import type { EdgeKind, GroupKind, NodeKind, Tone, NodeState } from "./types";

export const EDGE_INFO: Record<EdgeKind, { name: string; reads: string; drawn: string; color: string }> = {
  flow: { name: "Flow", reads: "A then B, or A feeds B", drawn: "Solid arrow", color: "var(--edge)" },
  increases: { name: "Increases", reads: "More A → more B", drawn: "Green arrow with +", color: "var(--tone-good)" },
  decreases: { name: "Decreases", reads: "More A → less B", drawn: "Red arrow with −", color: "var(--tone-bad)" },
  requires: { name: "Requires", reads: "A needs B to exist or work", drawn: "Dashed arrow", color: "var(--edge)" },
  becomes: { name: "Becomes", reads: "A turns into B", drawn: "Thick arrow with ⇒", color: "var(--edge)" },
  equals: { name: "Equals", reads: "A is the same thing as B", drawn: "Double line with =", color: "var(--edge)" },
  versus: { name: "Versus", reads: "A or B: a tradeoff", drawn: "Dotted line with vs", color: "var(--tone-warn)" },
  blocks: { name: "Blocks", reads: "A prevents B", drawn: "Red line ending in a bar", color: "var(--tone-bad)" },
  relates: { name: "Relates", reads: "Connected; nature not specified", drawn: "Thin plain line", color: "var(--edge-soft)" },
};

export const GROUP_INFO: Record<GroupKind, { name: string; reads: string }> = {
  group: { name: "Group", reads: "These belong together" },
  layer: { name: "Layer", reads: "One tier or band in a stack" },
  option: { name: "Option", reads: "One of several alternatives" },
  boundary: { name: "Boundary", reads: "Inside vs outside the system" },
};

export const NODE_INFO: Record<NodeKind, { name: string; reads: string }> = {
  card: { name: "Card", reads: "A thing, part or variable" },
  visual: { name: "Drawing", reads: "A custom-drawn picture" },
  image: { name: "Image", reads: "A picture from this project's files" },
  operator: { name: "Operator", reads: "A symbol joining things, like A + B = C" },
  note: { name: "Note", reads: "A side note; not part of the logic" },
  group: { name: "Group", reads: "A frame around related things" },
};

export const TONE_VAR: Record<Tone, string> = {
  neutral: "var(--tone-neutral)",
  accent: "var(--tone-accent)",
  good: "var(--tone-good)",
  warn: "var(--tone-warn)",
  bad: "var(--tone-bad)",
  muted: "var(--tone-muted)",
};

export const STATE_INFO: Record<NodeState, { name: string; color: string }> = {
  idea: { name: "Idea", color: "var(--tone-accent)" },
  question: { name: "Open question", color: "var(--tone-warn)" },
  decided: { name: "Decided", color: "var(--tone-neutral)" },
  built: { name: "Built", color: "var(--tone-good)" },
};
