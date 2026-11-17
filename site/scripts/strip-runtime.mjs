// Post-build: the page has no React interactivity (its only behaviour is one inline script), so the Next.js client
// runtime (~175 KB gzipped) is dead weight that delayed LCP under mobile throttling. Remove it from the exported HTML.
// Keeps: CSS, fonts, JSON-LD, and our own inline scripts. Fails loudly if the HTML shape changes.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const OUT = new URL("../out/", import.meta.url).pathname;
const files = readdirSync(OUT).filter((f) => f.endsWith(".html"));
for (const f of files) {
  const p = join(OUT, f);
  let html = readFileSync(p, "utf8");
  const before = html.length;
  html = html
    .replace(/<script[^>]*\ssrc="\/_next\/static\/[^"]+"[^>]*><\/script>/g, "")
    .replace(/<link[^>]*rel="preload"[^>]*as="script"[^>]*\/?>/g, "")
    .replace(/<link[^>]*as="script"[^>]*rel="preload"[^>]*\/?>/g, "")
    .replace(/<script>\(self\.__next_f[\s\S]*?<\/script>/g, "")
    .replace(/<script>self\.__next_f[\s\S]*?<\/script>/g, "")
    .replace(/<script id="_R_">[\s\S]*?<\/script>/g, "");
  const left = (html.match(/_next\/static\/[^"']+\.js/g) || []).length;
  if (left) throw new Error(`${f}: ${left} runtime script reference(s) left; update strip-runtime.mjs`);
  if (!html.includes("data-draw") && f === "index.html") throw new Error("index.html: page content missing");
  writeFileSync(p, html);
  console.log(`strip-runtime: ${f} ${before} -> ${html.length} bytes`);
}
