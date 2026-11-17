import { createContext, memo, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Handle, NodeResizer, Position, useNodeId, type NodeProps, type Node } from "@xyflow/react";
import DOMPurify from "dompurify";
import { icons, type LucideIcon } from "lucide-react";
import type { BpNode } from "@/lib/types";
import { ART_GAP, ART_H, CARD_METRICS, GROUP_METRICS, artOf, groupHeaderHeight, shapeOf, sizeOf, treatmentOf, OPERATOR_SIZE, type Art, type LNode } from "@/lib/layout";
import { GROUP_INFO, STATE_INFO, TONE_VAR } from "@/lib/vocab";
import { cn } from "@/lib/utils";

export type BpRfNode = Node<{ node: BpNode }>;

export interface CanvasCtxValue {
  projectId: string;
  readOnly: boolean;
  updateNode: (id: string, patch: Partial<BpNode>) => void;
  commitResize: (id: string) => void;
}
export const CanvasCtx = createContext<CanvasCtxValue>({ projectId: "", readOnly: true, updateNode: () => {}, commitResize: () => {} });

// ---------- helpers ----------
export function lucideIcon(name?: string): LucideIcon | null {
  if (!name) return null;
  const pascal = name.replace(/(^|[-_\s])(\w)/g, (_m, _s, c: string) => c.toUpperCase());
  return (icons as Record<string, LucideIcon>)[pascal] ?? null;
}

const HANDLES: { id: string; pos: Position }[] = [
  { id: "top", pos: Position.Top },
  { id: "right", pos: Position.Right },
  { id: "bottom", pos: Position.Bottom },
  { id: "left", pos: Position.Left },
];
function Handles() {
  return (
    <>
      {HANDLES.map((h) => (
        <Handle key={h.id} id={h.id} type="source" position={h.pos} />
      ))}
    </>
  );
}

function Resizer({ selected, minW = 60, minH = 40, keepAspect }: { selected: boolean; minW?: number; minH?: number; keepAspect?: boolean }) {
  const { readOnly, commitResize } = useContext(CanvasCtx);
  const id = useNodeId();
  if (readOnly) return null;
  return <NodeResizer isVisible={selected} minWidth={minW} minHeight={minH} keepAspectRatio={keepAspect} onResizeEnd={() => id && commitResize(id)} />;
}

/** Inline-editable text. Double-click to edit; Enter or blur commits; Escape cancels. */
export function EditableText({ value, placeholder, onCommit, className, multiline, style }: { value?: string; placeholder?: string; onCommit: (v: string) => void; className?: string; multiline?: boolean; style?: React.CSSProperties }) {
  const { readOnly } = useContext(CanvasCtx);
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  useEffect(() => {
    if (editing && ref.current) {
      done.current = false;
      ref.current.focus();
      ref.current.select();
    }
  }, [editing]);
  // Commit exactly once, on Enter or on blur (blur alone is not reliable when the window is not focused).
  const finish = (el: HTMLTextAreaElement, keep: boolean) => {
    if (done.current) return;
    done.current = true;
    setEditing(false);
    const v = el.value.trim();
    if (keep && v !== (value ?? "")) onCommit(v);
  };
  if (editing) {
    return (
      <textarea
        ref={ref}
        defaultValue={value ?? ""}
        rows={multiline ? 3 : 1}
        className={cn("nodrag nowheel block w-full resize-none rounded bg-background/60 px-0.5 outline outline-1 outline-ring/60", className)}
        style={style}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") finish(e.currentTarget, false);
          if (e.key === "Enter" && (!multiline || e.metaKey)) {
            e.preventDefault();
            finish(e.currentTarget, true);
          }
        }}
        onBlur={(e) => finish(e.currentTarget, true)}
      />
    );
  }
  if (!value && (readOnly || !placeholder)) return null;
  return (
    <div
      className={cn(className, !value && "italic opacity-50")}
      style={style}
      onDoubleClick={(e) => {
        if (readOnly) return;
        e.stopPropagation();
        setEditing(true);
      }}
    >
      {value || placeholder}
    </div>
  );
}

function StateChip({ state, center }: { state?: BpNode["state"]; center?: boolean }) {
  if (!state) return null;
  const info = STATE_INFO[state];
  return (
    <span className={cn("pointer-events-none absolute -top-2.5 z-10 inline-flex items-center gap-1 rounded-full border bg-card px-1.5 py-[1px] text-[10px] font-medium leading-4 text-muted-foreground shadow-xs", center ? "left-1/2 -translate-x-1/2" : "right-2")}>
      <span className="size-1.5 rounded-full" style={{ background: info.color }} />
      {info.name}
    </span>
  );
}

/** Every node is drawn at exactly the size layout reserved for it (layout.ts sizeOf: explicit size or computed from text). */
function boxStyle(n: BpNode): React.CSSProperties {
  if (n.size) return { width: "100%", height: "100%" };
  const s = sizeOf(n as unknown as LNode);
  return { width: s.w, height: s.h };
}

function toneStyle(n: BpNode): React.CSSProperties {
  const tone = n.tone ?? "neutral";
  if (tone === "neutral") return {};
  const c = TONE_VAR[tone];
  if (tone === "muted") return { background: "var(--muted)", borderColor: "var(--border)", color: "var(--muted-foreground)" };
  return {
    borderColor: `color-mix(in srgb, ${c} 55%, var(--border))`,
    background: `color-mix(in srgb, ${c} 7%, var(--card))`,
  };
}

// ---------- card (and its shapes: card | pill | circle | diamond | plain) ----------
function shapeColors(n: BpNode) {
  const tone = n.tone ?? "neutral";
  if (tone === "neutral") return { stroke: "var(--border)", fill: "var(--card)" };
  if (tone === "muted") return { stroke: "var(--border)", fill: "var(--muted)" };
  const c = TONE_VAR[tone];
  return { stroke: `color-mix(in srgb, ${c} 55%, var(--border))`, fill: `color-mix(in srgb, ${c} 7%, var(--card))` };
}

/** A card's own drawing, drawn inside the card (never as a separate node). */
export function NodeArt({ art, title, height }: { art: Art; title?: string; height: number }) {
  const { projectId } = useContext(CanvasCtx);
  const clean = useMemo(() => (art.svg ? sanitizeSvg(art.svg) : ""), [art.svg]);
  const frame = useMemo(() => (!art.svg && art.html ? frameUrl(art.html) : ""), [art.svg, art.html]);
  const [broken, setBroken] = useState(false);
  const src = !art.svg && !art.html && art.asset ? `bp-asset://${projectId}/${encodeURIComponent(art.asset)}` : "";
  return (
    <div className="pointer-events-none relative w-full shrink-0" style={{ height }} data-testid="node-art">
      {art.svg ? (
        <div className="size-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: clean }} />
      ) : art.html ? (
        <iframe title={title ?? "drawing"} sandbox="allow-scripts" src={frame} className="size-full border-0" referrerPolicy="no-referrer" />
      ) : src && !broken ? (
        <img src={src} alt={title ?? ""} className="size-full object-contain" draggable={false} onError={() => setBroken(true)} />
      ) : (
        <div className="flex size-full items-center justify-center text-[11px] text-muted-foreground">{art.asset ? `Missing file: ${art.asset}` : ""}</div>
      )}
    </div>
  );
}

function Titles({ n, id, m, center }: { n: BpNode; id: string; m: { title: number; sub: number }; center?: boolean }) {
  const { updateNode } = useContext(CanvasCtx);
  return (
    <div className={cn("min-w-0", center && "text-center")}>
      <EditableText value={n.title} placeholder="Untitled" onCommit={(v) => updateNode(id, { title: v })}
        className="font-semibold leading-snug tracking-[-0.01em] [overflow-wrap:anywhere]" style={{ fontSize: m.title }} />
      <EditableText value={n.subtitle} onCommit={(v) => updateNode(id, { subtitle: v || undefined })}
        className="mt-0.5 leading-snug text-muted-foreground [overflow-wrap:anywhere]" style={{ fontSize: m.sub }} />
    </div>
  );
}

function IconChip({ n, size }: { n: BpNode; size: number }) {
  const Icon = lucideIcon(n.icon);
  if (!Icon) return null;
  const tone = n.tone ?? "neutral";
  const c = tone === "neutral" ? "var(--tone-accent)" : TONE_VAR[tone];
  return (
    <div className="flex shrink-0 items-center justify-center rounded-lg" style={{ width: size, height: size, background: `color-mix(in srgb, ${c} 13%, transparent)`, color: c }}>
      <Icon style={{ width: Math.round(size * 0.5), height: Math.round(size * 0.5) }} strokeWidth={1.8} />
    </div>
  );
}

export const CardNode = memo(function CardNode({ id, data, selected }: NodeProps<BpRfNode>) {
  const n = data.node;
  const ln = n as unknown as LNode;
  const weight = n.weight ?? "md";
  const m = CARD_METRICS[weight] ?? CARD_METRICS.md;
  const shape = shapeOf(ln);
  const art = artOf(ln);
  const artH = art ? ART_H[art.size ?? "md"] ?? ART_H.md : 0;
  const box = boxStyle(n);
  const ring = selected && "ring-2 ring-ring/60";
  const col = shapeColors(n);
  const dashed = n.state === "idea";
  const shared = { "data-shape": shape } as Record<string, string>;

  if (shape === "diamond") {
    const s = sizeOf(ln);
    return (
      <div {...shared} className="relative flex items-center justify-center" style={box}>
        <Resizer selected={!!selected} minW={120} minH={72} />
        <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox={`0 0 ${s.w} ${s.h}`} preserveAspectRatio="none">
          <polygon points={`${s.w / 2},1 ${s.w - 1},${s.h / 2} ${s.w / 2},${s.h - 1} 1,${s.h / 2}`} style={{ fill: col.fill, stroke: selected ? "var(--ring)" : n.tone && n.tone !== "neutral" ? col.stroke : "color-mix(in srgb, var(--foreground) 24%, transparent)", strokeWidth: selected ? 2 : 1.5, strokeDasharray: dashed ? "5 4" : undefined, strokeLinejoin: "round" }} />
        </svg>
        <Handles />
        <StateChip state={n.state} center />
        <div className="relative" style={{ width: "50%" }}><Titles n={n} id={id} m={m} center /></div>
      </div>
    );
  }
  if (shape === "plain") {
    return (
      <div {...shared} className={cn("relative flex flex-col items-center rounded-xl", ring)} style={{ ...box, paddingTop: 0, gap: 8 }}>
        <Resizer selected={!!selected} minW={80} minH={48} />
        <Handles />
        <StateChip state={n.state} center />
        {art ? <NodeArt art={art} title={n.title} height={artH} /> : n.icon ? <IconChip n={n} size={40} /> : null}
        <div className="w-full px-1"><Titles n={n} id={id} m={m} center /></div>
      </div>
    );
  }
  const frameStyle: React.CSSProperties = { ...box, background: col.fill, borderColor: col.stroke, borderWidth: m.border, borderStyle: dashed ? "dashed" : "solid" };
  if (shape === "pill" || shape === "circle") {
    const isCircle = shape === "circle";
    return (
      <div {...shared} className={cn("relative flex items-center justify-center rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.04)]", isCircle ? "flex-col" : "", ring)}
        style={{ ...frameStyle, padding: isCircle ? 0 : "0 20px", gap: isCircle ? 6 : 8 }}>
        <Resizer selected={!!selected} minW={isCircle ? 80 : 96} minH={isCircle ? 80 : 36} keepAspect={isCircle} />
        <Handles />
        <StateChip state={n.state} center={isCircle} />
        {isCircle && art ? <div style={{ width: "50%" }}><NodeArt art={art} title={n.title} height={Math.min(artH, 56)} /></div>
          : n.icon ? <IconChip n={n} size={isCircle ? 24 : 20} /> : null}
        <div style={isCircle ? { width: "66%" } : { minWidth: 0 }}><Titles n={n} id={id} m={m} center /></div>
      </div>
    );
  }
  // rounded card
  if (art) {
    return (
      <div {...shared} className={cn("relative flex flex-col items-center rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)]", ring)}
        style={{ ...frameStyle, padding: `${m.padY}px ${m.padX}px`, gap: ART_GAP }}>
        <Resizer selected={!!selected} minW={120} minH={80} />
        <Handles />
        <StateChip state={n.state} />
        <NodeArt art={art} title={n.title} height={artH} />
        <div className="w-full"><Titles n={n} id={id} m={m} center /></div>
      </div>
    );
  }
  return (
    <div {...shared} className={cn("relative flex items-center rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)]", ring)}
      style={{ ...frameStyle, padding: `${m.padY}px ${m.padX}px`, gap: m.gap }}>
      <Resizer selected={!!selected} minW={120} minH={48} />
      <Handles />
      <StateChip state={n.state} />
      <IconChip n={n} size={m.icon} />
      <div className="min-w-0 flex-1"><Titles n={n} id={id} m={m} /></div>
    </div>
  );
});

// ---------- visual (svg / html) ----------
export const IFRAME_CSP = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:";
function htmlDoc(html: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"><meta http-equiv="Content-Security-Policy" content="${IFRAME_CSP}"><style>html,body{margin:0;height:100%;overflow:hidden;font-family:system-ui,-apple-system,sans-serif;background:transparent;color-scheme:light dark}</style></head><body>${html}</body></html>`;
}

/**
 * HTML visuals load from the bp-frame: scheme (served by the main process with this CSP as a response header).
 * A srcdoc/data: frame would inherit the app's own CSP, which forbids inline scripts, so drawings could not run.
 */
function frameUrl(html: string): string {
  const bytes = new TextEncoder().encode(htmlDoc(html));
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `bp-frame://visual/?h=${btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ["foreignObject", "script", "style", "use", "image", "a", "iframe", "embed", "object"], FORBID_ATTR: ["href", "xlink:href", "src"] }) as string;
}

export const VisualNode = memo(function VisualNode({ data, selected, id }: NodeProps<BpRfNode>) {
  const n = data.node;
  const { updateNode } = useContext(CanvasCtx);
  const clean = useMemo(() => (n.svg ? sanitizeSvg(n.svg) : ""), [n.svg]);
  const frame = useMemo(() => (!n.svg && n.html ? frameUrl(n.html) : ""), [n.svg, n.html]);
  return (
    <div className={cn("relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]", selected && "ring-2 ring-ring/60")} style={{ ...boxStyle(n), ...toneStyle(n) }}>
      <Resizer selected={!!selected} minW={80} minH={60} />
      <Handles />
      <StateChip state={n.state} />
      <div className="relative min-h-0 flex-1 p-2">
        {n.svg ? (
          <div className="size-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: clean }} />
        ) : n.html ? (
          <iframe title={n.title ?? "visual"} sandbox="allow-scripts" src={frame} className="pointer-events-none size-full border-0" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex size-full items-center justify-center text-[12px] text-muted-foreground">No drawing yet</div>
        )}
      </div>
      {(n.title || n.caption) && (
        <div className="shrink-0 border-t px-3 py-1.5 leading-[1.4]">
          <EditableText value={n.title} onCommit={(v) => updateNode(id, { title: v })} className="text-[12.5px] font-semibold [overflow-wrap:anywhere]" />
          {n.caption && <div className="text-[11px] text-muted-foreground [overflow-wrap:anywhere]">{n.caption}</div>}
        </div>
      )}
    </div>
  );
});

// ---------- image ----------
export const ImageNode = memo(function ImageNode({ data, selected }: NodeProps<BpRfNode>) {
  const n = data.node;
  const { projectId } = useContext(CanvasCtx);
  const [broken, setBroken] = useState(false);
  const src = n.asset ? `bp-asset://${projectId}/${encodeURIComponent(n.asset)}` : "";
  useEffect(() => setBroken(false), [src]);
  return (
    <div className={cn("relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]", selected && "ring-2 ring-ring/60")} style={boxStyle(n)}>
      <Resizer selected={!!selected} minW={60} minH={60} />
      <Handles />
      <div className="relative min-h-0 flex-1">
        {src && !broken ? (
          <img src={src} alt={n.title ?? n.caption ?? ""} className="size-full object-contain" draggable={false} onError={() => setBroken(true)} />
        ) : (
          <div className="flex size-full items-center justify-center px-3 text-center text-[12px] text-muted-foreground">{n.asset ? `Missing file: ${n.asset}` : "No image file set"}</div>
        )}
      </div>
      {(n.caption || n.title) && <div className="shrink-0 border-t px-3 py-1.5 text-[11.5px] leading-[1.4] text-muted-foreground [overflow-wrap:anywhere]">{n.caption || n.title}</div>}
    </div>
  );
});

// ---------- operator ----------
export const OperatorNode = memo(function OperatorNode({ data, selected }: NodeProps<BpRfNode>) {
  const n = data.node;
  const sym = n.operator === "-" ? "−" : n.operator ?? "+";
  const tone = n.tone && n.tone !== "neutral" ? TONE_VAR[n.tone] : "var(--foreground)";
  const d = n.size ? Math.min(n.size.w, n.size.h) : OPERATOR_SIZE;
  return (
    <div className="relative flex flex-col items-center">
      <div
        className={cn("flex items-center justify-center rounded-full border-[1.5px] bg-card shadow-[0_1px_2px_rgba(0,0,0,0.05)]", selected && "ring-2 ring-ring/60")}
        style={{ width: d, height: d, borderColor: `color-mix(in srgb, ${tone} 45%, var(--border))`, color: tone }}
      >
        <span className={cn("font-semibold leading-none", sym.length > 1 ? "text-[15px]" : "text-[24px]")}>{sym}</span>
      </div>
      <Handles />
      {n.title && <div className="pointer-events-none absolute top-full mt-1 whitespace-nowrap text-[11px] text-muted-foreground">{n.title}</div>}
    </div>
  );
});

// ---------- note ----------
export const NoteNode = memo(function NoteNode({ id, data, selected }: NodeProps<BpRfNode>) {
  const n = data.node;
  const { updateNode } = useContext(CanvasCtx);
  return (
    <div
      className={cn("relative rounded-md px-3 py-2.5 text-[12.5px] leading-snug shadow-[0_1px_3px_rgba(0,0,0,0.08)] [overflow-wrap:anywhere]", selected && "ring-2 ring-ring/60")}
      style={{ ...boxStyle(n), background: "var(--note-bg)", color: "var(--note-fg)" }}
    >
      <Resizer selected={!!selected} minW={100} minH={50} />
      <Handles />
      <EditableText value={n.title} placeholder="Note" onCommit={(v) => updateNode(id, { title: v })} className="font-semibold" />
      <EditableText value={n.subtitle} onCommit={(v) => updateNode(id, { subtitle: v || undefined })} className="mt-0.5 opacity-90" />
      <EditableText value={n.caption} multiline onCommit={(v) => updateNode(id, { caption: v || undefined })} className="mt-1 whitespace-pre-wrap opacity-90" />
    </div>
  );
});

// ---------- group: frame | band | tint | bracket | none ----------
export const GroupNode = memo(function GroupNode({ id, data, selected }: NodeProps<BpRfNode>) {
  const n = data.node;
  const { updateNode } = useContext(CanvasCtx);
  const gk = n.groupKind ?? "group";
  const tr = treatmentOf(n as unknown as LNode);
  const tone = n.tone && n.tone !== "neutral" ? TONE_VAR[n.tone] : "var(--tone-accent)";
  const hair = "color-mix(in srgb, var(--foreground) 11%, transparent)";
  const style: React.CSSProperties =
    tr === "band" ? { background: `color-mix(in srgb, ${tone} 3.5%, transparent)`, borderTop: `1px solid ${hair}`, borderBottom: `1px solid ${hair}` }
      : tr === "tint" ? { background: `color-mix(in srgb, ${n.tone && n.tone !== "neutral" ? tone : "var(--foreground)"} ${n.tone && n.tone !== "neutral" ? 6 : 3.5}%, transparent)`, borderRadius: 20 }
        : tr === "bracket" ? { borderLeft: `1.5px solid color-mix(in srgb, var(--foreground) 22%, transparent)` }
          : tr === "none" ? {}
            : gk === "layer" ? { background: `color-mix(in srgb, ${tone} 6%, transparent)`, border: `1px solid color-mix(in srgb, ${tone} 22%, transparent)`, borderRadius: 14 }
              : gk === "option" ? { background: "color-mix(in srgb, var(--foreground) 2%, transparent)", border: "1.5px dashed color-mix(in srgb, var(--foreground) 30%, transparent)", borderRadius: 18 }
                : gk === "boundary" ? { background: "transparent", border: "2px dashed color-mix(in srgb, var(--tone-bad) 45%, var(--foreground) 20%)", borderRadius: 6 }
                  : { background: "color-mix(in srgb, var(--foreground) 3.5%, transparent)", border: "1px solid var(--border)", borderRadius: 16 };
  const headH = groupHeaderHeight(n as unknown as LNode);
  return (
    <div data-treatment={tr} className={cn("relative size-full", selected && "ring-2 ring-ring/60")} style={{ ...style, ...(n.size ? {} : boxStyle(n)) }}>
      <Resizer selected={!!selected} minW={120} minH={80} />
      <Handles />
      {tr === "bracket" && (
        <>
          <span className="pointer-events-none absolute -left-px top-0 h-px w-2.5" style={{ background: "color-mix(in srgb, var(--foreground) 22%, transparent)" }} />
          <span className="pointer-events-none absolute -left-px bottom-0 h-px w-2.5" style={{ background: "color-mix(in srgb, var(--foreground) 22%, transparent)" }} />
        </>
      )}
      <div className="absolute left-4 flex max-w-[calc(100%-32px)] flex-col justify-center" style={{ top: 0, height: headH - 8 }}>
        <div className="flex items-baseline gap-2">
          {tr === "frame" && (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: gk === "boundary" ? "color-mix(in srgb, var(--tone-bad) 70%, var(--foreground))" : "var(--muted-foreground)" }}>
              {GROUP_INFO[gk].name}
            </span>
          )}
          <EditableText value={n.title} placeholder="Untitled" onCommit={(v) => updateNode(id, { title: v })}
            className={cn("truncate font-semibold", tr === "band" ? "uppercase tracking-[0.09em] text-muted-foreground" : tr === "frame" ? "" : "text-muted-foreground")}
            style={{ fontSize: tr === "band" ? GROUP_METRICS.bandPx : GROUP_METRICS.titlePx }} />
        </div>
        {n.subtitle && <div className="truncate text-[11.5px] text-muted-foreground">{n.subtitle}</div>}
      </div>
    </div>
  );
});

export const nodeTypes = {
  card: CardNode,
  visual: VisualNode,
  image: ImageNode,
  operator: OperatorNode,
  note: NoteNode,
  group: GroupNode,
};
