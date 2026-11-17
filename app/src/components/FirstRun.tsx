import { CopyPrompt, SetupSteps, useConnect } from "./AiSetup";

/** Shown when there is nothing yet: the whole onboarding in three steps. */
export function FirstRun({ root, onStartBlank }: { root: string; onStartBlank: () => void }) {
  const c = useConnect();
  return (
    <div className="absolute inset-0 overflow-y-auto" data-testid="first-run">
      <div className="flex min-h-full items-center justify-center px-8 py-14">
      <div className="w-full max-w-[460px]">
        <h1 className="text-[22px] font-semibold tracking-tight">Your AI draws, you explore</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">Ask your AI to explain any system or idea, and it appears here as a map you can click through.</p>
        <div className="mt-8"><SetupSteps c={c} /></div>
        <div className="mt-10 flex items-center justify-between gap-6 border-t pt-4 text-[12.5px] text-muted-foreground">
          <span className="min-w-0 break-words">Saved on this Mac in {friendlyPath(root)}</span>
          <button type="button" onClick={onStartBlank} className="shrink-0 whitespace-nowrap font-medium text-foreground/80 hover:text-foreground hover:underline">Start a blank project</button>
        </div>
      </div>
      </div>
    </div>
  );
}

/** "~/Blueprint" style: home shortened to ~ (main already does this); any leftover home-folder prefix is shortened too. */
function friendlyPath(p: string): string {
  if (!p) return "~/Blueprint";
  return p.replace(/^\/Users\/[^/]+/, "~");
}

/** Shown on an empty visual: what to ask your AI, with the topic filled in. */
export function EmptyVisualPrompt({ topic }: { topic: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" data-testid="empty-visual">
      <div className="pointer-events-auto w-[420px] text-center">
        <div className="text-[16px] font-medium">Ask your AI to draw this</div>
        <CopyPrompt text={`/visualize ${topic}`} className="mt-4 text-left" />
        <div className="mt-3 text-[13px] text-muted-foreground">or press + below to add a card yourself</div>
      </div>
    </div>
  );
}

/** What to suggest after /visualize on an empty visual: the most specific real name, never a generic "Overview". */
export function promptTopic(project?: string, system?: string): string {
  const generic = (t?: string) => !t || /^(overview|main|untitled)$/i.test(t.trim());
  if (!generic(system) && !generic(project)) return `${system} (${project})`;
  return (!generic(system) ? system : project) ?? "my idea";
}
