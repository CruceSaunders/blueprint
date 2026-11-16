import { contextBridge, ipcRenderer } from "electron";
import type { BlueprintApi, VisualIds } from "../src/lib/types";

const params = new URLSearchParams(location.search);
const snap = params.get("snapshot");
const snapIds: VisualIds | null = (() => {
  if (!snap) return null;
  const [projectId, systemId, visualId] = snap.split("/");
  return { projectId, systemId, visualId };
})();

function on<T>(channel: string, cb: (v: T) => void) {
  const h = (_e: unknown, v: T) => cb(v);
  ipcRenderer.on(channel, h);
  return () => void ipcRenderer.removeListener(channel, h);
}

const api: BlueprintApi & {
  onMenu(ch: "menu-undo" | "menu-redo" | "menu-search" | "menu-connect", cb: () => void): () => void;
  onSnapshotFit(cb: () => void): () => void;
} = {
  root: () => ipcRenderer.invoke("root"),
  tree: () => ipcRenderer.invoke("tree"),
  readVisual: (ids) => ipcRenderer.invoke("readVisual", ids),
  saveVisual: (ids, doc, baseRev) => ipcRenderer.invoke("saveVisual", ids, doc, baseRev),
  readSystem: (p, s) => ipcRenderer.invoke("readSystem", p, s),
  updateSystem: (p, s, patch) => ipcRenderer.invoke("updateSystem", p, s, patch),
  updateProject: (p, patch) => ipcRenderer.invoke("updateProject", p, patch),
  createProject: (t) => ipcRenderer.invoke("createProject", t),
  createSystem: (p, t) => ipcRenderer.invoke("createSystem", p, t),
  createVisual: (p, s, t) => ipcRenderer.invoke("createVisual", p, s, t),
  renameVisual: (ids, t) => ipcRenderer.invoke("renameVisual", ids, t),
  remove: (k, ids) => ipcRenderer.invoke("remove", k, ids),
  reorder: (k, ids, d) => ipcRenderer.invoke("reorder", k, ids, d),
  search: (q) => ipcRenderer.invoke("search", q),
  onStoreChanged: (cb) => on("store-changed", cb),
  onOpenPath: (cb) => on("open-path", cb),
  onMenu: (ch, cb) => on(ch, cb),
  onSnapshotFit: (cb) => on("snapshot-fit", cb),
  snapshotReady: (info) => ipcRenderer.send("snapshot-ready", info),
  snapshotRendered: () => ipcRenderer.send("snapshot-rendered"),
  snapshotError: (m) => ipcRenderer.send("snapshot-error", m),
  isSnapshot: () => snapIds !== null,
  snapshotTarget: () => snapIds,
  snapshotTheme: () => (params.get("theme") === "dark" ? "dark" : "light"),
  rendererReady: () => ipcRenderer.send("renderer-ready"),
  connectState: () => ipcRenderer.invoke("connectState"),
  connectDismiss: () => ipcRenderer.invoke("connectDismiss"),
  connectRun: (ids) => ipcRenderer.invoke("connectRun", ids),
};

contextBridge.exposeInMainWorld("blueprint", api);
export type PreloadApi = typeof api;
