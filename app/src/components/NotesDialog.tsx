import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";
import type { System } from "@/lib/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

/** A system's background notes, read first, edit on demand. Shown in the side sheet. */
export function NotesBody({ projectId, systemId }: { projectId: string; systemId: string }) {
  const [sys, setSys] = useState<System | null>(null);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState("");
  useEffect(() => {
    setEditing(false);
    void api.readSystem(projectId, systemId).then((s) => {
      setSys(s);
      setNotes(s?.notes ?? "");
      setSummary(s?.summary ?? "");
    });
  }, [projectId, systemId]);
  const save = async () => {
    const s = await api.updateSystem(projectId, systemId, { notes, summary });
    setSys(s);
    setEditing(false);
  };
  if (editing) {
    return (
      <div className="space-y-3">
        <label className="block">
          <div className="mb-1 text-[12px] font-medium text-muted-foreground">One-line summary</div>
          <Input value={summary} onChange={(e) => setSummary(e.target.value)} />
        </label>
        <label className="block">
          <div className="mb-1 text-[12px] font-medium text-muted-foreground">Notes</div>
          <Textarea autoFocus value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[280px] font-mono text-[12.5px]" />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          <Button onClick={() => void save()}>Save</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {sys?.summary && <div className="text-[14px] font-medium leading-snug">{sys.summary}</div>}
      {sys?.notes ? (
        <div className="bp-markdown text-[13.5px]"><ReactMarkdown remarkPlugins={[remarkGfm]}>{sys.notes}</ReactMarkdown></div>
      ) : !sys?.summary ? (
        <div className="text-[13px] text-muted-foreground">No notes yet. Your AI adds background here, or write your own.</div>
      ) : null}
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit notes</Button>
    </div>
  );
}
