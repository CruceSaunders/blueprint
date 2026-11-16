import type { PreloadApi } from "../../electron/preload";
declare global {
  interface Window { blueprint: PreloadApi }
}
export const api = window.blueprint;
