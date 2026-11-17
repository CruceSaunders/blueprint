// Framing: the box that holds everything drawn on a canvas (nodes, line routes, labels and kind badges), and the
// viewport that shows it centred with the same padding on every side. Used by the snapshot and the editor's fit.
import { useCallback, useEffect, useRef } from "react";
import { getNodesBounds, useNodesInitialized, useReactFlow, useStoreApi, type Node, type ReactFlowInstance, type Viewport } from "@xyflow/react";
import { labelBox, type LEdge } from "./layout";
import type { BpRfEdge } from "@/components/canvas/edges";

export interface Rect { x: number; y: number; width: number; height: number }

/** Bounds of nodes plus every line route point and every label/badge box. `extra` covers stroke and arrowheads. */
export function contentBounds(nodes: Node[], edges: BpRfEdge[], extra = 6): Rect | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x: number, y: number, w = 0, h = 0) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h); };
  if (nodes.length) { const b = getNodesBounds(nodes); add(b.x, b.y, b.width, b.height); }
  for (const e of edges) {
    const r = e.data?.route;
    if (r) for (const p of r) add(p.x - extra, p.y - extra, 2 * extra, 2 * extra);
    const at = e.data?.labelAt, le = e.data?.edge as unknown as LEdge | undefined;
    const sz = at && le ? labelBox(le, !!at.vertical) : null;
    if (at && sz) add(at.x - sz.w / 2 - 2, at.y - sz.h / 2 - 2, sz.w + 4, sz.h + 4);
  }
  return Number.isFinite(x0) ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

/** Viewport that centres `b` in a `w`x`h` pane with at least `pad` screen pixels on every side. */
export function viewportFor(b: Rect, w: number, h: number, pad: number, minZoom = 0.05, maxZoom = 4): Viewport {
  const zoom = Math.max(minZoom, Math.min(maxZoom, (w - 2 * pad) / Math.max(1, b.width), (h - 2 * pad) / Math.max(1, b.height)));
  return { x: (w - b.width * zoom) / 2 - b.x * zoom, y: (h - b.height * zoom) / 2 - b.y * zoom, zoom };
}

/** Fit everything drawn (not just the node boxes) into the pane. `pad` is a fraction of the smaller pane side. */
export function fitAll(
  rf: ReactFlowInstance<any, any>, pane: { width: number; height: number },
  opts: { pad?: number; padPx?: number; maxZoom?: number; minZoom?: number; duration?: number } = {},
): Promise<boolean> {
  const b = contentBounds(rf.getNodes(), rf.getEdges() as BpRfEdge[]);
  if (!b || !pane.width || !pane.height) return rf.fitView({ padding: opts.pad ?? 0.1, maxZoom: opts.maxZoom, duration: opts.duration });
  const pad = opts.padPx ?? Math.round((opts.pad ?? 0.1) * Math.min(pane.width, pane.height));
  return rf.setViewport(viewportFor(b, pane.width, pane.height, pad, opts.minZoom, opts.maxZoom), { duration: opts.duration });
}

type FitOpts = { pad?: number; padPx?: number; maxZoom?: number; minZoom?: number; duration?: number };
/** `fit(opts)`: fit everything drawn into this flow's pane (must be used inside a ReactFlowProvider). */
export function useFitAll() {
  const rf = useReactFlow();
  const store = useStoreApi();
  return useCallback((opts: FitOpts = {}) => { const { width, height } = store.getState(); return fitAll(rf, { width, height }, opts); }, [rf, store]);
}
/** Fit once, when the nodes are first measured, unless `enabled` is false (e.g. a saved viewport exists). */
export function useInitialFit(enabled: boolean, opts: FitOpts = {}) {
  const fit = useFitAll(), ready = useNodesInitialized(), done = useRef(false), o = useRef(opts), store = useStoreApi();
  useEffect(() => {
    if (!enabled || done.current || !ready) return;
    done.current = true;
    // wait for the pane to have a size (it is measured after the first render), then fit
    let frames = 0;
    const tick = () => { const { width, height } = store.getState(); if ((width && height) || ++frames > 60) void fit(o.current); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }, [enabled, ready, fit, store]);
}
