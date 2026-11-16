import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { SnapshotView } from "./components/SnapshotView";
import { api } from "./lib/api";
import { applyTheme } from "./lib/theme";

const root = createRoot(document.getElementById("root")!);
const snap = api.snapshotTarget();
if (snap) {
  applyTheme(api.snapshotTheme() === "dark");
  root.render(<SnapshotView ids={snap} />);
} else {
  root.render(<App />);
}
