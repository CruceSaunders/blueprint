import { useEffect, useLayoutEffect, useRef, useState } from "react";

const GAP = 14;
const EDGE = 10;
type Box = { l: number; t: number; r: number; b: number };
const area = (a: Box, b: Box) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));

/**
 * Where to put a w×h card for `item` inside a W×H area. It prefers EMPTY canvas: candidates around the item (right,
 * left, below, above for cards; below, above, sides for lines) and then a grid over the whole area are scored by overlap
 * with `protect` (the item and its connected cards) and with every other `obstacle` (cards, line labels, group titles).
 * A spot with no overlap always beats one with any; among those the nearest to the item wins.
 */
export function place(item: Box, w: number, h: number, W: number, H: number, opts: { vertical?: boolean; protect?: Box[]; obstacles?: Box[]; prev?: { x: number; y: number } | null } = {}): { x: number; y: number } {
  const protect = [item, ...(opts.protect ?? [])], obstacles = opts.obstacles ?? [];
  const cx = clamp(item.l, EDGE, W - w - EDGE), cy = clamp(item.t, EDGE, H - h - EDGE);
  const side = (x: number) => [0, -1, 1, -2, 2, -3, 3].map((k) => ({ x, y: clamp(item.t + k * 56, EDGE, H - h - EDGE) }));
  const stack = (y: number) => [0, -1, 1, -2, 2].map((k) => ({ x: clamp(item.l + k * 90, EDGE, W - w - EDGE), y }));
  const groups = opts.vertical
    ? [stack(item.b + GAP), stack(item.t - GAP - h), side(item.r + GAP), side(item.l - GAP - w)]
    : [side(item.r + GAP), side(item.l - GAP - w), stack(item.b + GAP), stack(item.t - GAP - h)];
  const cand: { x: number; y: number; bias: number }[] = [];
  groups.forEach((g, gi) => g.forEach((p, i) => cand.push({ ...p, bias: gi * 40 + i * 12 })));
  for (let y = EDGE; y <= H - h - EDGE; y += 36) for (let x = EDGE; x <= W - w - EDGE; x += 36) cand.push({ x, y, bias: 240 });
  if (!cand.length) cand.push({ x: cx, y: cy, bias: 0 });
  const icx = (item.l + item.r) / 2, icy = (item.t + item.b) / 2;
  let best = cand[0], bestCost = Infinity;
  for (const p of cand) {
    if (p.x < EDGE - 0.5 || p.y < EDGE - 0.5 || p.x + w > W - EDGE + 0.5 || p.y + h > H - EDGE + 0.5) continue;
    const box = { l: p.x, t: p.y, r: p.x + w, b: p.y + h };
    let prot = 0, obs = 0;
    for (const q of protect) prot += area(box, q);
    for (const q of obstacles) obs += area(box, q);
    const dist = Math.hypot((box.l + box.r) / 2 - icx, (box.t + box.b) / 2 - icy);
    const stick = opts.prev ? 0.25 * Math.hypot(p.x - opts.prev.x, p.y - opts.prev.y) : 0;
    const cost = (prot > 0 ? 1e9 : 0) + (obs > 0 ? 1e6 : 0) + prot * 50 + obs + dist + p.bias + stick;
    if (cost < bestCost) { bestCost = cost; best = p; }
  }
  return { x: clamp(best.x, EDGE, W - w - EDGE), y: clamp(best.y, EDGE, H - h - EDGE) };
}

/**
 * Floats its child next to the selected card or line, inside `container`, and follows it while the canvas pans,
 * zooms or the card moves. It never shifts the canvas. Hidden while the item is off screen.
 */
export function FloatingDetail({ container, type, id, ends, neighbors, onClose, children }: {
  container: React.RefObject<HTMLDivElement | null>;
  type: "node" | "edge";
  id: string;
  /** For a line: the two cards it joins, kept clear along with the line itself. */
  ends?: [string, string];
  /** For a card: the cards it is directly connected to, kept clear along with the card itself. */
  neighbors?: string[];
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    let raf = 0;
    let last = "";
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const wrap = container.current, me = ref.current;
      if (!wrap || !me) return;
      const sel = type === "node" ? `.react-flow__node[data-id="${CSS.escape(id)}"]` : `.react-flow__edge[data-id="${CSS.escape(id)}"] path`;
      const el = wrap.querySelector(sel) as Element | null;
      const W = wrap.clientWidth, H = wrap.clientHeight;
      let next: { x: number; y: number } | null = null;
      if (el) {
        const c = wrap.getBoundingClientRect();
        const rel = (r: DOMRect): Box => ({ l: r.left - c.left, t: r.top - c.top, r: r.right - c.left, b: r.bottom - c.top });
        const rects = [el.getBoundingClientRect()];
        const keep: Box[] = [];
        for (const e of ends ?? []) { const n = wrap.querySelector(`.react-flow__node[data-id="${CSS.escape(e)}"]`); if (n) rects.push(n.getBoundingClientRect()); }
        for (const e of neighbors ?? []) { const n = wrap.querySelector(`.react-flow__node[data-id="${CSS.escape(e)}"]`); if (n) keep.push(rel(n.getBoundingClientRect())); }
        const item = {
          l: Math.min(...rects.map((r) => r.left)) - c.left, t: Math.min(...rects.map((r) => r.top)) - c.top,
          r: Math.max(...rects.map((r) => r.right)) - c.left, b: Math.max(...rects.map((r) => r.bottom)) - c.top,
        };
        // everything else on screen the card should stay off: cards, line labels, group titles, the floating controls
        const obstacles: Box[] = [];
        wrap.querySelectorAll(".react-flow__node").forEach((n) => {
          const r = rel(n.getBoundingClientRect());
          if (n.classList.contains("react-flow__node-group")) {
            // only the title strip of a frame counts: its empty body is free space
            const zoom = n.getBoundingClientRect().height / ((n as HTMLElement).offsetHeight || 1);
            obstacles.push({ l: r.l, t: r.t, r: r.r, b: Math.min(r.b, r.t + 44 * zoom) });
          } else obstacles.push(r);
        });
        wrap.querySelectorAll("[data-testid=edge-label], [data-testid=add-toolbar] > div, .bp-controls, .react-flow__minimap").forEach((n) => obstacles.push(rel(n.getBoundingClientRect())));
        const visible = item.r > 0 && item.b > 0 && item.l < W && item.t < H;
        if (visible) next = place(item, me.offsetWidth, me.offsetHeight, W, H, { vertical: type === "edge", protect: keep, obstacles, prev: lastPos.current });
      }
      const key = next ? `${Math.round(next.x)},${Math.round(next.y)}` : "none";
      if (key !== last) { last = key; lastPos.current = next && { x: Math.round(next.x), y: Math.round(next.y) }; setPos(lastPos.current); }
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [container, type, id, ends?.[0], ends?.[1], neighbors?.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const a = document.activeElement as HTMLElement | null;
      if (a && ref.current?.contains(a) && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) { a.blur(); return; }
      if (document.querySelector("[role=dialog], [cmdk-root]")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute left-0 top-0 z-20"
      style={{ transform: pos ? `translate(${pos.x}px, ${pos.y}px)` : undefined, visibility: pos ? "visible" : "hidden" }}
      data-testid="detail-float"
    >
      <div className="pointer-events-auto">{children}</div>
    </div>
  );
}
