import { useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, ReactFlowProvider, useNodesInitialized, useReactFlow, getNodesBounds, ConnectionMode, applyNodeChanges } from "@xyflow/react";
import { api } from "@/lib/api";
import type { Visual, VisualIds } from "@/lib/types";
import { toRfEdges, toRfNodes, withRoutes } from "@/lib/doc";
import { CanvasCtx, nodeTypes, type BpRfNode } from "./canvas/nodes";
import { EdgeMarkers, edgeTypes, type BpRfEdge } from "./canvas/edges";

const noop = () => {};

function Inner({ ids }: { ids: VisualIds }) {
  const [doc, setDoc] = useState<Visual | null>(null);
  const [nodes, setNodes] = useState<BpRfNode[]>([]);
  const rf = useReactFlow<BpRfNode, BpRfEdge>();
  const initialized = useNodesInitialized();
  const sent = useRef(false);

  useEffect(() => {
    void api.readVisual(ids).then((v) => {
      if (!v) return api.snapshotError("visual not found");
      setDoc(v);
      setNodes(toRfNodes(v.nodes ?? []));
    }).catch((e) => api.snapshotError(String(e)));
  }, [ids]);

  const edges = useMemo(() => (doc ? withRoutes(toRfEdges(doc.edges ?? []), doc.nodes ?? [], nodes) : []), [doc, nodes]);

  useEffect(() => {
    if (!doc || sent.current) return;
    if (doc.nodes.length > 0 && !initialized) return;
    sent.current = true;
    const all = rf.getNodes();
    const b = all.length ? getNodesBounds(all) : { width: 800, height: 500 };
    const pad = 80;
    api.snapshotReady({ aspect: (b.height + pad) / (b.width + pad) });
  }, [doc, initialized, rf]);

  useEffect(() => api.onSnapshotFit(async () => {
    await rf.fitView({ padding: 0.05, maxZoom: 1.6, minZoom: 0.05 });
    const hasHtml = doc?.nodes.some((n) => n.kind === "visual" && n.html && !n.svg);
    const hasImg = doc?.nodes.some((n) => n.kind === "image");
    await document.fonts.ready;
    await new Promise((r) => setTimeout(r, hasHtml || hasImg ? 900 : 350));
    requestAnimationFrame(() => requestAnimationFrame(() => api.snapshotRendered()));
  }), [rf, doc]);

  if (!doc) return null;
  return (
    <CanvasCtx.Provider value={{ projectId: ids.projectId, readOnly: true, updateNode: noop, commitResize: noop }}>
      <EdgeMarkers />
      <ReactFlow<BpRfNode, BpRfEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={(ch) => setNodes((nds) => applyNodeChanges(ch, nds))}
        connectionMode={ConnectionMode.Loose}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        minZoom={0.05}
        maxZoom={4}
        proOptions={{ hideAttribution: true }}
      />
      {doc.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-[15px] text-muted-foreground">Empty visual: {doc.title}</div>
      )}
    </CanvasCtx.Provider>
  );
}

export function SnapshotView({ ids }: { ids: VisualIds }) {
  return (
    <div className="bp-snapshot fixed inset-0 bg-[var(--canvas)]">
      <ReactFlowProvider>
        <Inner ids={ids} />
      </ReactFlowProvider>
    </div>
  );
}
