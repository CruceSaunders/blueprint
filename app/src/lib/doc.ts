// Conversion between the store's Visual JSON and React Flow nodes/edges.
// Child positions are RELATIVE to their parent group (React Flow parentId convention; same as the MCP server).
import type { BpEdge, BpNode, Visual } from "./types";
import type { BpRfNode } from "@/components/canvas/nodes";
import type { BpRfEdge } from "@/components/canvas/edges";
import { sizeOf, absoluteBoxes, routeEdges, labelSpot, labelBox, labelObstacles, type LNode, type LEdge, type LayoutOpts, type XY, type Box } from "./layout";

export interface DocContent {
  nodes: BpNode[];
  edges: BpEdge[];
}

const HANDLE_ALIASES: Record<string, string> = { t: "top", r: "right", b: "bottom", l: "left", top: "top", right: "right", bottom: "bottom", left: "left" };
export const normHandle = (h?: string) => (h ? HANDLE_ALIASES[h.toLowerCase()] : undefined);

/** Parents must precede children for React Flow. Drops parent refs that point nowhere or at non-groups. */
export function orderNodes(nodes: BpNode[]): BpNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: BpNode[] = [];
  const seen = new Set<string>();
  const visit = (n: BpNode, depth = 0) => {
    if (seen.has(n.id) || depth > 50) return;
    const p = n.parent ? byId.get(n.parent) : undefined;
    if (p && p.kind === "group" && p.id !== n.id) visit(p, depth + 1);
    seen.add(n.id);
    out.push(n);
  };
  nodes.forEach((n) => visit(n));
  return out;
}

export function toRfNodes(nodes: BpNode[], prev?: BpRfNode[]): BpRfNode[] {
  const prevById = new Map((prev ?? []).map((n) => [n.id, n]));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return orderNodes(nodes).map((n) => {
    const p = prevById.get(n.id);
    const parentOk = n.parent && byId.get(n.parent)?.kind === "group";
    const rf: BpRfNode = {
      id: n.id,
      type: n.kind,
      position: { x: n.position?.x ?? 0, y: n.position?.y ?? 0 },
      data: { node: n },
      parentId: parentOk ? n.parent : undefined,
      selected: p?.selected ?? false,
      zIndex: n.kind === "group" ? -1 : undefined,
    };
    const s = sizeOf(n as unknown as LNode);
    rf.width = s.w;
    rf.height = s.h;
    return rf;
  });
}

export function toRfEdges(edges: BpEdge[], prev?: BpRfEdge[]): BpRfEdge[] {
  const sel = new Set((prev ?? []).filter((e) => e.selected).map((e) => e.id));
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "bp",
    sourceHandle: normHandle(e.sourceHandle) ?? null,
    targetHandle: normHandle(e.targetHandle) ?? null,
    data: { edge: e },
    selected: sel.has(e.id),
  }));
}

/** Read positions/sizes back from React Flow into doc nodes. Size is persisted only when it was already set,
 *  the node is a group, or the user resized it. */
export function fromRfNodes(rf: BpRfNode[], base: BpNode[], resized: Set<string> = new Set()): BpNode[] {
  const rfById = new Map(rf.map((n) => [n.id, n]));
  return base.map((n) => {
    const r = rfById.get(n.id);
    if (!r) return n;
    const next: BpNode = { ...n, position: { x: Math.round(r.position.x), y: Math.round(r.position.y) } };
    if (n.size || n.kind === "group" || resized.has(n.id)) {
      const w = r.width ?? r.measured?.width;
      const h = r.height ?? r.measured?.height;
      if (typeof w === "number" && typeof h === "number") next.size = { w: Math.round(w), h: Math.round(h) };
    }
    return next;
  });
}

const onBorder = (p: XY, b: Box) => {
  const ex = Math.abs(p.x - b.x) < 1.5 || Math.abs(p.x - (b.x + b.w)) < 1.5;
  const ey = Math.abs(p.y - b.y) < 1.5 || Math.abs(p.y - (b.y + b.h)) < 1.5;
  return (ex && p.y >= b.y - 1.5 && p.y <= b.y + b.h + 1.5) || (ey && p.x >= b.x - 1.5 && p.x <= b.x + b.w + 1.5);
};

/** Doc nodes with the live (possibly mid-drag) positions and sizes from React Flow. */
export function liveNodes(docNodes: BpNode[], rfNodes: BpRfNode[]): LNode[] {
  const rfById = new Map(rfNodes.map((n) => [n.id, n]));
  return docNodes.map((n) => {
    const r = rfById.get(n.id);
    if (!r) return n as unknown as LNode;
    const w = r.width ?? r.measured?.width, h = r.height ?? r.measured?.height;
    return { ...n, position: r.position, size: n.size && w && h ? { w, h } : n.size } as unknown as LNode;
  });
}

/** Attach a route and label spot to every edge. A stored route is used while both its ends still sit on their nodes;
 *  otherwise (node dragged, resized, new edge) the edge is re-routed live with the same router the MCP server uses. */
export function withRoutes(edges: BpRfEdge[], docNodes: BpNode[], rfNodes: BpRfNode[], opts: LayoutOpts = {}): BpRfEdge[] {
  const live = liveNodes(docNodes, rfNodes);
  const boxes = absoluteBoxes(live);
  const stale = new Set<string>();
  for (const e of edges) {
    const r = e.data?.edge.route, s = boxes.get(e.source), t = boxes.get(e.target);
    if (!s || !t) continue;
    if (!r || r.length < 2 || !onBorder(r[0], s) || !onBorder(r[r.length - 1], t)) stale.add(e.id);
  }
  const fresh = stale.size ? routeEdges(live, edges.map((e) => e.data!.edge as unknown as LEdge), stale, opts) : new Map<string, XY[]>();
  const avoid = labelObstacles(live);
  const routeOf = (e: BpRfEdge) => fresh.get(e.id) ?? (stale.has(e.id) ? undefined : e.data?.edge.route);
  const all = edges.map((e) => ({ id: e.id, r: routeOf(e) }));
  return edges.map((e) => {
    const route = routeOf(e);
    const le = e.data?.edge as unknown as LEdge | undefined;
    const labelAt = route && route.length > 1 && le && labelBox(le) ? labelSpot(route, le, avoid, all.filter((o) => o.id !== e.id && o.r).map((o) => o.r!)) : undefined;
    // Later labels keep clear of earlier ones (same order and rule as the MCP server's placeLabels()).
    const ls = labelAt && le ? labelBox(le, labelAt.vertical) : null;
    if (labelAt && ls) avoid.push({ x: labelAt.x - ls.w / 2, y: labelAt.y - ls.h / 2, w: ls.w, h: ls.h });
    return { ...e, data: { ...e.data!, route, labelAt } };
  });
}

/** Routes for every edge, from the saved geometry (persisted on the edge as `route`). */
export function computeRoutes(nodes: BpNode[], edges: BpEdge[], opts: LayoutOpts = {}): BpEdge[] {
  const routes = routeEdges(nodes as unknown as LNode[], edges as unknown as LEdge[], undefined, opts);
  return edges.map((e) => { const r = routes.get(e.id); const o = { ...e }; if (r) o.route = r; else delete o.route; return o; });
}

export function descendants(id: string, nodes: BpNode[]): Set<string> {
  const out = new Set<string>();
  let frontier = [id];
  while (frontier.length) {
    const next: string[] = [];
    for (const n of nodes) if (n.parent && frontier.includes(n.parent) && !out.has(n.id)) {
      out.add(n.id);
      next.push(n.id);
    }
    frontier = next;
  }
  return out;
}

export function emptyContent(v: Visual | null): DocContent {
  return { nodes: v?.nodes ?? [], edges: v?.edges ?? [] };
}
