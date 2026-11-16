import { useCallback, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { api } from "./lib/api";
import type { TreeProject, VisualIds } from "./lib/types";
import { useTheme } from "./lib/theme";
import { Sidebar, type TreeAction } from "./components/Sidebar";
import { VisualEditor } from "./components/canvas/VisualEditor";
import { SearchDialog } from "./components/SearchDialog";
import { ConnectDialog } from "./components/ConnectDialog";
import { ConfirmDialog, NameDialog } from "./components/PromptDialogs";
import { TooltipProvider } from "./components/ui/tooltip";
import { Button } from "./components/ui/button";

type Pending =
  | { kind: "name"; title: string; description?: string; initial: string; confirm: string; run: (v: string) => Promise<void> }
  | { kind: "confirm"; title: string; description: string; confirm: string; run: () => Promise<void> };

const LAST = "bp-last-visual";
const same = (a: VisualIds | null, b: VisualIds | null) => !!a && !!b && a.projectId === b.projectId && a.systemId === b.systemId && a.visualId === b.visualId;

export function App() {
  const [theme, setTheme] = useTheme();
  const [tree, setTree] = useState<TreeProject[] | null>(null);
  const [root, setRoot] = useState("");
  const [selected, setSelected] = useState<VisualIds | null>(() => {
    try { return JSON.parse(localStorage.getItem(LAST) ?? "null"); } catch { return null; }
  });
  const [focusNode, setFocusNode] = useState<string | null>(() => new URLSearchParams(location.search).get("select") || null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => setTree(await api.tree()), []);

  useEffect(() => {
    void refresh();
    void api.root().then(setRoot);
    const offStore = api.onStoreChanged(() => void refresh());
    const offOpen = api.onOpenPath((ids) => { setSelected(ids); setFocusNode((f) => (new URLSearchParams(location.search).get("uitest") ? f : null)); });
    const offSearch = api.onMenu("menu-search", () => setSearchOpen(true));
    const offConnect = api.onMenu("menu-connect", () => setConnectOpen(true));
    if (!new URLSearchParams(location.search).get("uitest")) void api.connectState().then((s) => { if (s.firstRun) setConnectOpen(true); });
    api.rendererReady();
    return () => { offStore(); offOpen(); offSearch(); offConnect(); };
  }, [refresh]);

  useEffect(() => {
    if (selected) localStorage.setItem(LAST, JSON.stringify(selected));
  }, [selected]);

  // Drop a selection that no longer exists; pick something sensible when nothing is selected.
  useEffect(() => {
    if (!tree) return;
    const exists = selected && tree.find((p) => p.id === selected.projectId)?.systems.find((s) => s.id === selected.systemId)?.visuals.some((v) => v.id === selected.visualId);
    if (exists) return;
    for (const p of tree) for (const s of p.systems) {
      const v = s.primaryVisual ?? s.visuals[0]?.id;
      if (v && s.visuals.some((x) => x.id === v)) return setSelected({ projectId: p.id, systemId: s.id, visualId: v });
    }
    setSelected(null);
  }, [tree, selected]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const select = (ids: VisualIds, nodeId?: string) => {
    if (!same(ids, selected)) setSelected(ids);
    setFocusNode(nodeId ?? null);
  };

  const onAction = (a: TreeAction) => {
    switch (a.type) {
      case "newProject":
        return setPending({ kind: "name", title: "New project", description: "An existing project or a new idea.", initial: "", confirm: "Create", run: async (t) => {
          const pid = await api.createProject(t);
          const sid = await api.createSystem(pid, "Overview");
          const vid = await api.createVisual(pid, sid, "Overview");
          await refresh();
          setSelected({ projectId: pid, systemId: sid, visualId: vid });
        } });
      case "newSystem":
        return setPending({ kind: "name", title: "New system", description: "One idea or mechanism inside this project.", initial: "", confirm: "Create", run: async (t) => {
          const sid = await api.createSystem(a.projectId, t);
          const vid = await api.createVisual(a.projectId, sid, t);
          await refresh();
          setSelected({ projectId: a.projectId, systemId: sid, visualId: vid });
        } });
      case "newVisual":
        return setPending({ kind: "name", title: "New visual", description: "Another view of this system, e.g. a detail of one part.", initial: "", confirm: "Create", run: async (t) => {
          const vid = await api.createVisual(a.projectId, a.systemId, t);
          await refresh();
          setSelected({ projectId: a.projectId, systemId: a.systemId, visualId: vid });
        } });
      case "rename":
        return setPending({ kind: "name", title: `Rename ${a.kind}`, initial: a.title, confirm: "Rename", run: async (t) => {
          if (a.kind === "project") await api.updateProject(a.ids.projectId!, { title: t });
          else if (a.kind === "system") await api.updateSystem(a.ids.projectId!, a.ids.systemId!, { title: t });
          else await api.renameVisual(a.ids as VisualIds, t);
          await refresh();
        } });
      case "delete":
        return setPending({ kind: "confirm", title: `Move “${a.title}” to the Trash?`, description: a.kind === "visual" ? "This visual moves to the macOS Trash. You can put it back from there." : `This ${a.kind} and everything inside it move to the macOS Trash. You can put them back from there.`, confirm: "Move to Trash", run: async () => {
          await api.remove(a.kind, a.ids);
          await refresh();
        } });
      case "move":
        void api.reorder(a.kind, a.ids, a.dir).then(refresh);
    }
  };

  const runPending = async (v?: string) => {
    const p = pending;
    setPending(null);
    if (!p) return;
    try {
      if (p.kind === "name") await p.run(v!);
      else await p.run();
    } catch (e) {
      setNotice(String(e));
    }
  };

  return (
    <TooltipProvider>
      <div className="flex h-full">
        <Sidebar tree={tree ?? []} selected={selected} onSelect={(ids) => select(ids)} onAction={onAction} onSearch={() => setSearchOpen(true)} theme={theme} onTheme={setTheme} />
        <main className="relative flex min-w-0 flex-1 bg-[var(--canvas)]">
          {selected && tree ? (
            <VisualEditor key={`${selected.projectId}/${selected.systemId}/${selected.visualId}`} ids={selected} tree={tree} focusNodeId={focusNode} onNotice={setNotice} />
          ) : tree ? (
            <div className="flex flex-1 flex-col">
              <div className="drag-region h-[52px] shrink-0" />
              <div className="flex flex-1 items-center justify-center pb-16">
                <div className="max-w-md text-center">
                  <div className="text-[20px] font-semibold tracking-tight">Nothing here yet</div>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                    Blueprint keeps visual maps of your ideas and systems. Ask your AI to “visualize” something and it appears here, or start one yourself.
                  </p>
                  <Button className="mt-5" onClick={() => onAction({ type: "newProject" })}><Plus className="size-4" /> New project</Button>
                  {root && <div className="mt-6 text-[11.5px] text-muted-foreground/80">Saved as plain files in {root.replace(/^\/Users\/[^/]+/, "~")}</div>}
                </div>
              </div>
            </div>
          ) : null}
          {notice && (
            <div className="absolute left-1/2 top-16 z-50 flex max-w-lg -translate-x-1/2 items-start gap-3 rounded-lg border bg-popover px-3.5 py-2.5 text-[13px] shadow-lg">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice(null)} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
            </div>
          )}
        </main>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} tree={tree ?? []} onPick={select} />
      <ConnectDialog open={connectOpen} onOpenChange={setConnectOpen} />
      <NameDialog open={pending?.kind === "name"} title={pending?.title ?? ""} description={pending?.kind === "name" ? pending.description : undefined} initial={pending?.kind === "name" ? pending.initial : ""} confirmLabel={pending?.confirm ?? "OK"} onCancel={() => setPending(null)} onSubmit={(v) => void runPending(v)} />
      <ConfirmDialog open={pending?.kind === "confirm"} title={pending?.title ?? ""} description={pending?.kind === "confirm" ? pending.description : ""} confirmLabel={pending?.confirm ?? "OK"} onCancel={() => setPending(null)} onConfirm={() => void runPending()} />
    </TooltipProvider>
  );
}
