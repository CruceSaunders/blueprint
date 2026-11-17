import { useEffect } from "react";
import { BookOpen, FileText, LayoutGrid, Map, MoreHorizontal, PanelLeft, Redo2, Search, SunMoon, Undo2, Wand2 } from "lucide-react";
import type { Arrangement, TreeSystem, VisualIds } from "@/lib/types";
import { ARRANGEMENT_NAME, ARRANGEMENT_ORDER } from "@/lib/look";
import type { LayoutDirection } from "@/lib/layout";
import { useCommands } from "@/lib/commands";
import { useShell } from "@/lib/shell";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Tip } from "./ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { AiStatus } from "./AiSetup";

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
  /** The visual's own arrangement (undefined = automatic) and a way to change it. */
  arrangement?: Arrangement;
  onArrange: (a: Arrangement | undefined) => void;
  hasNodes: boolean;
}

const NEXT_THEME = { light: "dark", dark: "system", system: "light" } as const;
const THEME_NAME = { light: "Light", dark: "Dark", system: "Match macOS" } as const;

/** One quiet line over the canvas: where you are on the left; undo, AI status, search and "More" on the right. */
export function VisualHeader({ ids, projectTitle, system, visualTitle, onRename, canUndo, canRedo, onUndo, onRedo, onTidy, arrangement, onArrange, hasNodes }: Props) {
  const shell = useShell();
  const many = (system?.visuals.length ?? 0) > 1;
  useCommands("visual", [
    { id: "undo", label: "Undo", group: "Edit", shortcut: "⌘Z", disabled: !canUndo, run: onUndo },
    { id: "redo", label: "Redo", group: "Edit", shortcut: "Shift ⌘Z", disabled: !canRedo, run: onRedo },
    { id: "tidy-down", label: "Tidy up: arrange top to bottom", group: "Arrange", disabled: !hasNodes, run: () => onTidy("DOWN") },
    { id: "tidy-right", label: "Tidy up: arrange left to right", group: "Arrange", disabled: !hasNodes, run: () => onTidy("RIGHT") },
    { id: "legend", label: "How to read lines and frames", group: "View", run: () => shell.setSheet("legend") },
    { id: "notes", label: "Notes for this system", group: "View", run: () => shell.setSheet("notes") },
    { id: "map", label: shell.showMap ? "Hide the overview map" : "Show the overview map", group: "View", run: shell.toggleMap },
  ]);
  // keep the open sheet pointing at the visual on screen
  useEffect(() => () => shell.setSheet(null), [ids.projectId, ids.systemId]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <header className={cn("drag-region flex h-[52px] shrink-0 items-center justify-between gap-4 border-b bg-background pr-3", shell.sidebarOpen ? "pl-4" : "pl-[84px]")}>
      <div className="flex min-w-0 items-center gap-2">
        {!shell.sidebarOpen && (
          <Tip label="Show sidebar (⌘\)"><Button variant="ghost" size="iconSm" aria-label="Show sidebar" className="no-drag text-muted-foreground" onClick={shell.toggleSidebar}><PanelLeft /></Button></Tip>
        )}
        <div className="flex min-w-0 items-center gap-1.5 text-[13px]" data-testid="breadcrumb">
          <span className="truncate text-muted-foreground">{projectTitle}</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="truncate font-medium">{system?.title ?? ids.systemId}</span>
          {many && (
            <>
              <span className="text-muted-foreground/50">/</span>
              <input
                key={visualTitle}
                aria-label="Visual name"
                defaultValue={visualTitle}
                onBlur={(e) => e.target.value.trim() && e.target.value !== visualTitle && onRename(e.target.value.trim())}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                className="no-drag min-w-0 rounded bg-transparent px-1 font-medium outline-none hover:bg-accent focus:bg-accent"
                style={{ width: `${Math.max(6, visualTitle.length + 1)}ch` }}
              />
            </>
          )}
        </div>
      </div>
      <div className="no-drag flex shrink-0 items-center gap-1">
        {canUndo && <Tip label="Undo (⌘Z)"><Button variant="ghost" size="iconSm" aria-label="Undo" className="text-muted-foreground" onClick={onUndo}><Undo2 /></Button></Tip>}
        {canRedo && <Tip label="Redo (⇧⌘Z)"><Button variant="ghost" size="iconSm" aria-label="Redo" className="text-muted-foreground" onClick={onRedo}><Redo2 /></Button></Tip>}
        <AiStatus open={shell.aiOpen} onOpenChange={shell.setAiOpen} />
        <Tip label="Search and commands (⌘K)"><Button variant="ghost" size="iconSm" aria-label="Search and commands" className="text-muted-foreground" onClick={shell.openCommands}><Search /></Button></Tip>
        <DropdownMenu>
          <Tip label="More"><DropdownMenuTrigger asChild><Button variant="ghost" size="iconSm" aria-label="More options" className="text-muted-foreground"><MoreHorizontal /></Button></DropdownMenuTrigger></Tip>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuItem disabled={!hasNodes} onSelect={() => onTidy("DOWN")}><Wand2 /> Arrange top to bottom</DropdownMenuItem>
            <DropdownMenuItem disabled={!hasNodes} onSelect={() => onTidy("RIGHT")}><Wand2 className="-rotate-90" /> Arrange left to right</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={!hasNodes} data-testid="layout-menu"><LayoutGrid /> Layout of this visual</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {(["auto", ...ARRANGEMENT_ORDER] as const).map((a) => (
                  <DropdownMenuItem key={a} data-arrangement={a} onSelect={() => onArrange(a === "auto" ? undefined : a)}>
                    <span className="w-4 text-foreground">{(arrangement ?? "auto") === a ? "✓" : ""}</span>{a === "auto" ? "Automatic" : ARRANGEMENT_NAME[a]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => shell.setSheet("notes")}><FileText /> Notes</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => shell.setSheet("legend")}><BookOpen /> How to read this</DropdownMenuItem>
            <DropdownMenuItem onSelect={shell.toggleMap}><Map /> {shell.showMap ? "Hide map" : "Show map"}</DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); shell.setTheme(NEXT_THEME[shell.theme]); }}><SunMoon /> Appearance: {THEME_NAME[shell.theme]}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={shell.openCommands}><Search /> All commands <span className="ml-auto text-[11px] text-muted-foreground">⌘K</span></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
