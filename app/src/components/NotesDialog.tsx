import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Pencil } from "lucide-react";
import { api } from "@/lib/api";
import type { System } from "@/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

export function NotesDialog({ open, onOpenChange, projectId, systemId }: { open: boolean; onOpenChange: (o: boolean) => void; projectId: string; systemId: string }) {
  const [sys, setSys] = useState<System | null>(null);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState("");
  useEffect(() => {
    if (!open) return;
    setEditing(false);
    void api.readSystem(projectId, systemId).then((s) => {
      setSys(s);
      setNotes(s?.notes ?? "");
      setSummary(s?.summary ?? "");
    });
  }, [open, projectId, systemId]);
  const save = async () => {
    const s = await api.updateSystem(projectId, systemId, { notes, summary });
    setSys(s);
    setEditing(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-3">
        <div>
          <DialogTitle>{sys?.title ?? "System"}: notes</DialogTitle>
          <DialogDescription>The background on this system: what it is, decisions, open questions.</DialogDescription>
        </div>
        {editing ? (
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">One-line summary</div>
              <Input value={summary} onChange={(e) => setSummary(e.target.value)} />
            </div>
            <div>
              <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Notes (Markdown)</div>
              <Textarea autoFocus value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[340px] font-mono text-[12.5px]" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={() => void save()}>Save notes</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sys?.summary && <div className="text-[13.5px] font-medium">{sys.summary}</div>}
            <div className="max-h-[60vh] overflow-y-auto rounded-lg border bg-background px-4 py-3">
              {sys?.notes ? (
                <div className="bp-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{sys.notes}</ReactMarkdown></div>
              ) : (
                <div className="py-6 text-center text-[13px] text-muted-foreground">No notes yet.</div>
              )}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="size-3.5" /> Edit notes</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
