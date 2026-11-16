import { useEffect, useState } from "react";
export type ThemeMode = "light" | "dark" | "system";
export function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}
export function useTheme(): [ThemeMode, (m: ThemeMode) => void] {
  const forced = new URLSearchParams(location.search).get("uitest") ? (new URLSearchParams(location.search).get("theme") as ThemeMode) : null;
  const [mode, setMode] = useState<ThemeMode>(() => forced || (localStorage.getItem("bp-theme") as ThemeMode) || "system");
  useEffect(() => {
    localStorage.setItem("bp-theme", mode);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => applyTheme(mode === "dark" || (mode === "system" && mq.matches));
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [mode]);
  return [mode, setMode];
}
