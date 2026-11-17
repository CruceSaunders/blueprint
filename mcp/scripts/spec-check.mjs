// SPEC.md vs code: every node/edge field and every enumerated value that SPEC.md documents must exist in the zod
// write schema (mcp/src/apply.ts) and the layout constants (mcp/src/layout.ts), and the other way round.
// Needs a build (npm run build). Exits 0 only if both directions match.
import fs from "node:fs"; import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../dist");
const A = await import(pathToFileURL(path.join(dist, "apply.js")).href);
const L = await import(pathToFileURL(path.join(dist, "layout.js")).href);
const spec = fs.readFileSync(path.resolve(here, "../../SPEC.md"), "utf8");

let failed = 0, checks = 0;
const same = (what, specList, codeList) => {
  checks++;
  const s = new Set(specList), c = new Set(codeList);
  const onlySpec = [...s].filter((x) => !c.has(x)), onlyCode = [...c].filter((x) => !s.has(x));
  if (!onlySpec.length && !onlyCode.length) { console.log(`ok   ${what}: ${[...s].sort().join(", ")}`); return; }
  failed++;
  console.log(`FAIL ${what}${onlySpec.length ? `\n       in SPEC.md only: ${onlySpec.join(", ")}` : ""}${onlyCode.length ? `\n       in code only: ${onlyCode.join(", ")}` : ""}`);
};

/** The fenced block right after a heading line. */
const block = (heading) => {
  const i = spec.indexOf(heading);
  if (i < 0) throw new Error(`SPEC.md has no "${heading}"`);
  const a = spec.indexOf("```", i), b = spec.indexOf("```", a + 3);
  return spec.slice(spec.indexOf("\n", a) + 1, b);
};
const stripComments = (t) => t.split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
/** Keys in a TypeScript-ish object sketch: identifiers in key position (after `{`, `,` or a line start). */
const keysOf = (t) => {
  const body = stripComments(t).replace(/"[^"]*"/g, '""').replace(/\{\s*x\s*,\s*y\s*\}/g, "P").replace(/\{\s*w\s*,\s*h\s*\}/g, "P");
  return [...body.matchAll(/(?:^|[{,])\s*([A-Za-z_][A-Za-z0-9_]*)\??(?=\s*[:,}]|\s*$)/gm)].map((m) => m[1]);
};
/** `name?: "a"|"b"|...` union in a block. */
const unionOf = (t, name) => {
  const m = new RegExp(`\\b${name}\\??:\\s*((?:"[^"]*"\\s*\\|\\s*)*"[^"]*")`).exec(t);
  if (!m) throw new Error(`SPEC.md: no "${name}" union found`);
  return [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
};

const nodeBlock = block("### Node");
const edgeBlock = block("### Edge");
const art = A.SCHEMAS.node.shape.art.unwrap();

// node fields (the art sub-fields are listed inline, so they count as node-block keys too)
const nodeKeys = keysOf(nodeBlock);
same("node fields", nodeKeys, [...Object.keys(A.SCHEMAS.node.shape), ...Object.keys(art.shape)]);
const artText = /art\?:\s*\{([^}]*)\}/.exec(stripComments(nodeBlock).replace(/\n\s*/g, " "))?.[1] ?? "";
same("art fields", keysOf(`{${artText}}`), Object.keys(art.shape));
same("edge fields", keysOf(edgeBlock), Object.keys(A.SCHEMAS.edge.shape));

// enumerated values
const opts = (zodOptional) => zodOptional.unwrap().options;
same("tone", unionOf(nodeBlock, "tone"), opts(A.SCHEMAS.node.shape.tone));
same("state", unionOf(nodeBlock, "state"), opts(A.SCHEMAS.node.shape.state));
same("weight", unionOf(nodeBlock, "weight"), opts(A.SCHEMAS.node.shape.weight));
same("operator", unionOf(nodeBlock, "operator"), [...A.OPERATORS]);
same("shape", unionOf(nodeBlock, "shape"), [...L.SHAPES]);
same("art.size", unionOf(nodeBlock, "size"), opts(art.shape.size));
same("groupKind", unionOf(nodeBlock, "groupKind"), [...A.GROUP_KINDS]);
same("treatment", unionOf(nodeBlock, "treatment"), [...L.TREATMENTS]);
same("handles", unionOf(edgeBlock.replace(/sourceHandle\?, targetHandle\?,\s*\/\/\s*/, "handle?: "), "handle"), opts(A.SCHEMAS.edge.shape.sourceHandle));
const kindList = (heading, stop) => { const i = spec.indexOf(heading); const j = spec.indexOf(stop, i); return [...spec.slice(i, j).matchAll(/^- `([a-z]+)`/gm)].map((m) => m[1]); };
same("node kinds", kindList("Node kinds:", "### Edge"), [...A.NODE_KINDS]);
const edgeTable = spec.slice(spec.indexOf("| kind      |"), spec.indexOf("\n\n", spec.indexOf("| kind      |")));
same("edge kinds", [...edgeTable.matchAll(/^\| ([a-z]+)\s+\|/gm)].map((m) => m[1]).filter((k) => k !== "kind"), [...A.EDGE_KINDS]);
const arrTable = spec.slice(spec.indexOf("| arrangement | placement |"), spec.indexOf("\n\n", spec.indexOf("| arrangement | placement |")));
same("arrangements", [...arrTable.matchAll(/^\| `([a-z]+)`(?: \/ `([a-z]+)`)? \|/gm)].flatMap((m) => [m[1], m[2]].filter(Boolean)), [...L.ARRANGEMENTS]);

console.log(`\n${checks - failed}/${checks} passed`);
process.exit(failed ? 1 : 0);
