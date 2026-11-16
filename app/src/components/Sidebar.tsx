import { useState } from "react";
import { ChevronRight, Folder, FolderOpen, Layers, MoreHorizontal, Plus, Search, Shapes, Moon, Sun, Monitor, ArrowUp, ArrowDown, Pencil, Trash2 } from "lucide-react";
import type { TreeProject, VisualIds } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Tip } from "./ui/tooltip";
import type { ThemeMode } from "@/lib/theme";

export type TreeAction =
  | { type: "newProject" }
  | { type: "newSystem"; projectId: string }
  | { type: "newVisual"; projectId: string; systemId: string }
  | { type: "rename"; kind: "project" | "system" | "visual"; ids: Partial<VisualIds>; title: string }
  | { type: "delete"; kind: "project" | "system" | "visual"; ids: Partial<VisualIds>; title: string }
  | { type: "move"; kind: "system" | "visual"; ids: Partial<VisualIds>; dir: -1 | 1 };

interface Props {
  tree: TreeProject[];
  selected: VisualIds | null;
  onSelect: (ids: VisualIds) => void;
  onAction: (a: TreeAction) => void;
  onSearch: () => void;
  theme: ThemeMode;
  onTheme: (t: ThemeMode) => void;
}

function Row({ depth, open, hasChildren, active, icon, label, onClick, onToggle, menu }: {
  depth: number; open?: boolean; hasChildren?: boolean; active?: boolean; icon: React.ReactNode; label: string;
  onClick: () => void; onToggle?: () => void; menu?: React.ReactNode;
}) {
  return (
    <div
      className={cn("group flex h-8 cursor-default items-center gap-1.5 rounded-md pr-1 text-[13px] transition-colors", active ? "bg-accent font-medium text-foreground" : "text-foreground/85 hover:bg-accent/60")}
      style={{ paddingLeft: 6 + depth * 14 }}
      onClick={onClick}
    >
      <span
        className={cn("flex size-4 shrink-0 items-center justify-center text-muted-foreground", !hasChildren && "invisible")}
        onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
      >
        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
      </span>
      <span className="shrink-0 text-muted-foreground [&_svg]:size-4">{icon}</span>
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

export function Sidebar({ tree, selected, onSelect, onAction, onSearch, theme, onTheme }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setCollapsed((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const isOpen = (k: string) => !collapsed.has(k);

  return (
    <aside className="flex w-[264px] shrink-0 flex-col border-r bg-sidebar">
      <div className="drag-region h-[52px] shrink-0" />
      <div className="px-3 pb-2">
        <button type="button" onClick={onSearch} className="no-drag flex h-8 w-full items-center gap-2 rounded-md border bg-card px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent">
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="text-[11px] tracking-wider">⌘K</kbd>
        </button>
      </div>
      <div className="flex items-center justify-between px-4 pb-1 pt-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Projects</span>
        <Tip label="New project" side="right">
          <button type="button" onClick={() => onAction({ type: "newProject" })} className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"><Plus className="size-3.5" /></button>
        </Tip>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" role="tree">
        {tree.length === 0 && <div className="px-3 py-3 text-[12.5px] leading-relaxed text-muted-foreground">No projects yet.</div>}
        {tree.map((p) => {
          const pk = p.id;
          return (
            <div key={p.id} className="mt-0.5">
              <Row
                depth={0}
                hasChildren={p.systems.length > 0}
                open={isOpen(pk)}
                icon={isOpen(pk) && p.systems.length ? <FolderOpen /> : <Folder />}
                label={p.title}
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
              {isOpen(pk) && p.systems.length === 0 && (
                <button type="button" onClick={() => onAction({ type: "newSystem", projectId: p.id })} className="ml-9 mt-0.5 flex h-7 items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">
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
                      icon={<Layers />}
                      label={s.title}
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
                          icon={<Shapes />}
                          label={v.title}
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
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="flex items-center justify-between border-t px-3 py-2">
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onAction({ type: "newProject" })}><Plus className="size-3.5" /> New project</Button>
        <div className="flex items-center rounded-md border bg-card p-0.5">
          {([["light", Sun], ["system", Monitor], ["dark", Moon]] as const).map(([m, Icon]) => (
            <Tip key={m} label={m === "system" ? "Match macOS" : m === "light" ? "Light" : "Dark"}>
              <button type="button" onClick={() => onTheme(m)} className={cn("flex size-6 items-center justify-center rounded text-muted-foreground", theme === m && "bg-accent text-foreground")}>
                <Icon className="size-3.5" />
              </button>
            </Tip>
          ))}
        </div>
      </div>
    </aside>
  );
}
