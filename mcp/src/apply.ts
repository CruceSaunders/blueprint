import { z } from "zod";
import { arrange, absoluteBoxes, diagnose, type LNode, type LEdge } from "./layout.js";

export const NODE_KINDS = ["card", "visual", "image", "operator", "note", "group"] as const;
export const EDGE_KINDS = ["flow", "increases", "decreases", "requires", "becomes", "equals", "versus", "blocks", "relates"] as const;
export const OPERATORS = ["+", "-", "×", "÷", "=", "&", "or", "≠", ">", "<"] as const;
export const GROUP_KINDS = ["group", "layer", "option", "boundary"] as const;
const TONES = ["neutral", "accent", "good", "warn", "bad", "muted"] as const;
const STATES = ["idea", "question", "decided", "built"] as const;
const WEIGHTS = ["sm", "md", "lg"] as const;
export const ID_RE = /^[a-z0-9_]+(-[a-z0-9_]+)*$/;
const ID_HELP = "ids must match ^[a-z0-9_]+(-[a-z0-9_]+)*$ (lowercase letters, digits, underscores, single hyphens between parts), e.g. `core-me`";

/** Hard size limits (bytes/characters). A batch over these is rejected with a fixable message. */
export const LIMITS = { ops: 500, nodes: 1000, edges: 2000, svg: 200_000, html: 200_000, text: 20_000, short: 500 } as const;
const coord = z.number().finite().min(-1e6).max(1e6);
const nodeFields = {
  position: z.object({ x: coord, y: coord }).strict().optional(),
  size: z.object({ w: z.number().positive().max(1e5), h: z.number().positive().max(1e5) }).strict().optional(),
  parent: z.string().max(LIMITS.short).optional(),
  title: z.string().max(LIMITS.short).optional(), subtitle: z.string().max(LIMITS.short).optional(),
  explanation: z.string().max(LIMITS.text).optional(),
  icon: z.string().max(80).optional(),
  tone: z.enum(TONES).optional(), state: z.enum(STATES).optional(), weight: z.enum(WEIGHTS).optional(),
  operator: z.enum(OPERATORS).optional(), groupKind: z.enum(GROUP_KINDS).optional(),
  svg: z.string().max(LIMITS.svg, `svg is longer than ${LIMITS.svg} characters; simplify the drawing or split it`).optional(),
  html: z.string().max(LIMITS.html, `html is longer than ${LIMITS.html} characters; simplify it`).optional(),
  asset: z.string().max(200).optional(), caption: z.string().max(LIMITS.text).optional(),
};
const nodeShape = z.object({ id: z.string().max(80).optional(), kind: z.string().max(40), ...nodeFields }).strict();
const nullable = Object.fromEntries(Object.entries(nodeFields).map(([k, v]) => [k, (v as any).unwrap().nullable().optional()]));
const nodePatch = z.object({ kind: z.string().optional(), ...nullable }).strict();
const edgeFields = {
  label: z.string().max(LIMITS.short).optional(), explanation: z.string().max(LIMITS.text).optional(), both: z.boolean().optional(),
  sourceHandle: z.enum(["top", "right", "bottom", "left"]).optional(), targetHandle: z.enum(["top", "right", "bottom", "left"]).optional(),
  route: z.array(z.object({ x: coord, y: coord }).strict()).max(200).optional(),
};
const edgeShape = z.object({ id: z.string().max(200).optional(), source: z.string().max(80), target: z.string().max(80), kind: z.string().max(40), ...edgeFields }).strict();
const edgePatch = z.object({ source: z.string().optional(), target: z.string().optional(), kind: z.string().optional(),
  ...Object.fromEntries(Object.entries(edgeFields).map(([k, v]) => [k, (v as any).unwrap().nullable().optional()])) }).strict();
const viewport = z.object({ x: z.number(), y: z.number(), zoom: z.number().positive() }).strict();

const OP_NAMES = ["add_node", "update_node", "remove_node", "add_edge", "update_edge", "remove_edge", "set_viewport"];

function fmtIssues(prefix: string, err: z.ZodError): string[] {
  return err.issues.map((i) => {
    if (i.code === "unrecognized_keys")
      return `${prefix}: unknown field(s) ${(i as any).keys.map((k: string) => `\`${k}\``).join(", ")}. Allowed node fields: kind, position, size, parent, title, subtitle, explanation, icon, tone, state, weight, operator, groupKind, svg, html, asset, caption. Edge fields: source, target, kind, label, explanation, both, sourceHandle, targetHandle.`;
    if (i.path[0] === "position") return `${prefix}: \`position\` must be {"x": number, "y": number} in canvas pixels (relative to the parent group's top-left if the node has a parent), e.g. {"x": 120, "y": 40}. Or leave it out and Blueprint places the node.`;
    if (i.path[0] === "size") return `${prefix}: \`size\` must be {"w": number, "h": number} with both above 0, e.g. {"w": 220, "h": 80}. Usually leave it out: Blueprint sizes nodes from their text.`;
    if (i.path[0] === "sourceHandle" || i.path[0] === "targetHandle") return `${prefix}: \`${String(i.path[0])}\` must be one of top, right, bottom, left (or leave it out to let Blueprint pick the facing sides).`;
    const p = i.path.length ? ` field \`${i.path.join(".")}\`` : "";
    return `${prefix}:${p} ${i.message}.`;
  });
}
const wc = (s?: string) => (s ?? "").trim().split(/\s+/).filter(Boolean).length;

function checkNodeIntrinsic(prefix: string, n: any, errors: string[], warnings: string[]) {
  if (!NODE_KINDS.includes(n.kind))
    errors.push(`${prefix}: unknown node kind '${n.kind}'. Valid kinds: ${NODE_KINDS.join(", ")}.`);
  if (!n.explanation || !String(n.explanation).trim())
    errors.push(`${prefix}: missing required \`explanation\` (markdown shown when the node is clicked; say what it is and why it is here).`);
  if (n.kind === "operator" && !n.operator)
    errors.push(`${prefix}: kind 'operator' needs \`operator\` set to one of ${OPERATORS.join(" ")}.`);
  if (n.kind === "image" && !n.asset)
    errors.push(`${prefix}: kind 'image' needs \`asset\` (file name returned by add_asset).`);
  if (n.kind === "visual" && !n.svg && !n.html)
    errors.push(`${prefix}: kind 'visual' needs \`svg\` (inline SVG) or \`html\` (self-contained HTML).`);
  if (n.operator && n.kind !== "operator") errors.push(`${prefix}: \`operator\` only applies to kind 'operator'.`);
  if (n.groupKind && n.kind !== "group") errors.push(`${prefix}: \`groupKind\` only applies to kind 'group'.`);
  if ((n.svg || n.html) && n.kind !== "visual") errors.push(`${prefix}: \`svg\`/\`html\` only apply to kind 'visual'.`);
  if (n.title && wc(n.title) > 5) warnings.push(`${prefix}: title "${n.title}" is over 5 words; keep titles short and put depth in explanation.`);
  if (n.subtitle && wc(n.subtitle) > 8) warnings.push(`${prefix}: subtitle is over 8 words.`);
  if (n.svg && /<script|<style|<foreignObject|\son\w+\s*=/i.test(n.svg)) warnings.push(`${prefix}: svg contains <script>, <style>, <foreignObject> or event handlers; they are stripped on render, so style with presentation attributes instead.`);
}

export interface ApplyResult {
  ok: boolean; errors: string[]; warnings: string[];
  visual?: any; summary?: string; boxes?: Record<string, [number, number, number, number]>;
}
/** Absolute bounding box per node as [x, y, w, h] in canvas pixels. */
export function boxesOf(nodes: any[]): Record<string, [number, number, number, number]> {
  const out: Record<string, [number, number, number, number]> = {};
  for (const [id, b] of absoluteBoxes(nodes as LNode[])) out[id] = [Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h)];
  return out;
}

/** Validate and apply ops to a visual (pure, no I/O except elk). Returns errors without touching the input. */
export async function applyOps(
  visual: any, ops: unknown[], layout: { direction?: "DOWN" | "RIGHT"; relayout?: boolean } = {},
  assetExists: (name: string) => boolean = () => true,
): Promise<ApplyResult> {
  const errors: string[] = [], warnings: string[] = [];
  const nodes: any[] = structuredClone(visual.nodes ?? []);
  const edges: any[] = structuredClone(visual.edges ?? []);
  let vp = visual.viewport;
  const added = { nodes: 0, edges: 0 }, removed = { nodes: 0, edges: 0 }, updated = { nodes: 0, edges: 0 };
  const newNodeIds = new Set<string>();
  const origIds = (visual.nodes ?? []).map((n: any) => n.id);
  const edgeOp = new Map<string, number>(), keepGroupSize = new Set<string>();
  const nodeIx = (id: string) => nodes.findIndex((n) => n.id === id);
  const edgeIx = (id: string) => edges.findIndex((e) => e.id === id);
  const uniq = (base: string, has: (id: string) => boolean) => { let id = base, n = 2; while (has(id)) id = `${base}-${n++}`; return id; };

  if (!Array.isArray(ops) || ops.length === 0) return { ok: false, errors: ["`ops` must be a non-empty array of operations."], warnings };
  if (ops.length > LIMITS.ops) return { ok: false, errors: [`Too many ops in one batch (${ops.length}); the limit is ${LIMITS.ops}. Split the work into several apply calls.`], warnings };

  ops.forEach((raw: any, i) => {
    const op = raw?.op;
    const head = `ops[${i}] ${op ?? "?"}`;
    if (!OP_NAMES.includes(op)) { errors.push(`ops[${i}]: unknown op '${op}'. Valid ops: ${OP_NAMES.join(", ")}.`); return; }
    switch (op) {
      case "add_node": {
        const r = nodeShape.safeParse(raw.node);
        if (!r.success) { errors.push(...fmtIssues(`${head}`, r.error)); if (!raw.node?.kind) return; }
        const n: any = { ...(raw.node ?? {}) };
        if (!n.id) n.id = uniq(slug(n.title || n.kind || "node"), (x) => nodeIx(x) >= 0);
        const pfx = `${head} '${n.id}'`;
        if (!ID_RE.test(n.id)) errors.push(`${pfx}: invalid node id; ${ID_HELP}.`);
        if (nodeIx(n.id) >= 0) errors.push(`${pfx}: duplicate node id; '${n.id}' already exists in this visual (or earlier in this batch). Pick a unique id.`);
        checkNodeIntrinsic(pfx, n, errors, warnings);
        if (n.kind === "image" && n.asset && !assetExists(n.asset)) errors.push(`${pfx}: asset '${n.asset}' not found in the project's assets/. Call add_asset first.`);
        if (n.kind === "group" && !n.groupKind) n.groupKind = "group";
        if (n.kind === "group" && n.size) keepGroupSize.add(n.id);
        nodes.push(n); newNodeIds.add(n.id); added.nodes++;
        break;
      }
      case "update_node": {
        const r = nodePatch.safeParse(raw.patch);
        if (!r.success) { errors.push(...fmtIssues(head, r.error)); return; }
        const ix = nodeIx(raw.id);
        if (ix < 0) { errors.push(`${head}: node '${raw.id}' does not exist. Node ids in the saved visual: ${origIds.join(", ") || "(none)"}.`); return; }
        const merged = { ...nodes[ix], ...raw.patch };
        for (const k of Object.keys(merged)) if (merged[k] === null) delete merged[k];
        checkNodeIntrinsic(`${head} '${raw.id}'`, merged, errors, warnings);
        if (merged.kind === "image" && merged.asset && !assetExists(merged.asset)) errors.push(`${head} '${raw.id}': asset '${merged.asset}' not found in assets/.`);
        if (merged.kind === "group" && raw.patch.size) keepGroupSize.add(merged.id);
        nodes[ix] = merged; updated.nodes++;
        break;
      }
      case "remove_node": {
        const ix = nodeIx(raw.id);
        if (ix < 0) { errors.push(`${head}: node '${raw.id}' does not exist.`); return; }
        nodes.splice(ix, 1); removed.nodes++;
        for (let j = edges.length - 1; j >= 0; j--)
          if (edges[j].source === raw.id || edges[j].target === raw.id) { edges.splice(j, 1); removed.edges++; }
        break;
      }
      case "add_edge": {
        const r = edgeShape.safeParse(raw.edge);
        if (!r.success) { errors.push(...fmtIssues(head, r.error)); return; }
        const e: any = { ...raw.edge };
        if (!e.id) e.id = uniq(`${e.source}-${e.kind}-${e.target}`, (x) => edgeIx(x) >= 0);
        const pfx = `${head} '${e.id}'`;
        if (!ID_RE.test(e.id)) errors.push(`${pfx}: invalid edge id; ${ID_HELP}.`);
        if (edgeIx(e.id) >= 0) errors.push(`${pfx}: duplicate edge id '${e.id}'.`);
        if (!EDGE_KINDS.includes(e.kind)) errors.push(`${pfx}: unknown relationship kind '${e.kind}'. Valid kinds: ${EDGE_KINDS.join(", ")}.`);
        if (!e.explanation || !String(e.explanation).trim())
          errors.push(`${pfx}: missing required \`explanation\` (one or two sentences saying what this relationship means).`);
        delete e.route;
        edges.push(e); added.edges++; edgeOp.set(e.id, i);
        break;
      }
      case "update_edge": {
        const r = edgePatch.safeParse(raw.patch);
        if (!r.success) { errors.push(...fmtIssues(head, r.error)); return; }
        const ix = edgeIx(raw.id);
        if (ix < 0) { errors.push(`${head}: edge '${raw.id}' does not exist. Edge ids in the saved visual: ${(visual.edges ?? []).map((e: any) => e.id).join(", ") || "(none)"}.`); return; }
        const merged = { ...edges[ix], ...raw.patch };
        for (const k of Object.keys(merged)) if (merged[k] === null) delete merged[k];
        edgeOp.set(merged.id, i);
        if (!EDGE_KINDS.includes(merged.kind)) errors.push(`${head} '${raw.id}': unknown relationship kind '${merged.kind}'. Valid kinds: ${EDGE_KINDS.join(", ")}.`);
        if (!merged.explanation || !String(merged.explanation).trim()) errors.push(`${head} '${raw.id}': \`explanation\` may not be empty.`);
        edges[ix] = merged; updated.edges++;
        break;
      }
      case "remove_edge": {
        const ix = edgeIx(raw.id);
        if (ix < 0) { errors.push(`${head}: edge '${raw.id}' does not exist.`); return; }
        edges.splice(ix, 1); removed.edges++;
        break;
      }
      case "set_viewport": {
        const r = viewport.safeParse(raw.viewport);
        if (!r.success) { errors.push(...fmtIssues(head, r.error)); return; }
        vp = raw.viewport;
        break;
      }
    }
  });

  // final-state reference checks (so op order inside the batch does not matter)
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const okIds = origIds.filter((x: string) => byId.has(x)); // saved ids only: nothing from this (possibly rejected) batch
  for (const e of edges) {
    const at = edgeOp.has(e.id) ? `ops[${edgeOp.get(e.id)}] ` : "";
    for (const end of ["source", "target"] as const)
      if (!byId.has(e[end]))
        errors.push(`${at}edge '${e.id}': dangling ${end} '${e[end]}' - no node with that id exists after this batch${at ? "" : " (a node it pointed to was removed)"}. Valid node ids: ${okIds.join(", ") || "(none)"}.`);
    if (e.source === e.target) errors.push(`${at}edge '${e.id}': source and target are the same node '${e.source}'.`);
  }
  for (const n of nodes) {
    if (n.parent === undefined) continue;
    const p = byId.get(n.parent);
    if (!p) errors.push(`node '${n.id}': parent '${n.parent}' does not exist after this batch (if you removed a group, remove or re-parent its children too).`);
    else if (p.kind !== "group") errors.push(`node '${n.id}': parent '${n.parent}' is kind '${p.kind}', not 'group'. Only group nodes can contain others.`);
    else {
      let cur: any = p, hops = 0;
      while (cur?.parent && hops++ < 1000) { if (cur.parent === n.id) { errors.push(`node '${n.id}': parent chain is circular.`); break; } cur = byId.get(cur.parent); }
    }
  }
  if (nodes.length > LIMITS.nodes) errors.push(`The visual would have ${nodes.length} nodes; the limit is ${LIMITS.nodes}. Split it into several visuals.`);
  if (edges.length > LIMITS.edges) errors.push(`The visual would have ${edges.length} edges; the limit is ${LIMITS.edges}.`);
  if (errors.length) return { ok: false, errors, warnings };

  let finalNodes: any[] = nodes, finalEdges: any[] = edges, needs = false;
  try {
    const r = await arrange(nodes as LNode[], edges as LEdge[], { ...layout, keepGroupSize });
    finalNodes = r.nodes; finalEdges = r.edges; needs = r.laidOut;
  } catch (e: any) { return { ok: false, errors: [`auto-layout failed: ${e?.message ?? e}. Give explicit positions or simplify the graph.`], warnings }; }
  warnings.push(...diagnose(finalNodes as LNode[], finalEdges as LEdge[]));
  const out = { ...visual, nodes: finalNodes, edges: finalEdges, viewport: vp };
  const bits = [
    added.nodes && `+${added.nodes} node(s)`, updated.nodes && `~${updated.nodes} node(s)`, removed.nodes && `-${removed.nodes} node(s)`,
    added.edges && `+${added.edges} edge(s)`, updated.edges && `~${updated.edges} edge(s)`, removed.edges && `-${removed.edges} edge(s)`,
    needs && "auto-layout applied",
  ].filter(Boolean);
  return { ok: true, errors: [], warnings, visual: out, summary: `${bits.join(", ") || "no changes"}; now ${finalNodes.length} nodes, ${finalEdges.length} edges`, boxes: boxesOf(finalNodes) };
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "node";
}
