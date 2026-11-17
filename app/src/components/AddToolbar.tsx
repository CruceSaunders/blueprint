import { useEffect, useRef, useState } from "react";
import { Circle, Frame, Image, PenTool, Plus, RectangleHorizontal, StickyNote, Ungroup, Group, X } from "lucide-react";
import type { NodeKind } from "@/lib/types";
import { useCommands } from "@/lib/commands";
import { Tip } from "./ui/tooltip";
import { cn } from "@/lib/utils";

export const ADD_ITEMS: { kind: NodeKind; label: string; hint: string; Icon: typeof Plus }[] = [
  { kind: "card", label: "Card", hint: "A thing, part or idea", Icon: RectangleHorizontal },
  { kind: "visual", label: "Drawing", hint: "A small picture you draw", Icon: PenTool },
  { kind: "image", label: "Image", hint: "A picture from this project's files", Icon: Image },
  { kind: "operator", label: "Symbol", hint: "+, =, or… to write A + B = C", Icon: Circle },
  { kind: "note", label: "Note", hint: "A side note", Icon: StickyNote },
  { kind: "group", label: "Frame", hint: "A box around related cards", Icon: Frame },
];

/** One quiet "+" that expands into the six things you can add. Group/Ungroup appear only when they apply. */
export function AddToolbar({ onAdd, canGroup, canUngroup, onGroup, onUngroup }: { onAdd: (k: NodeKind) => void; canGroup: boolean; canUngroup: boolean; onGroup: () => void; onUngroup: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("pointerdown", close, true); window.removeEventListener("keydown", esc); };
  }, [open]);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("bp-open-add", onOpen);
    return () => window.removeEventListener("bp-open-add", onOpen);
  }, []);
  useCommands("add", [
    ...ADD_ITEMS.map((it) => ({ id: `add-${it.kind}`, label: `Add ${it.label.toLowerCase()}`, group: "Add" as const, run: () => onAdd(it.kind) })),
    { id: "group", label: "Group selected into a frame", group: "Arrange", shortcut: "⌘G", disabled: !canGroup, run: onGroup },
    { id: "ungroup", label: "Remove frame, keep what's inside", group: "Arrange", shortcut: "Shift ⌘G", disabled: !canUngroup, run: onUngroup },
  ]);
  const pill = "flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center" data-testid="add-toolbar">
      <div ref={ref} className="pointer-events-auto flex items-center gap-0.5 rounded-full border bg-card/95 p-1 shadow-md backdrop-blur">
        {open ? (
          <>
            {ADD_ITEMS.map(({ kind, label, hint, Icon }) => (
              <Tip key={kind} label={hint}>
                <button type="button" onClick={() => { onAdd(kind); setOpen(false); }} className={pill}>
                  <Icon className="size-4" strokeWidth={1.8} />
                  {label}
                </button>
              </Tip>
            ))}
            <button type="button" aria-label="Close add menu" onClick={() => setOpen(false)} className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
              <X className="size-4" />
            </button>
          </>
        ) : (
          <>
            <Tip label="Add a card, note, frame…">
              <button type="button" aria-label="Add" onClick={() => setOpen(true)} className="flex size-9 items-center justify-center rounded-full text-foreground hover:bg-accent">
                <Plus className="size-[18px]" />
              </button>
            </Tip>
            {(canGroup || canUngroup) && <div className="mx-0.5 h-5 w-px bg-border" />}
            {canGroup && (
              <Tip label="Put the selected cards in a frame (⌘G)">
                <button type="button" onClick={onGroup} className={cn(pill)}><Group className="size-4" strokeWidth={1.8} />Group</button>
              </Tip>
            )}
            {canUngroup && (
              <Tip label="Remove the frame, keep what's inside (⇧⌘G)">
                <button type="button" onClick={onUngroup} className={cn(pill)}><Ungroup className="size-4" strokeWidth={1.8} />Ungroup</button>
              </Tip>
            )}
          </>
        )}
      </div>
    </div>
  );
}
