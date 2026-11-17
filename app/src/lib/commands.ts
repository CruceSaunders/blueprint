import { useEffect, useSyncExternalStore } from "react";

/** One action the command menu (⌘K) can run. Components that own an action register it while mounted. */
export interface Command {
  id: string;
  label: string;
  group: "Add" | "Arrange" | "Edit" | "View" | "AI tools" | "Create";
  shortcut?: string;
  disabled?: boolean;
  run: () => void;
}

const sources = new Map<string, Command[]>();
const listeners = new Set<() => void>();
let snapshot: Command[] = [];
const emit = () => {
  snapshot = [...sources.values()].flat();
  listeners.forEach((l) => l());
};

/** Register a set of commands under a key for as long as the calling component is mounted. */
export function useCommands(key: string, cmds: Command[]) {
  // re-register whenever the labels/disabled states change; run functions are read fresh each time
  const sig = JSON.stringify(cmds.map((c) => [c.id, c.label, c.disabled ?? false]));
  useEffect(() => {
    sources.set(key, cmds);
    emit();
    return () => { sources.delete(key); emit(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, sig]);
  // keep run closures current without re-emitting
  useEffect(() => { if (sources.has(key)) sources.set(key, cmds); });
}

export function useAllCommands(): Command[] {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => snapshot);
}

/** Look a command up at run time (so the menu always calls the newest closure). */
export function runCommand(id: string) {
  for (const list of sources.values()) for (const c of list) if (c.id === id && !c.disabled) return c.run();
}
