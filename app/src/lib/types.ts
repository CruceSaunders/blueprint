// Store contract — mirrors SPEC.md exactly. Shared by the Electron main process and the renderer.
export type Tone = "neutral" | "accent" | "good" | "warn" | "bad" | "muted";
export type NodeState = "idea" | "question" | "decided" | "built";
export type Weight = "sm" | "md" | "lg";
export type NodeKind = "card" | "visual" | "image" | "operator" | "note" | "group";
export type GroupKind = "group" | "layer" | "option" | "boundary";
export type Operator = "+" | "-" | "×" | "÷" | "=" | "&" | "or" | "≠" | ">" | "<";
export type EdgeKind =
  | "flow" | "increases" | "decreases" | "requires" | "becomes"
  | "equals" | "versus" | "blocks" | "relates";

export const NODE_KINDS: NodeKind[] = ["card", "visual", "image", "operator", "note", "group"];
export const EDGE_KINDS: EdgeKind[] = ["flow", "increases", "decreases", "requires", "becomes", "equals", "versus", "blocks", "relates"];
export const GROUP_KINDS: GroupKind[] = ["group", "layer", "option", "boundary"];
export const OPERATORS: Operator[] = ["+", "-", "×", "÷", "=", "&", "or", "≠", ">", "<"];

export interface BpNode {
  id: string;
  kind: NodeKind;
  position: { x: number; y: number };
  size?: { w: number; h: number };
  parent?: string;
  title?: string;
  subtitle?: string;
  explanation?: string;
  icon?: string;
  tone?: Tone;
  state?: NodeState;
  weight?: Weight;
  operator?: Operator;
  groupKind?: GroupKind;
  svg?: string;
  html?: string;
  asset?: string;
  caption?: string;
}

export interface BpEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  label?: string;
  explanation?: string;
  both?: boolean;
  sourceHandle?: string;
  targetHandle?: string;
  /** Bend points in absolute canvas coords, computed by layout (first on the source border, last on the target border). */
  route?: { x: number; y: number }[];
}

export interface Visual {
  id: string;
  title: string;
  description?: string;
  rev: number;
  createdAt: string;
  updatedAt: string;
  viewport: { x: number; y: number; zoom: number };
  nodes: BpNode[];
  edges: BpEdge[];
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  notes?: string;
  systemOrder: string[];
  rev: number;
  createdAt: string;
  updatedAt: string;
}

export interface System {
  id: string;
  title: string;
  summary?: string;
  notes?: string;
  primaryVisual: string | null;
  visualOrder: string[];
  rev: number;
  createdAt: string;
  updatedAt: string;
}

export interface TreeVisual { id: string; title: string; rev: number }
export interface TreeSystem { id: string; title: string; summary?: string; primaryVisual: string | null; visuals: TreeVisual[] }
export interface TreeProject { id: string; title: string; description?: string; systems: TreeSystem[] }

export interface VisualIds { projectId: string; systemId: string; visualId: string }

export interface SearchHit {
  type: "project" | "system" | "visual" | "node";
  projectId: string;
  systemId?: string;
  visualId?: string;
  nodeId?: string;
  title: string;
  context: string;
}

export type SaveResult = { ok: true; rev: number } | { ok: false; conflict: true; current: Visual } | { ok: false; error: string };

export interface BlueprintApi {
  root(): Promise<string>;
  tree(): Promise<TreeProject[]>;
  readVisual(ids: VisualIds): Promise<Visual | null>;
  saveVisual(ids: VisualIds, doc: Visual, baseRev: number): Promise<SaveResult>;
  readSystem(projectId: string, systemId: string): Promise<System | null>;
  updateSystem(projectId: string, systemId: string, patch: Partial<System>): Promise<System>;
  updateProject(projectId: string, patch: Partial<Project>): Promise<Project>;
  createProject(title: string): Promise<string>;
  createSystem(projectId: string, title: string): Promise<string>;
  createVisual(projectId: string, systemId: string, title: string): Promise<string>;
  renameVisual(ids: VisualIds, title: string): Promise<void>;
  remove(kind: "project" | "system" | "visual", ids: Partial<VisualIds>): Promise<void>;
  reorder(kind: "system" | "visual", ids: Partial<VisualIds>, dir: -1 | 1): Promise<void>;
  search(query: string): Promise<SearchHit[]>;
  onStoreChanged(cb: (paths: string[]) => void): () => void;
  onOpenPath(cb: (ids: VisualIds) => void): () => void;
  snapshotReady(info: { aspect: number }): void;
  snapshotRendered(): void;
  snapshotError(msg: string): void;
  isSnapshot(): boolean;
  snapshotTarget(): VisualIds | null;
  snapshotTheme(): "light" | "dark";
  rendererReady(): void;
  connectState(): Promise<{ firstRun: boolean; tools: ConnectTool[] }>;
  connectDismiss(): Promise<boolean>;
  connectRun(ids: string[]): Promise<{ ok: boolean; lines: string[] }>;
}

export interface ConnectTool { id: "claude" | "cursor" | "codex"; name: string; detected: boolean; evidence: string }
