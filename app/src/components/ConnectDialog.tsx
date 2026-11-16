import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ConnectTool } from "@/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";

/** First-run screen and "Connect AI tools…" menu item: one explicit, consented step that registers Blueprint. */
export function ConnectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [tools, setTools] = useState<ConnectTool[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; lines: string[] } | null>(null);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    void api.connectState().then((s) => setTools(s.tools));
  }, [open]);

  const found = tools.filter((t) => t.detected);
  const close = (o: boolean) => {
    if (!o) void api.connectDismiss();
    onOpenChange(o);
  };
  const run = async () => {
    setBusy(true);
    try { setResult(await api.connectRun(found.map((t) => t.id))); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg gap-4">
        <div>
          <DialogTitle>Connect your AI tools</DialogTitle>
          <DialogDescription>
            Lets your AI assistant draw in Blueprint. Each tool's settings file is backed up first, and you can undo it any time with “Blueprint --disconnect”.
          </DialogDescription>
        </div>
        {result ? (
          <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed whitespace-pre-wrap">{result.lines.join("\n")}</pre>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {tools.map((t) => (
              <li key={t.id} className="flex items-center justify-between">
                <span>{t.name}</span>
                <span className="text-muted-foreground">{t.detected ? "Found" : "Not installed"}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => close(false)}>{result ? "Close" : "Not now"}</Button>
          {!result && (
            <Button onClick={run} disabled={busy || found.length === 0}>
              {found.length ? `Connect ${found.length === 1 ? found[0].name : `${found.length} tools`}` : "No tools found"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
