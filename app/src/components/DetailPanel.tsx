import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeftRight, Check, Pencil, Trash2, X } from "lucide-react";
import type { Arrangement, BpEdge, BpNode, EdgeKind, GroupKind, NodeArt, NodeState, Operator, Shape, Tone, Treatment, Weight } from "@/lib/types";
import { EDGE_KINDS, GROUP_KINDS, OPERATORS } from "@/lib/types";
import { ARRANGEMENT_NAME, ARRANGEMENT_ORDER, SHAPE_NAME, SHAPE_ORDER, TREATMENT_NAME, TREATMENT_ORDER } from "@/lib/look";
import { EDGE_INFO, GROUP_INFO, STATE_INFO, TONE_VAR } from "@/lib/vocab";
import { EdgeSwatch } from "./canvas/edges";
import { lucideIcon } from "./canvas/nodes";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { cn } from "@/lib/utils";
import { Tip } from "./ui/tooltip";

interface Props {
  node?: BpNode;
  edge?: BpEdge;
  nodes: BpNode[];
  onNode: (id: string, patch: Partial<BpNode>) => void;
  onEdge: (id: string, patch: Partial<BpEdge>) => void;
  onDelete: () => void;
  onClose: () => void;
  /** A frame's `arrangement` / `treatment` change re-places what is inside it, so they go through the editor. */
  onGroupLook: (id: string, patch: Pick<BpNode, "arrangement" | "treatment">) => void;
  /** Set when this drawing is joined by one "relates" line to one card: moves the drawing onto that card as its art. */
  makeArt?: { cardTitle: string; run: () => void };
  /** Details first; properties only after an explicit "Edit". Held by the editor so it survives re-renders. */
  editing: boolean;
  onEditing: (v: boolean) => void;
}

const label = (n?: BpNode) => (n ? n.title || n.caption || (n.kind === "operator" ? `“${n.operator ?? "+"}”` : n.id) : "?");

function edgeSentence(e: BpEdge, nodes: BpNode[]) {
  const a = label(nodes.find((n) => n.id === e.source));
  const b = label(nodes.find((n) => n.id === e.target));
  switch (e.kind) {
    case "flow": return `${a} leads to ${b}`;
    case "increases": return `More ${a} → more ${b}`;
    case "decreases": return `More ${a} → less ${b}`;
    case "requires": return `${a} needs ${b}`;
    case "becomes": return `${a} turns into ${b}`;
    case "equals": return `${a} is the same as ${b}`;
    case "versus": return `${a} or ${b}: a tradeoff`;
    case "blocks": return `${a} prevents ${b}`;
    case "relates": return `${a} is connected to ${b}`;
  }
}

function Field({ label: l, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[12px] font-medium text-muted-foreground">{l}</div>
      {children}
    </label>
  );
}

function Segmented<T extends string>({ value, options, onChange, render, label: aria }: { value?: T; options: T[]; onChange: (v: T | undefined) => void; render?: (v: T) => React.ReactNode; label?: string }) {
  return (
    <div className="flex flex-wrap gap-1" role={aria ? "group" : undefined} aria-label={aria}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(value === o ? undefined : o)}
          className={cn("rounded-md border px-2 py-1 text-[12px] transition-colors", value === o ? "border-ring bg-accent font-medium" : "bg-card text-muted-foreground hover:bg-accent")}
        >
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  );
}


const TONES: Tone[] = ["neutral", "accent", "good", "warn", "bad", "muted"];
const TONE_NAMES: Record<Tone, string> = { neutral: "Plain", accent: "Highlight", good: "Good", warn: "Caution", bad: "Bad", muted: "Faded" };
/** One word per kind, the same words as the + menu. */
const KIND_NAME: Record<BpNode["kind"], string> = { card: "card", visual: "drawing", image: "image", operator: "symbol", note: "note", group: "frame" };

export function DetailPanel({ node, edge, nodes, onNode, onEdge, onDelete, onClose, onGroupLook, makeArt, editing, onEditing }: Props) {
  const what = node ? KIND_NAME[node.kind] : "line";
  const title = node ? label(node) : edge ? edgeSentence(edge, nodes) + (edge.both ? " (both ways)" : "") : "";
  return (
    <div data-testid="detail-panel" data-mode={editing ? "edit" : "view"} role="region" aria-label={title || what} className={cn("flex flex-col rounded-xl border bg-popover text-popover-foreground shadow-lg", editing ? "max-h-[calc(100vh-120px)] w-[340px]" : "max-h-[40vh] w-[320px]")}>
      <div className="flex items-start justify-between gap-2 px-4 pb-1 pt-3.5">
        {editing ? (
          <div className="pt-1 text-[14px] font-semibold">Edit {what}</div>
        ) : (
          <div className="min-w-0 pt-0.5">
            {edge && <EdgeSwatch kind={edge.kind} w={40} />}
            <div className="text-[15px] font-semibold leading-snug" data-testid="detail-title">{title}</div>
            {node?.subtitle && <div className="mt-0.5 text-[13px] text-muted-foreground">{node.subtitle}</div>}
          </div>
        )}
        {editing ? (
          <Button size="sm" variant="outline" onClick={() => { /* blur first: a focused field commits its text (the panel unmounts before the blur would fire) */ (document.activeElement as HTMLElement | null)?.blur(); onEditing(false); }}><Check className="size-3.5" /> Done</Button>
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => onEditing(true)}><Pencil className="size-3.5" /> Edit</Button>
            <Button variant="ghost" size="iconSm" onClick={onClose} aria-label="Close details"><X /></Button>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-1.5">
        {!editing && (
          <>
            {(node ?? edge)?.explanation ? (
              <div className="bp-markdown text-[14px] leading-relaxed"><ReactMarkdown remarkPlugins={[remarkGfm]}>{(node ?? edge)!.explanation!}</ReactMarkdown></div>
            ) : (
              <div className="text-[13px] text-muted-foreground">No explanation yet.</div>
            )}
          </>
        )}
        {editing && node && <NodeEdit node={node} onNode={onNode} onGroupLook={onGroupLook} makeArt={makeArt} />}
        {editing && edge && <EdgeEdit edge={edge} onEdge={onEdge} />}
      </div>
      {editing && (
        <div className="border-t px-4 py-2">
          <Button variant="ghost" size="sm" className="-ml-2.5 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="size-3.5" /> Delete {node?.kind === "group" ? "frame and what's inside" : what}
          </Button>
        </div>
      )}
    </div>
  );
}

function ExplanationField({ value, onSave }: { value?: string; onSave: (v: string | undefined) => void }) {
  return (
    <Field label="Explanation">
      <Textarea className="min-h-28 text-[13px]" defaultValue={value ?? ""} placeholder="What this means, in plain words." onBlur={(e) => e.target.value.trim() !== (value ?? "") && onSave(e.target.value.trim() || undefined)} />
    </Field>
  );
}

function NodeEdit({ node: n, onNode, onGroupLook, makeArt }: { node: BpNode; onNode: Props["onNode"]; onGroupLook: Props["onGroupLook"]; makeArt?: Props["makeArt"] }) {
  const set = (patch: Partial<BpNode>) => onNode(n.id, patch);
  const Icon = lucideIcon(n.icon);
  return (
    <div className="space-y-5">
      {n.kind !== "operator" && (
        <Field label="Title">
          <Input defaultValue={n.title ?? ""} onBlur={(e) => e.target.value !== (n.title ?? "") && set({ title: e.target.value || undefined })} />
        </Field>
      )}
      {(n.kind === "card" || n.kind === "group" || n.kind === "note") && (
        <Field label="Subtitle">
          <Input defaultValue={n.subtitle ?? ""} onBlur={(e) => e.target.value !== (n.subtitle ?? "") && set({ subtitle: e.target.value || undefined })} />
        </Field>
      )}
      {(n.kind === "visual" || n.kind === "image" || n.kind === "note") && (
        <Field label={n.kind === "note" ? "Text" : "Caption"}>
          <Textarea className="min-h-16" defaultValue={n.caption ?? ""} onBlur={(e) => e.target.value !== (n.caption ?? "") && set({ caption: e.target.value || undefined })} />
        </Field>
      )}
      <ExplanationField value={n.explanation} onSave={(v) => set({ explanation: v })} />
      {n.kind === "operator" && (
        <Field label="Symbol">
          <Segmented<Operator> value={n.operator ?? "+"} options={OPERATORS} onChange={(v) => v && set({ operator: v })} />
        </Field>
      )}
      {n.kind === "group" && (
        <Field label="Kind of frame">
          <Segmented<GroupKind> value={n.groupKind ?? "group"} options={GROUP_KINDS} onChange={(v) => v && set({ groupKind: v })} render={(v) => GROUP_INFO[v].name} />
        </Field>
      )}
      {n.kind === "group" && (
        <>
          <Field label="Arrangement of what's inside">
            <Segmented<Arrangement | "auto"> label="Arrangement" value={n.arrangement ?? "auto"} options={["auto", ...ARRANGEMENT_ORDER]}
              onChange={(v) => v && onGroupLook(n.id, { arrangement: v === "auto" ? undefined : v })} render={(v) => (v === "auto" ? "Automatic" : ARRANGEMENT_NAME[v])} />
          </Field>
          <Field label="How the frame is drawn">
            <Segmented<Treatment | "auto"> label="Frame style" value={n.treatment ?? "auto"} options={["auto", ...TREATMENT_ORDER]}
              onChange={(v) => v && onGroupLook(n.id, { treatment: v === "auto" ? undefined : v })} render={(v) => (v === "auto" ? "Default" : TREATMENT_NAME[v])} />
          </Field>
        </>
      )}
      {n.kind === "image" && (
        <Field label="File in this project's assets folder">
          <Input defaultValue={n.asset ?? ""} placeholder="e.g. diagram.png" onBlur={(e) => e.target.value !== (n.asset ?? "") && set({ asset: e.target.value || undefined })} />
        </Field>
      )}
      {(n.kind === "card" || n.kind === "visual" || n.kind === "group" || n.kind === "operator") && (
        <Field label="Colour">
          <div className="flex gap-2" role="radiogroup" aria-label="Colour">
            {TONES.map((t) => (
              <Tip key={t} label={TONE_NAMES[t]}>
                <button type="button" role="radio" aria-checked={(n.tone ?? "neutral") === t} aria-label={TONE_NAMES[t]} onClick={() => set({ tone: t === "neutral" ? undefined : t })}
                  className={cn("flex size-7 items-center justify-center rounded-full border", (n.tone ?? "neutral") === t ? "border-ring ring-2 ring-ring/30" : "border-transparent hover:border-border")}>
                  <span className="size-4 rounded-full" style={{ background: TONE_VAR[t] }} />
                </button>
              </Tip>
            ))}
          </div>
        </Field>
      )}
      {n.kind !== "note" && n.kind !== "operator" && (
        <Field label="Status">
          <Segmented<NodeState> value={n.state} options={["idea", "question", "decided", "built"]} onChange={(v) => set({ state: v })} render={(v) => STATE_INFO[v].name} />
        </Field>
      )}
      {n.kind === "card" && (
        <>
          <Field label="Size">
            <Segmented<Weight> value={n.weight} options={["sm", "md", "lg"]} onChange={(v) => set({ weight: v })} render={(v) => ({ sm: "Small", md: "Normal", lg: "Large" })[v]} />
          </Field>
          <Field label="Icon">
            <div className="flex items-center gap-2">
              <Input defaultValue={n.icon ?? ""} placeholder="e.g. coffee, user, brain" onBlur={(e) => e.target.value !== (n.icon ?? "") && set({ icon: e.target.value.trim() || undefined })} />
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md border">{Icon ? <Icon className="size-4" /> : null}</div>
            </div>
          </Field>
        </>
      )}
      {n.kind === "card" && (
        <>
          <Field label="Shape">
            <Segmented<Shape> label="Shape" value={n.shape ?? "card"} options={SHAPE_ORDER} onChange={(v) => v && set({ shape: v === "card" ? undefined : v })} render={(v) => SHAPE_NAME[v]} />
          </Field>
          <ArtEdit art={n.art} onArt={(art) => set({ art })} />
        </>
      )}
      {n.kind === "visual" && (
        <details className="text-[12px]">
          <summary className="cursor-pointer text-muted-foreground">Drawing source</summary>
          <div className="mt-2 space-y-2">
            <Textarea className="min-h-32 font-mono text-[11px]" defaultValue={n.svg ?? ""} placeholder="<svg …>" onBlur={(e) => e.target.value !== (n.svg ?? "") && set({ svg: e.target.value || undefined })} />
            <Textarea className="min-h-20 font-mono text-[11px]" defaultValue={n.html ?? ""} placeholder="HTML (used when there is no SVG)" onBlur={(e) => e.target.value !== (n.html ?? "") && set({ html: e.target.value || undefined })} />
          </div>
        </details>
      )}
      {n.kind === "visual" && makeArt && (
        <div>
          <Button variant="outline" size="sm" onClick={makeArt.run}>Make this the card's art</Button>
          <div className="mt-1.5 text-[12px] text-muted-foreground">Moves the drawing onto “{makeArt.cardTitle}” and removes this drawing and its line.</div>
        </div>
      )}
    </div>
  );
}

/** The drawing on a card: size, remove, and (behind a disclosure) the SVG source. */
function ArtEdit({ art, onArt }: { art?: NodeArt; onArt: (a: NodeArt | undefined) => void }) {
  const other = art && !art.svg ? (art.html ? "HTML" : art.asset ? "an image file" : "") : "";
  return (
    <div className="space-y-2.5">
      {art && (
        <Field label="Drawing size">
          <Segmented<NonNullable<NodeArt["size"]>> label="Drawing size" value={art.size ?? "md"} options={["sm", "md", "lg"]}
            onChange={(v) => v && onArt({ ...art, size: v })} render={(v) => ({ sm: "Small", md: "Normal", lg: "Large" })[v]} />
        </Field>
      )}
      <details className="text-[12px]">
        <summary className="cursor-pointer text-muted-foreground">{art ? "Drawing on this card (SVG)" : "Put a drawing on this card (SVG)"}</summary>
        <div className="mt-2 space-y-2">
          <Textarea aria-label="Drawing SVG" className="min-h-28 font-mono text-[11px]" defaultValue={art?.svg ?? ""} placeholder="<svg …>"
            onBlur={(e) => { const v = e.target.value.trim(); if (v !== (art?.svg ?? "")) onArt(v ? { svg: v, size: art?.size } : undefined); }} />
          {other && <div className="text-muted-foreground">Now drawn from {other}. Writing SVG here replaces it.</div>}
        </div>
      </details>
      {art && <Button variant="ghost" size="sm" className="-ml-2.5 text-muted-foreground" onClick={() => onArt(undefined)}><X className="size-3.5" /> Remove drawing</Button>}
    </div>
  );
}

function EdgeEdit({ edge: e, onEdge }: { edge: BpEdge; onEdge: Props["onEdge"] }) {
  const set = (patch: Partial<BpEdge>) => onEdge(e.id, patch);
  return (
    <div className="space-y-5">
      <Field label="What this line means">
        <div className="-mx-2 grid grid-cols-1 gap-0.5" role="radiogroup" aria-label="What this line means">
          {EDGE_KINDS.map((k: EdgeKind) => (
            <button key={k} type="button" role="radio" aria-checked={e.kind === k} onClick={() => set({ kind: k })}
              className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px]", e.kind === k ? "bg-accent font-medium" : "hover:bg-accent/60")}>
              <EdgeSwatch kind={k} w={36} />
              <span className="w-[72px] shrink-0">{EDGE_INFO[k].name}</span>
              <span className="truncate text-muted-foreground">{EDGE_INFO[k].reads}</span>
            </button>
          ))}
        </div>
      </Field>
      <ExplanationField value={e.explanation} onSave={(v) => set({ explanation: v })} />
      <Field label="Short label on the line">
        <Input defaultValue={e.label ?? ""} placeholder="Optional" onBlur={(ev) => ev.target.value !== (e.label ?? "") && set({ label: ev.target.value || undefined })} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => set({ both: e.both ? undefined : true })}>{e.both ? "Make one-way" : "Make two-way"}</Button>
        <Button variant="outline" size="sm" onClick={() => set({ source: e.target, target: e.source, sourceHandle: e.targetHandle, targetHandle: e.sourceHandle })}>
          <ArrowLeftRight className="size-3.5" /> Swap direction
        </Button>
      </div>
    </div>
  );
}
