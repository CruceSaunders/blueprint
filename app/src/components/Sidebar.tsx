import { useEffect, useRef, useState } from "react";
import { ChevronRight, MoreHorizontal, Plus, ArrowUp, ArrowDown, Pencil, Trash2, PanelLeft } from "lucide-react";
import type { TreeProject, VisualIds } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Tip } from "./ui/tooltip";

export type TreeAction =
  | { type: "newProject" }
  | { type: "newSystem"; projectId: string }
  | { type: "newVisual"; projectId: string; systemId: string }
  | { type: "rename"; kind: "project" | "system" | "visual"; ids: Partial<VisualIds>; title: string }
  | { type: "delete"; kind: "project" | "system" | "visual"; ids: Partial<VisualIds>; title: string }
  | { type: "move"; kind: "system" | "visual"; ids: Partial<VisualIds>; dir: -1 | 1 };

/** A name being typed in place: a new project/system/visual (phantom row) or a rename. */
export type SidebarEdit = Extract<TreeAction, { type: "newProject" | "newSystem" | "newVisual" | "rename" }>;

/** Inline name field: Enter saves, Escape cancels, clicking away saves if there is a name. */
function InlineName({ depth, initial, placeholder, onDone }: { depth: number; initial: string; placeholder: string; onDone: (v: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const born = useRef(Date.now());
  useEffect(() => { const t = window.setTimeout(() => { ref.current?.focus(); ref.current?.select(); }, 30); return () => window.clearTimeout(t); }, []);
  const finish = (v: string | null) => { if (done.current) return; done.current = true; onDone(v); };
  return (
    <div className="flex h-8 items-center gap-1 pr-1" style={{ paddingLeft: 4 + depth * 16 + 20 }}>
      <input
        ref={ref}
        data-testid="inline-name"
        aria-label={placeholder}
        defaultValue={initial}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); finish(e.currentTarget.value.trim() || null); }
          else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(null); }
        }}
        onBlur={(e) => {
          // a closing menu can steal focus right after the field appears: take it back instead of finishing
          if (Date.now() - born.current < 400) { const el = e.currentTarget; window.setTimeout(() => el.focus(), 0); return; }
          finish(e.currentTarget.value.trim() || null);
        }}
        className="h-7 min-w-0 flex-1 rounded-md border border-ring bg-background px-2 text-[13px] outline-none ring-2 ring-ring/25"
      />
    </div>
  );
}

interface Props {
  tree: TreeProject[];
  selected: VisualIds | null;
  onSelect: (ids: VisualIds) => void;
  onAction: (a: TreeAction) => void;
  onCollapse: () => void;
  edit: SidebarEdit | null;
  onEditDone: (value: string | null) => void;
  /** "project/system/visual" of a visual that just arrived from the AI: its row glows once. */
  arrived?: string | null;
}

function Row({ depth, open, hasChildren, active, label, onClick, onToggle, menu, glow, editor }: {
  depth: number; open?: boolean; hasChildren?: boolean; active?: boolean; icon?: React.ReactNode; label: string; glow?: boolean; editor?: React.ReactNode;
  onClick: () => void; onToggle?: () => void; menu?: React.ReactNode;
}) {
  if (editor) return <>{editor}</>;
  return (
    <div
      className={cn("group flex h-8 cursor-default items-center gap-1 rounded-md pr-1 text-[13px] transition-colors", active ? "bg-accent font-medium text-foreground" : depth === 0 ? "font-medium text-foreground/90 hover:bg-accent/60" : "text-foreground/80 hover:bg-accent/60", glow && "bp-arrived")}
      style={{ paddingLeft: 4 + depth * 16 }}
      onClick={onClick}
    >
      <span
        className={cn("flex size-4 shrink-0 items-center justify-center text-muted-foreground", !hasChildren && "invisible")}
        onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
      >
        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {menu && <span className="opacity-0 group-hover:opacity-100 has-[[data-state=open]]:opacity-100" onClick={(e) => e.stopPropagation()}>{menu}</span>}
    </div>
  );
}

function RowMenu({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground" aria-label="More">
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Sidebar({ tree, selected, onSelect, onAction, onCollapse, arrived, edit, onEditDone }: Props) {
  const renaming = (kind: "project" | "system" | "visual", ids: Partial<VisualIds>) =>
    edit?.type === "rename" && edit.kind === kind && edit.ids.projectId === ids.projectId && edit.ids.systemId === ids.systemId && edit.ids.visualId === ids.visualId;
  const inline = (depth: number, initial: string, placeholder: string) => <InlineName key={JSON.stringify(edit)} depth={depth} initial={initial} placeholder={placeholder} onDone={onEditDone} />;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setCollapsed((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const isOpen = (k: string) => !collapsed.has(k);

  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r bg-sidebar" data-testid="sidebar">
      <div className="drag-region flex h-[52px] shrink-0 items-center justify-end px-2">
        <Tip label="Hide sidebar (⌘\)" side="right">
          <button type="button" aria-label="Hide sidebar" onClick={onCollapse} className="no-drag flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><PanelLeft className="size-4" /></button>
        </Tip>
      </div>
      <div className="flex items-center justify-between px-4 pb-1 pt-1">
        <span className="text-[12px] font-medium text-muted-foreground">Projects</span>
        <Tip label="New project" side="right">
          <button type="button" aria-label="New project" onClick={() => onAction({ type: "newProject" })} className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><Plus className="size-4" /></button>
        </Tip>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" role="tree">
        {tree.length === 0 && <div className="px-3 py-2 text-[13px] text-muted-foreground">Nothing yet</div>}
        {tree.map((p) => {
          const pk = p.id;
          return (
            <div key={p.id} className="mt-0.5">
              <Row
                depth={0}
                hasChildren={p.systems.length > 0}
                open={isOpen(pk)}
                label={p.title}
                editor={renaming("project", { projectId: p.id }) ? inline(0, p.title, "Project name") : undefined}
                onClick={() => toggle(pk)}
                onToggle={() => toggle(pk)}
                menu={
                  <RowMenu>
                    <DropdownMenuItem onSelect={() => onAction({ type: "newSystem", projectId: p.id })}><Plus /> New system</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onAction({ type: "rename", kind: "project", ids: { projectId: p.id }, title: p.title })}><Pencil /> Rename</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => onAction({ type: "delete", kind: "project", ids: { projectId: p.id }, title: p.title })}><Trash2 /> Move to Trash</DropdownMenuItem>
                  </RowMenu>
                }
              />
              {isOpen(pk) && p.systems.length === 0 && !(edit?.type === "newSystem" && edit.projectId === p.id) && (
                <button type="button" onClick={() => onAction({ type: "newSystem", projectId: p.id })} className="ml-6 mt-0.5 flex h-7 items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">
                  <Plus className="size-3.5" /> Add a system
                </button>
              )}
              {isOpen(pk) && p.systems.map((s, si) => {
                const sk = `${p.id}/${s.id}`;
                const first = s.primaryVisual && s.visuals.some((v) => v.id === s.primaryVisual) ? s.primaryVisual : s.visuals[0]?.id;
                const sysActive = selected?.projectId === p.id && selected.systemId === s.id;
                const showVisuals = s.visuals.length > 1 && isOpen(sk);
                return (
                  <div key={s.id}>
                    <Row
                      depth={1}
                      hasChildren={s.visuals.length > 1}
                      open={isOpen(sk)}
                      active={sysActive && s.visuals.length <= 1}
                      glow={!!arrived && s.visuals.length <= 1 && arrived.startsWith(`${p.id}/${s.id}/`)}
                      label={s.title}
                      editor={renaming("system", { projectId: p.id, systemId: s.id }) ? inline(1, s.title, "System name") : undefined}
                      onClick={() => (first ? onSelect({ projectId: p.id, systemId: s.id, visualId: first }) : onAction({ type: "newVisual", projectId: p.id, systemId: s.id }))}
                      onToggle={() => toggle(sk)}
                      menu={
                        <RowMenu>
                          <DropdownMenuItem onSelect={() => onAction({ type: "newVisual", projectId: p.id, systemId: s.id })}><Plus /> New visual</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => onAction({ type: "rename", kind: "system", ids: { projectId: p.id, systemId: s.id }, title: s.title })}><Pencil /> Rename</DropdownMenuItem>
                          <DropdownMenuItem disabled={si === 0} onSelect={() => onAction({ type: "move", kind: "system", ids: { projectId: p.id, systemId: s.id }, dir: -1 })}><ArrowUp /> Move up</DropdownMenuItem>
                          <DropdownMenuItem disabled={si === p.systems.length - 1} onSelect={() => onAction({ type: "move", kind: "system", ids: { projectId: p.id, systemId: s.id }, dir: 1 })}><ArrowDown /> Move down</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem destructive onSelect={() => onAction({ type: "delete", kind: "system", ids: { projectId: p.id, systemId: s.id }, title: s.title })}><Trash2 /> Move to Trash</DropdownMenuItem>
                        </RowMenu>
                      }
                    />
                    {showVisuals && s.visuals.map((v, vi) => {
                      const ids = { projectId: p.id, systemId: s.id, visualId: v.id };
                      return (
                        <Row
                          key={v.id}
                          depth={2}
                          active={sysActive && selected?.visualId === v.id}
                          glow={arrived === `${p.id}/${s.id}/${v.id}`}
                          label={v.title}
                          editor={renaming("visual", ids) ? inline(2, v.title, "Visual name") : undefined}
                          onClick={() => onSelect(ids)}
                          menu={
                            <RowMenu>
                              <DropdownMenuItem onSelect={() => onAction({ type: "rename", kind: "visual", ids, title: v.title })}><Pencil /> Rename</DropdownMenuItem>
                              <DropdownMenuItem disabled={vi === 0} onSelect={() => onAction({ type: "move", kind: "visual", ids, dir: -1 })}><ArrowUp /> Move up</DropdownMenuItem>
                              <DropdownMenuItem disabled={vi === s.visuals.length - 1} onSelect={() => onAction({ type: "move", kind: "visual", ids, dir: 1 })}><ArrowDown /> Move down</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem destructive onSelect={() => onAction({ type: "delete", kind: "visual", ids, title: v.title })}><Trash2 /> Move to Trash</DropdownMenuItem>
                            </RowMenu>
                          }
                        />
                      );
                    })}
                    {edit?.type === "newVisual" && edit.projectId === p.id && edit.systemId === s.id && inline(2, "", "Visual name")}
                  </div>
                );
              })}
              {edit?.type === "newSystem" && edit.projectId === p.id && inline(1, "", "System name")}
            </div>
          );
        })}
        {edit?.type === "newProject" && inline(0, "", "Project name")}
      </nav>
    </aside>
  );
}
