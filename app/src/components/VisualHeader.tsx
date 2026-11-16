import { useState } from "react";
import { ChevronRight, FileText, Redo2, Undo2, Wand2 } from "lucide-react";
import type { TreeSystem, VisualIds } from "@/lib/types";
import type { LayoutDirection } from "@/lib/layout";
import { Button } from "./ui/button";
import { Tip } from "./ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Legend } from "./Legend";
import { NotesDialog } from "./NotesDialog";

interface Props {
  ids: VisualIds;
  projectTitle: string;
  system?: TreeSystem;
  visualTitle: string;
  onRename: (t: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onTidy: (d: LayoutDirection) => void;
  hasNodes: boolean;
}

export function VisualHeader({ ids, projectTitle, system, visualTitle, onRename, canUndo, canRedo, onUndo, onRedo, onTidy, hasNodes }: Props) {
  const [notesOpen, setNotesOpen] = useState(false);
  const many = (system?.visuals.length ?? 0) > 1;
  return (
    <header className="drag-region flex h-[52px] shrink-0 items-center justify-between gap-4 border-b bg-background px-4">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1 text-[13px]">
          <span className="truncate text-muted-foreground">{projectTitle}</span>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
          <span className="truncate font-semibold">{system?.title ?? ids.systemId}</span>
          {many && (
            <>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
              <input
                key={visualTitle}
                defaultValue={visualTitle}
                onBlur={(e) => e.target.value.trim() && e.target.value !== visualTitle && onRename(e.target.value.trim())}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                className="no-drag min-w-0 rounded bg-transparent px-1 font-medium outline-none hover:bg-accent focus:bg-accent"
                style={{ width: `${Math.max(6, visualTitle.length + 1)}ch` }}
              />
            </>
          )}
        </div>
        {system?.summary && <div className="truncate text-[12px] text-muted-foreground">{system.summary}</div>}
      </div>
      <div className="no-drag flex shrink-0 items-center gap-1">
        <Tip label="Undo (⌘Z)"><Button variant="ghost" size="iconSm" aria-label="Undo" disabled={!canUndo} onClick={onUndo}><Undo2 /></Button></Tip>
        <Tip label="Redo (⇧⌘Z)"><Button variant="ghost" size="iconSm" aria-label="Redo" disabled={!canRedo} onClick={onRedo}><Redo2 /></Button></Tip>
        <div className="mx-1 h-5 w-px bg-border" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={!hasNodes} className="text-muted-foreground"><Wand2 className="size-3.5" /> Tidy</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onTidy("DOWN")}>Arrange top to bottom</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onTidy("RIGHT")}>Arrange left to right</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Legend />
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setNotesOpen(true)}><FileText className="size-3.5" /> Notes</Button>
      </div>
      <NotesDialog open={notesOpen} onOpenChange={setNotesOpen} projectId={ids.projectId} systemId={ids.systemId} />
    </header>
  );
}
