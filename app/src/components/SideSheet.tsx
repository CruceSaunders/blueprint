import { X } from "lucide-react";
import { Button } from "./ui/button";

/** A quiet reading panel pinned to the top right of the canvas. Non-modal: the canvas stays usable. */
export function SideSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div data-testid="side-sheet" className="absolute right-3 top-[64px] z-30 flex max-h-[calc(100%-80px)] w-[380px] flex-col rounded-xl border bg-popover shadow-lg">
      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <div className="text-[14px] font-semibold">{title}</div>
        <Button variant="ghost" size="iconSm" aria-label="Close" onClick={onClose}><X /></Button>
      </div>
      <div className="min-h-0 overflow-y-auto px-4 pb-4 pt-1">{children}</div>
    </div>
  );
}
