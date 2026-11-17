// Builds the site's demo map ("Coffee shop" / "How the shop makes money") through the Blueprint MCP server,
// in a throwaway store. Never point BLUEPRINT_HOME at the real ~/Blueprint.
// Usage: BLUEPRINT_HOME=/some/scratch/dir node site/demo/make-demo.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const home = process.env.BLUEPRINT_HOME;
if (!home || home === join(os.homedir(), "Blueprint")) throw new Error("Set BLUEPRINT_HOME to a scratch directory");
const call = join(here, "../../mcp/scripts/call.mjs");
const tmp = mkdtempSync(join(os.tmpdir(), "bp-demo-"));
function run(tool, args) {
  const f = join(tmp, `${tool}.json`);
  writeFileSync(f, JSON.stringify(args));
  const out = execFileSync(process.execPath, [call, tool, "--file", f], { env: process.env, encoding: "utf8" });
  const result = JSON.parse(out);
  if (result.ok === false || result.warnings?.length) throw new Error(`${tool}: ${out}`);
  console.log(`--- ${tool}\n${out.trim().slice(0, 1500)}`);
  return out;
}
run("create_project", { title: "Coffee shop", description: "A small neighbourhood coffee shop." });
run("create_system", { projectId: "coffee-shop", title: "How the shop makes money", summary: "Cups sold times price is revenue; profit is what is left after costs." });
run("create_visual", { projectId: "coffee-shop", systemId: "how-the-shop-makes-money", title: "Overview", description: "Where the shop's money comes from and where it goes.", primary: true });
const ops = JSON.parse(readFileSync(join(here, "ops.json"), "utf8"));
run("apply", ops);
rmSync(tmp, { recursive: true, force: true });
