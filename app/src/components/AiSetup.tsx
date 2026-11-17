import { useCallback, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { api } from "@/lib/api";
import type { ConnectTool } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export const EXAMPLE_PROMPT = "/visualize how a coffee shop order works";

/** Shared connection state: which AI tools are installed and which already have Blueprint. */
export function useConnect() {
  const [tools, setTools] = useState<ConnectTool[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const refresh = useCallback(async () => setTools((await api.connectState()).tools), []);
  useEffect(() => {
    void refresh();
    const off = api.onMenu("menu-connect", () => void refresh());
    window.addEventListener("focus", refresh);
    window.addEventListener("bp-connect-changed", refresh);
    return () => { off(); window.removeEventListener("focus", refresh); window.removeEventListener("bp-connect-changed", refresh); };
  }, [refresh]);
  const connect = async () => {
    const ids = (tools ?? []).filter((t) => t.detected).map((t) => t.id);
    setBusy(true);
    try {
      setResult(await api.connectRun(ids));
      void api.connectDismiss();
      window.dispatchEvent(new Event("bp-connect-changed"));
    } finally { setBusy(false); }
  };
  const connected = (tools ?? []).filter((t) => t.connected);
  const pending = (tools ?? []).filter((t) => t.detected && !t.connected);
  return { tools, busy, result, connect, connected, pending, refresh };
}

function ToolRow({ t }: { t: ConnectTool }) {
  const state = t.connected ? "Connected" : t.detected ? "Not connected yet" : "Not installed";
  return (
    <li className="flex h-8 items-center justify-between text-[13px]" data-tool={t.id} data-state={t.connected ? "connected" : t.detected ? "found" : "missing"}>
      <span className={cn(!t.detected && "text-muted-foreground")}>{t.name}</span>
      <span className={cn("flex items-center gap-1.5", t.connected ? "text-[var(--tone-good)]" : "text-muted-foreground")}>
        {t.connected && <Check className="size-3.5" />}
        {state}
      </span>
    </li>
  );
}

/** Step 1 body: the three tools, their status, and one Connect button. */
export function ConnectTools({ c }: { c: ReturnType<typeof useConnect> }) {
  const { tools, busy, result, connect, pending } = c;
  return (
    <div data-testid="connect-tools">
      <ul className="divide-y divide-border/60">{(tools ?? []).map((t) => <ToolRow key={t.id} t={t} />)}</ul>
      {pending.length > 0 && (
        <Button className="mt-3" onClick={() => void connect()} disabled={busy}>
          {busy ? "Connecting…" : "Connect"}
        </Button>
      )}
      {tools && !tools.some((t) => t.detected) && (
        <p className="mt-2 text-[12.5px] text-muted-foreground">Install Claude Code, Cursor or Codex first, then come back.</p>
      )}
      {result && (
        <div className="mt-3 text-[12.5px]">
          <p className={result.ok ? "text-muted-foreground" : "text-destructive"}>
            {result.ok ? "Done. Restart your AI tool (or open a new chat) so it picks up Blueprint." : "Something went wrong. Nothing else was changed."}
          </p>
          <details className="mt-1 text-muted-foreground">
            <summary className="cursor-pointer select-none">Details</summary>
            <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-muted p-2 text-[11px] leading-relaxed whitespace-pre-wrap">{result.lines.join("\n")}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

export function CopyPrompt({ text = EXAMPLE_PROMPT, className }: { text?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border bg-background py-1 pl-3 pr-1", className)} data-testid="example-prompt">
      <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{text}</code>
      <Button variant="ghost" size="sm" onClick={() => void copy()} aria-label="Copy prompt">
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

/** The whole onboarding in three steps. Used on the first-run screen and in the AI status popover. */
export function SetupSteps({ c, compact = false }: { c: ReturnType<typeof useConnect>; compact?: boolean }) {
  const done1 = c.connected.length > 0;
  const Step = ({ n, done, title, children }: { n: number; done?: boolean; title: string; children?: React.ReactNode }) => (
    <li className="flex gap-3.5" data-step={n}>
      <span className={cn("mt-px flex size-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-medium tabular-nums", done ? "border-transparent bg-[var(--tone-good)] text-white" : "bg-card text-muted-foreground")}>
        {done ? <Check className="size-3.5" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium leading-6">{title}</div>
        {children && <div className="mt-2">{children}</div>}
      </div>
    </li>
  );
  return (
    <ol className={cn("flex flex-col", compact ? "gap-5" : "gap-7")} data-testid="setup-steps">
      <Step n={1} done={done1} title="Connect your AI tools"><ConnectTools c={c} /></Step>
      <Step n={2} title="In your AI, type /visualize and your idea"><CopyPrompt /></Step>
      <Step n={3} title="Your visual opens here on its own" />
    </ol>
  );
}

/** Small persistent indicator: "AI connected" or "Connect AI". Opens the same three steps. */
export function AiStatus({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const c = useConnect();
  useEffect(() => { if (open) void c.refresh(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const on = c.connected.length > 0;
  if (!c.tools) return null;
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" data-testid="ai-status" className={cn("no-drag flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] transition-colors", on ? "text-muted-foreground hover:bg-accent hover:text-foreground" : "border bg-card font-medium text-foreground hover:bg-accent")}>
          <span className={cn("size-1.5 rounded-full", on ? "bg-[var(--tone-good)]" : "bg-[var(--tone-warn)]")} />
          {on ? "AI connected" : "Connect AI"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-5">
        <SetupSteps c={c} compact />
      </PopoverContent>
    </Popover>
  );
}
