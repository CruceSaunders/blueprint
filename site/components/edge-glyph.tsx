// The nine relationship lines exactly as the app draws them: widths, dashes, arrowheads, bar end and badges are
// copied from app/src/components/canvas/edges.tsx (EDGE_STYLE, EdgeMarkers, EdgeSwatch); colours from app/src/index.css.
// Arrowheads are inline paths (no <marker> ids), so many glyphs can share one page.
export type Kind = "flow" | "increases" | "decreases" | "requires" | "becomes" | "equals" | "versus" | "blocks" | "relates";

type Style = { color: string; width: number; dash?: string; end: "arrow" | "arrowLg" | "bar" | "none"; badge?: string };
const EDGE_STYLE: Record<Kind, Style> = {
  flow: { color: "var(--edge)", width: 1.6, end: "arrow" },
  increases: { color: "var(--good)", width: 1.8, end: "arrow", badge: "+" },
  decreases: { color: "var(--bad)", width: 1.8, end: "arrow", badge: "−" },
  requires: { color: "var(--edge)", width: 1.6, dash: "7 5", end: "arrow" },
  becomes: { color: "var(--edge)", width: 3.6, end: "arrowLg", badge: "⇒" },
  equals: { color: "var(--edge)", width: 1.4, end: "none", badge: "=" },
  versus: { color: "var(--warn)", width: 2, dash: "0.1 6", end: "none", badge: "vs" },
  blocks: { color: "var(--bad)", width: 1.8, end: "bar" },
  relates: { color: "var(--soft)", width: 1.1, end: "none" },
};

/** A horizontal line of `kind` from x1 to x2 at height y. Used for the small swatches and the animated stage. */
export function EdgeLine({ kind, x1, x2, y }: { kind: Kind; x1: number; x2: number; y: number }) {
  const st = EDGE_STYLE[kind];
  const c = st.color;
  const tip = st.end === "arrowLg" ? 12 : st.end === "arrow" ? 8 : st.end === "bar" ? 2 : 0;
  const mid = (x1 + x2) / 2;
  const wide = (st.badge?.length ?? 0) > 1;
  return (
    <g>
      {kind === "equals" ? (
        <>
          <line x1={x1} y1={y - 2.5} x2={x2} y2={y - 2.5} stroke={c} strokeWidth={1.4} />
          <line x1={x1} y1={y + 2.5} x2={x2} y2={y + 2.5} stroke={c} strokeWidth={1.4} />
        </>
      ) : (
        <line x1={x1} y1={y} x2={x2 - tip} y2={y} stroke={c} strokeWidth={Math.min(st.width, 3.6)} strokeDasharray={st.dash} strokeLinecap="round" />
      )}
      {st.end === "arrow" && <path d={`M${x2 - 9},${y - 4.5} L${x2},${y} L${x2 - 9},${y + 4.5} L${x2 - 6.5},${y} Z`} fill={c} />}
      {st.end === "arrowLg" && <path d={`M${x2 - 13},${y - 6.5} L${x2},${y} L${x2 - 13},${y + 6.5} L${x2 - 9.5},${y} Z`} fill={c} />}
      {st.end === "bar" && <rect x={x2 - 2.5} y={y - 9} width={3.2} height={18} rx={1.2} fill={c} />}
      {st.badge && (
        <g className="glyph-badge">
          <rect x={mid - (wide ? 10 : 7.5)} y={y - 7.5} width={wide ? 20 : 15} height={15} rx={7.5} fill="var(--bg)" stroke={c} strokeWidth={1.2} />
          <text x={mid} y={y + 3.6} textAnchor="middle" fill={c} fontSize={wide ? 8.5 : 11} fontWeight={700} fontFamily="ui-sans-serif, system-ui, sans-serif">
            {st.badge}
          </text>
        </g>
      )}
    </g>
  );
}

export function EdgeSwatch({ kind, w = 56 }: { kind: Kind; w?: number }) {
  return (
    <svg width={w} height={20} viewBox={`0 0 ${w} 20`} aria-hidden className="overflow-visible">
      <EdgeLine kind={kind} x1={3} x2={w - 4} y={10} />
    </svg>
  );
}
