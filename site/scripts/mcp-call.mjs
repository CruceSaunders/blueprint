// Calls one Blueprint MCP tool and prints the text result: node mcp-call.mjs <tool> --file args.json [--save-image p.png]
// Server: the packaged app (`$BLUEPRINT_APP_BIN --mcp`) when BLUEPRINT_APP_BIN is set, else the repo build (mcp/dist).
// The MCP SDK is loaded from $BLUEPRINT_REPO/mcp (default: this checkout), which must have its node_modules installed.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = process.env.BLUEPRINT_REPO || path.resolve(here, "../..");
const req = createRequire(path.join(repo, "mcp/package.json"));
const { Client } = req("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = req("@modelcontextprotocol/sdk/client/stdio.js");

const argv = process.argv.slice(2);
let file, save;
const pos = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--file") file = argv[++i];
  else if (argv[i] === "--save-image") save = argv[++i];
  else pos.push(argv[i]);
}
const [tool, json] = pos;
const args = file ? JSON.parse(fs.readFileSync(file, "utf8")) : json ? JSON.parse(json) : {};
const bin = process.env.BLUEPRINT_APP_BIN;
const server = bin ? { command: bin, args: ["--mcp"] } : { command: process.execPath, args: [path.join(repo, "mcp/dist/index.js")] };
const client = new Client({ name: "site-demo", version: "1" });
await client.connect(new StdioClientTransport({ ...server, env: { ...process.env } }));
let code = 0;
try {
  const r = await client.callTool({ name: tool, arguments: args });
  for (const c of r.content ?? []) {
    if (c.type === "text") console.log(c.text);
    else if (c.type === "image" && save) fs.writeFileSync(save, Buffer.from(c.data, "base64"));
  }
  if (r.isError) code = 1;
} catch (e) {
  console.error("CALL ERROR:", e.message);
  code = 1;
}
await client.close();
process.exit(code);
