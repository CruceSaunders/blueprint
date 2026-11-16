// Bundles the Electron main process, the preload and the MCP server (served by `Blueprint --mcp`).
// The MCP server source lives in ../mcp/src; its generated content (guide + bundled skills) is refreshed first.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
execFileSync(process.execPath, [path.resolve(here, "../../mcp/scripts/build.mjs")], { stdio: "inherit" });
const common = { bundle: true, platform: "node", target: "node22", format: "cjs", external: ["electron", "fsevents", "./mcp-server.js"], sourcemap: false, logLevel: "warning",
  // The MCP server resolves its own deps from ../mcp/node_modules.
  nodePaths: [path.resolve(here, "../../mcp/node_modules")] };
await build({ ...common, entryPoints: ["electron/main.ts"], outfile: "dist-electron/main.js" });
await build({ ...common, entryPoints: ["electron/preload.ts"], outfile: "dist-electron/preload.js" });
await build({ ...common, entryPoints: ["../mcp/src/server.ts"], outfile: "dist-electron/mcp-server.js" });
console.log("main + preload + mcp-server built");
