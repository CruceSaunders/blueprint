// Auto-layout, content sizing, edge routing, layout warnings and the tidiness diagnosis for Blueprint visuals.
// Plain exported functions so the app can copy this file 1:1 (app/src/lib/layout.ts). No dependencies.
// Child positions are relative to their parent group (React Flow convention). Edge routes are absolute canvas coords.
//
// Layout model (symmetry first):
// - Every container (the canvas, or a group) has an `arrangement`: flow (ranked by ordering edges), stack (tiers),
//   row, column, ring, hub, tree, grid or free. Each one is deterministic and symmetric about the container's axis.
// - Sizes are multiples of 8; gaps are multiples of 8; centring may put a position on a 4px half-step.
// - Lines attach at the midpoint of a side, or at slots spread symmetrically around it when several share a side.
//   Lines of the same kind leaving (or entering) one side together share one port and split as a trunk.
// - Routes are straight when the ends line up, otherwise one elbow (L) or one jog (Z, two bends), or a C around the
//   outside gutter for back edges. A search router is only the fallback. Lines never cross a group they do not belong to.

export type LayoutDirection = "DOWN" | "RIGHT";
export type Arrangement = "flow" | "stack" | "row" | "column" | "ring" | "hub" | "tree" | "grid" | "free";
export const ARRANGEMENTS: Arrangement[] = ["flow", "stack", "row", "column", "ring", "hub", "tree", "grid", "free"];
export type Shape = "card" | "pill" | "circle" | "diamond" | "plain";
export const SHAPES: Shape[] = ["card", "pill", "circle", "diamond", "plain"];
export type Treatment = "frame" | "band" | "tint" | "bracket" | "none";
export const TREATMENTS: Treatment[] = ["frame", "band", "tint", "bracket", "none"];
export interface Art { svg?: string; html?: string; asset?: string; size?: "sm" | "md" | "lg" }
export interface XY { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }
export interface LNode {
  id: string; kind: string; parent?: string;
  position?: { x: number; y: number }; size?: { w: number; h: number };
  title?: string; subtitle?: string; caption?: string; icon?: string; state?: string; weight?: string; groupKind?: string;
  shape?: string; art?: Art; arrangement?: string; treatment?: string;
  [k: string]: unknown;
}
export interface LEdge {
  id: string; source: string; target: string; kind?: string; label?: string; both?: boolean;
  sourceHandle?: string; targetHandle?: string; route?: XY[];
  [k: string]: unknown;
}
/** Visual-level layout settings (stored on the visual as `arrangement` / `direction`). */
export interface LayoutOpts { arrangement?: string; direction?: LayoutDirection }

const G = 8;
const ceil8 = (v: number) => Math.ceil(v / G - 1e-9) * G;
const ceil16 = (v: number) => Math.ceil(v / 16 - 1e-9) * 16;
const half = (v: number) => Math.round(v * 2) / 2;

// ---------------------------------------------------------------- text measurement
// Deterministic estimate of the app font (SF Pro / system sans). Deliberately a little generous so text never clips.
const NARROW = new Set("ijlI.,:;'|!()[]{}tf/\\-`\"".split(""));
const WIDE = new Set("mwMW@%&".split(""));
function charW(c: string, px: number, bold: boolean) {
  let k = 0.56;
  if (c === " ") k = 0.29;
  else if (NARROW.has(c)) k = 0.33;
  else if (WIDE.has(c)) k = 0.86;
  else if (c >= "A" && c <= "Z") k = 0.68;
  else if (c >= "0" && c <= "9") k = 0.6;
  else if (c.charCodeAt(0) > 0x2000) k = 1.0;
  return k * px * (bold ? 1.07 : 1);
}
export function textWidth(s: string, px: number, bold = false): number {
  let w = 0;
  for (const c of s) w += charW(c, px, bold);
  return w * 1.04;
}
/** Number of lines `s` wraps to inside `maxW` pixels (greedy word wrap; long words break). */
export function wrapLines(s: string | undefined, px: number, maxW: number, bold = false): number {
  if (!s || !s.trim()) return 0;
  let lines = 0;
  for (const para of s.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines++; continue; }
    let cur = 0, n = 1;
    const sp = charW(" ", px, bold);
    for (const w of words) {
      const ww = textWidth(w, px, bold);
      if (ww > maxW) { if (cur > 0) n++; n += Math.ceil(ww / maxW) - 1; cur = ww % maxW; continue; }
      if (cur === 0) cur = ww;
      else if (cur + sp + ww <= maxW) cur += sp + ww;
      else { n++; cur = ww; }
    }
    lines += n;
  }
  return lines;
}

// ---------------------------------------------------------------- node sizes (shared with the app renderer)
/** Metrics the app renderer uses. Keep in sync with app/src/components/canvas/nodes.tsx. Widths are multiples of 16. */
export const CARD_METRICS = {
  sm: { w: 176, padX: 12, padY: 8, title: 12.5, sub: 11, icon: 28, gap: 12, border: 1 },
  md: { w: 224, padX: 16, padY: 12, title: 14, sub: 12, icon: 32, gap: 12, border: 1 },
  lg: { w: 256, padX: 16, padY: 16, title: 16, sub: 12.5, icon: 40, gap: 12, border: 1.5 },
} as const;
export const LH = 1.375; // leading-snug
export const NOTE_METRICS = { w: 208, padX: 12, padY: 10, px: 12.5 };
export const MEDIA_METRICS = { w: 256, art: 152, padX: 12, padY: 6, title: 12.5, caption: 11, lh: 1.4 };
/** Height of a card's own drawing (`art`) per art size. */
export const ART_H = { sm: 56, md: 96, lg: 136 } as const;
export const ART_GAP = 10;
export const OPERATOR_SIZE = 56;
/** Group header heights / paddings per treatment (multiples of 8). */
export const GROUP_METRICS = { padX: 24, padBottom: 24, kindPx: 10, titlePx: 13, bandPx: 11, minW: 224, minH: 120 };
const HEADER: Record<Treatment, [number, number]> = { frame: [48, 64], band: [40, 56], tint: [40, 56], bracket: [40, 56], none: [32, 48] };

/** Legacy defaults (kept for callers that only need a rough size). */
export const DEFAULT_SIZE: Record<string, { w: number; h: number }> = {
  card: { w: 224, h: 64 }, visual: { w: 256, h: 192 }, image: { w: 256, h: 192 },
  operator: { w: OPERATOR_SIZE, h: OPERATOR_SIZE }, note: { w: 208, h: 64 }, group: { w: 256, h: 160 },
};

export function artOf(n: LNode): Art | null {
  const a = n.art;
  return a && typeof a === "object" && (a.svg || a.html || a.asset) ? a : null;
}
export function shapeOf(n: LNode): Shape {
  return n.kind === "card" && SHAPES.includes(n.shape as Shape) ? (n.shape as Shape) : "card";
}
export function treatmentOf(n: LNode): Treatment {
  if (TREATMENTS.includes(n.treatment as Treatment)) return n.treatment as Treatment;
  return n.groupKind === "layer" ? "band" : n.groupKind === "group" || !n.groupKind ? "tint" : "frame";
}
const GROUP_KIND_LABEL: Record<string, string> = { group: "GROUP", layer: "LAYER", option: "OPTION", boundary: "BOUNDARY" };
/** Width of a group's header (label + title), measured from the frame's left edge. */
export function groupHeaderWidth(n: LNode): number {
  const t = treatmentOf(n), title = n.title ?? "Untitled";
  if (t === "band") return 16 + textWidth(title.toUpperCase(), GROUP_METRICS.bandPx, true) * 1.12 + 16;
  if (t !== "frame") return 16 + textWidth(title, GROUP_METRICS.titlePx, true) + 16;
  const kind = GROUP_KIND_LABEL[n.groupKind ?? "group"] ?? "GROUP";
  return 14 + textWidth(kind, GROUP_METRICS.kindPx, true) * 1.12 + 8 + textWidth(title, GROUP_METRICS.titlePx, true) + 14;
}
export function groupHeaderHeight(n: LNode): number { return HEADER[treatmentOf(n)][n.subtitle ? 1 : 0]; }

function cardText(n: LNode, m: { title: number; sub: number }, inner: number) {
  const t = Math.max(1, wrapLines(n.title || "Untitled", m.title, inner, true));
  const s = wrapLines(n.subtitle, m.sub, inner);
  return { t, s, h: t * m.title * LH + (s ? 2 + s * m.sub * LH : 0) };
}

/** Size a node needs for its content at a given width (or its natural width). One function for layout and renderer. */
export function contentSize(n: LNode, width?: number): { w: number; h: number } {
  switch (n.kind) {
    case "operator": return { w: OPERATOR_SIZE, h: OPERATOR_SIZE };
    case "note": {
      const m = NOTE_METRICS, w = width ?? m.w, inner = w - 2 * m.padX;
      const t = wrapLines(n.title, m.px, inner, true), s = wrapLines(n.subtitle, m.px, inner), c = wrapLines(n.caption, m.px, inner);
      const h = 2 * m.padY + (t + s + c) * m.px * LH + (s ? 2 : 0) + (c ? 4 : 0);
      return { w, h: ceil8(Math.max(56, h)) };
    }
    case "visual": case "image": {
      const m = MEDIA_METRICS, w = width ?? m.w, inner = w - 2 * m.padX - 2;
      const title = n.kind === "image" ? (n.caption || n.title) : n.title;
      const cap = n.kind === "visual" ? n.caption : undefined;
      const tl = wrapLines(title, n.kind === "image" ? 11.5 : m.title, inner, n.kind !== "image");
      const cl = wrapLines(cap, m.caption, inner);
      const footer = tl || cl ? 1 + 2 * m.padY + tl * (n.kind === "image" ? 11.5 : m.title) * m.lh + cl * m.caption * m.lh : 0;
      return { w, h: ceil8(2 + m.art + footer) };
    }
    case "group": return { w: Math.max(GROUP_METRICS.minW, ceil16(groupHeaderWidth(n) + 16)), h: GROUP_METRICS.minH };
    default: return cardSize(n, width);
  }
}

function cardSize(n: LNode, width?: number): { w: number; h: number } {
  const m = CARD_METRICS[(n.weight as "sm" | "md" | "lg") ?? "md"] ?? CARD_METRICS.md;
  const art = artOf(n), artH = art ? ART_H[art.size ?? "md"] ?? ART_H.md : 0;
  const shape = shapeOf(n);
  if (shape === "pill") {
    const iconW = n.icon ? 20 + 8 : 0;
    const tw = Math.max(textWidth(n.title || "Untitled", m.title, true), n.subtitle ? textWidth(n.subtitle, m.sub) : 0);
    const w = width ?? Math.min(288, Math.max(112, ceil16(tw + 40 + iconW + 2)));
    const tx = cardText(n, m, w - 40 - iconW);
    return { w, h: ceil8(Math.max(40, 20 + tx.h)) };
  }
  if (shape === "circle") {
    const top = art ? Math.min(artH, 56) : n.icon ? 24 : 0;
    let D = width ?? 96;
    for (; !width && D < 320; D += 16) {
      const tx = cardText(n, m, D * 0.66);
      if (tx.t <= 3 && top + (top ? 6 : 0) + tx.h <= D * 0.6) break;
    }
    return { w: D, h: D };
  }
  if (shape === "diamond") {
    let w = width ?? 160;
    for (; !width && w < 416; w += 16) {
      const tx = cardText(n, m, w * 0.5);
      if (tx.t <= 3 && tx.h <= ceil8(w * 0.6) * 0.42) break;
    }
    return { w, h: ceil8(w * 0.6) };
  }
  if (shape === "plain") {
    const topW = art ? artH * 1.5 : n.icon ? 40 : 0, topH = art ? artH : n.icon ? 40 : 0;
    const tw = Math.max(textWidth(n.title || "Untitled", m.title, true), n.subtitle ? textWidth(n.subtitle, m.sub) : 0);
    const w = width ?? ceil16(Math.max(topW, Math.min(192, tw + 12), 96));
    const tx = cardText(n, m, w - 8);
    return { w, h: ceil8(topH + (topH ? 8 : 0) + tx.h + 8) };
  }
  // rounded card
  if (art) {
    const w = width ?? (art.size === "lg" ? Math.max(256, m.w) : m.w);
    const tx = cardText(n, m, w - 2 * m.padX - 2 * m.border);
    return { w, h: ceil8(2 * m.padY + 2 * m.border + artH + ART_GAP + tx.h) };
  }
  const w = width ?? m.w;
  const inner = w - 2 * m.padX - 2 * m.border - (n.icon ? m.icon + m.gap : 0);
  const tx = cardText(n, m, inner);
  return { w, h: ceil8(2 * m.padY + 2 * m.border + Math.max(n.icon ? m.icon : 0, tx.h)) };
}
/** The size a node is drawn at: explicit `size` if set, else computed from its content. */
export const sizeOf = (n: LNode): { w: number; h: number } => n.size ?? contentSize(n);

// ---------------------------------------------------------------- hierarchy helpers
type Tree = { byId: Map<string, LNode>; kids: Map<string, LNode[]>; parentOf: (n: LNode) => string };
function tree(nodes: LNode[]): Tree {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parentOf = (n: LNode) => (n.parent && byId.get(n.parent)?.kind === "group" && n.parent !== n.id ? n.parent : "");
  const kids = new Map<string, LNode[]>();
  for (const n of nodes) { const p = parentOf(n); (kids.get(p) ?? kids.set(p, []).get(p)!).push(n); }
  return { byId, kids, parentOf };
}
function ancestors(id: string, t: Tree): string[] {
  const out: string[] = []; let cur = t.byId.get(id); let g = 0;
  while (cur && g++ < 100) { const p = t.parentOf(cur); if (!p) break; out.push(p); cur = t.byId.get(p); }
  return out;
}
/** Absolute bounding box of every node (canvas coordinates). */
export function absoluteBoxes(nodes: LNode[]): Map<string, Box> {
  const t = tree(nodes);
  const out = new Map<string, Box>();
  const get = (n: LNode, depth = 0): Box => {
    const have = out.get(n.id); if (have) return have;
    const s = sizeOf(n), p = t.parentOf(n);
    const base = p && depth < 100 ? get(t.byId.get(p)!, depth + 1) : { x: 0, y: 0 };
    const b = { x: base.x + (n.position?.x ?? 0), y: base.y + (n.position?.y ?? 0), w: s.w, h: s.h };
    out.set(n.id, b); return b;
  };
  nodes.forEach((n) => get(n));
  return out;
}
function depthOf(n: LNode, t: Tree) { return ancestors(n.id, t).length; }

// ---------------------------------------------------------------- group fit
/** Resize every group to wrap its children plus title room. Groups in `keep` keep their size as given.
 *  `exact` (fresh layout): snug fit with the children centred and equal left/right margins.
 *  Otherwise only grow, and only pull children in when they stick out (absolute positions are preserved). */
export function fitGroups(nodes: LNode[], keep: Set<string> = new Set(), exact = false, symmetric: Set<string> = new Set()): LNode[] {
  const out = nodes.map((n) => ({ ...n }));
  const t = tree(out);
  const groups = out.filter((n) => n.kind === "group").sort((a, b) => depthOf(b, t) - depthOf(a, t));
  for (const g of groups) {
    const kids = t.kids.get(g.id);
    if (!kids?.length) { if (!g.size) g.size = contentSize(g); continue; }
    if (keep.has(g.id) && g.size) continue;
    if (kids.some((k) => !k.position)) continue;
    const padX = GROUP_METRICS.padX, padT = groupHeaderHeight(g), padB = GROUP_METRICS.padBottom;
    let minX = Math.min(...kids.map((k) => k.position!.x)), maxX0 = Math.max(...kids.map((k) => k.position!.x + sizeOf(k).w));
    const minY = Math.min(...kids.map((k) => k.position!.y));
    // a ring or hub is centred on its own middle (x = 0 where it was placed), not on its uneven bounding box
    if (exact && symmetric.has(g.id)) { const e = Math.max(-minX, maxX0); minX = -e; maxX0 = e; }
    const headW = ceil16(groupHeaderWidth(g) + 16);
    if (exact) {
      // wide enough that the title stays left of the top midpoint, so a line can attach dead centre
      const cw = maxX0 - minX, W = ceil16(Math.max(cw + 2 * padX, headW, GROUP_METRICS.minW, 2 * (groupHeaderWidth(g) + 24)));
      const dx = (W - cw) / 2 - minX, dy = padT - minY;
      for (const k of kids) k.position = { x: half(k.position!.x + dx), y: half(k.position!.y + dy) };
      const gp = g.position ?? { x: 0, y: 0 };
      g.position = { x: half(gp.x - dx), y: half(gp.y - dy) };
      const maxY = Math.max(...kids.map((k) => k.position!.y + sizeOf(k).h));
      g.size = { w: W, h: ceil8(maxY + padB) };
      continue;
    }
    const dx = minX < padX ? padX - minX : 0, dy = minY < padT ? padT - minY : 0;
    if (dx || dy) {
      for (const k of kids) k.position = { x: half(k.position!.x + dx), y: half(k.position!.y + dy) };
      const gp = g.position ?? { x: 0, y: 0 };
      g.position = { x: half(gp.x - dx), y: half(gp.y - dy) };
    }
    const maxX = Math.max(...kids.map((k) => k.position!.x + sizeOf(k).w));
    const maxY = Math.max(...kids.map((k) => k.position!.y + sizeOf(k).h));
    const need = { w: Math.ceil(Math.max(maxX + padX, headW)), h: Math.ceil(maxY + padB) };
    g.size = !g.size ? need : { w: Math.max(g.size.w, need.w), h: Math.max(g.size.h, need.h) };
  }
  return out;
}

// ---------------------------------------------------------------- edge labels
/** Relationship kinds that decide order. Others (requires, equals, versus, relates) never reorder the diagram. */
export const ORDERING_KINDS = new Set(["flow", "becomes", "increases", "decreases", "blocks"]);
export const BADGE_KINDS: Record<string, string> = { increases: "+", decreases: "−", becomes: "⇒", equals: "=", versus: "vs" };
export const LABEL_MAX_W = 200;
/** Edge label + kind badge box. Along a horizontal stretch they sit side by side; along a vertical one they stack. */
export function labelBox(e: LEdge, vertical = false): { w: number; h: number } | null {
  const badge = e.kind ? BADGE_KINDS[e.kind] : undefined;
  if (!badge && !e.label) return null;
  const bw = badge ? (badge.length > 1 ? 30 : 22) : 0;
  const lw = e.label ? Math.ceil(Math.min(LABEL_MAX_W, textWidth(e.label, 11, true) + 16)) : 0;
  if (vertical) return { w: Math.max(bw, lw), h: (badge ? 22 : 0) + (badge && e.label ? 4 : 0) + (e.label ? 22 : 0) };
  return { w: bw + (badge && e.label ? 6 : 0) + lw, h: 22 };
}
/** Horizontal label box (kept for older callers). */
export function labelSize(e: LEdge): { w: number; h: number } | null { return labelBox(e, false); }

// ---------------------------------------------------------------- structure (graph only; shared by layout and tidiness)
interface CEdge { id: string; s: string; t: string; kind: string; lh: { w: number; h: number } | null; lv: { w: number; h: number } | null }
interface Structure {
  arr: Arrangement; down: boolean;
  ranks: string[][];                 // flow: rank members incl. virtual lanes (ids starting "~v")
  dagSucc: Map<string, string[]>; dagPred: Map<string, string[]>;
  satOf: Map<string, string[]>; satellite: Map<string, string>;
  gutter: Map<string, { from: string[]; to: string[] }>;
  line: string[];                    // row/column/stack/grid/ring order
  hub: string | null;
  treeKids: Map<string, string[]>; roots: string[];
  spine: Set<string>;                // flow: the longest chain, drawn dead straight on the axis
}
const isVirtual = (id: string) => id.startsWith("~v");

/** The arrangement a container uses: its own (group) or the visual's (canvas), else a default from its content. */
export function containerArrangement(group: LNode | null, kids: LNode[], cEdges: { s: string; t: string; kind: string }[], opts: LayoutOpts): Arrangement {
  const own = group ? group.arrangement : opts.arrangement;
  if (ARRANGEMENTS.includes(own as Arrangement)) return own as Arrangement;
  const bands = kids.filter((k) => k.kind === "group" && k.groupKind === "layer").length;
  if (bands >= 2) return "flow";
  if (cEdges.some((e) => ORDERING_KINDS.has(e.kind))) return "flow";
  if (kids.length <= 5) return (opts.direction ?? "DOWN") === "DOWN" ? "row" : "column";
  return "grid";
}

function structure(kids: LNode[], cEdges: CEdge[], arr: Arrangement, dir: LayoutDirection): Structure {
  const ids = kids.map((k) => k.id), order = new Map(ids.map((id, i) => [id, i]));
  const S: Structure = { arr, down: dir === "DOWN", ranks: [], dagSucc: new Map(), dagPred: new Map(), satOf: new Map(), satellite: new Map(), gutter: new Map(), line: [], hub: null, treeKids: new Map(), roots: [], spine: new Set() };
  const ordering = cEdges.filter((e) => ORDERING_KINDS.has(e.kind) && order.has(e.s) && order.has(e.t) && e.s !== e.t);
  // DAG in model order: bands chained first (flow/stack), then ordering edges that do not close a cycle.
  const adj = new Map<string, Set<string>>(ids.map((id) => [id, new Set()]));
  const reach = (a: string, b: string) => { const seen = new Set<string>(); const st = [a]; while (st.length) { const x = st.pop()!; if (x === b) return true; if (seen.has(x)) continue; seen.add(x); adj.get(x)?.forEach((y) => st.push(y)); } return false; };
  const bands = kids.filter((k) => k.kind === "group" && k.groupKind === "layer").map((k) => k.id);
  const chain = new Set<string>();
  if (arr === "flow") for (let i = 1; i < bands.length; i++) { adj.get(bands[i - 1])!.add(bands[i]); chain.add(`${bands[i - 1]}>${bands[i]}`); }
  const back: CEdge[] = [];
  for (const e of ordering) { if (adj.get(e.s)!.has(e.t)) continue; if (reach(e.t, e.s)) back.push(e); else adj.get(e.s)!.add(e.t); }
  const topo = (subset: string[]) => {
    const set = new Set(subset), indeg = new Map(subset.map((id) => [id, 0]));
    adj.forEach((ys, x) => { if (set.has(x)) ys.forEach((y) => set.has(y) && indeg.set(y, indeg.get(y)! + 1)); });
    const out: string[] = [], ready = subset.filter((id) => !indeg.get(id));
    while (ready.length) { ready.sort((a, b) => order.get(a)! - order.get(b)!); const x = ready.shift()!; out.push(x); adj.get(x)!.forEach((y) => { if (!set.has(y)) return; indeg.set(y, indeg.get(y)! - 1); if (!indeg.get(y)) ready.push(y); }); }
    for (const id of subset) if (!out.includes(id)) out.push(id);
    return out;
  };

  if (arr === "row" || arr === "column" || arr === "grid" || arr === "ring" || arr === "stack" || arr === "free") {
    S.line = arr === "stack" ? [...ids] : topo(ids);
    if (arr === "ring") S.line = ringOrder(ids, ordering);
    return S;
  }
  if (arr === "hub") {
    const deg = new Map(ids.map((id) => [id, 0]));
    for (const e of cEdges) { if (deg.has(e.s)) deg.set(e.s, deg.get(e.s)! + 1); if (deg.has(e.t)) deg.set(e.t, deg.get(e.t)! + 1); }
    S.hub = ids.reduce<string | null>((best, id) => (best === null || deg.get(id)! > deg.get(best)! ? id : best), null);
    S.line = ids.filter((id) => id !== S.hub);
    return S;
  }
  // flow / tree: satellites (only non-ordering ties to a ranked node) sit beside their partner.
  const touched = new Set<string>(bands);
  for (const e of ordering) { touched.add(e.s); touched.add(e.t); }
  for (const e of cEdges) {
    if (ORDERING_KINDS.has(e.kind) || !order.has(e.s) || !order.has(e.t)) continue;
    const [sat, partner] = !touched.has(e.s) && touched.has(e.t) ? [e.s, e.t] : !touched.has(e.t) && touched.has(e.s) ? [e.t, e.s] : [null, null];
    if (!sat || !partner || S.satellite.has(sat)) continue;
    S.satellite.set(sat, partner); (S.satOf.get(partner) ?? S.satOf.set(partner, []).get(partner)!).push(sat);
  }
  // gutter: a node whose only way out is back up the flow (a feedback step) sits in the outer gutter beside the flow.
  if (arr === "flow") for (const id of ids) {
    if (bands.includes(id) || S.satellite.has(id)) continue;
    const outs = back.filter((e) => e.s === id), fwdOut = [...adj.get(id)!];
    const ins = ids.filter((x) => adj.get(x)!.has(id));
    if (outs.length && !fwdOut.length && ins.length && !S.satOf.has(id)) S.gutter.set(id, { from: ins, to: outs.map((e) => e.t) });
  }
  const ranked = ids.filter((id) => !S.satellite.has(id) && !S.gutter.has(id));
  const rset = new Set(ranked);
  const succ = (x: string) => [...adj.get(x)!].filter((y) => rset.has(y));
  const pred = (x: string) => ranked.filter((y) => adj.get(y)!.has(x));
  if (arr === "tree") {
    for (const x of topo(ranked)) for (const y of succ(x)) if (![...S.treeKids.values()].some((l) => l.includes(y))) (S.treeKids.get(x) ?? S.treeKids.set(x, []).get(x)!).push(y);
    const kidSet = new Set([...S.treeKids.values()].flat());
    S.roots = topo(ranked).filter((x) => !kidSet.has(x));
    return S;
  }
  // longest-path ranks, then sources pulled down next to their first consumer
  const rank = new Map<string, number>();
  for (const x of topo(ranked)) rank.set(x, Math.max(0, ...pred(x).map((p) => rank.get(p)! + 1)));
  for (const x of topo(ranked).reverse()) {
    if (bands.includes(x) || pred(x).length || !succ(x).length) continue;
    rank.set(x, Math.min(...succ(x).map((y) => rank.get(y)!)) - 1);
  }
  const R = Math.max(-1, ...rank.values()) + 1;
  S.ranks = Array.from({ length: R }, () => []);
  for (const x of ranked) S.ranks[rank.get(x)!].push(x);
  for (const x of ranked) { S.dagSucc.set(x, []); S.dagPred.set(x, []); }
  // spine: the longest chain through the ranks (ties: earliest added), kept on the axis
  {
    const len = new Map<string, number>(), from = new Map<string, string>();
    for (const x of topo(ranked)) {
      let best: string | undefined;
      for (const p of pred(x)) if (best === undefined || len.get(p)! > len.get(best)! || (len.get(p) === len.get(best) && order.get(p)! < order.get(best)!)) best = p;
      len.set(x, (best ? len.get(best)! : 0) + 1); if (best) from.set(x, best);
    }
    let end: string | undefined;
    for (const x of ranked) if (end === undefined || len.get(x)! > len.get(end)!) end = x;
    for (let x = end; x; x = from.get(x)) S.spine.add(x);
    if (S.spine.size < 2) S.spine.clear();
  }
  // Long edges get no lanes (lanes would push ranks off their axis); the router takes them straight or round the outside.
  for (const x of ranked) for (const y of succ(x)) { S.dagSucc.get(x)!.push(y); S.dagPred.get(y)!.push(x); }
  return S;
}

function ringOrder(ids: string[], ordering: CEdge[]): string[] {
  const out: string[] = [], seen = new Set<string>();
  let cur: string | undefined = ids[0];
  while (cur && !seen.has(cur)) {
    out.push(cur); seen.add(cur);
    const c: string = cur;
    cur = ordering.filter((e) => e.s === c && !seen.has(e.t)).map((e) => e.t).sort((a, b) => ids.indexOf(a) - ids.indexOf(b))[0];
  }
  for (const id of ids) if (!seen.has(id)) out.push(id);
  return out;
}

// ---------------------------------------------------------------- placement per arrangement
interface Ctx { sz: (id: string) => { w: number; h: number }; byId: Map<string, LNode>; kidsOf: Map<string, LNode[]>; pull: (id: string) => number }
const NODE_GAP = 48;

function lineGap(cEdges: CEdge[], members: Set<string>, horiz: boolean) {
  let g = NODE_GAP;
  for (const e of cEdges) if (members.has(e.s) && members.has(e.t)) {
    const l = horiz ? e.lh : e.lv;
    g = Math.max(g, l ? ceil16((horiz ? l.w : l.h) + 48) : 64);
  }
  return g;
}
function rankGap(cEdges: CEdge[], down: boolean, only?: (e: CEdge) => boolean) {
  let g = 80;
  for (const e of cEdges) {
    const l = down ? e.lv : e.lh; if (!l || (only && !only(e))) continue;
    // a fan (several same-kind lines from one node or into one) splits half-way: each branch's label needs half the gap
    const fan = cEdges.some((o) => o !== e && o.kind === e.kind && (o.s === e.s || o.t === e.t));
    const need = (down ? l.h : l.w) + 48;
    g = Math.max(g, ceil16(fan ? 2 * need - 16 : need));
  }
  return g;
}

function place(kids: LNode[], cEdges: CEdge[], S: Structure, ctx: Ctx): Map<string, XY> {
  const pos = new Map<string, XY>();
  const sz = ctx.sz;
  const lineAt = (ids: string[], horiz: boolean, gap: number, cross = 0) => { // centred at 0 on the main line
    const total = ids.reduce((a, id) => a + (horiz ? sz(id).w : sz(id).h), 0) + gap * Math.max(0, ids.length - 1);
    let at = -total / 2;
    for (const id of ids) { const s = sz(id); pos.set(id, horiz ? { x: at, y: cross - s.h / 2 } : { x: cross - s.w / 2, y: at }); at += (horiz ? s.w : s.h) + gap; }
  };
  const withPull = (ids: string[]) => [...ids].sort((a, b) => ctx.pull(a) - ctx.pull(b) || ids.indexOf(a) - ids.indexOf(b));
  switch (S.arr) {
    case "free": case "row": case "column": {
      const horiz = S.arr === "row" || (S.arr === "free" && S.down);
      const ids = withPull(S.line);
      lineAt(ids, horiz, lineGap(cEdges, new Set(ids), horiz));
      return pos;
    }
    case "stack": {
      equaliseBands(kids, ctx, S.down);
      lineAt(S.line, !S.down, rankGap(cEdges, S.down));
      return pos;
    }
    case "grid": {
      const ids = withPull(S.line), n = ids.length;
      const cols = n <= 4 ? n : n <= 9 ? 3 : 4;
      const cw = Math.max(...ids.map((id) => sz(id).w)), ch = Math.max(...ids.map((id) => sz(id).h));
      for (let r = 0; r * cols < n; r++) {
        const row = ids.slice(r * cols, r * cols + cols), tot = row.length * cw + (row.length - 1) * NODE_GAP;
        row.forEach((id, i) => { const s = sz(id); pos.set(id, { x: -tot / 2 + i * (cw + NODE_GAP) + (cw - s.w) / 2, y: r * (ch + NODE_GAP) + (ch - s.h) / 2 }); });
      }
      return pos;
    }
    case "ring": {
      const ids = S.line, n = ids.length;
      if (n === 1) { const s = sz(ids[0]); pos.set(ids[0], { x: -s.w / 2, y: -s.h / 2 }); return pos; }
      const W = Math.max(...ids.map((id) => sz(id).w)), H = Math.max(...ids.map((id) => sz(id).h));
      const lab = Math.max(0, ...cEdges.map((e) => e.lh?.w ?? 0));
      const ang = ids.map((_, i) => (n === 2 ? (i === 0 ? Math.PI : 0) : -Math.PI / 2 + (2 * Math.PI * i) / n));
      for (let k = 1.2; k < 12; k += 0.1) {
        const rx = ceil8(W * 0.5 * k + lab * 0.25), ry = ceil8(Math.max(H * 0.5 * k, rx * 0.55));
        const boxes = ids.map((id, i) => { const s = sz(id); return { x: rx * Math.cos(ang[i]) - s.w / 2, y: ry * Math.sin(ang[i]) - s.h / 2, w: s.w, h: s.h }; });
        let ok = true;
        for (let i = 0; i < n && ok; i++) for (let j = i + 1; j < n && ok; j++) if (overlaps(inflate(boxes[i], 56), boxes[j])) ok = false;
        if (ok || k > 11.8) { ids.forEach((id, i) => pos.set(id, { x: half(boxes[i].x), y: half(boxes[i].y) })); break; }
      }
      return pos;
    }
    case "hub": {
      const hub = S.hub!, hs = sz(hub), spokes = S.line, n = spokes.length;
      pos.set(hub, { x: -hs.w / 2, y: -hs.h / 2 });
      if (!n) return pos;
      const lab = (a: string) => cEdges.filter((e) => (e.s === a && e.t === hub) || (e.t === a && e.s === hub));
      const gx = Math.max(96, ...spokes.flatMap((a) => lab(a).map((e) => ceil16((e.lh?.w ?? 0) + 64))));
      const gy = Math.max(80, ...spokes.flatMap((a) => lab(a).map((e) => ceil16((e.lv?.h ?? 0) + 48))));
      const put = (id: string, cx: number, cy: number) => { const s = sz(id); pos.set(id, { x: half(cx - s.w / 2), y: half(cy - s.h / 2) }); };
      const W = Math.max(...spokes.map((id) => sz(id).w)), H = Math.max(...spokes.map((id) => sz(id).h));
      let rest = [...spokes], top: string | undefined, bottom: string | undefined;
      if (n === 3 || (n % 2 === 1 && n >= 5)) top = rest.pop();
      if (n === 4) { top = rest[2]; bottom = rest[3]; rest = rest.slice(0, 2); }
      const left = rest.filter((_, i) => i % 2 === 1), right = rest.filter((_, i) => i % 2 === 0);
      const column = (list: string[], cx: number) => {
        const tot = list.length * H + (list.length - 1) * 32;
        list.forEach((id, i) => put(id, cx, -tot / 2 + i * (H + 32) + H / 2));
      };
      column(right, hs.w / 2 + gx + W / 2);
      column(left, -(hs.w / 2 + gx + W / 2));
      if (top) put(top, 0, -(hs.h / 2 + gy + sz(top).h / 2));
      if (bottom) put(bottom, 0, hs.h / 2 + gy + sz(bottom).h / 2);
      return pos;
    }
    case "tree": return placeTree(S, cEdges, ctx, pos);
    default: return placeFlow(kids, cEdges, S, ctx, pos);
  }
}

function equaliseBands(kids: LNode[], ctx: Ctx, down: boolean) {
  const bands = kids.filter((k) => k.kind === "group" && k.groupKind === "layer");
  if (bands.length < 2) return;
  const full = Math.max(...bands.map((b) => (down ? sizeOf(b).w : sizeOf(b).h)));
  for (const b of bands) {
    const old = sizeOf(b), extra = full - (down ? old.w : old.h);
    if (extra <= 0) continue;
    b.size = down ? { w: full, h: old.h } : { w: old.w, h: full };
    for (const c of ctx.kidsOf.get(b.id) ?? []) if (c.position)
      c.position = down ? { x: half(c.position.x + extra / 2), y: c.position.y } : { x: c.position.x, y: half(c.position.y + extra / 2) };
  }
  alignBandColumns(bands, ctx, down);
}

/** The row of parts inside each band, if its parts sit on one line across the band (else null). */
function bandRow(b: LNode, kidsOf: Map<string, LNode[]>, down: boolean): LNode[] | null {
  const ks = (kidsOf.get(b.id) ?? []).filter((k) => k.position);
  if (ks.length < 1 || ks.some((k) => k.kind === "group")) return null;
  const mid = (k: LNode) => (down ? k.position!.y + sizeOf(k).h / 2 : k.position!.x + sizeOf(k).w / 2);
  if (ks.some((k) => Math.abs(mid(k) - mid(ks[0])) > 1)) return null;
  return [...ks].sort((a, c) => (down ? a.position!.x - c.position!.x : a.position!.y - c.position!.y));
}
/** Column centres a tier's row should use: the widest row's own centres when it has as many parts, else evenly
 *  spread over the widest row's span (centres relative to the band's middle). Null when there is nothing to match. */
function bandColumns(rows: { b: LNode; row: LNode[] }[], down: boolean) {
  const cc = (k: LNode) => (down ? k.position!.x + sizeOf(k).w / 2 : k.position!.y + sizeOf(k).h / 2);
  const bandMid = (b: LNode) => (down ? sizeOf(b).w : sizeOf(b).h) / 2;
  const span = (r: { b: LNode; row: LNode[] }) => { const a = r.row[0], z = r.row[r.row.length - 1]; return (down ? z.position!.x + sizeOf(z).w - a.position!.x : z.position!.y + sizeOf(z).h - a.position!.y); };
  const ref = rows.reduce((p, q) => (span(q) > span(p) || (span(q) === span(p) && q.row.length > p.row.length) ? q : p));
  const refC = ref.row.map((k) => cc(k) - bandMid(ref.b));
  return (n: number): number[] => n === refC.length ? refC
    : n === 1 ? [0] : Array.from({ length: n }, (_, i) => refC[0] + (i * (refC[refC.length - 1] - refC[0])) / (n - 1));
}
/** Tiers of a stack line up: a tier's row takes the column grid of the widest tier (same count) or spreads evenly
 *  across its span (other counts), as long as nothing overlaps. */
function alignBandColumns(bands: LNode[], ctx: Ctx, down: boolean) {
  const rows = bands.map((b) => ({ b, row: bandRow(b, ctx.kidsOf, down) })).filter((r): r is { b: LNode; row: LNode[] } => !!r.row);
  if (rows.length < 2) return;
  const cols = bandColumns(rows, down);
  for (const { b, row } of rows) {
    const target = cols(row.length), mid = (down ? sizeOf(b).w : sizeOf(b).h) / 2, len = (k: LNode) => (down ? sizeOf(k).w : sizeOf(k).h);
    const lo = row.map((k, i) => mid + target[i] - len(k) / 2);
    const fits = lo[0] >= GROUP_METRICS.padX - 0.5 && lo[lo.length - 1] + len(row[row.length - 1]) <= 2 * mid - GROUP_METRICS.padX + 0.5
      && row.every((k, i) => !i || lo[i] - (lo[i - 1] + len(row[i - 1])) >= 24);
    if (!fits) continue;
    row.forEach((k, i) => { k.position = down ? { x: half(lo[i]), y: k.position!.y } : { x: k.position!.x, y: half(lo[i]) }; });
  }
}

/** Parts in one row share one height (per shape; a part with its own drawing keeps its own). Only ever grows. */
function evenRowHeights(kids: LNode[], horiz: boolean) {
  const byShape = new Map<string, LNode[]>();
  for (const k of kids) if (k.kind === "card" && !artOf(k) && shapeOf(k) !== "circle" && shapeOf(k) !== "diamond") (byShape.get(shapeOf(k)) ?? byShape.set(shapeOf(k), []).get(shapeOf(k))!).push(k);
  for (const list of byShape.values()) {
    if (list.length < 2) continue;
    const H = Math.max(...list.map((k) => (horiz ? sizeOf(k).h : sizeOf(k).w)));
    for (const k of list) { const s = sizeOf(k); if ((horiz ? s.h : s.w) < H) k.size = horiz ? { w: s.w, h: H } : { w: H, h: s.h }; }
  }
}

function placeTree(S: Structure, cEdges: CEdge[], ctx: Ctx, pos: Map<string, XY>): Map<string, XY> {
  // layout space: main axis = depth, cross = breadth
  const d = (id: string) => { const s = ctx.sz(id); return S.down ? s : { w: s.h, h: s.w }; };
  const gap = rankGap(cEdges, S.down);
  const depth = new Map<string, number>(), levelH: number[] = [];
  const walk = (id: string, l: number) => { depth.set(id, l); levelH[l] = Math.max(levelH[l] ?? 0, d(id).h); for (const c of S.treeKids.get(id) ?? []) walk(c, l + 1); };
  S.roots.forEach((r) => walk(r, 0));
  const width = new Map<string, number>();
  const wOf = (id: string): number => { const kids = S.treeKids.get(id) ?? []; const kw = kids.reduce((a, c) => a + wOf(c), 0) + NODE_GAP * Math.max(0, kids.length - 1); const w = Math.max(d(id).w, kw); width.set(id, w); return w; };
  const total = S.roots.reduce((a, r) => a + wOf(r), 0) + NODE_GAP * Math.max(0, S.roots.length - 1);
  const levelY: number[] = []; let acc = 0;
  for (let l = 0; l < levelH.length; l++) { levelY[l] = acc; acc += (levelH[l] ?? 0) + gap; }
  const center = new Map<string, number>();
  const putAt = (id: string, left: number) => {
    const kids = S.treeKids.get(id) ?? [];
    const kw = kids.reduce((a, c) => a + width.get(c)!, 0) + NODE_GAP * Math.max(0, kids.length - 1);
    let at = left + (width.get(id)! - kw) / 2;
    for (const c of kids) { putAt(c, at); at += width.get(c)! + NODE_GAP; }
    const c = kids.length ? (center.get(kids[0])! + center.get(kids[kids.length - 1])!) / 2 : left + width.get(id)! / 2;
    center.set(id, c);
  };
  let at = -total / 2;
  for (const r of S.roots) { putAt(r, at); at += width.get(r)! + NODE_GAP; }
  for (const [id, c] of center) {
    const s = d(id), l = depth.get(id)!, y = levelY[l] + ((levelH[l] ?? 0) - s.h) / 2;
    const lx = half(c - s.w / 2), ly = half(y);
    pos.set(id, S.down ? { x: lx, y: ly } : { x: ly, y: lx });
  }
  placeSatellites(S, cEdges, ctx, pos);
  return pos;
}

function satGap(cEdges: CEdge[], a: string, b: string, down: boolean) {
  let g = NODE_GAP;
  for (const e of cEdges) if ((e.s === a && e.t === b) || (e.s === b && e.t === a)) { const l = down ? e.lh : e.lv; g = Math.max(g, l ? ceil16((down ? l.w : l.h) + 40) : 64); }
  return g;
}
/** Satellites of already-placed partners (tree): right, then left, mirrored. */
function placeSatellites(S: Structure, cEdges: CEdge[], ctx: Ctx, pos: Map<string, XY>) {
  for (const [p, sats] of S.satOf) {
    const pp = pos.get(p); if (!pp) continue;
    const ps = ctx.sz(p);
    let r = S.down ? pp.x + ps.w : pp.y + ps.h, l = S.down ? pp.x : pp.y;
    sats.forEach((s, i) => {
      const ss = ctx.sz(s), g = satGap(cEdges, s, p, S.down);
      if (S.down) { const x = i % 2 === 0 ? r + g : l - g - ss.w; pos.set(s, { x, y: half(pp.y + (ps.h - ss.h) / 2) }); if (i % 2 === 0) r = x + ss.w; else l = x; }
      else { const y = i % 2 === 0 ? r + g : l - g - ss.h; pos.set(s, { x: half(pp.x + (ps.w - ss.w) / 2), y }); if (i % 2 === 0) r = y + ss.h; else l = y; }
    });
  }
}

/** Cluster = a rank member plus its satellites, mirrored so the member stays at the cluster's centre. */
function clusterOf(id: string, S: Structure, cEdges: CEdge[], d: (id: string) => { w: number; h: number }) {
  const sats = S.satOf.get(id) ?? [];
  const w = isVirtual(id) ? 8 : d(id).w;
  let right = 0, left = 0;
  const offs: { id: string; dx: number }[] = [];
  sats.forEach((s, i) => {
    const g = satGap(cEdges, s, id, S.down), sw = d(s).w;
    if (i % 2 === 0) { offs.push({ id: s, dx: w / 2 + right + g + sw / 2 }); right += g + sw; }
    else { offs.push({ id: s, dx: -(w / 2 + left + g + sw / 2) }); left += g + sw; }
  });
  const halfW = w / 2 + Math.max(left, right);
  return { halfW, offs };
}

function placeFlow(kids: LNode[], cEdges: CEdge[], S: Structure, ctx: Ctx, pos: Map<string, XY>): Map<string, XY> {
  equaliseBands(kids, ctx, S.down);
  const d = (id: string) => { if (isVirtual(id)) return { w: 8, h: 0 }; const s = ctx.sz(id); return S.down ? s : { w: s.h, h: s.w }; };
  const order = new Map(kids.map((k, i) => [k.id, i]));
  const src = (v: string) => (isVirtual(v) ? v.slice(2).split(">")[0] : v);
  const ranks = S.ranks.map((r) => [...r].sort((a, b) => (order.get(src(a))! - order.get(src(b))!) || (a < b ? -1 : 1)));
  // barycenter sweeps; nodes tied to the gutter drift to the outer end of their rank
  const idx = new Map<string, number>();
  const reindex = () => ranks.forEach((r) => r.forEach((id, i) => idx.set(id, i)));
  reindex();
  const bary = (id: string, nb: string[]) => (nb.length ? nb.reduce((a, x) => a + idx.get(x)!, 0) / nb.length : idx.get(id)!);
  for (let it = 0; it < 6; it++) {
    const downSweep = it % 2 === 0;
    const seq = downSweep ? ranks.map((_, i) => i).slice(1) : ranks.map((_, i) => i).reverse().slice(1);
    for (const r of seq) {
      const key = new Map(ranks[r].map((id) => [id, bary(id, (downSweep ? S.dagPred.get(id) : S.dagSucc.get(id)) ?? []) + (isVirtual(id) ? 0 : ctx.pull(id) * 1000)]));
      ranks[r].sort((a, b) => key.get(a)! - key.get(b)! || idx.get(a)! - idx.get(b)!);
      reindex();
    }
  }
  // one rhythm for every gap; a gap that a labelled fan splits across gets the extra room it needs
  const rankOf = new Map<string, number>(); ranks.forEach((r, i) => r.forEach((id) => rankOf.set(id, i)));
  const isFan = (e: CEdge) => cEdges.some((o) => o !== e && o.kind === e.kind && (o.s === e.s || o.t === e.t));
  const base = rankGap(cEdges.filter((e) => !isFan(e)), S.down);
  const gapAfter = (ri: number) => Math.max(base, rankGap(cEdges, S.down, (e) => isFan(e) && rankOf.get(e.s) === ri && rankOf.get(e.t) === ri + 1));
  let main = 0;
  for (const [ri, r] of ranks.entries()) {
    if (!r.length) continue;
    const gap = gapAfter(ri);
    const cl = r.map((id) => ({ id, ...clusterOf(id, S, cEdges, d) }));
    const rankH = Math.max(...r.map((id) => d(id).h), ...r.flatMap((id) => (S.satOf.get(id) ?? []).map((s) => d(s).h)));
    const put = (id: string, x: number) => { const s = d(id); pos.set(id, { x: half(x - s.w / 2), y: half(main + (rankH - s.h) / 2) }); };
    const place = (c: typeof cl[number], cx: number) => { put(c.id, cx); for (const o of c.offs) put(o.id, cx + o.dx); };
    const si = cl.findIndex((c) => S.spine.has(c.id));
    if (si >= 0) { // the spine node stays on the axis; the rest of the rank spreads out from it, keeping its order
      place(cl[si], 0);
      let at = cl[si].halfW + NODE_GAP;
      for (const c of cl.slice(si + 1)) { place(c, at + c.halfW); at += 2 * c.halfW + NODE_GAP; }
      at = -cl[si].halfW - NODE_GAP;
      for (const c of cl.slice(0, si).reverse()) { place(c, at - c.halfW); at -= 2 * c.halfW + NODE_GAP; }
    } else {
      const total = cl.reduce((a, c) => a + 2 * c.halfW, 0) + NODE_GAP * (cl.length - 1);
      let at = -total / 2;
      for (const c of cl) { place(c, at + c.halfW); at += 2 * c.halfW + NODE_GAP; }
    }
    main += rankH + gap;
  }
  // gutter: beside the flow, vertically between the steps it connects
  const edge = Math.max(0, ...[...pos].filter(([id]) => !isVirtual(id)).map(([id, p]) => p.x + d(id).w));
  const placedG: Box[] = [];
  for (const [g, { from, to }] of S.gutter) {
    const s = d(g);
    const centres = [...from, ...to].filter((x) => pos.has(x)).map((x) => pos.get(x)!.y + d(x).h / 2);
    const cy = centres.length ? (Math.min(...centres) + Math.max(...centres)) / 2 : 0;
    const lab = Math.max(0, ...cEdges.filter((e) => e.s === g || e.t === g).map((e) => (S.down ? e.lh?.w : e.lv?.h) ?? 0));
    let b = { x: edge + ceil16(64 + lab), y: half(cy - s.h / 2), w: s.w, h: s.h };
    while (placedG.some((o) => overlaps(inflate(o, 24), b))) b = { ...b, x: b.x + s.w + NODE_GAP };
    placedG.push(b); pos.set(g, { x: b.x, y: b.y });
  }
  for (const id of [...pos.keys()]) if (isVirtual(id)) pos.delete(id);
  if (!S.down) for (const [id, p] of pos) pos.set(id, { x: p.y, y: p.x });
  return pos;
}

// ---------------------------------------------------------------- layout driver
function liftEdges(nodes: LNode[], edges: LEdge[], t: Tree, dir: LayoutDirection) {
  const lifted = new Map<string, CEdge[]>();
  for (const e of edges) {
    if (!t.byId.has(e.source) || !t.byId.has(e.target) || e.source === e.target) continue;
    const pa = [e.source, ...ancestors(e.source, t)], pb = [e.target, ...ancestors(e.target, t)];
    const common = pa.find((x) => pb.includes(x) && x !== e.source && x !== e.target) ?? (pb.includes(e.source) || pa.includes(e.target) ? null : "");
    if (common === null) continue;
    const ia = pa.indexOf(common), ib = pb.indexOf(common);
    const s = common === "" ? pa[pa.length - 1] : pa[ia - 1];
    const tt = common === "" ? pb[pb.length - 1] : pb[ib - 1];
    if (!s || !tt || s === tt) continue;
    (lifted.get(common) ?? lifted.set(common, []).get(common)!).push({ id: e.id, s, t: tt, kind: e.kind ?? "relates", lh: labelBox(e, false), lv: labelBox(e, true) });
  }
  void nodes; void dir;
  return lifted;
}

/** Structures of every container (graph only). */
function allStructures(nodes: LNode[], edges: LEdge[], opts: LayoutOpts) {
  const t = tree(nodes), dir = opts.direction ?? "DOWN";
  const lifted = liftEdges(nodes, edges, t, dir);
  const out = new Map<string, { S: Structure; kids: LNode[]; cEdges: CEdge[] }>();
  for (const cid of ["", ...nodes.filter((n) => n.kind === "group").map((n) => n.id)]) {
    const kids = t.kids.get(cid) ?? [];
    if (!kids.length) continue;
    const cEdges = lifted.get(cid) ?? [];
    const arr = containerArrangement(cid ? t.byId.get(cid)! : null, kids, cEdges, opts);
    out.set(cid, { S: structure(kids, cEdges, arr, dir), kids, cEdges });
  }
  return { t, out };
}

/**
 * Returns a new node array with positions and group sizes filled in.
 * Nodes lacking `position` are placed; with relayout:true every node is re-placed; `replace` re-places those ids.
 * Hand-placed siblings keep their position; new siblings are placed beside them without overlap.
 */
export async function layoutNodes(
  nodes: LNode[], edges: LEdge[],
  opts: LayoutOpts & { relayout?: boolean; replace?: Set<string> } = {},
): Promise<LNode[]> {
  return layoutNodesSync(nodes, edges, opts);
}
export function layoutNodesSync(nodes: LNode[], edges: LEdge[], opts: LayoutOpts & { relayout?: boolean; replace?: Set<string> } = {}): LNode[] {
  const relayout = !!opts.relayout;
  const out: LNode[] = nodes.map((n) => ({ ...n }));
  const replace = opts.replace ?? new Set<string>();
  if (!relayout && !replace.size && out.every((n) => n.position)) return out;
  const wasPlaced = new Set(nodes.filter((n) => n.position && !replace.has(n.id)).map((n) => n.id));
  const isNew = (n: LNode) => relayout || !wasPlaced.has(n.id);
  const { t, out: structs } = allStructures(out, edges, opts);
  // nodes linked to a gutter node (in any container) are pulled to the outer end of their row
  const gutterIds = new Set<string>();
  structs.forEach(({ S }) => S.gutter.forEach((_, id) => gutterIds.add(id)));
  const desc = (id: string): string[] => (t.kids.get(id) ?? []).flatMap((k) => [k.id, ...desc(k.id)]);
  const gutterAll = new Set([...gutterIds].flatMap((g) => [g, ...desc(g)]));
  const pull = (id: string) => {
    const mine = new Set([id, ...desc(id)]);
    return edges.some((e) => (mine.has(e.source) && gutterAll.has(e.target) && !mine.has(e.target)) || (mine.has(e.target) && gutterAll.has(e.source) && !mine.has(e.source))) && !gutterIds.has(id) ? 1 : 0;
  };
  const ctx: Ctx = { sz: (id) => sizeOf(t.byId.get(id)!), byId: t.byId, kidsOf: t.kids, pull };
  const containers = [...out.filter((n) => n.kind === "group").sort((a, b) => depthOf(b, t) - depthOf(a, t)).map((g) => g.id), ""];
  for (const cid of containers) {
    const kids = t.kids.get(cid) ?? [];
    if (!kids.length) continue;
    const { S, cEdges } = structs.get(cid)!;
    const fresh = kids.filter(isNew), pinned = kids.filter((k) => !isNew(k));
    if (fresh.length && S.arr !== "free") {
      if (S.arr === "row" && !pinned.length) evenRowHeights(kids, true);
      const proposed = place(kids, cEdges, S, ctx);
      if (!pinned.length) {
        for (const k of kids) { const p = proposed.get(k.id) ?? { x: 0, y: 0 }; k.position = { x: half(p.x), y: half(p.y) }; }
      } else {
        const pb = { minX: Math.min(...pinned.map((n) => n.position!.x)), maxY: Math.max(...pinned.map((n) => n.position!.y + sizeOf(n).h)) };
        const fp = fresh.map((n) => proposed.get(n.id) ?? { x: 0, y: 0 });
        const fminX = Math.min(...fp.map((p) => p.x)), fminY = Math.min(...fp.map((p) => p.y));
        fresh.forEach((n, i) => { n.position = { x: half(fp[i].x - fminX + pb.minX), y: half(fp[i].y - fminY + pb.maxY + 80) }; });
      }
    } else if (fresh.length) { // free: new nodes in a row below what is there
      const maxY = pinned.length ? Math.max(...pinned.map((n) => n.position!.y + sizeOf(n).h)) + 80 : 0;
      let x = pinned.length ? Math.min(...pinned.map((n) => n.position!.x)) : 0;
      for (const n of fresh) { n.position = { x, y: maxY }; x += sizeOf(n).w + NODE_GAP; }
    }
    if (cid) {
      const g = t.byId.get(cid)!;
      const exact = relayout || !pinned.length || replace.has(cid);
      // a ring/hub, or a downward flow with a spine, is centred on its own axis (x = 0 where it was placed)
      const sym = exact && fresh.length === kids.length && (S.arr === "ring" || S.arr === "hub" || (S.arr === "flow" && S.down && S.spine.size > 0)) ? new Set([cid]) : new Set<string>();
      const fitted = fitGroups([g, ...kids].map((n) => (n === g ? { ...g, parent: undefined } : n)), new Set(), exact, sym);
      fitted.slice(1).forEach((k, i) => { kids[i].position = k.position; });
      g.size = fitted[0].size;
      if (g.position && fitted[0].position && !isNew(g)) g.position = fitted[0].position;
    }
  }
  if (relayout) {
    const top = t.kids.get("") ?? [];
    const mx = Math.min(...top.map((n) => n.position!.x)), my = Math.min(...top.map((n) => n.position!.y));
    const dx = -Math.floor(mx / G) * G, dy = -Math.floor(my / G) * G; // shift by whole grid steps: keeps the 8px phase
    for (const n of top) n.position = { x: half(n.position!.x + dx), y: half(n.position!.y + dy) };
  }
  return out;
}

// ---------------------------------------------------------------- edge routing
export type Side = "top" | "right" | "bottom" | "left";
const SIDES: Side[] = ["bottom", "top", "right", "left"];
const HANDLE_ALIAS: Record<string, Side> = { t: "top", r: "right", b: "bottom", l: "left", top: "top", right: "right", bottom: "bottom", left: "left" };
export const normSide = (h?: string): Side | undefined => (h ? HANDLE_ALIAS[h.toLowerCase()] : undefined);
const OPP: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };
const NORMAL: Record<Side, XY> = { top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const STUB = 16, MARGIN = 10;
const vert = (s: Side) => s === "top" || s === "bottom";

/** Box of a group's header text in absolute coords. Edges must never cross it. */
export function groupTitleBox(n: LNode, b: Box): Box {
  return { x: b.x + 8, y: b.y + 4, w: Math.min(b.w - 16, groupHeaderWidth(n)), h: groupHeaderHeight(n) - 12 };
}
/** Where a single line attaches on a side: the side's midpoint (for a group's top, past its title when the title reaches the middle). */
export function sideCenter(n: LNode, b: Box, side: Side): number {
  if (vert(side)) {
    const mid = b.x + b.w / 2;
    if (n.kind === "group" && side === "top" && b.x + groupHeaderWidth(n) + 24 > mid) return half((b.x + groupHeaderWidth(n) + 16 + b.x + b.w) / 2);
    return mid;
  }
  if (n.kind === "group") return b.y + groupHeaderHeight(n) + (b.h - groupHeaderHeight(n)) / 2;
  return b.y + b.h / 2;
}
function sideSpan(n: LNode, b: Box, side: Side): [number, number] {
  const shape = shapeOf(n);
  const round = n.kind === "operator" || shape === "circle" || shape === "diamond";
  const c = sideCenter(n, b, side);
  const halfLen = round ? 0 : vert(side) ? Math.min(c - b.x, b.x + b.w - c) - 16 : Math.min(c - b.y, b.y + b.h - c) - 12;
  return [c - Math.max(0, halfLen), c + Math.max(0, halfLen)];
}
function portPoint(b: Box, side: Side, c: number): XY {
  return side === "top" ? { x: c, y: b.y } : side === "bottom" ? { x: c, y: b.y + b.h } : side === "left" ? { x: b.x, y: c } : { x: b.x + b.w, y: c };
}

class Heap { a: [number, number][] = []; push(x: [number, number]) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const top = a[0]; const last = a.pop()!; if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; } }

const inside = (p: XY, b: Box) => p.x > b.x + 0.01 && p.x < b.x + b.w - 0.01 && p.y > b.y + 0.01 && p.y < b.y + b.h - 0.01;
const inflate = (b: Box, m: number): Box => ({ x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m });
const overlaps = (a: Box, b: Box, pad = 0) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
function segHits(a: XY, b: XY, r: Box) {
  const box = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
  return box.x < r.x + r.w - 0.5 && r.x + 0.5 < box.x + box.w && box.y < r.y + r.h - 0.5 && r.y + 0.5 < box.y + box.h
    || (box.w === 0 && box.x > r.x + 0.5 && box.x < r.x + r.w - 0.5 && box.y < r.y + r.h - 0.5 && box.y + box.h > r.y + 0.5)
    || (box.h === 0 && box.y > r.y + 0.5 && box.y < r.y + r.h - 0.5 && box.x < r.x + r.w - 0.5 && box.x + box.w > r.x + 0.5);
}
const pathHits = (pts: XY[], hard: Box[]) => pts.some((p, i) => i > 0 && hard.some((h) => segHits(pts[i - 1], p, h)));
const pathLen = (pts: XY[]) => pts.reduce((a, p, i) => (i ? a + Math.abs(p.x - pts[i - 1].x) + Math.abs(p.y - pts[i - 1].y) : 0), 0);

/** Orthogonal route from p0 (leaving in dir d0) to p1 (arriving in dir d1) around hard obstacles; soft boxes cost more. */
function astar(p0: XY, d0: XY, p1: XY, d1: XY, hard: Box[], soft: Box[]): XY[] | null {
  const xsSet = new Set<number>([p0.x, p1.x]), ysSet = new Set<number>([p0.y, p1.y]);
  const all = [...hard, ...soft];
  for (const b of all) { xsSet.add(b.x); xsSet.add(b.x + b.w); ysSet.add(b.y); ysSet.add(b.y + b.h); }
  const lo = { x: Math.min(p0.x, p1.x, ...all.map((b) => b.x)) - 40, y: Math.min(p0.y, p1.y, ...all.map((b) => b.y)) - 40 };
  const hi = { x: Math.max(p0.x, p1.x, ...all.map((b) => b.x + b.w)) + 40, y: Math.max(p0.y, p1.y, ...all.map((b) => b.y + b.h)) + 40 };
  xsSet.add(lo.x); xsSet.add(hi.x); ysSet.add(lo.y); ysSet.add(hi.y);
  const mids = (s: Set<number>) => { const a = [...s].sort((x, y) => x - y); for (let i = 1; i < a.length; i++) if (a[i] - a[i - 1] > 8) s.add((a[i] + a[i - 1]) / 2); return [...s].map((v) => Math.round(v * 2) / 2).filter((v, i, arr) => arr.indexOf(v) === i).sort((x, y) => x - y); };
  const xs = mids(xsSet), ys = mids(ysSet);
  const X = xs.length, Y = ys.length;
  const idx = (i: number, j: number) => j * X + i;
  const si = xs.indexOf(Math.round(p0.x * 2) / 2), sj = ys.indexOf(Math.round(p0.y * 2) / 2);
  const ti = xs.indexOf(Math.round(p1.x * 2) / 2), tj = ys.indexOf(Math.round(p1.y * 2) / 2);
  if (si < 0 || sj < 0 || ti < 0 || tj < 0) return null;
  const blocked = new Uint8Array(X * Y);
  for (let j = 0; j < Y; j++) for (let i = 0; i < X; i++) { const p = { x: xs[i], y: ys[j] }; if (hard.some((b) => inside(p, b))) blocked[idx(i, j)] = 1; }
  blocked[idx(si, sj)] = 0; blocked[idx(ti, tj)] = 0;
  const DIRS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  const dirIx = (d: XY) => DIRS.findIndex((q) => q.x === d.x && q.y === d.y);
  const N = X * Y * 4, BEND = 160;
  const g = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const heap = new Heap();
  const start = idx(si, sj) * 4 + dirIx(d0);
  g[start] = 0; heap.push([0, start]);
  const h = (i: number, j: number) => Math.abs(xs[i] - xs[ti]) + Math.abs(ys[j] - ys[tj]);
  const goalDir = dirIx(d1);
  let best = -1;
  while (heap.size) {
    const [f, st] = heap.pop();
    const cell = st >> 2, d = st & 3, i = cell % X, j = (cell / X) | 0;
    if (f - h(i, j) > g[st] + 1e-6) continue;
    if (i === ti && j === tj && d === goalDir) { best = st; break; }
    for (let nd = 0; nd < 4; nd++) {
      if (DIRS[nd].x === -DIRS[d].x && DIRS[nd].y === -DIRS[d].y) continue;
      const ni = i + DIRS[nd].x, nj = j + DIRS[nd].y;
      if (ni < 0 || nj < 0 || ni >= X || nj >= Y || blocked[idx(ni, nj)]) continue;
      const mid = { x: (xs[i] + xs[ni]) / 2, y: (ys[j] + ys[nj]) / 2 };
      if (hard.some((b) => inside(mid, b))) continue;
      const len = Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j]);
      let c = len;
      if (soft.some((b) => inside(mid, b))) c += len * 4;
      if (nd !== d) c += BEND;
      const ns = idx(ni, nj) * 4 + nd;
      if (g[st] + c < g[ns] - 1e-6) { g[ns] = g[st] + c; prev[ns] = st; heap.push([g[ns] + h(ni, nj), ns]); }
    }
  }
  if (best < 0) return null;
  const pts: XY[] = [];
  for (let s = best; s >= 0; s = prev[s]) { const cell = s >> 2; pts.push({ x: xs[cell % X], y: ys[(cell / X) | 0] }); if (s === start) break; }
  return pts.reverse();
}

function simplify(pts: XY[]): XY[] {
  const out: XY[] = [];
  for (const p of pts) {
    const q = { x: half(p.x), y: half(p.y) };
    if (out.length && out[out.length - 1].x === q.x && out[out.length - 1].y === q.y) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2], b = out[out.length - 1];
      if ((a.x === b.x && b.x === q.x) || (a.y === b.y && b.y === q.y)) { out[out.length - 1] = q; continue; }
    }
    out.push(q);
  }
  return out;
}

/** Simple orthogonal shapes between two ports: straight, L (one elbow), Z (one jog) or C (around the outside). */
function shapeRoute(ps: XY, sa: Side, pt: XY, sb: Side, chan?: number, outer?: number): XY[] | null {
  const ns = NORMAL[sa], nt = NORMAL[sb];
  if (vert(sa) && vert(sb)) {
    if (sa !== sb && ns.y === -nt.y && (pt.y - ps.y) * ns.y >= 2 * STUB) {
      if (Math.abs(ps.x - pt.x) < 0.75) return [ps, { x: ps.x, y: pt.y }];
      const my = chan ?? (ps.y + pt.y) / 2;
      return [ps, { x: ps.x, y: my }, { x: pt.x, y: my }, pt];
    }
    if (sa === sb) { const y = outer ?? (ns.y > 0 ? Math.max(ps.y, pt.y) + 32 : Math.min(ps.y, pt.y) - 32); return [ps, { x: ps.x, y }, { x: pt.x, y }, pt]; }
    return null;
  }
  if (!vert(sa) && !vert(sb)) {
    if (sa !== sb && ns.x === -nt.x && (pt.x - ps.x) * ns.x >= 2 * STUB) {
      if (Math.abs(ps.y - pt.y) < 0.75) return [ps, { x: pt.x, y: ps.y }];
      const mx = chan ?? (ps.x + pt.x) / 2;
      return [ps, { x: mx, y: ps.y }, { x: mx, y: pt.y }, pt];
    }
    if (sa === sb) { const x = outer ?? (ns.x > 0 ? Math.max(ps.x, pt.x) + 32 : Math.min(ps.x, pt.x) - 32); return [ps, { x, y: ps.y }, { x, y: pt.y }, pt]; }
    return null;
  }
  if (vert(sa)) { // leave vertically, arrive horizontally
    const c = { x: ps.x, y: pt.y };
    if ((c.y - ps.y) * ns.y >= STUB && (c.x - pt.x) * nt.x >= STUB) return [ps, c, pt];
    return null;
  }
  const c = { x: pt.x, y: ps.y };
  if ((c.x - ps.x) * ns.x >= STUB && (c.y - pt.y) * nt.y >= STUB) return [ps, c, pt];
  return null;
}

/** A clean simple shape for these ports: the preferred channel first, then the nearest channel or gutter that is clear. */
function shapeSearch(ps: XY, a: Side, pt: XY, b: Side, clear: (r: XY[]) => boolean, chan?: number, outer?: number): XY[] | null {
  const first = shapeRoute(ps, a, pt, b, chan, outer);
  if (!first) return null;
  if (clear(first)) return first;
  if (first.length !== 4) return null;
  if (a === b) { // C: walk the gutter outward
    const dir = a === "bottom" || a === "right" ? 1 : -1;
    const base = vert(a) ? (dir > 0 ? Math.max(ps.y, pt.y) : Math.min(ps.y, pt.y)) : (dir > 0 ? Math.max(ps.x, pt.x) : Math.min(ps.x, pt.x));
    for (let d = 24; d <= 2400; d += 8) { const r = shapeRoute(ps, a, pt, b, undefined, base + dir * d); if (r && clear(r)) return r; }
    return null;
  }
  // Z: slide the jog channel across the gap, nearest the middle first
  const lo = vert(a) ? Math.min(ps.y, pt.y) + STUB : Math.min(ps.x, pt.x) + STUB, hi = vert(a) ? Math.max(ps.y, pt.y) - STUB : Math.max(ps.x, pt.x) - STUB;
  const mid = (lo + hi) / 2;
  for (let d = 8; d <= (hi - lo) / 2; d += 8) for (const c of [mid - d, mid + d]) { const r = shapeRoute(ps, a, pt, b, c); if (r && clear(r)) return r; }
  return null;
}

/** A ring step: a smooth curve from the side of `a` that faces the way round the ring, to the side of `b` that
 *  faces back. Both ends sit at side midpoints; between perpendicular sides the curve is a quarter ellipse. */
function arcRoute(an: LNode, a: Box, bn: LNode, b: Box, c: XY, rx: number, ry: number, clockwise: boolean): XY[] {
  // Each step bulges away from the ring's centre: of the two quarter-turn options (leave sideways then arrive from
  // above/below, or the reverse) take the one whose corner lies farther out. Ends that line up face each other.
  void clockwise;
  const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const dx = cb.x - ca.x, dy = cb.y - ca.y;
  let sa: Side, sb: Side;
  if (Math.abs(dy) < 8) { sa = dx > 0 ? "right" : "left"; sb = dx > 0 ? "left" : "right"; }
  else if (Math.abs(dx) < 8) { sa = dy > 0 ? "bottom" : "top"; sb = dy > 0 ? "top" : "bottom"; }
  else {
    const far = (p: XY) => Math.hypot((p.x - c.x) / (rx || 1), (p.y - c.y) / (ry || 1));
    if (far({ x: cb.x, y: ca.y }) >= far({ x: ca.x, y: cb.y })) { sa = dx > 0 ? "right" : "left"; sb = dy > 0 ? "top" : "bottom"; }
    else { sa = dy > 0 ? "bottom" : "top"; sb = dx > 0 ? "left" : "right"; }
  }
  const p0 = portPoint(a, sa, sideCenter(an, a, sa)), p3 = portPoint(b, sb, sideCenter(bn, b, sb));
  const n0 = NORMAL[sa], n3 = NORMAL[sb];
  const k0 = 0.552 * (n0.x ? Math.abs(p3.x - p0.x) : Math.abs(p3.y - p0.y)) || 40;
  const k3 = 0.552 * (n3.x ? Math.abs(p3.x - p0.x) : Math.abs(p3.y - p0.y)) || 40;
  const p1 = { x: p0.x + n0.x * k0, y: p0.y + n0.y * k0 }, p2 = { x: p3.x + n3.x * k3, y: p3.y + n3.y * k3 };
  const pts: XY[] = [];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32, u = 1 - t;
    pts.push({ x: Math.round((u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x) * 10) / 10,
      y: Math.round((u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y) * 10) / 10 });
  }
  pts[0] = p0; pts[pts.length - 1] = p3;
  // a step between aligned ends is a straight line, not a curve of collinear samples
  return pts.every((p) => p.x === p0.x) || pts.every((p) => p.y === p0.y) ? [p0, p3] : pts;
}

/** The ellipse through a ring's member centres. Members sit at equal angles, so (from three on) the centroid is the
 *  ellipse's centre and the mean squared offset is half the squared radius. */
function ringGeom(cs: XY[]): { c: XY; rx: number; ry: number } {
  let c: XY, rx: number, ry: number;
  if (cs.length >= 3) {
    c = { x: cs.reduce((a, p) => a + p.x, 0) / cs.length, y: cs.reduce((a, p) => a + p.y, 0) / cs.length };
    rx = Math.sqrt((2 * cs.reduce((a, p) => a + (p.x - c.x) ** 2, 0)) / cs.length); ry = Math.sqrt((2 * cs.reduce((a, p) => a + (p.y - c.y) ** 2, 0)) / cs.length);
  } else {
    c = { x: (Math.min(...cs.map((p) => p.x)) + Math.max(...cs.map((p) => p.x))) / 2, y: (Math.min(...cs.map((p) => p.y)) + Math.max(...cs.map((p) => p.y))) / 2 };
    rx = Math.max(...cs.map((p) => Math.abs(p.x - c.x))); ry = Math.max(...cs.map((p) => Math.abs(p.y - c.y)));
  }
  return { c, rx: rx || ry, ry: ry || rx };
}
interface RingInfo { members: string[]; c: XY; rx: number; ry: number }
function ringsOf(nodes: LNode[], edges: LEdge[], opts: LayoutOpts, boxes: Map<string, Box>): RingInfo[] {
  const { out } = allStructures(nodes, edges, opts);
  const rings: RingInfo[] = [];
  for (const [, { S }] of out) {
    if (S.arr !== "ring" || S.line.length < 2) continue;
    const bs = S.line.map((id) => boxes.get(id)!).filter(Boolean);
    rings.push({ members: S.line, ...ringGeom(bs.map((b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 }))) });
  }
  return rings;
}

/**
 * Routes for edges (absolute canvas coords, first point on the source border, last on the target border).
 * `only` limits which edges are computed (others still reserve their ports).
 */
export function routeEdges(nodes: LNode[], edges: LEdge[], only?: Set<string>, opts: LayoutOpts = {}): Map<string, XY[]> {
  const t = tree(nodes);
  const boxes = absoluteBoxes(nodes);
  const result = new Map<string, XY[]>();
  const valid = edges.filter((e) => boxes.has(e.source) && boxes.has(e.target) && e.source !== e.target);
  const nodeOf = (id: string) => t.byId.get(id)!;
  // rings: consecutive members join along the ring as arcs
  const rings = ringsOf(nodes, edges, opts, boxes);
  const arcs = new Set<string>();
  for (const e of valid) for (const r of rings) {
    const i = r.members.indexOf(e.source), j = r.members.indexOf(e.target), n = r.members.length;
    if (i < 0 || j < 0) continue;
    const cw = (i + 1) % n === j, ccw = (j + 1) % n === i;
    if (!cw && !ccw) continue;
    arcs.add(e.id);
    if (only && !only.has(e.id)) continue;
    const pts = arcRoute(nodeOf(e.source), boxes.get(e.source)!, nodeOf(e.target), boxes.get(e.target)!, r.c, r.rx, r.ry, cw);
    if (pts.length >= 2) result.set(e.id, pts);
  }
  const ortho = valid.filter((e) => !arcs.has(e.id));
  const related = (e: LEdge) => new Set([e.source, e.target, ...ancestors(e.source, t), ...ancestors(e.target, t)]);
  const titleBoxes = nodes.filter((n) => n.kind === "group").map((n) => ({ id: n.id, b: inflate(groupTitleBox(n, boxes.get(n.id)!), 4) }));
  const obstacles = (e: LEdge, foreign: boolean): Box[] => {
    const rel = related(e), hard: Box[] = [];
    for (const n of nodes) {
      if (n.id === e.source || n.id === e.target) continue;
      if (n.kind !== "group") hard.push(inflate(boxes.get(n.id)!, MARGIN));
      else if (foreign && !rel.has(n.id)) hard.push(inflate(boxes.get(n.id)!, MARGIN));
    }
    for (const tb of titleBoxes) if (tb.id !== e.source && tb.id !== e.target) hard.push(tb.b);
    return hard;
  };
  const contentBox = (() => { const bs = [...boxes.values()]; return { x: Math.min(...bs.map((b) => b.x)), y: Math.min(...bs.map((b) => b.y)), r: Math.max(...bs.map((b) => b.x + b.w)), b: Math.max(...bs.map((b) => b.y + b.h)) }; })();
  void contentBox;
  /** The gutter a C route runs in: just outside every box between its two ends, then 24px further per extra route. */
  const outerFor = (side: Side, ps: XY, pt: XY, k = 0) => {
    const lo = vert(side) ? Math.min(ps.x, pt.x) : Math.min(ps.y, pt.y), hi = vert(side) ? Math.max(ps.x, pt.x) : Math.max(ps.y, pt.y);
    const span = [...boxes.values()].filter((b) => (vert(side) ? b.x < hi && b.x + b.w > lo : b.y < hi && b.y + b.h > lo));
    const ext = side === "bottom" ? Math.max(ps.y, pt.y, ...span.map((b) => b.y + b.h)) : side === "top" ? Math.min(ps.y, pt.y, ...span.map((b) => b.y))
      : side === "right" ? Math.max(ps.x, pt.x, ...span.map((b) => b.x + b.w)) : Math.min(ps.x, pt.x, ...span.map((b) => b.x));
    const d = 32 + 24 * k;
    return side === "bottom" || side === "right" ? ext + d : ext - d;
  };
  // Facing sides of two boxes that overlap across the gap: a jog between them reads as one straight run (and lets
  // a fan-out share one trunk), so it beats an elbow out of a side that faces away.
  // a fan: two or more same-kind lines leaving (or entering) one node in the same main direction
  const heading = (e: LEdge) => { const a = boxes.get(e.source)!, b = boxes.get(e.target)!; const dx = b.x + b.w / 2 - a.x - a.w / 2, dy = b.y + b.h / 2 - a.y - a.h / 2; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "r" : "l") : dy > 0 ? "d" : "u"; };
  const fanKinds = new Set<string>();
  for (const e of ortho) for (const end of [0, 1] as const) {
    const id = end ? e.target : e.source;
    if (ortho.filter((o) => o.kind === e.kind && !o.both && (end ? o.target : o.source) === id && heading(o) === heading(e)).length > 1) fanKinds.add(`${e.id}`);
  }
  const facing = (s: Box, tb: Box, fan = false): [Side, Side] | null => {
    if (fan) { // a fan-out/fan-in splits as one trunk: face each other across the gap even when offset sideways
      const gx = Math.max(tb.x - (s.x + s.w), s.x - (tb.x + tb.w)), gy = Math.max(tb.y - (s.y + s.h), s.y - (tb.y + tb.h));
      if (gy > 0 && gy >= gx) return tb.y > s.y ? ["bottom", "top"] : ["top", "bottom"];
      if (gx > 0 && gx > gy) return tb.x > s.x ? ["right", "left"] : ["left", "right"];
    }
    const gapX = Math.max(tb.x - (s.x + s.w), s.x - (tb.x + tb.w)), gapY = Math.max(tb.y - (s.y + s.h), s.y - (tb.y + tb.h));
    const within = (c: number, lo: number, len: number) => c > lo + 0.5 && c < lo + len - 0.5;
    if (gapX > gapY && gapX > 0) { if (within(s.y + s.h / 2, tb.y, tb.h) || within(tb.y + tb.h / 2, s.y, s.h)) return tb.x > s.x ? ["right", "left"] : ["left", "right"]; return null; }
    if (gapY > 0 && (within(s.x + s.w / 2, tb.x, tb.w) || within(tb.x + tb.w / 2, s.x, s.w))) return tb.y > s.y ? ["bottom", "top"] : ["top", "bottom"];
    return null;
  };
  // 1. sides: try every pair with midpoint ports; fewest bends wins, then shortest
  const pick = new Map<string, [Side, Side]>();
  const taken = new Map<string, Set<string>>(); // node|side -> bundle keys already using it
  const bkey = (e: LEdge, end: 0 | 1) => (e.both ? e.id : `${e.kind}|${end}`);
  const byPriority = [...ortho].sort((x, y) => Number(!ORDERING_KINDS.has(x.kind ?? "")) - Number(!ORDERING_KINDS.has(y.kind ?? "")));
  for (const e of byPriority) {
    const sb = boxes.get(e.source)!, tb = boxes.get(e.target)!;
    const hard = obstacles(e, true);
    const fs = normSide(e.sourceHandle), ft = normSide(e.targetHandle);
    let best: { s: [Side, Side]; score: number } | null = null;
    for (const a of fs ? [fs] : SIDES) for (const b of ft ? [ft] : SIDES) {
      const ps = portPoint(sb, a, sideCenter(nodeOf(e.source), sb, a)), pt = portPoint(tb, b, sideCenter(nodeOf(e.target), tb, b));
      const own = [inflate(sb, -1), inflate(tb, -1)];
      const r = shapeSearch(ps, a, pt, b, (q) => !pathHits(q, hard) && !pathHits(q, own), undefined, a === b ? outerFor(a, ps, pt) : undefined)
        ?? shapeRoute(ps, a, pt, b, undefined, a === b ? outerFor(a, ps, pt) : undefined);
      if (!r) continue;
      const f = facing(sb, tb, fanKinds.has(e.id));
      // a side already used by another bundle costs extra; joining a bundle of the same kind earns a trunk (fan-in/out)
      const busy = (id: string, sd: Side, end: 0 | 1) => { const u = taken.get(`${id}|${sd}`); return !u ? 0 : !u.has(bkey(e, end)) ? 500 : -650; };
      const score = (pathHits(r, hard) ? 1e6 : 0) + (pathHits(r, own) ? 1e6 : 0) + (r.length - 2) * 600 + pathLen(r) - (f && f[0] === a && f[1] === b ? 700 : 0)
        + busy(e.source, a, 0) + busy(e.target, b, 1);
      if (!best || score < best.score) best = { s: [a, b], score };
    }
    const chosen: [Side, Side] = best?.s ?? [fs ?? "bottom", ft ?? "top"];
    pick.set(e.id, chosen);
    for (const end of [0, 1] as const) { const k = `${end ? e.target : e.source}|${chosen[end]}`; (taken.get(k) ?? taken.set(k, new Set()).get(k)!).add(bkey(e, end)); }
  }
  // 2. ports: one slot per bundle (same kind, same direction) on a side, slots spread symmetrically about the centre
  type Slot = { key: string; members: { e: LEdge; end: 0 | 1 }[]; other: number };
  const sidesMap = new Map<string, Slot[]>();
  for (const e of ortho) {
    const [a, b] = pick.get(e.id)!;
    for (const end of [0, 1] as const) {
      const id = end === 0 ? e.source : e.target, side = end === 0 ? a : b, oid = end === 0 ? e.target : e.source;
      const k = `${id}|${side}`;
      const list = sidesMap.get(k) ?? sidesMap.set(k, []).get(k)!;
      const ob = boxes.get(oid)!, oc = vert(side) ? ob.x + ob.w / 2 : ob.y + ob.h / 2;
      const bk = e.both ? `${e.id}` : `${e.kind}|${end}`;
      let slot = list.find((s) => s.key === bk);
      if (!slot) { slot = { key: bk, members: [], other: 0 }; list.push(slot); }
      slot.members.push({ e, end });
      slot.other = (slot.other * (slot.members.length - 1) + oc) / slot.members.length;
    }
  }
  const port = new Map<string, XY>(), bundle = new Map<string, Slot>();
  for (const [k, list] of sidesMap) {
    const [id, side] = k.split("|") as [string, Side];
    const n = nodeOf(id), b = boxes.get(id)!;
    const [from, to] = sideSpan(n, b, side), c = sideCenter(n, b, side);
    list.sort((x, y) => x.other - y.other);
    const step = list.length > 1 ? Math.min(40, (to - from) / (list.length - 1)) : 0;
    const set = (s: Slot, at: number) => { for (const m of s.members) { port.set(`${m.e.id}|${m.end}`, portPoint(b, side, half(at))); if (s.members.length > 1) bundle.set(`${m.e.id}|${m.end}`, s); } };
    // The main line keeps the centre: a slot whose far end faces this side's centre runs dead straight; the others
    // step aside, mirrored about it. Otherwise all slots spread symmetrically about the centre.
    const straightSlot = list.length > 1 ? list.find((s) => s.members.length === 1 && (() => {
      const m = s.members[0], oid = m.end === 0 ? m.e.target : m.e.source, [sa, sb] = pick.get(m.e.id)!, os = m.end === 0 ? sb : sa;
      return os === OPP[side] && Math.abs(sideCenter(nodeOf(oid), boxes.get(oid)!, os) - c) < 1;
    })()) : undefined;
    if (straightSlot) {
      set(straightSlot, c);
      const rest = list.filter((s) => s !== straightSlot);
      const before = rest.filter((s) => s.other < c), after = rest.filter((s) => s.other >= c);
      const room = Math.min(c - from, to - c), k = Math.max(before.length, after.length);
      const st = k ? Math.min(Math.max(step, 24), room / k) : 0;
      before.reverse().forEach((s, i) => set(s, c - (i + 1) * st));
      after.forEach((s, i) => set(s, c + (i + 1) * st));
    } else list.forEach((s, i) => set(s, c + (i - (list.length - 1) / 2) * step));
  }
  // 3. route with the real ports; shared-port bundles share their jog channel so they split as one trunk
  const outerUsed = new Map<string, number>();
  for (const e of ortho) {
    if (only && !only.has(e.id)) continue;
    const [a, b] = pick.get(e.id)!;
    const ps = port.get(`${e.id}|0`)!, pt = port.get(`${e.id}|1`)!;
    let chan: number | undefined;
    for (const end of [0, 1] as const) {
      const s = bundle.get(`${e.id}|${end}`);
      if (!s) continue;
      const mine = end === 0 ? ps : pt;
      const others = s.members.map((m) => port.get(`${m.e.id}|${1 - m.end}`)!);
      if (vert(end === 0 ? a : b)) { const near = others.reduce((p, q) => (Math.abs(q.y - mine.y) < Math.abs(p.y - mine.y) ? q : p)); chan = half((mine.y + near.y) / 2); }
      else { const near = others.reduce((p, q) => (Math.abs(q.x - mine.x) < Math.abs(p.x - mine.x) ? q : p)); chan = half((mine.x + near.x) / 2); }
    }
    let outer: number | undefined;
    if (a === b) { // C route: through the outer gutter, consistent spacing
      const k = outerUsed.get(a) ?? 0; outerUsed.set(a, k + 1);
      outer = outerFor(a, ps, pt, k);
    }
    const hard = obstacles(e, true);
    const own = [inflate(boxes.get(e.source)!, -1), inflate(boxes.get(e.target)!, -1)];
    const clear = (q: XY[]) => !pathHits(q, hard) && !pathHits(q, own);
    let r = shapeSearch(ps, a, pt, b, clear, chan, outer);
    // a side that is now crowded may have no clean shape: try the other sides with their midpoints before searching
    if (!r) for (const a2 of normSide(e.sourceHandle) ? [a] : SIDES) for (const b2 of normSide(e.targetHandle) ? [b] : SIDES) {
      if (r) break;
      const p2 = a2 === a ? ps : portPoint(boxes.get(e.source)!, a2, sideCenter(nodeOf(e.source), boxes.get(e.source)!, a2));
      const q2 = b2 === b ? pt : portPoint(boxes.get(e.target)!, b2, sideCenter(nodeOf(e.target), boxes.get(e.target)!, b2));
      const taken2 = (id: string, sd: Side) => sidesMap.has(`${id}|${sd}`) && !(id === e.source && sd === a) && !(id === e.target && sd === b);
      if (taken2(e.source, a2) || taken2(e.target, b2)) continue;
      r = shapeSearch(p2, a2, q2, b2, clear, undefined, a2 === b2 ? outerFor(a2, p2, q2) : undefined);
    }
    if (!r) {
      const ns = NORMAL[a], nt = NORMAL[b];
      const s0 = { x: ps.x + ns.x * STUB, y: ps.y + ns.y * STUB }, t0 = { x: pt.x + nt.x * STUB, y: pt.y + nt.y * STUB };
      const path = astar(s0, ns, t0, { x: -nt.x, y: -nt.y }, hard, []) ?? astar(s0, ns, t0, { x: -nt.x, y: -nt.y }, obstacles(e, false), nodes.filter((n) => n.kind === "group" && !related(e).has(n.id)).map((n) => boxes.get(n.id)!));
      r = path ? [ps, ...path, pt] : [ps, s0, { x: s0.x, y: t0.y }, t0, pt];
    }
    result.set(e.id, simplify(r));
  }
  return result;
}

/** Where to draw an edge's label/badge: centred on the line's main segment (longest; the last one for a split
 *  bundle), clear of nodes and earlier labels. `vertical` says the label stacks along a vertical stretch. */
export function labelSpot(route: XY[], e: LEdge, avoid: Box[] = [], others: XY[][] = []): { x: number; y: number; vertical: boolean } {
  // a stretch another line also runs along (a shared trunk) is no place for this line's own label
  const shared = (a: XY, b: XY) => others.some((r) => r.some((p, i) => {
    if (!i) return false; const q = r[i - 1];
    if (a.x === b.x && p.x === q.x && p.x === a.x) return Math.min(Math.max(a.y, b.y), Math.max(p.y, q.y)) - Math.max(Math.min(a.y, b.y), Math.min(p.y, q.y)) > 4;
    if (a.y === b.y && p.y === q.y && p.y === a.y) return Math.min(Math.max(a.x, b.x), Math.max(p.x, q.x)) - Math.max(Math.min(a.x, b.x), Math.min(p.x, q.x)) > 4;
    return false;
  }));
  const segs: { a: XY; b: XY; len: number; i: number }[] = [];
  const curved = route.some((p, i) => i > 0 && p.x !== route[i - 1].x && p.y !== route[i - 1].y);
  if (curved) { // on a curve: badge and label both centred on the arc, as near its middle as that allows
    const n = route.length, mid = (n - 1) / 2;
    let best: { x: number; y: number; vertical: boolean; score: number } | null = null;
    for (let i = Math.ceil(n * 0.2); i <= Math.floor(n * 0.8); i++) for (const vertical of [false, true]) {
      const m = route[i], sz = labelBox(e, vertical) ?? { w: 0, h: 0 };
      const lb = { x: m.x - sz.w / 2 - 8, y: m.y - sz.h / 2 - 8, w: sz.w + 16, h: sz.h + 16 };
      if (avoid.some((o) => overlaps(lb, o, -0.5))) continue;
      // the arc must run through the badge and through the label (within ARC_ON of each part's centre)
      const off = Math.max(...labelParts(e, m, vertical).map((p) => distToPath(p, route)));
      const score = (off > ARC_ON ? 100 + off : 0) + Math.abs(i - mid) / n;
      if (!best || score < best.score) best = { x: m.x, y: m.y, vertical, score };
    }
    if (best) return { x: best.x, y: best.y, vertical: best.vertical };
    const m = route[Math.floor(mid)]; return { x: m.x, y: m.y, vertical: false };
  }
  for (let i = 1; i < route.length; i++) segs.push({ a: route[i - 1], b: route[i], len: Math.abs(route[i].x - route[i - 1].x) + Math.abs(route[i].y - route[i - 1].y), i });
  const order = [...segs].sort((p, q) => Number(shared(p.a, p.b)) - Number(shared(q.a, q.b)) || q.len - p.len);
  let fallback: { x: number; y: number; vertical: boolean } | null = null;
  for (const s of order) {
    const vertical = s.a.x === s.b.x;
    const sz = labelBox(e, vertical) ?? { w: 0, h: 0 };
    const need = (vertical ? sz.h : sz.w) + (s.i === 1 ? 14 : 0) + (s.i === route.length - 1 ? 20 : 0) + 8;
    const lo = vertical ? Math.min(s.a.y, s.b.y) : Math.min(s.a.x, s.b.x), hi = vertical ? Math.max(s.a.y, s.b.y) : Math.max(s.a.x, s.b.x);
    // centred first; if that spot sits on another line or label, slide along this stretch
    const crossesOther = (lb: Box) => others.some((r) => r.some((p, i) => i > 0 && segHits(r[i - 1], p, lb)));
    const room = Math.max(0, hi - lo - need);
    for (const f of [0, 0.25, -0.25, 0.5, -0.5]) {
      const m = (lo + hi) / 2 + f * room;
      const c = vertical ? { x: s.a.x, y: m, vertical } : { x: m, y: s.a.y, vertical };
      const lb = { x: c.x - sz.w / 2 - 3, y: c.y - sz.h / 2 - 3, w: sz.w + 6, h: sz.h + 6 };
      const clear = !avoid.some((o) => overlaps(lb, o, -0.5));
      if (clear && !crossesOther(lb) && hi - lo >= need) return c;
      if (!fallback && clear && f === 0) fallback = c;
      if (!room) break;
    }
  }
  if (fallback) return fallback;
  const s = order[0] ?? { a: route[0], b: route[0] };
  return { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2, vertical: s.a.x === s.b.x && s.a.y !== s.b.y };
}
/** A label part counts as on its arc when the arc passes within this distance of its centre (a badge is 22px across). */
export const ARC_ON = 10;
/** Centres of the parts drawn for a line's label at `c`: the kind badge and the text (one or both). */
export function labelParts(e: LEdge, c: XY, vertical: boolean): XY[] {
  const badge = e.kind ? BADGE_KINDS[e.kind] : undefined;
  if (!badge || !e.label) return [c];
  const sz = labelBox(e, vertical)!, bw = badge.length > 1 ? 30 : 22;
  if (vertical) return [{ x: c.x, y: c.y - sz.h / 2 + 11 }, { x: c.x, y: c.y + sz.h / 2 - 11 }];
  const lw = sz.w - bw - 6;
  return [{ x: c.x - sz.w / 2 + bw / 2, y: c.y }, { x: c.x + sz.w / 2 - lw / 2, y: c.y }];
}
/** Shortest distance from a point to a polyline. */
export function distToPath(p: XY, r: XY[]): number {
  let d = Infinity;
  for (let i = 1; i < r.length; i++) {
    const a = r[i - 1], b = r[i], vx = b.x - a.x, vy = b.y - a.y, L = vx * vx + vy * vy;
    const t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L)) : 0;
    d = Math.min(d, Math.hypot(p.x - a.x - t * vx, p.y - a.y - t * vy));
  }
  return d;
}
/** Boxes an edge label must stay clear of: every non-group node and every group title. */
export function labelObstacles(nodes: LNode[]): Box[] {
  const boxes = absoluteBoxes(nodes);
  return [
    ...nodes.filter((n) => n.kind !== "group").map((n) => boxes.get(n.id)!),
    ...nodes.filter((n) => n.kind === "group").map((n) => groupTitleBox(n, boxes.get(n.id)!)),
  ];
}
/** Label boxes for every edge, in draw order (the app and diagnose() place them identically). */
export function placeLabels(nodes: LNode[], edges: LEdge[]): Map<string, { x: number; y: number; vertical: boolean; box: Box }> {
  const avoid = labelObstacles(nodes), out = new Map<string, { x: number; y: number; vertical: boolean; box: Box }>();
  for (const e of edges) {
    const r = e.route; if (!r || r.length < 2 || !labelBox(e)) continue;
    const c = labelSpot(r, e, avoid, edges.filter((o) => o.id !== e.id && o.route).map((o) => o.route!)), sz = labelBox(e, c.vertical)!;
    const box = { x: c.x - sz.w / 2, y: c.y - sz.h / 2, w: sz.w, h: sz.h };
    out.set(e.id, { ...c, box }); avoid.push(box);
  }
  return out;
}

// ---------------------------------------------------------------- one-shot arrange + diagnostics
/** Lay out (if needed), fit groups, and route every edge. What `apply`, the app's Tidy and fixtures all use. */
export async function arrange(
  nodes: LNode[], edges: LEdge[],
  opts: LayoutOpts & { relayout?: boolean; keepGroupSize?: Set<string>; replace?: Set<string> } = {},
): Promise<{ nodes: LNode[]; edges: LEdge[]; laidOut: boolean }> {
  const needs = !!opts.relayout || !!opts.replace?.size || nodes.some((n) => !n.position);
  let ns = needs ? layoutNodesSync(nodes, edges, opts) : nodes.map((n) => ({ ...n }));
  ns = fitGroups(ns, opts.relayout ? new Set() : opts.keepGroupSize ?? new Set());
  const routes = routeEdges(ns, edges, undefined, opts);
  const es = edges.map((e) => { const r = routes.get(e.id); const o = { ...e }; if (r) o.route = r; else delete o.route; return o; });
  return { nodes: ns, edges: es, laidOut: needs };
}

/** Layout problems worth fixing. Warnings, never errors. */
export function diagnose(nodes: LNode[], edges: LEdge[]): string[] {
  const w: string[] = [];
  const t = tree(nodes);
  const boxes = absoluteBoxes(nodes);
  const anc = new Map(nodes.map((n) => [n.id, new Set(ancestors(n.id, t))]));
  const content = nodes.filter((n) => n.kind !== "group");
  if (content.length > 15) w.push(`crowded: ${content.length} non-group nodes (aim for 5-12; over ~15, split into an overview plus detail visuals).`);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j];
    if (anc.get(a.id)!.has(b.id) || anc.get(b.id)!.has(a.id)) continue;
    if (overlaps(boxes.get(a.id)!, boxes.get(b.id)!, -1)) w.push(`overlap: '${a.id}' and '${b.id}' overlap on the canvas. Move one, or re-run apply with layout {relayout:true}.`);
  }
  for (const n of nodes) {
    const p = t.parentOf(n); if (!p) continue;
    const b = boxes.get(n.id)!, g = boxes.get(p)!;
    if (b.x < g.x || b.y < g.y || b.x + b.w > g.x + g.w || b.y + b.h > g.y + g.h) w.push(`outside-frame: '${n.id}' sticks out of its group '${p}'.`);
  }
  for (const n of nodes) {
    if (!n.size || n.kind === "group" || n.kind === "operator" || shapeOf(n) === "circle" || shapeOf(n) === "diamond") continue;
    const need = contentSize(n, n.size.w);
    if (need.h > n.size.h + 2) w.push(`clipped-text: '${n.id}' is ${n.size.w}x${n.size.h} but its content needs ${need.h}px of height. Remove \`size\` (patch size:null) to auto-size, or enlarge it.`);
  }
  for (const n of nodes) if (n.kind === "group" && n.size && groupHeaderWidth(n) > n.size.w) w.push(`clipped-text: group '${n.id}' title is wider than its frame.`);
  // a drawing joined to a card by a plain line is that card's picture: it belongs on the card
  for (const n of nodes) {
    if (n.kind !== "visual" && n.kind !== "image") continue;
    const es = edges.filter((e) => e.source === n.id || e.target === n.id);
    const other = es.length === 1 ? t.byId.get(es[0].source === n.id ? es[0].target : es[0].source) : undefined;
    if (es.length === 1 && es[0].kind === "relates" && other?.kind === "card")
      w.push(`illustration-node: '${n.id}' is a drawing whose only line is a \`relates\` to card '${other.id}'. A picture of a part goes ON the part: move the drawing into '${other.id}' as \`art\` ({svg|html|asset}) and remove '${n.id}'.`);
  }
  const titles = nodes.filter((n) => n.kind === "group").map((n) => ({ id: n.id, b: groupTitleBox(n, boxes.get(n.id)!) }));
  const labels = placeLabels(nodes, edges);
  const placed: { id: string; b: Box }[] = [];
  for (const e of edges) {
    const r = e.route; if (!r || r.length < 2) continue;
    const hits = new Set<string>();
    for (let k = 1; k < r.length; k++) {
      for (const n of content) if (n.id !== e.source && n.id !== e.target && segHits(r[k - 1], r[k], boxes.get(n.id)!)) hits.add(`card '${n.id}'`);
      for (const tb of titles) if (tb.id !== e.source && tb.id !== e.target && segHits(r[k - 1], r[k], tb.b)) hits.add(`title of group '${tb.id}'`);
    }
    if (hits.size) w.push(`edge-crossing: edge '${e.id}' passes through ${[...hits].join(", ")}.`);
    const L = labels.get(e.id);
    if (L) {
      const lb = L.box;
      const on = content.filter((n) => overlaps(lb, boxes.get(n.id)!, 2)).map((n) => n.id);
      if (on.length) w.push(`label-overlap: label of edge '${e.id}' touches ${on.map((x) => `'${x}'`).join(", ")}.`);
      const stacked = placed.filter((p) => overlaps(lb, p.b, 2)).map((p) => `'${p.id}'`);
      if (stacked.length) w.push(`label-overlap: label/badge of edge '${e.id}' sits on the label/badge of edge ${stacked.join(", ")}; one hides the other. Re-run apply with layout {relayout:true}, shorten a label, or drop a label that the kind badge already says.`);
      const under = edges.filter((o) => o.id !== e.id && o.route && o.route.length > 1 && o.route.some((pt, k) => k > 0 && segHits(o.route![k - 1], pt, lb))).map((o) => `'${o.id}'`);
      if (under.length) w.push(`label-overlap: label/badge of edge '${e.id}' is drawn across the line of edge ${under.join(", ")}.`);
      placed.push({ id: e.id, b: lb });
      if (e.label && textWidth(e.label, 11, true) + 16 > LABEL_MAX_W) w.push(`clipped-text: label of edge '${e.id}' is too long and will be cut; keep labels to 2-4 words.`);
    }
  }
  return w;
}

// ---------------------------------------------------------------- tidiness
export interface Tidiness {
  defects: string[];
  metrics: { edges: number; offCentre: number; bends: number; maxBends: number; bendy: number; unequalGaps: number; offAxis: number; foreignGroup: number; uncentredInGroup: number;
    rowMisaligned: number; rowUnevenHeight: number; ringOffArc: number; ringUnequalAngles: number };
}
/** Measurable tidiness: off-centre attachments, bends, unequal sibling gaps, off-axis ranks, lines inside foreign groups. */
export function tidiness(nodes: LNode[], edges: LEdge[], opts: LayoutOpts = {}): Tidiness {
  const t = tree(nodes), boxes = absoluteBoxes(nodes);
  const m = { edges: edges.length, offCentre: 0, bends: 0, maxBends: 0, bendy: 0, unequalGaps: 0, offAxis: 0, foreignGroup: 0, uncentredInGroup: 0, rowMisaligned: 0, rowUnevenHeight: 0, ringOffArc: 0, ringUnequalAngles: 0 };
  const defects: string[] = [];
  const ortho = (r: XY[]) => r.every((p, i) => !i || p.x === r[i - 1].x || p.y === r[i - 1].y);
  // attachments: per node side, the ports used must be symmetric about the side's centre
  const ports = new Map<string, { v: number; e: string }[]>();
  const sideOf = (b: Box, p: XY): Side | null => {
    const onX = p.x >= b.x - 0.6 && p.x <= b.x + b.w + 0.6, onY = p.y >= b.y - 0.6 && p.y <= b.y + b.h + 0.6;
    if (Math.abs(p.y - b.y) < 0.6 && onX) return "top";
    if (Math.abs(p.y - b.y - b.h) < 0.6 && onX) return "bottom";
    if (Math.abs(p.x - b.x) < 0.6 && onY) return "left";
    if (Math.abs(p.x - b.x - b.w) < 0.6 && onY) return "right";
    return null;
  };
  for (const e of edges) {
    const r = e.route; if (!r || r.length < 2) continue;
    for (const [id, p] of [[e.source, r[0]], [e.target, r[r.length - 1]]] as const) {
      const b = boxes.get(id); if (!b) continue;
      const s = sideOf(b, p);
      if (!s) { m.offCentre++; defects.push(`off-centre: edge '${e.id}' does not end on a side of '${id}'.`); continue; }
      const k = `${id}|${s}`;
      (ports.get(k) ?? ports.set(k, []).get(k)!).push({ v: vert(s) ? p.x : p.y, e: e.id });
    }
    if (ortho(r)) {
      const bends = r.slice(1, -1).filter((p, i) => { const a = r[i], b = r[i + 2]; return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y)); }).length;
      m.bends += bends; m.maxBends = Math.max(m.maxBends, bends);
      if (bends > 2) { m.bendy++; defects.push(`bends: edge '${e.id}' has ${bends} bends (at most 2: straight, one elbow or one jog).`); }
    }
    const rel = new Set([e.source, e.target, ...ancestors(e.source, t), ...ancestors(e.target, t)]);
    for (const g of nodes) {
      if (g.kind !== "group" || rel.has(g.id)) continue;
      if (r.some((p, i) => i > 0 && segHits(r[i - 1], p, inflate(boxes.get(g.id)!, -1)))) { m.foreignGroup++; defects.push(`foreign-group: edge '${e.id}' runs through group '${g.id}', which holds neither end.`); }
    }
  }
  for (const [k, list] of ports) {
    const [id, s] = k.split("|") as [string, Side];
    const n = t.byId.get(id)!, c = sideCenter(n, boxes.get(id)!, s);
    const vs = [...new Set(list.map((x) => half(x.v)))];
    const straightAtCentre = list.some((x) => Math.abs(x.v - c) <= 1 && (edges.find((e) => e.id === x.e)?.route?.length ?? 0) === 2);
    if (straightAtCentre) continue; // the main line holds the centre; side lines step aside from it
    for (const v of vs) if (!vs.some((u) => Math.abs((v - c) + (u - c)) <= 1)) {
      m.offCentre++; defects.push(`off-centre: '${list.find((x) => half(x.v) === v)!.e}' attaches to '${id}' ${Math.round(v - c)}px from the centre of its ${s} side, unbalanced.`);
    }
  }
  // arrangement symmetry per container
  const { out } = allStructures(nodes, edges, opts);
  const centre = (id: string) => { const b = boxes.get(id)!; return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; };
  for (const [cid, { S, kids }] of out) {
    const where = cid ? `group '${cid}'` : "the canvas";
    const main = (id: string) => (S.down ? centre(id).y : centre(id).x), cross = (id: string) => (S.down ? centre(id).x : centre(id).y);
    const ext = (id: string) => { const b = boxes.get(id)!; return S.down ? [b.x, b.x + b.w] : [b.y, b.y + b.h]; };
    const gb = cid ? boxes.get(cid)! : null;
    const gn = cid ? t.byId.get(cid)! : null;
    const contentMidY = gb ? (gb.y + groupHeaderHeight(gn!) + gb.y + gb.h - GROUP_METRICS.padBottom) / 2 : 0;
    const groupAxis = gb ? (S.down ? gb.x + gb.w / 2 : contentMidY) : null;
    const checkLine = (ids: string[], label: string, axis: number | null, horiz: boolean) => {
      if (ids.length < 1) return;
      const mc = (id: string) => (horiz ? centre(id).y : centre(id).x), cc = (id: string) => (horiz ? centre(id).x : centre(id).y);
      const span = (id: string) => { const b = boxes.get(id)!; return horiz ? [b.x, b.x + b.w] : [b.y, b.y + b.h]; };
      if (ids.some((id) => Math.abs(mc(id) - mc(ids[0])) > 1)) { m.offAxis++; defects.push(`off-axis: ${label} in ${where} are not centred on one line.`); }
      const sorted = [...ids].sort((a, b) => cc(a) - cc(b));
      const gaps = sorted.slice(1).map((id, i) => span(id)[0] - span(sorted[i])[1]);
      const pitch = sorted.slice(1).map((id, i) => cc(id) - cc(sorted[i])); // a row on a column grid: equal centre spacing
      if (gaps.length > 1 && Math.max(...gaps) - Math.min(...gaps) > 2 && Math.max(...pitch) - Math.min(...pitch) > 2) { m.unequalGaps++; defects.push(`unequal-gaps: ${label} in ${where} have gaps ${gaps.map(Math.round).join("/")}px.`); }
      if (axis !== null) { const mid = (span(sorted[0])[0] + span(sorted[sorted.length - 1])[1]) / 2, cmid = (cc(sorted[0]) + cc(sorted[sorted.length - 1])) / 2; if (Math.abs(mid - axis) > 2 && Math.abs(cmid - axis) > 2) { m.offAxis++; defects.push(`off-axis: ${label} in ${where} sit ${Math.round(mid - axis)}px off the centre line.`); } }
    };
    if (S.arr === "row" || S.arr === "column") checkLine(S.line, "items", cid ? (S.arr === "row" ? gb!.x + gb!.w / 2 : contentMidY) : null, S.arr === "row");
    else if (S.arr === "stack") checkLine(S.line, "tiers", groupAxis !== null ? (S.down ? contentMidY : gb!.x + gb!.w / 2) : null, !S.down);
    else if (S.arr === "grid") {
      const rows = new Map<number, string[]>();
      for (const id of S.line) { const k = Math.round(centre(id).y); (rows.get(k) ?? rows.set(k, []).get(k)!).push(id); }
      const axis = gb ? gb.x + gb.w / 2 : null;
      let first: number | null = null;
      for (const [, ids] of rows) { const sorted = [...ids].sort((a, b) => centre(a).x - centre(b).x); const b0 = boxes.get(sorted[0])!, b1 = boxes.get(sorted[sorted.length - 1])!; const mid = (b0.x + b1.x + b1.w) / 2; first ??= mid; checkLine(ids, "grid cells", axis ?? first, true); }
    } else if (S.arr === "flow") {
      const ranks = S.ranks.map((r) => r.filter((id) => !isVirtual(id)));
      const centres: number[] = [];
      const rankInfo = ranks.map((r, ri) => {
        if (!r.length) return null;
        const sorted = [...r].sort((a, b) => cross(a) - cross(b));
        const cl = sorted.map((id) => {
          const c = cross(id); let hw = (ext(id)[1] - ext(id)[0]) / 2;
          for (const s of S.satOf.get(id) ?? []) { const [a, b] = ext(s); hw = Math.max(hw, Math.abs(a - c), Math.abs(b - c)); if (Math.abs(main(s) - main(id)) > 1) { m.offAxis++; defects.push(`off-axis: '${s}' is not level with '${id}', the node it sits beside.`); } }
          return [c - hw, c + hw];
        });
        const sp = r.find((id) => S.spine.has(id));
        const mid = sp ? cross(sp) : (cl[0][0] + cl[cl.length - 1][1]) / 2;
        if (r.some((id) => Math.abs(main(id) - main(r[0])) > 1)) { m.offAxis++; defects.push(`off-axis: rank ${ri + 1} in ${where} is not on one line.`); }
        const gaps = cl.slice(1).map((c, i) => c[0] - cl[i][1]);
        if (!S.ranks[ri].some(isVirtual) && gaps.length > 1 && Math.max(...gaps) - Math.min(...gaps) > 2) { m.unequalGaps++; defects.push(`unequal-gaps: rank ${ri + 1} in ${where} has gaps ${gaps.map(Math.round).join("/")}px.`); }
        if (!S.ranks[ri].some(isVirtual)) centres.push(mid);
        return { mid, virt: S.ranks[ri].some(isVirtual) };
      });
      const sortedC = [...centres].sort((a, b) => a - b);
      const axis = groupAxis ?? sortedC[Math.floor(sortedC.length / 2)];
      rankInfo.forEach((ri, i) => { if (ri && !ri.virt && axis !== undefined && Math.abs(ri.mid - axis) > 2) { m.offAxis++; defects.push(`off-axis: rank ${i + 1} in ${where} is centred ${Math.round(ri.mid - axis)}px off the main axis.`); } });
    } else if (S.arr === "tree") {
      for (const [p, cs] of S.treeKids) {
        const xs = cs.map(cross), mid = (Math.min(...xs) + Math.max(...xs)) / 2;
        if (Math.abs(cross(p) - mid) > 2) { m.offAxis++; defects.push(`off-axis: '${p}' is not centred over its children.`); }
      }
    } else if (S.arr === "ring" || S.arr === "hub") {
      const ids = S.arr === "hub" ? [S.hub!, ...S.line] : S.line;
      const cs = ids.map(centre), ax = S.arr === "hub" ? centre(S.hub!).x : (Math.min(...cs.map((c) => c.x)) + Math.max(...cs.map((c) => c.x))) / 2;
      for (let i = 0; i < cs.length; i++) if (!cs.some((c) => Math.abs(c.x - ax + (cs[i].x - ax)) <= 2 && Math.abs(c.y - cs[i].y) <= 2)) { m.offAxis++; defects.push(`asymmetric: '${ids[i]}' has no mirror partner across the ${S.arr}'s axis.`); }
    }
    // a row: parts of one shape share one height
    if (S.arr === "row") {
      const byShape = new Map<string, string[]>();
      for (const k of kids) if (k.kind === "card" && !artOf(k) && shapeOf(k) !== "circle" && shapeOf(k) !== "diamond") (byShape.get(shapeOf(k)) ?? byShape.set(shapeOf(k), []).get(shapeOf(k))!).push(k.id);
      for (const ids of byShape.values()) {
        const hs = ids.map((id) => boxes.get(id)!.h);
        if (ids.length > 1 && Math.max(...hs) - Math.min(...hs) > 1) { m.rowUnevenHeight++; defects.push(`row-uneven-height: the parts in the row in ${where} have different heights (${[...new Set(hs.map(Math.round))].join("/")}px).`); }
      }
    }
    // tiers of a stack: each tier's row sits on the widest tier's columns (or evenly across its span)
    const bands = kids.filter((k) => k.kind === "group" && k.groupKind === "layer");
    if ((S.arr === "stack" || S.arr === "flow") && bands.length >= 2) {
      const rows = bands.map((b) => ({ b, row: bandRow(b, t.kids, S.down) })).filter((r): r is { b: LNode; row: LNode[] } => !!r.row);
      if (rows.length >= 2) {
        const cols = bandColumns(rows, S.down);
        for (const { b, row } of rows) {
          const target = cols(row.length), mid = (S.down ? sizeOf(b).w : sizeOf(b).h) / 2;
          const off = row.map((k, i) => (S.down ? k.position!.x + sizeOf(k).w / 2 : k.position!.y + sizeOf(k).h / 2) - mid - target[i]);
          if (off.some((d) => Math.abs(d) > 2)) { m.rowMisaligned++; defects.push(`row-misaligned: the parts of tier '${b.id}' do not line up with the columns of the widest tier (off by up to ${Math.round(Math.max(...off.map(Math.abs)))}px).`); }
        }
      }
    }
    // a ring: members on one ellipse at equal angles; each step's badge and label on its arc
    if (S.arr === "ring" && S.line.length >= 3) {
      const cs = S.line.map(centre), { c, rx, ry } = ringGeom(cs), n = cs.length;
      const r = cs.map((p) => Math.hypot((p.x - c.x) / rx, (p.y - c.y) / ry));
      if (r.some((v) => Math.abs(v - 1) > 0.03)) { m.ringOffArc++; defects.push(`ring-off-arc: the members of the ring in ${where} do not sit on one ellipse.`); }
      const ang = cs.map((p) => Math.atan2((p.y - c.y) / ry, (p.x - c.x) / rx));
      const steps = ang.map((a, i) => { let d = Math.abs(ang[(i + 1) % n] - a); if (d > Math.PI) d = 2 * Math.PI - d; return d; });
      if (steps.some((d) => Math.abs(d - (2 * Math.PI) / n) > (3 * Math.PI) / 180)) { m.ringUnequalAngles++; defects.push(`ring-unequal-angles: the members of the ring in ${where} are not at equal angles (${steps.map((d) => Math.round((d * 180) / Math.PI)).join("/")} degrees).`); }
      const labels = placeLabels(nodes, edges);
      for (const e of edges) {
        const i = S.line.indexOf(e.source), j = S.line.indexOf(e.target);
        if (i < 0 || j < 0 || ((i + 1) % n !== j && (j + 1) % n !== i)) continue;
        const L = labels.get(e.id); if (!L || !e.route) continue;
        const off = Math.max(...labelParts(e, L, L.vertical).map((p) => distToPath(p, e.route!)));
        if (off > ARC_ON) { m.ringOffArc++; defects.push(`ring-off-arc: the badge/label of edge '${e.id}' sits ${Math.round(off)}px off its arc.`); }
      }
    }
    if (gb && (S.arr === "ring" || S.arr === "hub") && kids.length) {
      const cs = (S.arr === "hub" ? [S.hub!, ...S.line] : S.line).map(centre);
      const ax = S.arr === "hub" ? centre(S.hub!).x : (Math.min(...cs.map((c) => c.x)) + Math.max(...cs.map((c) => c.x))) / 2;
      if (Math.abs(gb.x + gb.w / 2 - ax) > 2) { m.uncentredInGroup++; defects.push(`uncentred: the ${S.arr} in group '${cid}' is ${Math.round(ax - gb.x - gb.w / 2)}px off the group's centre.`); }
    } else if (gb && S.arr !== "free" && !(S.arr === "flow" && S.down && S.spine.size > 0) && kids.length) { // a spined flow is checked on its axis above
      const l = Math.min(...kids.map((k) => boxes.get(k.id)!.x)) - gb.x, r = gb.x + gb.w - Math.max(...kids.map((k) => { const b = boxes.get(k.id)!; return b.x + b.w; }));
      const cxs = kids.map((k) => centre(k.id).x), onGrid = S.arr === "row" && Math.abs((Math.min(...cxs) + Math.max(...cxs)) / 2 - (gb.x + gb.w / 2)) <= 2;
      if (Math.abs(l - r) > 2 && !onGrid) { m.uncentredInGroup++; defects.push(`uncentred: the contents of group '${cid}' have margins ${Math.round(l)}px left and ${Math.round(r)}px right.`); }
    }
  }
  return { defects, metrics: m };
}
