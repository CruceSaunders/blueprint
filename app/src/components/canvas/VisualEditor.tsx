import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap, ConnectionMode,
  applyNodeChanges, applyEdgeChanges, useReactFlow,
  type NodeChange, type EdgeChange, type Connection, type OnBeforeDelete,
} from "@xyflow/react";
import type { BpEdge, BpNode, NodeKind, Visual, VisualIds, TreeProject } from "@/lib/types";
import { api } from "@/lib/api";
import { CanvasCtx, nodeTypes, type BpRfNode, type CanvasCtxValue } from "./nodes";
import { EdgeMarkers, edgeTypes, type BpRfEdge } from "./edges";
import { computeRoutes, descendants, fromRfNodes, toRfEdges, toRfNodes, withRoutes, type DocContent } from "@/lib/doc";
import { arrange, sizeOf, type LayoutDirection, type LNode, type LEdge } from "@/lib/layout";
import { newId } from "@/lib/utils";
import { AddToolbar } from "../AddToolbar";
import { DetailPanel } from "../DetailPanel";
import { VisualHeader } from "../VisualHeader";

type Meta = Omit<Visual, "nodes" | "edges">;

const clean = <T extends object>(o: T): T => {
  const out = { ...o } as Record<string, unknown>;
  for (const k of Object.keys(out)) if (out[k] === undefined || out[k] === "") delete out[k];
  return out as T;
};

const PLACEHOLDER_SVG = `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="180" height="100" rx="12" fill="none" stroke="currentColor" stroke-opacity="0.25" stroke-dasharray="6 6"/><circle cx="70" cy="60" r="22" fill="#6b8afd" fill-opacity="0.25"/><rect x="104" y="40" width="50" height="40" rx="8" fill="#3fb37f" fill-opacity="0.25"/></svg>`;

function defaultsFor(kind: NodeKind): Partial<BpNode> {
  switch (kind) {
    case "card": return { title: "New card" };
    case "visual": return { title: "Drawing", svg: PLACEHOLDER_SVG };
    case "image": return { title: "Image" };
    case "operator": return { operator: "+" };
    case "note": return { title: "Note", caption: "Double-click to write" };
    case "group": return { groupKind: "group", title: "Group", size: { w: 380, h: 240 } };
  }
}

export interface EditorProps {
  ids: VisualIds;
  tree: TreeProject[];
  focusNodeId?: string | null;
  onNotice: (msg: string) => void;
}

export function VisualEditor(props: EditorProps) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  );
}

function EditorInner({ ids, tree, focusNodeId, onNotice }: EditorProps) {
  const rf = useReactFlow<BpRfNode, BpRfEdge>();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [missing, setMissing] = useState(false);
  const [nodes, setNodesState] = useState<BpRfNode[]>([]);
  const [edges, setEdgesState] = useState<BpRfEdge[]>([]);
  const content = useRef<DocContent>({ nodes: [], edges: [] });
  const metaRef = useRef<Meta | null>(null);
  const rev = useRef(0);
  const undoStack = useRef<DocContent[]>([]);
  const redoStack = useRef<DocContent[]>([]);
  const saveTimer = useRef<number | null>(null);
  const resized = useRef(new Set<string>());
  const [geomTick, setGeomTick] = useState(0);
  // The detail panel opens only on a genuine click (pointer up within 4px of pointer down), never on drag/resize/connect.
  const [detail, setDetail] = useState<{ type: "node" | "edge"; id: string } | null>(null);
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const isClick = (e: { clientX: number; clientY: number }) => !!downAt.current && Math.hypot(e.clientX - downAt.current.x, e.clientY - downAt.current.y) <= 4;
  const [, force] = useState(0);
  const idsRef = useRef(ids);
  idsRef.current = ids;

  // ---------- save ----------
  const adopt = useCallback((v: Visual) => {
    rev.current = v.rev ?? 0;
    const { nodes: n, edges: e, ...m } = v;
    metaRef.current = m;
    setMeta(m);
    content.current = { nodes: n ?? [], edges: e ?? [] };
    setNodesState((prev) => toRfNodes(content.current.nodes, prev));
    setEdgesState((prev) => toRfEdges(content.current.edges, prev));
  }, []);

  const save = useCallback(async () => {
    saveTimer.current = null;
    const m = metaRef.current;
    if (!m) return;
    const doc: Visual = { ...m, nodes: content.current.nodes, edges: content.current.edges };
    const res = await api.saveVisual(idsRef.current, doc, rev.current);
    if (res.ok) rev.current = res.rev;
    else if ("conflict" in res) {
      adopt(res.current);
      onNotice("This visual was changed elsewhere (probably by your AI). Showing the newest version; your last edit was not saved.");
    } else onNotice(`Could not save: ${res.error}`);
  }, [adopt, onNotice]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void save(), 400);
  }, [save]);

  // flush on unmount
  useEffect(() => () => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      void save();
    }
  }, [save]);

  const apply = useCallback((next: DocContent, opts: { record?: boolean; rebuild?: boolean } = {}) => {
    if (opts.record !== false) {
      undoStack.current.push(content.current);
      if (undoStack.current.length > 200) undoStack.current.shift();
      redoStack.current = [];
    }
    content.current = next;
    if (opts.rebuild !== false) {
      setNodesState((prev) => toRfNodes(next.nodes, prev));
      setEdgesState((prev) => toRfEdges(next.edges, prev));
    }
    scheduleSave();
    force((x) => x + 1);
  }, [scheduleSave]);

  // ---------- load + live reload ----------
  useEffect(() => {
    let cancelled = false;
    void api.readVisual(ids).then((v) => {
      if (cancelled) return;
      if (!v) return setMissing(true);
      adopt(v);
    });
    return () => { cancelled = true; };
  }, [ids, adopt]);

  useEffect(() => api.onStoreChanged(async (paths) => {
    const suffix = `/systems/${ids.systemId}/visuals/${ids.visualId}.json`;
    if (!paths.some((p) => p.endsWith(suffix) && p.includes(`/projects/${ids.projectId}/`))) return;
    if (saveTimer.current) return; // our own edit is pending; its save will detect any conflict
    const v = await api.readVisual(ids);
    if (!v) return setMissing(true);
    if ((v.rev ?? 0) <= rev.current) return; // our own write echoing back
    undoStack.current.push(content.current);
    redoStack.current = [];
    adopt(v); // viewport untouched
  }), [ids, adopt]);

  // ---------- geometry commits (drag end / resize end) ----------
  useEffect(() => {
    if (!geomTick) return;
    const nextNodes = fromRfNodes(nodes, content.current.nodes, resized.current);
    if (JSON.stringify(nextNodes) === JSON.stringify(content.current.nodes)) return;
    // moved/resized: every edge gets a fresh route from the saved geometry (stale routes are never kept)
    apply({ nodes: nextNodes, edges: computeRoutes(nextNodes, content.current.edges) }, { rebuild: false });
    setEdgesState((prev) => toRfEdges(content.current.edges, prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geomTick]);

  const onNodesChange = useCallback((changes: NodeChange<BpRfNode>[]) => {
    setNodesState((nds) => applyNodeChanges(changes, nds));
    if (changes.some((c) => c.type === "position" && c.dragging === false)) setGeomTick((t) => t + 1);
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange<BpRfEdge>[]) => {
    setEdgesState((eds) => applyEdgeChanges(changes, eds));
  }, []);

  // ---------- operations ----------
  const updateNode = useCallback((id: string, patch: Partial<BpNode>) => {
    apply({ ...content.current, nodes: content.current.nodes.map((n) => (n.id === id ? clean({ ...n, ...patch }) : n)) });
  }, [apply]);
  const updateEdge = useCallback((id: string, patch: Partial<BpEdge>) => {
    apply({ ...content.current, edges: content.current.edges.map((e) => (e.id === id ? clean({ ...e, ...patch }) : e)) });
  }, [apply]);

  const deleteIds = useCallback((nodeIds: string[], edgeIds: string[]) => {
    const kill = new Set(nodeIds);
    for (const id of nodeIds) descendants(id, content.current.nodes).forEach((d) => kill.add(d));
    const ek = new Set(edgeIds);
    apply({
      nodes: content.current.nodes.filter((n) => !kill.has(n.id)),
      edges: content.current.edges.filter((e) => !ek.has(e.id) && !kill.has(e.source) && !kill.has(e.target)),
    });
  }, [apply]);

  const onBeforeDelete: OnBeforeDelete<BpRfNode, BpRfEdge> = useCallback(async ({ nodes: dn, edges: de }) => {
    deleteIds(dn.map((n) => n.id), de.map((e) => e.id));
    return false;
  }, [deleteIds]);

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return;
    const taken = new Set(content.current.edges.map((e) => e.id));
    const edge: BpEdge = clean({ id: newId("e", taken), source: c.source, target: c.target, kind: "flow", sourceHandle: c.sourceHandle ?? undefined, targetHandle: c.targetHandle ?? undefined });
    setNodesState((nds) => nds.map((n) => ({ ...n, selected: false })));
    apply({ ...content.current, edges: [...content.current.edges, edge] });
    setEdgesState((eds) => eds.map((e) => ({ ...e, selected: e.id === edge.id })));
    setDetail({ type: "edge", id: edge.id }); // a finished connection opens its kind picker
  }, [apply]);

  const addNode = useCallback((kind: NodeKind) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    const center = rf.screenToFlowPosition({ x: (rect?.left ?? 0) + (rect?.width ?? 800) / 2, y: (rect?.top ?? 0) + (rect?.height ?? 600) / 2 });
    const d = kind === "group" ? { w: 380, h: 240 } : sizeOf({ id: "_", kind, ...defaultsFor(kind) } as LNode);
    const taken = new Set(content.current.nodes.map((n) => n.id));
    const jitter = (content.current.nodes.length % 5) * 18;
    const node: BpNode = { id: newId(kind, taken), kind, position: { x: Math.round(center.x - d.w / 2 + jitter), y: Math.round(center.y - d.h / 2 + jitter) }, ...defaultsFor(kind) };
    setEdgesState((eds) => eds.map((e) => ({ ...e, selected: false })));
    setNodesState((nds) => nds.map((n) => ({ ...n, selected: false })));
    apply({ ...content.current, nodes: [...content.current.nodes, node] });
    setNodesState((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })));
  }, [apply, rf]);

  const selectedNodes = nodes.filter((n) => n.selected);

  const group = useCallback(() => {
    const sel = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
    const all = content.current.nodes;
    // keep only top-most selected (drop those whose ancestor is selected)
    const top = all.filter((n) => sel.has(n.id) && !all.some((a) => sel.has(a.id) && descendants(a.id, all).has(n.id)));
    if (!top.length) return;
    const parent = top[0].parent;
    if (top.some((n) => n.parent !== parent)) return onNotice("To group, pick items that sit in the same frame.");
    const rfById = new Map(nodes.map((n) => [n.id, n]));
    const boxes = top.map((n) => {
      const r = rfById.get(n.id)!;
      const w = r.width ?? r.measured?.width ?? sizeOf(n as unknown as LNode).w;
      const h = r.height ?? r.measured?.height ?? sizeOf(n as unknown as LNode).h;
      return { x: n.position.x, y: n.position.y, w, h };
    });
    const minX = Math.min(...boxes.map((b) => b.x)), minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w)), maxY = Math.max(...boxes.map((b) => b.y + b.h));
    const gx = Math.round(minX - 28), gy = Math.round(minY - 56);
    const taken = new Set(all.map((n) => n.id));
    const g: BpNode = clean({ id: newId("group", taken), kind: "group", groupKind: "group", title: "Group", parent, position: { x: gx, y: gy }, size: { w: Math.round(maxX - minX + 56), h: Math.round(maxY - minY + 84) } });
    const topIds = new Set(top.map((n) => n.id));
    apply({
      nodes: [...all.map((n) => (topIds.has(n.id) ? { ...n, parent: g.id, position: { x: n.position.x - gx, y: n.position.y - gy } } : n)), g],
      edges: content.current.edges,
    });
  }, [nodes, apply, onNotice]);

  const ungroup = useCallback(() => {
    const groups = nodes.filter((n) => n.selected && n.type === "group").map((n) => n.id);
    if (!groups.length) return;
    let ns = content.current.nodes;
    for (const gid of groups) {
      const g = ns.find((n) => n.id === gid);
      if (!g) continue;
      ns = ns.filter((n) => n.id !== gid).map((n) => (n.parent === gid ? clean({ ...n, parent: g.parent, position: { x: n.position.x + g.position.x, y: n.position.y + g.position.y } }) : n));
    }
    const gs = new Set(groups);
    apply({ nodes: ns, edges: content.current.edges.filter((e) => !gs.has(e.source) && !gs.has(e.target)) });
  }, [nodes, apply]);

  const tidy = useCallback(async (direction: LayoutDirection) => {
    const out = await arrange(content.current.nodes as unknown as LNode[], content.current.edges as unknown as LEdge[], { direction, relayout: true });
    apply({ nodes: out.nodes as unknown as BpNode[], edges: out.edges as unknown as BpEdge[] });
    window.setTimeout(() => void rf.fitView({ padding: 0.12, duration: 300 }), 80);
  }, [apply, rf]);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(content.current);
    apply(prev, { record: false });
  }, [apply]);
  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(content.current);
    apply(next, { record: false });
  }, [apply]);

  // menu + keyboard
  useEffect(() => {
    const isText = () => {
      const a = document.activeElement as HTMLElement | null;
      return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable);
    };
    const offU = api.onMenu("menu-undo", () => (isText() ? document.execCommand("undo") : undo()));
    const offR = api.onMenu("menu-redo", () => (isText() ? document.execCommand("redo") : redo()));
    const onKey = (e: KeyboardEvent) => {
      if (isText()) return;
      if (e.metaKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (e.shiftKey) ungroup();
        else group();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { offU(); offR(); window.removeEventListener("keydown", onKey); };
  }, [undo, redo, group, ungroup]);

  // focus a node (from search)
  const focused = useRef<string | null>(null);
  useEffect(() => {
    if (!focusNodeId || !meta || focused.current === focusNodeId) return;
    focused.current = focusNodeId;
    const t = window.setTimeout(() => {
      const edge = content.current.edges.find((e) => e.id === focusNodeId);
      if (edge) {
        setEdgesState((eds) => eds.map((e) => ({ ...e, selected: e.id === focusNodeId })));
        setDetail({ type: "edge", id: focusNodeId });
        return;
      }
      setNodesState((nds) => nds.map((n) => ({ ...n, selected: n.id === focusNodeId })));
      if (content.current.nodes.some((n) => n.id === focusNodeId)) setDetail({ type: "node", id: focusNodeId });
      void rf.fitView({ nodes: [{ id: focusNodeId }], padding: 1.2, duration: 400, maxZoom: 1.2 });
    }, 150);
    void t;
  }, [focusNodeId, meta, rf]);

  const ctx: CanvasCtxValue = useMemo(() => ({
    projectId: ids.projectId,
    readOnly: false,
    updateNode,
    commitResize: (id: string) => {
      resized.current.add(id);
      setGeomTick((t) => t + 1);
    },
  }), [ids.projectId, updateNode]);

  const displayEdges = useMemo(() => withRoutes(edges, content.current.nodes, nodes), [edges, nodes]);
  const project = tree.find((p) => p.id === ids.projectId);
  const system = project?.systems.find((s) => s.id === ids.systemId);

  if (missing) {
    return <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">This visual no longer exists. Pick another one on the left.</div>;
  }

  const defaultVp = meta && !(meta.viewport?.x === 0 && meta.viewport?.y === 0 && meta.viewport?.zoom === 1) && meta.viewport?.zoom ? meta.viewport : undefined;
  const singleNode = detail?.type === "node" ? content.current.nodes.find((n) => n.id === detail.id) : undefined;
  const singleEdge = detail?.type === "edge" ? content.current.edges.find((e) => e.id === detail.id) : undefined;

  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <VisualHeader
          ids={ids}
          projectTitle={project?.title ?? ids.projectId}
          system={system}
          visualTitle={meta?.title ?? ""}
          onRename={(title) => { if (metaRef.current) { metaRef.current = { ...metaRef.current, title }; setMeta(metaRef.current); scheduleSave(); } }}
          canUndo={undoStack.current.length > 0}
          canRedo={redoStack.current.length > 0}
          onUndo={undo}
          onRedo={redo}
          onTidy={tidy}
          hasNodes={content.current.nodes.length > 0}
        />
        <div ref={wrapRef} className="relative min-h-0 flex-1" data-testid="canvas" onPointerDownCapture={(e) => { downAt.current = { x: e.clientX, y: e.clientY }; }}>
          {meta && (
            <CanvasCtx.Provider value={ctx}>
              <EdgeMarkers />
              <ReactFlow<BpRfNode, BpRfEdge>
                nodes={nodes}
                edges={displayEdges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(e, n) => { if (isClick(e)) setDetail({ type: "node", id: n.id }); }}
                onEdgeClick={(e, ed) => { if (isClick(e)) setDetail({ type: "edge", id: ed.id }); }}
                onPaneClick={(e) => { if (isClick(e)) setDetail(null); }}
                onBeforeDelete={onBeforeDelete}
                connectionMode={ConnectionMode.Loose}
                isValidConnection={(c) => c.source !== c.target}
                deleteKeyCode={["Backspace", "Delete"]}
                multiSelectionKeyCode={["Meta", "Shift"]}
                defaultViewport={defaultVp}
                fitView={!defaultVp}
                fitViewOptions={{ padding: 0.15, maxZoom: 1.1 }}
                minZoom={0.1}
                maxZoom={3}
                snapToGrid
                snapGrid={[4, 4]}
                proOptions={{ hideAttribution: true }}
                connectionLineStyle={{ stroke: "var(--tone-accent)", strokeWidth: 1.6 }}
                onlyRenderVisibleElements={false}
              >
                <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--canvas-dot)" />
                <Controls showInteractive={false} position="bottom-left" />
                <MiniMap pannable zoomable position="bottom-right" maskColor="color-mix(in srgb, var(--background) 70%, transparent)" nodeColor="var(--muted-foreground)" nodeBorderRadius={6} style={{ width: 160, height: 104, marginBottom: 72 }} />
              </ReactFlow>
              {content.current.nodes.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="max-w-sm text-center">
                    <div className="text-[15px] font-medium">This canvas is empty</div>
                    <div className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">Add a card, drawing or note from the bar below, or ask your AI to visualize this system.</div>
                  </div>
                </div>
              )}
              <AddToolbar
                onAdd={addNode}
                canGroup={selectedNodes.length >= 1}
                canUngroup={selectedNodes.some((n) => n.type === "group")}
                onGroup={group}
                onUngroup={ungroup}
              />
            </CanvasCtx.Provider>
          )}
        </div>
      </div>
      {(singleNode || singleEdge) && (
        <DetailPanel
          key={JSON.stringify(singleNode ?? singleEdge)}
          node={singleNode}
          edge={singleEdge}
          nodes={content.current.nodes}
          onNode={updateNode}
          onEdge={updateEdge}
          onDelete={() => deleteIds(singleNode ? [singleNode.id] : [], singleEdge ? [singleEdge.id] : [])}
          onClose={() => {
            setDetail(null);
            setNodesState((nds) => nds.map((n) => ({ ...n, selected: false })));
            setEdgesState((eds) => eds.map((e) => ({ ...e, selected: false })));
          }}
        />
      )}
    </div>
  );
}
