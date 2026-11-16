// Renders public/og.png (1200x630) from the real demo-map snapshot: logo, headline, map. Headless Chromium.
// Usage: node scripts/og.mjs <map.png> <out.png>
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
// Playwright is not a site dependency; use the copy the web-design bar installs (or PLAYWRIGHT_FROM=<dir with node_modules>).
const from = process.env.PLAYWRIGHT_FROM || join(os.homedir(), ".cache/website-bar/package.json");
const { chromium } = createRequire(from)("playwright");
const [mapPath, out] = process.argv.slice(2);
const map = readFileSync(mapPath).toString("base64");
const logo = readFileSync(join(here, "../public/logo.svg")).toString("base64");
const html = `<!doctype html><html><head><style>
  html,body{margin:0;width:1200px;height:630px;background:#f6f7fb;font-family:-apple-system,"Helvetica Neue",sans-serif;color:#10162f}
  .grid{position:absolute;inset:0;background-image:linear-gradient(to right,rgba(58,76,143,.08) 1px,transparent 1px),linear-gradient(to bottom,rgba(58,76,143,.08) 1px,transparent 1px);background-size:48px 48px}
  .top{position:absolute;left:64px;top:52px;right:64px;display:flex;align-items:center;gap:16px}
  .top img{width:52px;height:52px}
  .brand{font-size:28px;font-weight:650;letter-spacing:-.01em}
  h1{position:absolute;left:64px;top:118px;margin:0;font-size:48px;line-height:1.02;letter-spacing:-.035em;font-weight:760;max-width:1000px}
  .map{position:absolute;left:64px;right:64px;top:200px;height:390px;border:1px solid rgba(30,42,94,.12);border-radius:16px;background:#fdfdfe;overflow:hidden;box-shadow:0 20px 50px -24px rgba(30,42,94,.35)}
  .map img{width:100%;height:100%;object-fit:cover;object-position:50% 40%}
</style></head><body><div class="grid"></div>
<div class="top"><img src="data:image/svg+xml;base64,${logo}"><span class="brand">Blueprint</span></div>
<h1>A canvas where your AI draws your systems</h1>
<div class="map"><img src="data:image/png;base64,${map}"></div></body></html>`;
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await p.setContent(html, { waitUntil: "load" });
await p.screenshot({ path: out, type: "png" });
await b.close();
console.log(`og: ${out}`);
