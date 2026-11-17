import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { api } from "./lib/api";
import type { TreeProject, VisualIds } from "./lib/types";
import { useTheme } from "./lib/theme";
import { Sidebar, type SidebarEdit, type TreeAction } from "./components/Sidebar";
import { VisualEditor } from "./components/canvas/VisualEditor";
import { SearchDialog } from "./components/SearchDialog";
import { FirstRun } from "./components/FirstRun";
import { EXAMPLE_PROMPT } from "./components/AiSetup";
import { SideSheet } from "./components/SideSheet";
import { LegendBody } from "./components/Legend";
import { NotesBody } from "./components/NotesDialog";
import { ShellCtx, type Shell } from "./lib/shell";
import { useCommands } from "./lib/commands";
import { ConfirmDialog } from "./components/PromptDialogs";
import { TooltipProvider } from "./components/ui/tooltip";

type Pending = { kind: "confirm"; title: string; description: string; confirm: string; run: () => Promise<void> };

const LAST = "bp-last-visual";
const UITEST = !!new URLSearchParams(location.search).get("uitest");
const keyOf = (ids: VisualIds) => `${ids.projectId}/${ids.systemId}/${ids.visualId}`;
const visualKeys = (tree: TreeProject[]) => tree.flatMap((p) => p.systems.flatMap((s) => s.visuals.map((v) => ({ key: `${p.id}/${s.id}/${v.id}`, ids: { projectId: p.id, systemId: s.id, visualId: v.id }, title: v.title }))));
const stored = (k: string, d: boolean) => { try { const v = localStorage.getItem(k); return v === null ? d : v === "1"; } catch { return d; } };
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
  const [aiOpen, setAiOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => stored("bp-sidebar", true));
  const [showMap, setShowMap] = useState(() => stored("bp-map", false));
  const [sheet, setSheet] = useState<Shell["sheet"]>(null);
  const [arrived, setArrived] = useState<string | null>(null);
  // One first-use hint on the canvas, gone after the first click on a card or line.
  const [hint, setHint] = useState(() => !stored("bp-hint-done", false));
  const known = useRef<Set<string> | null>(null);
  const localCreate = useRef(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [sidebarEdit, setSidebarEdit] = useState<SidebarEdit | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => setTree(await api.tree()), []);

  useEffect(() => {
    void refresh();
    void api.root().then(setRoot);
    const offStore = api.onStoreChanged(() => void refresh());
    const offOpen = api.onOpenPath((ids) => { setSelected(ids); setFocusNode((f) => (new URLSearchParams(location.search).get("uitest") ? f : null)); });
    const offSearch = api.onMenu("menu-search", () => setSearchOpen(true));
    const offConnect = api.onMenu("menu-connect", () => setAiOpen(true));
    // First launch with existing visuals and no AI tool connected: open the AI panel once.
    if (!UITEST) void api.connectState().then((s) => { if (s.firstRun && !s.tools.some((t) => t.connected)) { setAiOpen(true); void api.connectDismiss(); } });
    api.rendererReady();
    return () => { offStore(); offOpen(); offSearch(); offConnect(); };
  }, [refresh]);

  useEffect(() => {
    if (selected) localStorage.setItem(LAST, JSON.stringify(selected));
  }, [selected]);
  useEffect(() => { localStorage.setItem("bp-sidebar", sidebarOpen ? "1" : "0"); }, [sidebarOpen]);
  useEffect(() => { localStorage.setItem("bp-map", showMap ? "1" : "0"); }, [showMap]);

  // A visual that appears on disk (your AI just drew it) opens right away, and its sidebar row glows once.
  useEffect(() => {
    if (!tree) return;
    const list = visualKeys(tree);
    const prev = known.current;
    known.current = new Set(list.map((v) => v.key));
    if (!prev) return;
    const fresh = list.filter((v) => !prev.has(v.key));
    if (!fresh.length) return;
    const newest = fresh[fresh.length - 1];
    if (localCreate.current) { localCreate.current = false; return; }
    setSelected(newest.ids);
    setFocusNode(null);
    setArrived(newest.key);
    setNotice(`New from your AI: ${newest.title}`);
  }, [tree]);
  useEffect(() => {
    if (!arrived) return;
    const t = window.setTimeout(() => setArrived(null), 2600);
    return () => window.clearTimeout(t);
  }, [arrived]);

  useEffect(() => {
    if (!hint) return;
    const done = (e: PointerEvent) => {
      if (!(e.target as Element)?.closest?.(".react-flow__node, .react-flow__edge")) return;
      setHint(false);
      localStorage.setItem("bp-hint-done", "1");
    };
    window.addEventListener("pointerdown", done, true);
    return () => window.removeEventListener("pointerdown", done, true);
  }, [hint]);

  // ⌘K opens the command menu; ⌘\ shows or hides the sidebar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey || e.altKey || e.ctrlKey) return;
      if (e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen((o) => !o); }
      else if (e.key === "\\") { e.preventDefault(); setSidebarOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      case "newSystem":
      case "newVisual":
      case "rename":
        // named in place in the sidebar (Enter saves, Escape cancels)
        setSidebarOpen(true);
        return setSidebarEdit(a);
      case "delete":
        return setPending({ kind: "confirm", title: `Move “${a.title}” to the Trash?`, description: a.kind === "visual" ? "This visual moves to the macOS Trash. You can put it back from there." : `This ${a.kind} and everything inside it move to the macOS Trash. You can put them back from there.`, confirm: "Move to Trash", run: async () => {
          await api.remove(a.kind, a.ids);
          await refresh();
        } });
      case "move":
        void api.reorder(a.kind, a.ids, a.dir).then(refresh);
    }
  };

  const commitName = async (value: string | null) => {
    const a = sidebarEdit;
    setSidebarEdit(null);
    if (!a || !value) return;
    try {
      if (a.type === "newProject") {
        localCreate.current = true;
        const pid = await api.createProject(value);
        const sid = await api.createSystem(pid, "Overview");
        const vid = await api.createVisual(pid, sid, "Overview");
        await refresh();
        setSelected({ projectId: pid, systemId: sid, visualId: vid });
      } else if (a.type === "newSystem") {
        localCreate.current = true;
        const sid = await api.createSystem(a.projectId, value);
        const vid = await api.createVisual(a.projectId, sid, value);
        await refresh();
        setSelected({ projectId: a.projectId, systemId: sid, visualId: vid });
      } else if (a.type === "newVisual") {
        localCreate.current = true;
        const vid = await api.createVisual(a.projectId, a.systemId, value);
        await refresh();
        setSelected({ projectId: a.projectId, systemId: a.systemId, visualId: vid });
      } else if (value !== a.title) {
        if (a.kind === "project") await api.updateProject(a.ids.projectId!, { title: value });
        else if (a.kind === "system") await api.updateSystem(a.ids.projectId!, a.ids.systemId!, { title: value });
        else await api.renameVisual(a.ids as VisualIds, value);
        await refresh();
      }
    } catch (e) {
      setNotice(String(e));
    }
  };

  const runPending = async (v?: string) => {
    const p = pending;
    setPending(null);
    if (!p) return;
    try {
      await p.run();
    } catch (e) {
      setNotice(String(e));
    }
  };

  const shell: Shell = useMemo(() => ({
    sidebarOpen, toggleSidebar: () => setSidebarOpen((o) => !o),
    showMap, toggleMap: () => setShowMap((m) => !m),
    openCommands: () => setSearchOpen(true),
    aiOpen, setAiOpen, sheet, setSheet, theme, setTheme,
  }), [sidebarOpen, showMap, aiOpen, sheet, theme, setTheme]);

  const copyPrompt = () => { void navigator.clipboard.writeText(EXAMPLE_PROMPT).catch(() => undefined); setNotice("Copied. Paste it into your AI."); };
  useCommands("app", [
    { id: "connect", label: "Connect AI tools", group: "AI tools", run: () => setAiOpen(true) },
    { id: "copy-prompt", label: "Copy an example prompt", group: "AI tools", run: copyPrompt },
    { id: "new-project", label: "New project", group: "Create", run: () => onAction({ type: "newProject" }) },
    ...(selected ? [
      { id: "new-system", label: "New system in this project", group: "Create" as const, run: () => onAction({ type: "newSystem", projectId: selected.projectId }) },
      { id: "new-visual", label: "New visual of this system", group: "Create" as const, run: () => onAction({ type: "newVisual", projectId: selected.projectId, systemId: selected.systemId }) },
    ] : []),
    { id: "sidebar", label: sidebarOpen ? "Hide sidebar" : "Show sidebar", group: "View", shortcut: "⌘\\", run: () => setSidebarOpen((o) => !o) },
    { id: "theme-light", label: "Appearance: light", group: "View", run: () => setTheme("light") },
    { id: "theme-dark", label: "Appearance: dark", group: "View", run: () => setTheme("dark") },
    { id: "theme-system", label: "Appearance: match macOS", group: "View", run: () => setTheme("system") },
  ]);

  const empty = tree !== null && tree.length === 0;
  return (
    <TooltipProvider>
      <ShellCtx.Provider value={shell}>
      <div className="flex h-full">
        {sidebarOpen && (!empty || sidebarEdit) && <Sidebar edit={sidebarEdit} onEditDone={(v) => void commitName(v)} tree={tree ?? []} selected={selected} onSelect={(ids) => select(ids)} onAction={onAction} onCollapse={() => setSidebarOpen(false)} arrived={arrived} />}
        <main className="group/main relative flex min-w-0 flex-1 bg-[var(--canvas)]">
          {selected && tree ? (
            <VisualEditor key={keyOf(selected)} ids={selected} tree={tree} focusNodeId={focusNode} onNotice={setNotice} />
          ) : tree ? (
            <div className="relative flex-1">
              <FirstRun root={root} onStartBlank={() => onAction({ type: "newProject" })} />
              <div className="drag-region absolute inset-x-0 top-0 h-[40px]" />
            </div>
          ) : null}
          {hint && selected && !sheet && (
            <div className="pointer-events-none absolute left-1/2 top-[68px] z-20 -translate-x-1/2 rounded-full border bg-card/90 px-3 py-1 text-[12.5px] text-muted-foreground shadow-sm group-has-[[data-testid=empty-visual]]/main:hidden" data-testid="canvas-hint">
              Click any card or line to see what it means
            </div>
          )}
          {sheet && selected && (
            <SideSheet title={sheet === "legend" ? "How to read this" : "Notes"} onClose={() => setSheet(null)}>
              {sheet === "legend" ? <LegendBody /> : <NotesBody projectId={selected.projectId} systemId={selected.systemId} />}
            </SideSheet>
          )}
          {notice && (
            <div role="status" className="absolute bottom-5 left-5 z-50 flex max-w-md items-start gap-3 rounded-lg border bg-popover px-3.5 py-2.5 text-[13px] shadow-lg">
              <span>{notice}</span>
              <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
            </div>
          )}
        </main>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} tree={tree ?? []} onPick={select} />
      <ConfirmDialog open={pending?.kind === "confirm"} title={pending?.title ?? ""} description={pending?.kind === "confirm" ? pending.description : ""} confirmLabel={pending?.confirm ?? "OK"} onCancel={() => setPending(null)} onConfirm={() => void runPending()} />
      </ShellCtx.Provider>
    </TooltipProvider>
  );
}
