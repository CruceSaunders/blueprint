import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import type { BpEdge, EdgeKind } from "@/lib/types";
import { EDGE_INFO } from "@/lib/vocab";

export type BpRfEdge = Edge<{ edge: BpEdge; route?: { x: number; y: number }[]; labelAt?: { x: number; y: number; vertical?: boolean } }>;

/** SVG path through orthogonal bend points with rounded corners. */
export function roundedPath(pts: { x: number; y: number }[], radius = 8): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = Math.hypot(c.x - b.x, c.y - b.y);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    if (r < 0.5) { d += ` L${b.x},${b.y}`; continue; }
    const p1 = { x: b.x - ((b.x - a.x) / l1) * r, y: b.y - ((b.y - a.y) / l1) * r };
    const p2 = { x: b.x + ((c.x - b.x) / l2) * r, y: b.y + ((c.y - b.y) / l2) * r };
    d += ` L${p1.x},${p1.y} Q${b.x},${b.y} ${p2.x},${p2.y}`;
  }
  const z = pts[pts.length - 1];
  return d + ` L${z.x},${z.y}`;
}

type ColorKey = "edge" | "good" | "bad" | "warn" | "soft";
const COLOR: Record<ColorKey, string> = {
  edge: "var(--edge)",
  good: "var(--tone-good)",
  bad: "var(--tone-bad)",
  warn: "var(--tone-warn)",
  soft: "var(--edge-soft)",
};

interface Style {
  color: ColorKey;
  width: number;
  dash?: string;
  end: "arrow" | "arrowLg" | "bar" | "none";
  badge?: string;
}

export const EDGE_STYLE: Record<EdgeKind, Style> = {
  flow: { color: "edge", width: 1.6, end: "arrow" },
  increases: { color: "good", width: 1.8, end: "arrow", badge: "+" },
  decreases: { color: "bad", width: 1.8, end: "arrow", badge: "−" },
  requires: { color: "edge", width: 1.6, dash: "7 5", end: "arrow" },
  becomes: { color: "edge", width: 3.6, end: "arrowLg", badge: "⇒" },
  equals: { color: "edge", width: 1.4, end: "none", badge: "=" },
  versus: { color: "warn", width: 2, dash: "0.1 6", end: "none", badge: "vs" },
  blocks: { color: "bad", width: 1.8, end: "bar" },
  relates: { color: "soft", width: 1.1, end: "none" },
};

/** Shared SVG marker defs. Rendered once per canvas. */
export function EdgeMarkers() {
  return (
    <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden>
      <defs>
        {(Object.keys(COLOR) as ColorKey[]).map((k) => (
          <g key={k}>
            <marker id={`bp-arrow-${k}`} viewBox="0 0 12 12" refX="10" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <path d="M1.5,1.5 L10.5,6 L1.5,10.5 L4,6 Z" style={{ fill: COLOR[k] }} />
            </marker>
            <marker id={`bp-arrowLg-${k}`} viewBox="0 0 16 16" refX="12" refY="8" markerWidth="18" markerHeight="18" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <path d="M1,1.5 L14,8 L1,14.5 L4.5,8 Z" style={{ fill: COLOR[k] }} />
            </marker>
            <marker id={`bp-bar-${k}`} viewBox="0 0 8 20" refX="5" refY="10" markerWidth="8" markerHeight="20" markerUnits="userSpaceOnUse" orient="auto">
              <rect x="2.5" y="1" width="3.2" height="18" rx="1.2" style={{ fill: COLOR[k] }} />
            </marker>
          </g>
        ))}
      </defs>
    </svg>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  const wide = text.length > 1;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full border-[1.5px] bg-card font-semibold leading-none shadow-xs"
      style={{ borderColor: color, color, minWidth: 22, height: 22, padding: wide ? "0 6px" : 0, fontSize: wide ? 11 : 14 }}
    >
      {text}
    </span>
  );
}

export const RelationshipEdge = memo(function RelationshipEdge(props: EdgeProps<BpRfEdge>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected } = props;
  const e = data?.edge;
  const kind: EdgeKind = e && EDGE_INFO[e.kind] ? e.kind : "relates";
  const st = EDGE_STYLE[kind];
  const color = COLOR[st.color];
  const route = data?.route;
  let path: string, lx: number, ly: number;
  if (route && route.length >= 2) {
    path = roundedPath(route);
    lx = data?.labelAt?.x ?? route[0].x;
    ly = data?.labelAt?.y ?? route[0].y;
  } else {
    [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.3 });
  }

  const arrowId = st.end === "arrowLg" ? `bp-arrowLg-${st.color}` : `bp-arrow-${st.color}`;
  const markerEnd = st.end === "none" ? (e?.both ? `url(#${arrowId})` : undefined) : st.end === "bar" ? `url(#bp-bar-${st.color})` : `url(#${arrowId})`;
  const markerStart = e?.both ? `url(#${arrowId})` : undefined;
  const width = selected ? st.width + 0.8 : st.width;

  return (
    <>
      {kind === "equals" ? (
        <>
          <path d={path} fill="none" style={{ stroke: color, strokeWidth: 6 + (selected ? 1 : 0) }} className="bp-edge-path" />
          <path d={path} fill="none" style={{ stroke: "var(--canvas)", strokeWidth: 2.4 }} />
          <BaseEdge id={id} path={path} interactionWidth={18} style={{ stroke: "transparent", strokeWidth: 1 }} markerEnd={markerEnd} markerStart={markerStart} />
        </>
      ) : (
        <BaseEdge
          id={id}
          path={path}
          interactionWidth={18}
          className="bp-edge-path"
          markerEnd={markerEnd}
          markerStart={markerStart}
          style={{ stroke: color, strokeWidth: width, strokeDasharray: st.dash, strokeLinecap: "round", fill: "none" }}
        />
      )}
      {(st.badge || e?.label) && (
        <EdgeLabelRenderer>
          <div
            className={`nodrag nopan pointer-events-auto absolute flex items-center whitespace-nowrap rounded-full ${data?.labelAt?.vertical ? "flex-col gap-1" : "gap-1.5"}`}
            data-testid="edge-label"
            style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`, background: st.badge && e?.label ? "var(--canvas)" : undefined }}
          >
            {st.badge && <Badge text={st.badge} color={color} />}
            {e?.label && (
              <span className="max-w-[200px] truncate whitespace-nowrap rounded-md border bg-card px-1.5 py-0.5 text-[11px] font-semibold leading-4 text-muted-foreground shadow-xs">{e.label}</span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

export const edgeTypes = { bp: RelationshipEdge };

/** Small inline preview of an edge kind (legend + picker). */
export function EdgeSwatch({ kind, w = 56 }: { kind: EdgeKind; w?: number }) {
  const st = EDGE_STYLE[kind];
  const c = COLOR[st.color];
  const y = 10;
  const x2 = w - 4;
  return (
    <svg width={w} height={20} viewBox={`0 0 ${w} 20`} className="shrink-0 overflow-visible">
      {kind === "equals" ? (
        <>
          <line x1={3} y1={y - 2.5} x2={x2} y2={y - 2.5} style={{ stroke: c, strokeWidth: 1.4 }} />
          <line x1={3} y1={y + 2.5} x2={x2} y2={y + 2.5} style={{ stroke: c, strokeWidth: 1.4 }} />
        </>
      ) : (
        <line
          x1={3}
          y1={y}
          x2={st.end === "none" ? x2 : x2 - 2}
          y2={y}
          style={{ stroke: c, strokeWidth: Math.min(st.width, 3.2), strokeDasharray: st.dash, strokeLinecap: "round" }}
          markerEnd={st.end === "none" ? undefined : st.end === "bar" ? `url(#bp-bar-${st.color})` : st.end === "arrowLg" ? `url(#bp-arrowLg-${st.color})` : `url(#bp-arrow-${st.color})`}
        />
      )}
      {st.badge && (
        <g>
          <rect x={w / 2 - (st.badge.length > 1 ? 10 : 7.5)} y={2.5} width={st.badge.length > 1 ? 20 : 15} height={15} rx={7.5} style={{ fill: "var(--card)", stroke: c, strokeWidth: 1.2 }} />
          <text x={w / 2} y={13.6} textAnchor="middle" style={{ fill: c, fontSize: st.badge.length > 1 ? 8.5 : 11, fontWeight: 700 }}>
            {st.badge}
          </text>
        </g>
      )}
    </svg>
  );
}
