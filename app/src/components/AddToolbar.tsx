import { Circle, Frame, Image, PenTool, Plus, RectangleHorizontal, StickyNote, Ungroup, Group } from "lucide-react";
import type { NodeKind } from "@/lib/types";
import { Tip } from "./ui/tooltip";
import { cn } from "@/lib/utils";

const ITEMS: { kind: NodeKind; label: string; hint: string; Icon: typeof Plus }[] = [
  { kind: "card", label: "Card", hint: "A thing, part or variable", Icon: RectangleHorizontal },
  { kind: "visual", label: "Drawing", hint: "A custom picture (SVG)", Icon: PenTool },
  { kind: "image", label: "Image", hint: "A picture from the project's files", Icon: Image },
  { kind: "operator", label: "Symbol", hint: "+, =, or… to write A + B = C", Icon: Circle },
  { kind: "note", label: "Note", hint: "A side note, not part of the logic", Icon: StickyNote },
  { kind: "group", label: "Frame", hint: "Group, layer, option or boundary", Icon: Frame },
];

export function AddToolbar({ onAdd, canGroup, canUngroup, onGroup, onUngroup }: { onAdd: (k: NodeKind) => void; canGroup: boolean; canUngroup: boolean; onGroup: () => void; onUngroup: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border bg-card/95 p-1 shadow-lg backdrop-blur">
        {ITEMS.map(({ kind, label, hint, Icon }) => (
          <Tip key={kind} label={hint}>
            <button type="button" onClick={() => onAdd(kind)} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <Icon className="size-4" strokeWidth={1.8} />
              {label}
            </button>
          </Tip>
        ))}
        <div className="mx-1 h-5 w-px bg-border" />
        <Tip label="Put the selected items in a frame (⌘G)">
          <button type="button" aria-label="Group" disabled={!canGroup} onClick={onGroup} className={cn("flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent")}>
            <Group className="size-4" strokeWidth={1.8} />
          </button>
        </Tip>
        <Tip label="Remove the selected frame, keep its contents (⇧⌘G)">
          <button type="button" aria-label="Ungroup" disabled={!canUngroup} onClick={onUngroup} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent">
            <Ungroup className="size-4" strokeWidth={1.8} />
          </button>
        </Tip>
      </div>
    </div>
  );
}
