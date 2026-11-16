import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function NameDialog({ open, title, description, initial, confirmLabel, onCancel, onSubmit }: { open: boolean; title: string; description?: string; initial: string; confirmLabel: string; onCancel: () => void; onSubmit: (v: string) => void }) {
  const [v, setV] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setV(initial), [initial, open]);
  // Focus + select the name once the dialog is up (after any menu that opened it has handed focus back).
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => { input.current?.focus(); input.current?.select(); }, 30);
    return () => window.clearTimeout(t);
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <div>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription className="mt-1">{description}</DialogDescription>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) onSubmit(v.trim()); }} className="space-y-4">
          <Input ref={input} autoFocus value={v} onChange={(e) => setV(e.target.value)} onFocus={(e) => e.target.select()} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={!v.trim()}>{confirmLabel}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({ open, title, description, confirmLabel, onCancel, onConfirm }: { open: boolean; title: string; description: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="mt-1">{description}</DialogDescription>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
