import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeftRight, Pencil, Trash2, X } from "lucide-react";
import type { BpEdge, BpNode, EdgeKind, GroupKind, NodeState, Operator, Tone, Weight } from "@/lib/types";
import { EDGE_KINDS, GROUP_KINDS, OPERATORS } from "@/lib/types";
import { EDGE_INFO, GROUP_INFO, NODE_INFO, STATE_INFO, TONE_VAR } from "@/lib/vocab";
import { EdgeSwatch } from "./canvas/edges";
import { lucideIcon } from "./canvas/nodes";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { cn } from "@/lib/utils";

interface Props {
  node?: BpNode;
  edge?: BpEdge;
  nodes: BpNode[];
  onNode: (id: string, patch: Partial<BpNode>) => void;
  onEdge: (id: string, patch: Partial<BpEdge>) => void;
  onDelete: () => void;
  onClose: () => void;
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
      <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">{l}</div>
      {children}
    </label>
  );
}

function Segmented<T extends string>({ value, options, onChange, render }: { value?: T; options: T[]; onChange: (v: T | undefined) => void; render?: (v: T) => React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-1">
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

function Explanation({ value, onSave }: { value?: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  if (editing) {
    return (
      <div className="space-y-2">
        <Textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-40 font-mono text-[12.5px]" placeholder="What does this mean, and why is it here? Markdown works." />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setDraft(value ?? ""); setEditing(false); }}>Cancel</Button>
          <Button size="sm" onClick={() => { onSave(draft.trim()); setEditing(false); }}>Save</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="group relative">
      {value ? (
        <div className="bp-markdown text-[13.5px] leading-relaxed"><ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown></div>
      ) : (
        <div className="text-[13px] italic text-muted-foreground">No explanation yet.</div>
      )}
      <Button variant="outline" size="sm" className="mt-3" onClick={() => { setDraft(value ?? ""); setEditing(true); }}>
        <Pencil className="size-3.5" /> {value ? "Edit explanation" : "Write explanation"}
      </Button>
    </div>
  );
}

const TONES: Tone[] = ["neutral", "accent", "good", "warn", "bad", "muted"];
const TONE_NAMES: Record<Tone, string> = { neutral: "Plain", accent: "Highlight", good: "Good", warn: "Caution", bad: "Bad", muted: "Faded" };

export function DetailPanel({ node, edge, nodes, onNode, onEdge, onDelete, onClose }: Props) {
  return (
    <aside data-testid="detail-panel" className="flex w-[340px] shrink-0 flex-col border-l bg-card">
      <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="text-[11.5px] font-medium text-muted-foreground">
            {node ? (node.kind === "group" ? `${GROUP_INFO[node.groupKind ?? "group"].name}: ${GROUP_INFO[node.groupKind ?? "group"].reads.toLowerCase()}` : `${NODE_INFO[node.kind].name}: ${NODE_INFO[node.kind].reads.toLowerCase()}`) : edge ? "Relationship" : ""}
          </div>
          <div className="mt-0.5 truncate text-[15px] font-semibold">{node ? label(node) : edge ? EDGE_INFO[edge.kind]?.name : ""}</div>
        </div>
        <Button variant="ghost" size="iconSm" onClick={onClose} aria-label="Close details"><X /></Button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {node && <NodeBody node={node} onNode={onNode} />}
        {edge && <EdgeBody edge={edge} nodes={nodes} onEdge={onEdge} />}
      </div>
      <div className="border-t px-4 py-3">
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="size-3.5" /> Delete {node ? (node.kind === "group" ? "frame and its contents" : "item") : "relationship"}
        </Button>
      </div>
    </aside>
  );
}

function NodeBody({ node: n, onNode }: { node: BpNode; onNode: Props["onNode"] }) {
  const set = (patch: Partial<BpNode>) => onNode(n.id, patch);
  const Icon = lucideIcon(n.icon);
  return (
    <>
      <Explanation value={n.explanation} onSave={(v) => set({ explanation: v || undefined })} />
      <div className="space-y-3 border-t pt-4">
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
        {n.kind === "image" && (
          <Field label="File in this project's assets folder">
            <Input defaultValue={n.asset ?? ""} placeholder="e.g. diagram.png" onBlur={(e) => e.target.value !== (n.asset ?? "") && set({ asset: e.target.value || undefined })} />
          </Field>
        )}
        {(n.kind === "card" || n.kind === "visual" || n.kind === "group" || n.kind === "operator") && (
          <Field label="Colour">
            <div className="flex flex-wrap gap-1.5">
              {TONES.map((t) => (
                <button key={t} type="button" title={TONE_NAMES[t]} onClick={() => set({ tone: t === "neutral" ? undefined : t })}
                  className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px]", (n.tone ?? "neutral") === t ? "border-ring bg-accent" : "bg-card text-muted-foreground hover:bg-accent")}>
                  <span className="size-2.5 rounded-full" style={{ background: TONE_VAR[t] }} />
                  {TONE_NAMES[t]}
                </button>
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
            <Field label="Importance">
              <Segmented<Weight> value={n.weight} options={["sm", "md", "lg"]} onChange={(v) => set({ weight: v })} render={(v) => ({ sm: "Minor", md: "Normal", lg: "Major" })[v]} />
            </Field>
            <Field label="Icon (Lucide name, e.g. brain)">
              <div className="flex items-center gap-2">
                <Input defaultValue={n.icon ?? ""} onBlur={(e) => e.target.value !== (n.icon ?? "") && set({ icon: e.target.value.trim() || undefined })} />
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md border">{Icon ? <Icon className="size-4" /> : null}</div>
              </div>
            </Field>
          </>
        )}
        {n.kind === "visual" && (
          <details className="text-[12px]">
            <summary className="cursor-pointer text-muted-foreground">Drawing source (SVG or HTML)</summary>
            <div className="mt-2 space-y-2">
              <Textarea className="min-h-32 font-mono text-[11px]" defaultValue={n.svg ?? ""} placeholder="<svg …>" onBlur={(e) => e.target.value !== (n.svg ?? "") && set({ svg: e.target.value || undefined })} />
              <Textarea className="min-h-20 font-mono text-[11px]" defaultValue={n.html ?? ""} placeholder="HTML (used when there is no SVG)" onBlur={(e) => e.target.value !== (n.html ?? "") && set({ html: e.target.value || undefined })} />
            </div>
          </details>
        )}
      </div>
    </>
  );
}

function EdgeBody({ edge: e, nodes, onEdge }: { edge: BpEdge; nodes: BpNode[]; onEdge: Props["onEdge"] }) {
  const set = (patch: Partial<BpEdge>) => onEdge(e.id, patch);
  const info = EDGE_INFO[e.kind];
  return (
    <>
      <div className="rounded-lg border bg-background px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <EdgeSwatch kind={e.kind} w={44} />
          <div className="text-[13.5px] font-medium leading-snug">{edgeSentence(e, nodes)}</div>
        </div>
        <div className="mt-1 text-[12px] text-muted-foreground">{info?.name}: {info?.reads}{e.both ? " (both directions)" : ""}</div>
      </div>
      <Explanation value={e.explanation} onSave={(v) => set({ explanation: v || undefined })} />
      <div className="space-y-3 border-t pt-4">
        <Field label="Kind of relationship">
          <div className="grid grid-cols-1 gap-0.5">
            {EDGE_KINDS.map((k: EdgeKind) => (
              <button key={k} type="button" onClick={() => set({ kind: k })}
                className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[12.5px]", e.kind === k ? "bg-accent font-medium" : "hover:bg-accent/60")}>
                <EdgeSwatch kind={k} w={40} />
                <span className="w-[72px] shrink-0">{EDGE_INFO[k].name}</span>
                <span className="truncate text-muted-foreground">{EDGE_INFO[k].reads}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Short label on the line (optional)">
          <Input defaultValue={e.label ?? ""} onBlur={(ev) => ev.target.value !== (e.label ?? "") && set({ label: ev.target.value || undefined })} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => set({ both: e.both ? undefined : true })}>
            {e.both ? "Make one-way" : "Make two-way"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => set({ source: e.target, target: e.source, sourceHandle: e.targetHandle, targetHandle: e.sourceHandle })}>
            <ArrowLeftRight className="size-3.5" /> Swap direction
          </Button>
        </div>
      </div>
    </>
  );
}
