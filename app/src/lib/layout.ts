// COPIED 1:1 from mcp/src/layout.ts (source of truth). Re-copy when that file changes.
// Auto-layout, content sizing, edge routing and layout diagnostics for Blueprint visuals.
// Plain exported functions so the app can copy this file 1:1 (app/src/lib/layout.ts). Only dependency: elkjs.
// Child positions are relative to their parent group (React Flow convention). Edge routes are absolute canvas coords.
import ELK from "elkjs/lib/elk.bundled.js";

export type LayoutDirection = "DOWN" | "RIGHT";
export interface XY { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }
export interface LNode {
  id: string; kind: string; parent?: string;
  position?: { x: number; y: number }; size?: { w: number; h: number };
  title?: string; subtitle?: string; caption?: string; icon?: string; state?: string; weight?: string; groupKind?: string;
  [k: string]: unknown;
}
export interface LEdge {
  id: string; source: string; target: string; kind?: string; label?: string;
  sourceHandle?: string; targetHandle?: string; route?: XY[];
  [k: string]: unknown;
}

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
      if (ww > maxW) { // breaks across lines
        if (cur > 0) n++;
        n += Math.ceil(ww / maxW) - 1;
        cur = ww % maxW;
        continue;
      }
      if (cur === 0) cur = ww;
      else if (cur + sp + ww <= maxW) cur += sp + ww;
      else { n++; cur = ww; }
    }
    lines += n;
  }
  return lines;
}

// ---------------------------------------------------------------- node sizes (shared with the app renderer)
/** Metrics the app renderer uses for each node kind. Keep in sync with app/src/components/canvas/nodes.tsx. */
export const CARD_METRICS = {
  sm: { w: 180, padX: 12, padY: 8, title: 12.5, sub: 11, icon: 28, gap: 12, border: 1 },
  md: { w: 220, padX: 14, padY: 12, title: 14, sub: 12, icon: 32, gap: 12, border: 1 },
  lg: { w: 250, padX: 16, padY: 14, title: 16, sub: 12, icon: 40, gap: 12, border: 1.5 },
} as const;
export const LH = 1.375; // leading-snug
export const NOTE_METRICS = { w: 200, padX: 12, padY: 10, px: 12.5 };
export const MEDIA_METRICS = { w: 260, art: 150, padX: 12, padY: 6, title: 12.5, caption: 11, lh: 1.4 };
export const GROUP_METRICS = { padX: 24, padBottom: 24, header: 48, headerSub: 62, kindPx: 10, titlePx: 13, minW: 220, minH: 120 };
export const OPERATOR_SIZE = 56;

/** Legacy defaults (kept for callers that only need a rough size). */
export const DEFAULT_SIZE: Record<string, { w: number; h: number }> = {
  card: { w: 220, h: 64 }, visual: { w: 260, h: 190 }, image: { w: 260, h: 190 },
  operator: { w: OPERATOR_SIZE, h: OPERATOR_SIZE }, note: { w: 200, h: 64 }, group: { w: 260, h: 160 },
};

const GROUP_KIND_LABEL: Record<string, string> = { group: "GROUP", layer: "LAYER", option: "OPTION", boundary: "BOUNDARY" };
/** Width of a group's header (kind label + title), measured from the frame's left edge. */
export function groupHeaderWidth(n: LNode): number {
  const kind = GROUP_KIND_LABEL[n.groupKind ?? "group"] ?? "GROUP";
  return 14 + textWidth(kind, GROUP_METRICS.kindPx, true) * 1.12 + 8 + textWidth(n.title ?? "Untitled", GROUP_METRICS.titlePx, true) + 14;
}
export function groupHeaderHeight(n: LNode): number { return n.subtitle ? GROUP_METRICS.headerSub : GROUP_METRICS.header; }

/** Size a node needs for its text at a given width (or its natural width). One function for layout and renderer. */
export function contentSize(n: LNode, width?: number): { w: number; h: number } {
  switch (n.kind) {
    case "operator": return { w: OPERATOR_SIZE, h: OPERATOR_SIZE };
    case "note": {
      const m = NOTE_METRICS, w = width ?? m.w, inner = w - 2 * m.padX;
      const t = wrapLines(n.title, m.px, inner, true), s = wrapLines(n.subtitle, m.px, inner), c = wrapLines(n.caption, m.px, inner);
      const lh = m.px * LH;
      const h = 2 * m.padY + (t + s + c) * lh + (s ? 2 : 0) + (c ? 4 : 0);
      return { w, h: Math.ceil(Math.max(56, h)) };
    }
    case "visual": case "image": {
      const m = MEDIA_METRICS, w = width ?? m.w, inner = w - 2 * m.padX - 2;
      const title = n.kind === "image" ? (n.caption || n.title) : n.title;
      const cap = n.kind === "visual" ? n.caption : undefined;
      const tl = wrapLines(title, n.kind === "image" ? 11.5 : m.title, inner, n.kind !== "image");
      const cl = wrapLines(cap, m.caption, inner);
      const footer = tl || cl ? 1 + 2 * m.padY + tl * (n.kind === "image" ? 11.5 : m.title) * m.lh + cl * m.caption * m.lh : 0;
      return { w, h: Math.ceil(2 + m.art + footer) };
    }
    case "group": {
      return { w: Math.max(GROUP_METRICS.minW, Math.ceil(groupHeaderWidth(n) + 16)), h: GROUP_METRICS.minH };
    }
    default: { // card
      const m = CARD_METRICS[(n.weight as "sm" | "md" | "lg") ?? "md"] ?? CARD_METRICS.md;
      const w = width ?? m.w;
      const inner = w - 2 * m.padX - 2 * m.border - (n.icon ? m.icon + m.gap : 0);
      const t = Math.max(1, wrapLines(n.title || "Untitled", m.title, inner, true));
      const s = wrapLines(n.subtitle, m.sub, inner);
      const textH = t * m.title * LH + (s ? 2 + s * m.sub * LH : 0);
      return { w, h: Math.ceil(2 * m.padY + 2 * m.border + Math.max(n.icon ? m.icon : 0, textH)) };
    }
  }
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
 *  Children that stick out left/top are pulled in by moving the frame instead (absolute positions are preserved). */
export function fitGroups(nodes: LNode[], keep: Set<string> = new Set(), exact = false): LNode[] {
  const out = nodes.map((n) => ({ ...n }));
  const t = tree(out);
  const groups = out.filter((n) => n.kind === "group").sort((a, b) => depthOf(b, t) - depthOf(a, t));
  for (const g of groups) {
    const kids = t.kids.get(g.id);
    if (!kids?.length) { if (!g.size) g.size = contentSize(g); continue; }
    if (keep.has(g.id) && g.size) continue;
    if (kids.some((k) => !k.position)) continue;
    const padL = GROUP_METRICS.padX, padT = groupHeaderHeight(g);
    const minX = Math.min(...kids.map((k) => k.position!.x)), minY = Math.min(...kids.map((k) => k.position!.y));
    // exact: snug fit (fresh layout). Otherwise only grow, and only pull children in when they stick out.
    const dx = exact || minX < padL ? padL - minX : 0, dy = exact || minY < padT ? padT - minY : 0;
    if (dx || dy) {
      for (const k of kids) k.position = { x: Math.round(k.position!.x + dx), y: Math.round(k.position!.y + dy) };
      const gp = g.position ?? { x: 0, y: 0 };
      g.position = { x: Math.round(gp.x - dx), y: Math.round(gp.y - dy) };
    }
    const maxX = Math.max(...kids.map((k) => k.position!.x + sizeOf(k).w));
    const maxY = Math.max(...kids.map((k) => k.position!.y + sizeOf(k).h));
    const need = {
      w: Math.ceil(Math.max(maxX + GROUP_METRICS.padX, groupHeaderWidth(g) + 16)),
      h: Math.ceil(maxY + GROUP_METRICS.padBottom),
    };
    g.size = exact || !g.size ? need : { w: Math.max(g.size.w, need.w), h: Math.max(g.size.h, need.h) };
  }
  return out;
}

// ---------------------------------------------------------------- layout
/** Relationship kinds that decide top-to-bottom order. Others (requires, equals, versus, relates) never reorder the diagram. */
export const ORDERING_KINDS = new Set(["flow", "becomes", "increases", "decreases", "blocks"]);
const LAYER_GAP = 110; // between ranks: room for a label plus two arrowheads
const NODE_GAP = 48;   // between neighbours in a rank

export function elkRootOptions(direction: LayoutDirection, inLayerGap = NODE_GAP) {
  return {
    "elk.algorithm": "layered",
    "elk.direction": direction,
    "elk.layered.spacing.nodeNodeBetweenLayers": String(LAYER_GAP),
    "elk.spacing.nodeNode": String(inLayerGap),
    "elk.spacing.componentComponent": "80",
    "elk.layered.cycleBreaking.strategy": "MODEL_ORDER",
    "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
    "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    "elk.padding": "[top=0,left=0,bottom=0,right=0]",
  };
}

const elk: any = new (ELK as any)();

/** Edge label + kind badge box size, as drawn by the app. */
export const BADGE_KINDS: Record<string, string> = { increases: "+", decreases: "−", becomes: "⇒", equals: "=", versus: "vs" };
export const LABEL_MAX_W = 200;
export function labelSize(e: LEdge): { w: number; h: number } | null {
  const badge = e.kind ? BADGE_KINDS[e.kind] : undefined;
  if (!badge && !e.label) return null;
  let w = 0;
  if (badge) w += badge.length > 1 ? 30 : 22;
  if (e.label) w += (badge ? 6 : 0) + Math.min(LABEL_MAX_W, textWidth(e.label, 11, true) + 16);
  return { w: Math.ceil(w), h: 22 };
}

interface Placed { x: number; y: number }

/** Lay out the direct children of one container. Sizes of child groups must already be final. */
async function layoutContainer(kids: LNode[], cEdges: { s: string; t: string; kind: string; lw: number }[], direction: LayoutDirection): Promise<Map<string, Placed>> {
  const pos = new Map<string, Placed>();
  if (!kids.length) return pos;
  const down = direction === "DOWN";
  const order = new Map(kids.map((k, i) => [k.id, i]));
  const ordering = cEdges.filter((e) => ORDERING_KINDS.has(e.kind));
  const bands = kids.filter((k) => k.kind === "group" && k.groupKind === "layer");
  const sideLabel = Math.max(0, ...cEdges.filter((e) => !ORDERING_KINDS.has(e.kind)).map((e) => e.lw));
  const inGap = Math.max(NODE_GAP, sideLabel ? sideLabel + 44 : 0);

  // No ordering at all: tidy rows (DOWN) or columns (RIGHT), in the order nodes were added.
  if (!ordering.length && bands.length < 2) {
    const n = kids.length;
    const perRow = n <= 5 ? n : Math.ceil(Math.sqrt(n * 1.6));
    const sz = kids.map(sizeOf);
    const cellMain = Math.max(...sz.map((s) => (down ? s.w : s.h)));
    let cursor = 0;
    for (let r = 0; r * perRow < n; r++) {
      const row = kids.slice(r * perRow, r * perRow + perRow);
      const rs = row.map(sizeOf);
      const depth = Math.max(...rs.map((s) => (down ? s.h : s.w)));
      row.forEach((k, i) => {
        const s = rs[i];
        const a = i * (cellMain + inGap) + (cellMain - (down ? s.w : s.h)) / 2;
        const b = cursor + (depth - (down ? s.h : s.w)) / 2;
        pos.set(k.id, down ? { x: a, y: b } : { x: b, y: a });
      });
      cursor += depth + (bands.length ? 60 : inGap + 16);
    }
    return pos;
  }

  // Satellites: nodes tied to the diagram only by non-ordering edges sit beside their partner, not in the ranking.
  const touched = new Set<string>();
  for (const e of ordering) { touched.add(e.s); touched.add(e.t); }
  bands.forEach((b) => touched.add(b.id));
  const partner = new Map<string, string>();
  for (const e of cEdges) {
    if (ORDERING_KINDS.has(e.kind)) continue;
    if (!touched.has(e.s) && touched.has(e.t) && !partner.has(e.s)) partner.set(e.s, e.t);
    else if (!touched.has(e.t) && touched.has(e.s) && !partner.has(e.t)) partner.set(e.t, e.s);
  }
  const ranked = kids.filter((k) => !partner.has(k.id));

  // Model order for ELK: layer bands stacked in the order added, then edges in the order added (skipping any that would form a cycle).
  const adj = new Map<string, Set<string>>(ranked.map((k) => [k.id, new Set()]));
  const reach = (a: string, b: string) => { // is b reachable from a?
    const seen = new Set<string>(); const st = [a];
    while (st.length) { const x = st.pop()!; if (x === b) return true; if (seen.has(x)) continue; seen.add(x); adj.get(x)?.forEach((y) => st.push(y)); }
    return false;
  };
  const chain: [string, string][] = [];
  for (let i = 1; i < bands.length; i++) { chain.push([bands[i - 1].id, bands[i].id]); adj.get(bands[i - 1].id)!.add(bands[i].id); }
  for (const e of ordering) {
    if (!adj.has(e.s) || !adj.has(e.t) || e.s === e.t) continue;
    if (!reach(e.t, e.s)) adj.get(e.s)!.add(e.t);
  }
  const indeg = new Map(ranked.map((k) => [k.id, 0]));
  adj.forEach((ys) => ys.forEach((y) => indeg.set(y, (indeg.get(y) ?? 0) + 1)));
  const topo: string[] = [];
  const ready = ranked.filter((k) => !indeg.get(k.id)).map((k) => k.id);
  while (ready.length) {
    ready.sort((a, b) => order.get(a)! - order.get(b)!);
    const x = ready.shift()!; topo.push(x);
    adj.get(x)!.forEach((y) => { indeg.set(y, indeg.get(y)! - 1); if (!indeg.get(y)) ready.push(y); });
  }
  for (const k of ranked) if (!topo.includes(k.id)) topo.push(k.id);

  // Layer bands get one common width (height when flowing right) before ranking, children re-centred.
  if (bands.length) {
    const full = Math.max(...bands.map((b) => (down ? sizeOf(b).w : sizeOf(b).h)));
    for (const b of bands) {
      const old = sizeOf(b), extra = full - (down ? old.w : old.h);
      if (extra <= 0) continue;
      b.size = down ? { w: full, h: old.h } : { w: old.w, h: full };
      for (const c of kidsOf.get(b.id) ?? []) if (c.position)
        c.position = down ? { x: c.position.x + extra / 2, y: c.position.y } : { x: c.position.x, y: c.position.y + extra / 2 };
    }
  }
  const graph: any = {
    id: "__c__",
    layoutOptions: elkRootOptions(direction, inGap),
    children: topo.map((id) => { const s = sizeOf(kids[order.get(id)!]); return { id, width: s.w, height: s.h }; }),
    edges: [
      ...chain.map(([s, t], i) => ({ id: `__chain${i}`, sources: [s], targets: [t] })),
      ...ordering.filter((e) => adj.has(e.s) && adj.has(e.t) && e.s !== e.t).map((e, i) => ({ id: `__e${i}`, sources: [e.s], targets: [e.t] })),
    ],
  };
  let res: any;
  try { res = await elk.layout(graph); }
  catch { graph.edges = chain.map(([s, t], i) => ({ id: `__chain${i}`, sources: [s], targets: [t] })); res = await elk.layout(graph); }
  for (const c of res.children ?? []) pos.set(c.id, { x: c.x ?? 0, y: c.y ?? 0 });

  const box = (id: string): Box => { const p = pos.get(id)!, s = sizeOf(kids[order.get(id)!]); return { x: p.x, y: p.y, w: s.w, h: s.h }; };
  // Layer bands: aligned on one edge; everything else keeps its offset from the band it sits nearest to.
  if (bands.length) {
    const start = Math.min(...bands.map((b) => (down ? pos.get(b.id)!.x : pos.get(b.id)!.y)));
    const shift = new Map<string, number>();
    for (const b of bands) { const p = pos.get(b.id)!; shift.set(b.id, start - (down ? p.x : p.y)); pos.set(b.id, down ? { x: start, y: p.y } : { x: p.x, y: start }); }
    for (const k of kids) {
      if (shift.has(k.id) || !pos.has(k.id)) continue;
      const p = pos.get(k.id)!, kb = box(k.id), mainC = down ? kb.y + kb.h / 2 : kb.x + kb.w / 2;
      let bestB = bands[0], bd = Infinity;
      for (const b of bands) { const bb = box(b.id); const c = down ? bb.y + bb.h / 2 : bb.x + bb.w / 2; if (Math.abs(c - mainC) < bd) { bd = Math.abs(c - mainC); bestB = b; } }
      const d = shift.get(bestB.id)!;
      pos.set(k.id, down ? { x: p.x + d, y: p.y } : { x: p.x, y: p.y + d });
    }
  }
  // Satellites beside their partner (right of it when stacking down, below it when flowing right).
  const perPartner = new Map<string, number>();
  for (const k of kids) {
    const p = partner.get(k.id); if (!p) continue;
    const pb = box(p), s = sizeOf(k), lw = Math.max(60, ...cEdges.filter((e) => (e.s === k.id && e.t === p) || (e.t === k.id && e.s === p)).map((e) => e.lw + 44));
    const off = perPartner.get(p) ?? 0;
    pos.set(k.id, down ? { x: pb.x + pb.w + lw + off, y: pb.y + (pb.h - s.h) / 2 } : { x: pb.x + (pb.w - s.w) / 2, y: pb.y + pb.h + lw + off });
    perPartner.set(p, off + (down ? s.w : s.h) + NODE_GAP);
  }
  // Resolve any overlap by pushing the later node sideways (bands never move).
  const fixed = new Set(bands.map((b) => b.id));
  const movable = kids.filter((k) => !fixed.has(k.id)).sort((a, b) => (down ? pos.get(a.id)!.x - pos.get(b.id)!.x : pos.get(a.id)!.y - pos.get(b.id)!.y));
  const settled: string[] = [...fixed];
  for (const k of movable) {
    for (let guard = 0; guard < 200; guard++) {
      const kb = box(k.id);
      const hit = settled.map(box).find((o) => kb.x < o.x + o.w + 40 && o.x < kb.x + kb.w + 40 && kb.y < o.y + o.h + 40 && o.y < kb.y + kb.h + 40);
      if (!hit) break;
      const p = pos.get(k.id)!;
      pos.set(k.id, down ? { x: hit.x + hit.w + 56, y: p.y } : { x: p.x, y: hit.y + hit.h + 56 });
    }
    settled.push(k.id);
  }
  return pos;
}
// set per call of layoutNodes so layoutContainer can re-centre band children
let kidsOf = new Map<string, LNode[]>();

/**
 * Returns a new node array with positions and group sizes filled in.
 * Nodes lacking `position` are placed; with relayout:true every node is re-placed.
 * Hand-placed siblings keep their position; new siblings are placed below them without overlap.
 */
export async function layoutNodes(
  nodes: LNode[], edges: LEdge[],
  opts: { direction?: LayoutDirection; relayout?: boolean } = {},
): Promise<LNode[]> {
  const direction = opts.direction ?? "DOWN";
  const relayout = !!opts.relayout;
  const out: LNode[] = nodes.map((n) => ({ ...n }));
  if (!relayout && out.every((n) => n.position)) return out;
  const wasPlaced = new Set(nodes.filter((n) => n.position).map((n) => n.id));
  const isNew = (n: LNode) => relayout || !wasPlaced.has(n.id);
  const t = tree(out);
  kidsOf = t.kids;

  // edges lifted to the container where they meet (lowest common ancestor)
  const lifted = new Map<string, { s: string; t: string; kind: string; lw: number }[]>();
  for (const e of edges) {
    if (!t.byId.has(e.source) || !t.byId.has(e.target) || e.source === e.target) continue;
    const pa = [e.source, ...ancestors(e.source, t)], pb = [e.target, ...ancestors(e.target, t)];
    const common = pa.find((x) => pb.includes(x) && x !== e.source && x !== e.target) ?? (pb.includes(e.source) || pa.includes(e.target) ? null : "");
    if (common === null) continue; // edge between a group and its own descendant
    const ia = pa.indexOf(common), ib = pb.indexOf(common);
    const s = common === "" ? pa[pa.length - 1] : pa[ia - 1];
    const tt = common === "" ? pb[pb.length - 1] : pb[ib - 1];
    if (!s || !tt || s === tt) continue;
    (lifted.get(common) ?? lifted.set(common, []).get(common)!).push({ s, t: tt, kind: e.kind ?? "relates", lw: labelSize(e)?.w ?? 0 });
  }

  const containers = [...out.filter((n) => n.kind === "group").sort((a, b) => depthOf(b, t) - depthOf(a, t)).map((g) => g.id), ""];
  for (const cid of containers) {
    const kids = t.kids.get(cid) ?? [];
    if (!kids.length) continue;
    const fresh = kids.filter(isNew), pinned = kids.filter((k) => !isNew(k));
    if (fresh.length) {
      const proposed = await layoutContainer(kids, lifted.get(cid) ?? [], direction);
      if (!pinned.length) {
        for (const k of kids) { const p = proposed.get(k.id)!; k.position = { x: Math.round(p.x), y: Math.round(p.y) }; }
      } else {
        // place the fresh ones (keeping their proposed arrangement) below the hand-placed ones
        const pb = { minX: Math.min(...pinned.map((n) => n.position!.x)), maxY: Math.max(...pinned.map((n) => n.position!.y + sizeOf(n).h)) };
        const fminX = Math.min(...fresh.map((n) => proposed.get(n.id)!.x)), fminY = Math.min(...fresh.map((n) => proposed.get(n.id)!.y));
        for (const n of fresh) { const p = proposed.get(n.id)!; n.position = { x: Math.round(p.x - fminX + pb.minX), y: Math.round(p.y - fminY + pb.maxY + 80) }; }
      }
    }
    if (cid) {
      const g = t.byId.get(cid)!;
      const fitted = fitGroups([g, ...kids].map((n) => (n === g ? { ...g, parent: undefined } : n)), new Set(), relayout || !pinned.length);
      const fg = fitted[0];
      // fitGroups shifts kids; copy back
      fitted.slice(1).forEach((k, i) => { kids[i].position = k.position; });
      g.size = fg.size;
      if (g.position && fg.position && (fg.position.x !== g.position.x || fg.position.y !== g.position.y) && !isNew(g)) g.position = fg.position;
    }
  }
  // normalise top level so the drawing starts near the origin
  if (relayout) {
    const top = t.kids.get("") ?? [];
    const mx = Math.min(...top.map((n) => n.position!.x)), my = Math.min(...top.map((n) => n.position!.y));
    for (const n of top) n.position = { x: Math.round(n.position!.x - mx), y: Math.round(n.position!.y - my) };
  }
  return out;
}

// ---------------------------------------------------------------- edge routing
export type Side = "top" | "right" | "bottom" | "left";
const HANDLE_ALIAS: Record<string, Side> = { t: "top", r: "right", b: "bottom", l: "left", top: "top", right: "right", bottom: "bottom", left: "left" };
export const normSide = (h?: string): Side | undefined => (h ? HANDLE_ALIAS[h.toLowerCase()] : undefined);
const NORMAL: Record<Side, XY> = { top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const STUB = 18, MARGIN = 12, BEND = 34;

/** Box of a group's header text (title + kind label) in absolute coords. Edges must never cross it. */
export function groupTitleBox(n: LNode, b: Box): Box {
  return { x: b.x + 8, y: b.y + 4, w: Math.min(b.w - 16, groupHeaderWidth(n)), h: groupHeaderHeight(n) - 16 };
}

function facingSides(s: Box, t: Box): [Side, Side] {
  const dx = t.x + t.w / 2 - (s.x + s.w / 2), dy = t.y + t.h / 2 - (s.y + s.h / 2);
  const gapX = Math.max(t.x - (s.x + s.w), s.x - (t.x + t.w));
  const gapY = Math.max(t.y - (s.y + s.h), s.y - (t.y + t.h));
  if (gapX > gapY) return dx >= 0 ? ["right", "left"] : ["left", "right"];
  return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
}

/** Usable span along a side for ports: [from,to] along the side's axis (absolute). */
function sideSpan(n: LNode, b: Box, side: Side, ignoreChip = false): [number, number] {
  const corner = n.kind === "operator" ? b.w / 2 - 1 : 14;
  if (side === "top" || side === "bottom") {
    let from = b.x + corner, to = b.x + b.w - corner;
    if (side === "top" && n.state && n.kind !== "group" && !ignoreChip) to = Math.max(from, to - 96); // keep clear of the state chip
    if (n.kind === "group" && side === "top") from = Math.min(to - 10, b.x + groupHeaderWidth(n) + 16);
    return [from, Math.max(from, to)];
  }
  let from = b.y + corner, to = b.y + b.h - corner;
  if (n.kind === "group") from = Math.min(to - 10, b.y + groupHeaderHeight(n));
  return [from, Math.max(from, to)];
}

class Heap { a: [number, number][] = []; push(x: [number, number]) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const top = a[0]; const last = a.pop()!; if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; } }

const inside = (p: XY, b: Box) => p.x > b.x + 0.01 && p.x < b.x + b.w - 0.01 && p.y > b.y + 0.01 && p.y < b.y + b.h - 0.01;
const inflate = (b: Box, m: number): Box => ({ x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m });

/** Orthogonal route from p0 (leaving in dir d0) to p1 (arriving in dir d1) around hard obstacles; soft boxes cost more. */
function astar(p0: XY, d0: XY, p1: XY, d1: XY, hard: Box[], soft: Box[], used: Set<string>): XY[] | null {
  const xsSet = new Set<number>([p0.x, p1.x]), ysSet = new Set<number>([p0.y, p1.y]);
  const all = [...hard, ...soft.map((b) => inflate(b, MARGIN))];
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
  const N = X * Y * 4;
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
    if (i === ti && j === tj) { if (d === goalDir) { best = st; break; } }
    for (let nd = 0; nd < 4; nd++) {
      if (DIRS[nd].x === -DIRS[d].x && DIRS[nd].y === -DIRS[d].y) continue;
      const ni = i + DIRS[nd].x, nj = j + DIRS[nd].y;
      if (ni < 0 || nj < 0 || ni >= X || nj >= Y || blocked[idx(ni, nj)]) continue;
      const mid = { x: (xs[i] + xs[ni]) / 2, y: (ys[j] + ys[nj]) / 2 };
      if (hard.some((b) => inside(mid, b))) continue;
      const len = Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j]);
      let c = len;
      if (soft.some((b) => inside(mid, inflate(b, 8)))) c += len * 3; // also keeps lines off unrelated frame borders
      if (used.has(`${Math.round(mid.x)},${Math.round(mid.y)}`)) c += len * 1.5;
      if (nd !== d) c += BEND;
      if (ni === ti && nj === tj && nd !== goalDir) c += BEND;
      const ns = idx(ni, nj) * 4 + nd;
      if (g[st] + c < g[ns] - 1e-6) { g[ns] = g[st] + c; prev[ns] = st; heap.push([g[ns] + h(ni, nj), ns]); }
    }
  }
  if (best < 0) {
    let bc = Infinity;
    for (let d = 0; d < 4; d++) { const s = idx(ti, tj) * 4 + d; if (g[s] < bc) { bc = g[s]; best = s; } }
    if (best < 0 || bc === Infinity) return null;
  }
  const pts: XY[] = [];
  for (let s = best; s >= 0; s = prev[s]) { const cell = s >> 2; pts.push({ x: xs[cell % X], y: ys[(cell / X) | 0] }); if (s === start) break; }
  pts.reverse();
  // mark used segments
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], b = pts[k];
    const ai = xs.indexOf(a.x), bi = xs.indexOf(b.x), aj = ys.indexOf(a.y), bj = ys.indexOf(b.y);
    for (let i = Math.min(ai, bi); i < Math.max(ai, bi); i++) used.add(`${Math.round((xs[i] + xs[i + 1]) / 2)},${Math.round(a.y)}`);
    for (let j = Math.min(aj, bj); j < Math.max(aj, bj); j++) used.add(`${Math.round(a.x)},${Math.round((ys[j] + ys[j + 1]) / 2)}`);
  }
  return pts;
}

function simplify(pts: XY[]): XY[] {
  const out: XY[] = [];
  for (const p of pts) {
    const q = { x: Math.round(p.x), y: Math.round(p.y) };
    if (out.length && out[out.length - 1].x === q.x && out[out.length - 1].y === q.y) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2], b = out[out.length - 1];
      if ((a.x === b.x && b.x === q.x) || (a.y === b.y && b.y === q.y)) { out[out.length - 1] = q; continue; }
    }
    out.push(q);
  }
  return out;
}

/**
 * Orthogonal routes for edges (absolute canvas coords, first point on the source border, last on the target border).
 * Routes avoid every card that is not an endpoint and every group title; they prefer not to cut through unrelated groups.
 * `only` limits which edges are computed (others still reserve their ports).
 */
export function routeEdges(nodes: LNode[], edges: LEdge[], only?: Set<string>): Map<string, XY[]> {
  const t = tree(nodes);
  const boxes = absoluteBoxes(nodes);
  const result = new Map<string, XY[]>();
  const valid = edges.filter((e) => boxes.has(e.source) && boxes.has(e.target) && e.source !== e.target);
  // 1. sides
  const ends: { e: LEdge; side: [Side, Side] }[] = valid.map((e) => {
    const auto = facingSides(boxes.get(e.source)!, boxes.get(e.target)!);
    return { e, side: [normSide(e.sourceHandle) ?? auto[0], normSide(e.targetHandle) ?? auto[1]] };
  });
  // 2. ports: spread edges sharing a side, ordered by where the other end is; align with the other end when alone
  const bySide = new Map<string, { key: string; other: Box; otherSpan: [number, number]; end: 0 | 1; e: LEdge }[]>();
  for (const { e, side } of ends) {
    for (const end of [0, 1] as const) {
      const id = end === 0 ? e.source : e.target, oid = end === 0 ? e.target : e.source;
      const k = `${id}|${side[end]}`;
      const ob = boxes.get(oid)!;
      (bySide.get(k) ?? bySide.set(k, []).get(k)!).push({ key: `${e.id}|${end}`, other: ob, otherSpan: sideSpan(t.byId.get(oid)!, ob, side[1 - end]), end, e });
    }
  }
  const port = new Map<string, XY>();
  for (const [k, list] of bySide) {
    const [id, side] = k.split("|") as [string, Side];
    const n = t.byId.get(id)!, b = boxes.get(id)!;
    const [from, to] = sideSpan(n, b, side);
    const horiz = side === "top" || side === "bottom";
    const oc = (o: Box) => (horiz ? o.x + o.w / 2 : o.y + o.h / 2);
    list.sort((a, c) => oc(a.other) - oc(c.other));
    let coords: number[];
    if (list.length === 1) {
      const [oFrom, oTo] = list[0].otherSpan;
      const lo = Math.max(from, oFrom), hi = Math.min(to, oTo);
      coords = [lo <= hi ? (lo + hi) / 2 : (from + to) / 2];
    } else {
      const span = to - from, step = Math.min(36, span / list.length);
      const mid = (from + to) / 2;
      coords = list.map((_, i) => mid + (i - (list.length - 1) / 2) * step);
    }
    list.forEach((it, i) => {
      let c = coords[i];
      c = Math.round(c);
      const p = side === "top" ? { x: c, y: b.y } : side === "bottom" ? { x: c, y: b.y + b.h } : side === "left" ? { x: b.x, y: c } : { x: b.x + b.w, y: c };
      port.set(it.key, p);
    });
  }
  // 3. route
  const used = new Set<string>();
  const titleBoxes = nodes.filter((n) => n.kind === "group").map((n) => ({ id: n.id, b: groupTitleBox(n, boxes.get(n.id)!) }));
  for (const { e, side } of ends) {
    if (only && !only.has(e.id)) continue;
    const related = new Set([e.source, e.target, ...ancestors(e.source, t), ...ancestors(e.target, t)]);
    const hard: Box[] = [];
    for (const n of nodes) {
      if (n.kind === "group" || n.id === e.source || n.id === e.target) continue;
      hard.push(inflate(boxes.get(n.id)!, MARGIN));
    }
    for (const tb of titleBoxes) hard.push(inflate(tb.b, 6));
    // slide a port along its side until the line can leave it without starting inside a title or card margin
    const slide = (id: string, sd: Side, p: XY): XY => {
      const nrm = NORMAL[sd];
      const blockedAt = (q: XY) => { const st = { x: q.x + nrm.x * STUB, y: q.y + nrm.y * STUB }; return hard.some((h) => inside(st, h) || inside(q, h)); };
      if (!blockedAt(p)) return p;
      const horiz = sd === "top" || sd === "bottom", base = horiz ? p.x : p.y;
      for (const ignoreChip of [false, true]) { // prefer clear of the state chip; touching it beats crossing a title
        const [from, to] = sideSpan(t.byId.get(id)!, boxes.get(id)!, sd, ignoreChip);
        for (let d = 6; d <= to - from + Math.abs(base - from); d += 6) for (const sg of [d, -d]) {
          const c = base + sg; if (c < from || c > to) continue;
          const q = horiz ? { x: Math.round(c), y: p.y } : { x: p.x, y: Math.round(c) };
          if (!blockedAt(q)) return q;
        }
      }
      return p;
    };
    const ps = slide(e.source, side[0], port.get(`${e.id}|0`)!), pt = slide(e.target, side[1], port.get(`${e.id}|1`)!);
    const ns = NORMAL[side[0]], nt = NORMAL[side[1]];
    const s0 = { x: ps.x + ns.x * STUB, y: ps.y + ns.y * STUB }, t0 = { x: pt.x + nt.x * STUB, y: pt.y + nt.y * STUB };
    const soft = nodes.filter((n) => n.kind === "group" && !related.has(n.id)).map((n) => boxes.get(n.id)!);
    // an endpoint that is a group: its own children are in the way too (already hard); stubs may start inside nothing else
    const path = astar(s0, ns, t0, { x: -nt.x, y: -nt.y }, hard, soft, used);
    const pts = path ? [ps, ...path, pt] : [ps, s0, { x: s0.x, y: t0.y }, t0, pt];
    result.set(e.id, simplify(pts));
  }
  return result;
}

/** Where to draw an edge's label/badge: on the longest straight run that fits it, clear of the arrowheads and of `avoid` boxes. */
export function labelSpot(route: XY[], size: { w: number; h: number }, avoid: Box[] = []): XY {
  let best: { c: XY; score: number } | null = null;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i];
    const horiz = a.y === b.y;
    let lo = horiz ? Math.min(a.x, b.x) : Math.min(a.y, b.y), hi = horiz ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
    if (i === 1) { if ((horiz ? a.x : a.y) === lo) lo += 14; else hi -= 14; }
    if (i === route.length - 1) { if ((horiz ? b.x : b.y) === hi) hi -= 18; else lo += 18; }
    const half = (horiz ? size.w : size.h) / 2 + 4;
    const len = hi - lo, fits = len >= 2 * half;
    // try the middle first, then slide toward both ends
    const tries = fits ? [0, 0.15, -0.15, 0.3, -0.3, 0.45, -0.45] : [0];
    for (const f of tries) {
      const m = (lo + hi) / 2 + f * Math.max(0, len - 2 * half);
      const c = horiz ? { x: m, y: a.y } : { x: a.x, y: m };
      const lb = { x: c.x - size.w / 2 - 3, y: c.y - size.h / 2 - 3, w: size.w + 6, h: size.h + 6 };
      const clear = !avoid.some((o) => lb.x < o.x + o.w && o.x < lb.x + lb.w && lb.y < o.y + o.h && o.y < lb.y + lb.h);
      const score = (clear ? 20000 : 0) + (fits ? 10000 : 0) + len - Math.abs(f) * 100;
      if (!best || score > best.score) best = { c, score };
      if (clear) break;
    }
  }
  return best?.c ?? route[0];
}
/** Boxes an edge label must stay clear of: every non-group node and every group title. */
export function labelObstacles(nodes: LNode[]): Box[] {
  const boxes = absoluteBoxes(nodes);
  return [
    ...nodes.filter((n) => n.kind !== "group").map((n) => boxes.get(n.id)!),
    ...nodes.filter((n) => n.kind === "group").map((n) => groupTitleBox(n, boxes.get(n.id)!)),
  ];
}

// ---------------------------------------------------------------- one-shot arrange + diagnostics
/** Lay out (if needed), fit groups, and route every edge. What `apply`, the app's Tidy and fixtures all use. */
export async function arrange(
  nodes: LNode[], edges: LEdge[],
  opts: { direction?: LayoutDirection; relayout?: boolean; keepGroupSize?: Set<string> } = {},
): Promise<{ nodes: LNode[]; edges: LEdge[]; laidOut: boolean }> {
  const needs = !!opts.relayout || nodes.some((n) => !n.position);
  let ns = needs ? await layoutNodes(nodes, edges, opts) : nodes.map((n) => ({ ...n }));
  ns = fitGroups(ns, opts.relayout ? new Set() : opts.keepGroupSize ?? new Set());
  const routes = routeEdges(ns, edges);
  const es = edges.map((e) => { const r = routes.get(e.id); const o = { ...e }; if (r) o.route = r; else delete o.route; return o; });
  return { nodes: ns, edges: es, laidOut: needs };
}

const overlaps = (a: Box, b: Box, pad = 0) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
function segHits(a: XY, b: XY, r: Box) {
  const box = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
  return box.x < r.x + r.w - 0.5 && r.x + 0.5 < box.x + box.w && box.y < r.y + r.h - 0.5 && r.y + 0.5 < box.y + box.h
    || (box.w === 0 && box.x > r.x + 0.5 && box.x < r.x + r.w - 0.5 && box.y < r.y + r.h - 0.5 && box.y + box.h > r.y + 0.5)
    || (box.h === 0 && box.y > r.y + 0.5 && box.y < r.y + r.h - 0.5 && box.x < r.x + r.w - 0.5 && box.x + box.w > r.x + 0.5);
}

/** Layout problems worth fixing. Warnings, never errors. */
export function diagnose(nodes: LNode[], edges: LEdge[]): string[] {
  const w: string[] = [];
  const t = tree(nodes);
  const boxes = absoluteBoxes(nodes);
  const anc = new Map(nodes.map((n) => [n.id, new Set(ancestors(n.id, t))]));
  const content = nodes.filter((n) => n.kind !== "group");
  if (content.length > 15) w.push(`crowded: ${content.length} non-group nodes (aim for 5-12; over ~15, split into an overview plus detail visuals).`);
  // overlaps between nodes that are not nested in each other
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j];
    if (anc.get(a.id)!.has(b.id) || anc.get(b.id)!.has(a.id)) continue;
    if (overlaps(boxes.get(a.id)!, boxes.get(b.id)!, -1)) w.push(`overlap: '${a.id}' and '${b.id}' overlap on the canvas. Move one, or re-run apply with layout {relayout:true}.`);
  }
  // children outside their frame
  for (const n of nodes) {
    const p = t.parentOf(n); if (!p) continue;
    const b = boxes.get(n.id)!, g = boxes.get(p)!;
    if (b.x < g.x || b.y < g.y || b.x + b.w > g.x + g.w || b.y + b.h > g.y + g.h) w.push(`outside-frame: '${n.id}' sticks out of its group '${p}'.`);
  }
  // text clipping for explicitly sized nodes
  for (const n of nodes) {
    if (!n.size || n.kind === "group" || n.kind === "operator") continue;
    const need = contentSize(n, n.size.w);
    if (need.h > n.size.h + 2) w.push(`clipped-text: '${n.id}' is ${n.size.w}x${n.size.h} but its text needs ${need.h}px of height. Remove \`size\` (patch size:null) to auto-size, or enlarge it.`);
  }
  for (const n of nodes) if (n.kind === "group" && n.size && groupHeaderWidth(n) > n.size.w) w.push(`clipped-text: group '${n.id}' title is wider than its frame.`);
  // edges through cards / titles, labels on cards
  const titles = nodes.filter((n) => n.kind === "group").map((n) => ({ id: n.id, b: groupTitleBox(n, boxes.get(n.id)!) }));
  const avoid = labelObstacles(nodes);
  const placed: { id: string; b: Box }[] = [];
  for (const e of edges) {
    const r = e.route; if (!r || r.length < 2) continue;
    const hits = new Set<string>();
    for (let k = 1; k < r.length; k++) {
      for (const n of content) if (n.id !== e.source && n.id !== e.target && segHits(r[k - 1], r[k], boxes.get(n.id)!)) hits.add(`card '${n.id}'`);
      for (const tb of titles) if (segHits(r[k - 1], r[k], tb.b)) hits.add(`title of group '${tb.id}'`);
    }
    if (hits.size) w.push(`edge-crossing: edge '${e.id}' passes through ${[...hits].join(", ")}.`);
    const ls = labelSize(e);
    if (ls) {
      const c = labelSpot(r, ls, avoid), lb = { x: c.x - ls.w / 2, y: c.y - ls.h / 2, w: ls.w, h: ls.h };
      const on = content.filter((n) => overlaps(lb, boxes.get(n.id)!, 2)).map((n) => n.id);
      if (on.length) w.push(`label-overlap: label of edge '${e.id}' touches ${on.map((x) => `'${x}'`).join(", ")}.`);
      const stacked = placed.filter((p) => overlaps(lb, p.b, 2)).map((p) => `'${p.id}'`);
      if (stacked.length) w.push(`label-overlap: label/badge of edge '${e.id}' sits on the label/badge of edge ${stacked.join(", ")}; one hides the other. Re-run apply with layout {relayout:true}, shorten a label, or drop a label that the kind badge already says.`);
      const under = edges.filter((o) => o.id !== e.id && o.route && o.route.length > 1 && o.route.some((pt, k) => k > 0 && segHits(o.route![k - 1], pt, lb))).map((o) => `'${o.id}'`);
      if (under.length) w.push(`label-overlap: label/badge of edge '${e.id}' is drawn across the line of edge ${under.join(", ")}.`);
      placed.push({ id: e.id, b: lb });
      avoid.push(lb); // later labels are nudged clear of this one, exactly as the app draws them
      if (e.label && textWidth(e.label, 11, true) + 16 > LABEL_MAX_W) w.push(`clipped-text: label of edge '${e.id}' is too long and will be cut; keep labels to 2-4 words.`);
    }
  }
  return w;
}
