// Plain-word names and display order for the look fields (node shape, group arrangement and treatment).
// The values themselves are defined in types.ts and laid out by layout.ts; this file only names them for people.
import type { Arrangement, Shape, Treatment } from "./types";

export const SHAPE_ORDER: Shape[] = ["card", "pill", "circle", "diamond", "plain"];
export const SHAPE_NAME: Record<Shape, string> = { card: "Card", pill: "Pill", circle: "Circle", diamond: "Diamond", plain: "Plain" };

export const ARRANGEMENT_ORDER: Arrangement[] = ["flow", "stack", "row", "column", "ring", "hub", "tree", "grid", "free"];
export const ARRANGEMENT_NAME: Record<Arrangement, string> = { flow: "Flow", stack: "Layers", row: "Row", column: "Column", ring: "Ring", hub: "Hub", tree: "Tree", grid: "Grid", free: "Free" };

export const TREATMENT_ORDER: Treatment[] = ["frame", "band", "tint", "bracket", "none"];
export const TREATMENT_NAME: Record<Treatment, string> = { frame: "Frame", band: "Band", tint: "Tint", bracket: "Bracket", none: "None" };
