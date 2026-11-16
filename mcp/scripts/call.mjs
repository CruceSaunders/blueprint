// Generic MCP client: node call.mjs <tool> '<json>' | --file args.json  [--save-image path.png]
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
let file, save, pos = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--file") file = argv[++i];
  else if (argv[i] === "--save-image") save = argv[++i];
  else pos.push(argv[i]);
}
const [tool, json] = pos;
if (!tool) { console.error("usage: call.mjs <tool> ['<json>'|--file f] [--save-image p]"); process.exit(2); }
const args = file ? JSON.parse(fs.readFileSync(file, "utf8")) : json ? JSON.parse(json) : {};
const client = new Client({ name: "call", version: "1" });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.resolve(here, "../dist/index.js")], env: { ...process.env } }));
let code = 0;
try {
  const r = await client.callTool({ name: tool, arguments: args });
  for (const c of r.content ?? []) {
    if (c.type === "text") console.log(c.text);
    else if (c.type === "image") {
      if (save) { fs.writeFileSync(save, Buffer.from(c.data, "base64")); console.log(`[image saved ${save}]`); }
      else console.log(`[image ${c.mimeType}, ${c.data.length} b64 chars; use --save-image]`);
    }
  }
  if (r.isError) code = 1;
} catch (e) { console.error("CALL ERROR:", e.message); code = 1; }
await client.close();
process.exit(code);
