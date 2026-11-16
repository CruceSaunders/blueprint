// Dev-only: writes a test fixture (every node kind, every edge kind, nested groups) to ~/Blueprint/projects/_fixture-test.
// Usage: node scripts/fixture-gen.mts          Remove with: rm -rf ~/Blueprint/projects/_fixture-test
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { arrange } from "../src/lib/layout.ts";

const root = path.join(os.homedir(), "Blueprint", "projects", "_fixture-test");
const t = new Date().toISOString();
const ex = (s: string) => s;
const nodes: any[] = [
  { id: "inputs", kind: "group", groupKind: "layer", title: "Inputs", explanation: ex("The tier of things we put in.") },
  { id: "ads", kind: "card", parent: "inputs", title: "Ad spend", subtitle: "Paid channels", icon: "megaphone", tone: "accent", state: "decided", explanation: ex("Money spent on **ads** each month.") },
  { id: "plus", kind: "operator", operator: "+", parent: "inputs", explanation: ex("Ad spend and content combine.") },
  { id: "content", kind: "card", parent: "inputs", title: "Content", subtitle: "Posts and videos", icon: "pen-line", state: "idea", explanation: ex("Organic content we publish.") },
  { id: "eq", kind: "operator", operator: "=", parent: "inputs", explanation: ex("Together they equal reach.") },
  { id: "reach", kind: "card", parent: "inputs", title: "Reach", icon: "radio", weight: "lg", explanation: ex("How many people see us.") },
  { id: "funnel", kind: "visual", title: "Funnel", caption: "Visitors narrow to buyers", explanation: ex("A drawn funnel."), svg: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg"><path d="M20 10 H180 L120 70 V110 H80 V70 Z" fill="#6b8afd" fill-opacity="0.22" stroke="#6b8afd" stroke-width="2"/><line x1="40" y1="30" x2="160" y2="30" stroke="#6b8afd" stroke-opacity="0.5"/><line x1="70" y1="55" x2="130" y2="55" stroke="#6b8afd" stroke-opacity="0.5"/><script>alert(1)</script></svg>` },
  { id: "gauge", kind: "visual", title: "Health", explanation: ex("An HTML visual in a sandboxed iframe."), html: `<div style="display:flex;align-items:center;justify-content:center;height:100%;font:600 28px system-ui;color:#3fb37f">82%<img src="https://example.com/x.png" style="display:none"></div>` },
  { id: "customers", kind: "card", title: "Customers", icon: "users-round", explanation: ex("People who pay.") },
  { id: "business", kind: "group", groupKind: "boundary", title: "Our business", explanation: ex("Everything inside is under our control.") },
  { id: "plan-a", kind: "group", groupKind: "option", parent: "business", title: "Plan A", explanation: ex("First alternative.") },
  { id: "hire", kind: "card", parent: "plan-a", title: "Hire a team", icon: "users", explanation: ex("Grow by hiring.") },
  { id: "plan-b", kind: "group", groupKind: "option", parent: "business", title: "Plan B", explanation: ex("Second alternative.") },
  { id: "automate", kind: "card", parent: "plan-b", title: "Automate it", icon: "bot", state: "question", explanation: ex("Grow with software.") },
  { id: "revenue", kind: "card", parent: "business", title: "Revenue", icon: "dollar-sign", tone: "good", weight: "lg", explanation: ex("Money in.") },
  { id: "churn", kind: "card", parent: "business", title: "Churn", icon: "trending-down", tone: "bad", explanation: ex("Customers who leave.") },
  { id: "refs", kind: "group", groupKind: "group", title: "References", explanation: ex("Supporting material.") },
  { id: "memo", kind: "note", parent: "refs", title: "Reminder", caption: "Numbers here are illustrative.", explanation: ex("A side note.") },
  { id: "chart", kind: "image", parent: "refs", asset: "chart.svg", caption: "Last quarter", explanation: ex("An image asset.") },
  { id: "regulation", kind: "card", title: "Regulation", icon: "scale", tone: "warn", explanation: ex("Rules that apply to us.") },
];
const e = (id: string, source: string, target: string, kind: string, extra: any = {}) => ({ id, source, target, kind, explanation: `${source} ${kind} ${target}.`, ...extra });
const edges = [
  e("e1", "ads", "plus", "relates"),
  e("e2", "content", "plus", "relates"),
  e("e3", "plus", "eq", "relates"),
  e("e4", "eq", "reach", "equals"),
  e("e5", "reach", "funnel", "flow", { label: "visitors" }),
  e("e6", "funnel", "customers", "becomes"),
  e("e7", "customers", "revenue", "increases"),
  e("e8", "churn", "revenue", "decreases"),
  e("e9", "hire", "automate", "versus"),
  e("e10", "hire", "revenue", "requires"),
  e("e11", "regulation", "automate", "blocks"),
  e("e13", "customers", "gauge", "relates"),
  e("e12", "customers", "churn", "flow", { both: true, label: "feedback" }),
];
const arranged = await arrange(nodes, edges, { direction: "DOWN" });
const laid = arranged.nodes;
fs.mkdirSync(path.join(root, "systems", "growth", "visuals"), { recursive: true });
fs.mkdirSync(path.join(root, "assets"), { recursive: true });
fs.writeFileSync(path.join(root, "assets", "chart.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140"><rect width="240" height="140" fill="#f4f6fb"/><g fill="#3fb37f"><rect x="30" y="80" width="30" height="40"/><rect x="80" y="55" width="30" height="65"/><rect x="130" y="35" width="30" height="85"/><rect x="180" y="20" width="30" height="100"/></g></svg>`);
const meta = { rev: 1, createdAt: t, updatedAt: t };
fs.writeFileSync(path.join(root, "project.json"), JSON.stringify({ id: "_fixture-test", title: "Fixture test", description: "Test data", notes: "", systemOrder: ["growth"], ...meta }, null, 2));
fs.writeFileSync(path.join(root, "systems", "growth", "system.json"), JSON.stringify({ id: "growth", title: "Growth loop", summary: "How reach turns into revenue", notes: "## Notes\n\nFixture notes with **markdown**.", primaryVisual: "overview", visualOrder: ["overview"], ...meta }, null, 2));
fs.writeFileSync(path.join(root, "systems", "growth", "visuals", "overview.json"), JSON.stringify({ id: "overview", title: "Overview", description: "", ...meta, viewport: { x: 0, y: 0, zoom: 1 }, nodes: laid, edges: arranged.edges }, null, 2));
console.log("fixture written", laid.length, "nodes", edges.length, "edges");
