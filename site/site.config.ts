// The one place to change links, the site URL and the product visuals.
export const SITE = {
  name: "Blueprint",
  // Set at deploy time. Canonical, og:url, og:image, twitter:image, robots.txt and sitemap.xml all derive from it.
  url: "https://blueprint-canvas-lovat.vercel.app",
  title: "Blueprint: a canvas where your AI draws your systems",
  description:
    "Blueprint is a free, open-source Mac app. Ask Claude Code, Cursor or Codex to /visualize a system and it draws a clear map you can click, read and edit.",
  downloadUrl: "https://github.com/CruceSaunders/blueprint/releases/latest/download/Blueprint.dmg",
  githubUrl: "https://github.com/CruceSaunders/blueprint",
  issuesUrl: "https://github.com/CruceSaunders/blueprint/issues",
  downloadLabel: "Download for Mac",
  githubLabel: "View on GitHub",
  requirement: "Open source. For macOS on Apple silicon.",
} as const;

// Real captures of the demo map (site/demo/ops.json), made by `bash scripts/shoot.sh`. Never redrawn.
export const SHOTS = {
  app: {
    light: "/shots/app-light.webp",
    dark: "/shots/app-dark.webp",
    width: 2880,
    height: 1800,
    alt: "The Blueprint app showing a coffee shop's money map. The line from Long queue to Cups sold is selected, and the floating detail card explains it: a long queue stops some sales.",
    // Phones: two crops of the same capture, stacked. Cards with the selected line, then the whole floating detail card.
    canvas: { light: "/shots/app-canvas-light.webp", dark: "/shots/app-canvas-dark.webp", width: 1096, height: 450 },
    panel: { light: "/shots/app-panel-light.webp", dark: "/shots/app-panel-dark.webp", width: 696, height: 382 },
  },
  map: {
    light: "/shots/map-light.webp",
    dark: "/shots/map-dark.webp",
    width: 1600,
    height: 291,
    alt: "A map Blueprint drew of how a coffee shop makes money: cups sold times price equals revenue, revenue raises profit, costs lower it, and a long queue blocks sales.",
  },
  og: { src: "/og.png", width: 1200, height: 630, alt: "Blueprint: a canvas where your AI draws your systems, over a map of how a coffee shop makes money." },
} as const;
