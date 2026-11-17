import { createContext, useContext } from "react";
import type { ThemeMode } from "./theme";

/** App-level view state that the header and canvas frame read (sidebar, map, panels, theme). */
export interface Shell {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  showMap: boolean;
  toggleMap: () => void;
  openCommands: () => void;
  aiOpen: boolean;
  setAiOpen: (o: boolean) => void;
  /** "legend" | "notes" side sheet over the canvas edge, or null */
  sheet: "legend" | "notes" | null;
  setSheet: (s: "legend" | "notes" | null) => void;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
}

export const ShellCtx = createContext<Shell | null>(null);
export function useShell(): Shell {
  const s = useContext(ShellCtx);
  if (!s) throw new Error("ShellCtx missing");
  return s;
}
