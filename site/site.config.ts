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
    alt: "The Blueprint app showing a coffee shop's money map, drawn top to bottom from customers to profit. The line from Long queue to Cups sold is selected, and the floating detail card explains it: a long queue stops some sales.",
    // Phones: one crop of the same capture: the whole map with the open detail card.
    canvas: { light: "/shots/app-canvas-light.webp", dark: "/shots/app-canvas-dark.webp", width: 1122, height: 1660 },
  },
  map: {
    light: "/shots/map-light.webp",
    dark: "/shots/map-dark.webp",
    width: 1274,
    height: 1901,
    alt: "A map Blueprint drew of how a coffee shop makes money: customers buy cups, a long queue turns some away, cups sold times price per cup becomes revenue, revenue raises profit and costs lower it.",
  },
  og: { src: "/og.png", width: 1200, height: 630, alt: "Blueprint: a canvas where your AI draws your systems, over a map of how a coffee shop makes money." },
} as const;
