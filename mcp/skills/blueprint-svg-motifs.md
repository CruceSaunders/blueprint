---
name: blueprint-svg-motifs
description: Load when you are about to draw a Blueprint card's `art` (or a standalone `visual` node) and one of these shapes fits the idea - funnel, stack of layers, two-step loop, gauge, bar trend, hub-and-spoke network, balance scale, timeline, gate, flywheel. Ten copy-ready inline SVG recipes that pass the app's sanitiser and read in light and dark mode. Pair with blueprint-declutter-and-svg-craft for the drawing rules.
---

# Blueprint SVG motif recipes

Each recipe is a complete `svg` value. Use it as the `art` of the card it depicts (`"art": {"svg": "...", "size": "md"}`): the funnel goes on the filter's card, the gauge on the capacity card. Inside art, drop the text labels (the card's title names it) unless the words are the point. A standalone `visual` node is only for a picture of the whole map. Before reaching for motif 3, 6 or 10, ask whether the map itself should be a `ring` or `hub` arrangement instead of a small drawing of one. All share one frame: `viewBox="0 0 240 140"`, ink in `currentColor`, one accent hue at partial `fill-opacity`, text at 11-13 units, arrowheads drawn as small polygons (no `<defs>`, `<marker>`, ids, `<style>` or scripts). Change the words and numbers; keep the geometry unless the snapshot shows a problem. Put the claim in the card's `title`/`subtitle` and any extra sentence in `explanation`, not inside the drawing.

Accent hues that hold up on both themes: blue `#3b82f6`, green `#10b981`, amber `#f59e0b`, red `#ef4444`, violet `#8b5cf6`, slate `#64748b`. Use one hue per drawing unless the colours mean different things; never let colour be the only signal.

When the JSON string needs the SVG, keep attribute quotes as `\"` or switch the SVG to single quotes.

## 1. Funnel (stages that shrink)
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140" font-family="system-ui, sans-serif" font-size="12"><path d="M20 12h200l-30 36H50z" fill="#3b82f6" fill-opacity=".15" stroke="#3b82f6" stroke-width="1.5"/><path d="M54 54h132l-24 36H78z" fill="#3b82f6" fill-opacity=".3" stroke="#3b82f6" stroke-width="1.5"/><path d="M82 96h76l-18 32h-40z" fill="#3b82f6" fill-opacity=".45" stroke="#3b82f6" stroke-width="1.5"/><text x="120" y="34" text-anchor="middle" fill="currentColor">Visits</text><text x="120" y="76" text-anchor="middle" fill="currentColor">Sign-ups</text><text x="120" y="116" text-anchor="middle" fill="currentColor">Paid</text></svg>
```

## 2. Stack / layers (tiers resting on each other)
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140" font-family="system-ui, sans-serif" font-size="12"><rect x="20" y="10" width="200" height="34" rx="6" fill="#8b5cf6" fill-opacity=".12" stroke="#8b5cf6" stroke-width="1.5"/><rect x="20" y="53" width="200" height="34" rx="6" fill="#8b5cf6" fill-opacity=".25" stroke="#8b5cf6" stroke-width="1.5"/><rect x="20" y="96" width="200" height="34" rx="6" fill="#8b5cf6" fill-opacity=".38" stroke="#8b5cf6" stroke-width="1.5"/><text x="120" y="31" text-anchor="middle" fill="currentColor">Interface</text><text x="120" y="74" text-anchor="middle" fill="currentColor">Logic</text><text x="120" y="117" text-anchor="middle" fill="currentColor">Storage</text></svg>
```

## 3. Two-step loop (reinforcing or balancing)
Swap the centre letter to `B` for a balancing loop.
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140" font-family="system-ui, sans-serif" font-size="12"><path d="M124 26A44 44 0 0 1 124 114" fill="none" stroke="#10b981" stroke-width="2.5"/><polygon points="132,108 132,120 122,114" fill="#10b981"/><path d="M116 114A44 44 0 0 1 116 26" fill="none" stroke="#10b981" stroke-width="2.5"/><polygon points="108,20 108,32 118,26" fill="#10b981"/><text x="120" y="80" text-anchor="middle" font-size="28" font-weight="700" fill="currentColor">R</text><text x="172" y="74" fill="currentColor">More users</text><text x="68" y="74" text-anchor="end" fill="currentColor">More value</text></svg>
```

## 4. Gauge (a level against a limit)
The value arc ends at angle `180 - 180 * share` degrees on a circle of radius 80 centred at (120,110): end point `(120 + 80cos a, 110 - 80sin a)`. The example shows 65%.
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140" font-family="system-ui, sans-serif" font-size="13"><path d="M40 110A80 80 0 0 1 200 110" fill="none" stroke="currentColor" stroke-opacity=".15" stroke-width="14"/><path d="M40 110A80 80 0 0 1 156.3 38.7" fill="none" stroke="#10b981" stroke-width="14"/><line x1="120" y1="110" x2="147" y2="57" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="120" cy="110" r="5" fill="currentColor"/><text x="120" y="134" text-anchor="middle" fill="currentColor">65% of capacity</text></svg>
```

## 5. Bar trend (change over time)
Bars sit on a baseline at y=120; a bar of value `h` starts at `y = 120 - h`.
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140" font-family="system-ui, sans-serif" font-size="11"><line x1="18" y1="120" x2="222" y2="120" stroke="currentColor" stroke-opacity=".4"/><rect x="28" y="100" width="22" height="20" rx="2" fill="#3b82f6" fill-opacity=".55"/><rect x="60" y="88" width="22" height="32" rx="2" fill="#3b82f6" fill-opacity=".55"/><rect x="92" y="90" width="22" height="30" rx="2" fill="#3b82f6" fill-opacity=".55"/><rect x="124" y="72" width="22" height="48" rx="2" fill="#3b82f6" fill-opacity=".55"/><rect x="156" y="58" width="22" height="62" rx="2" fill="#3b82f6" fill-opacity=".55"/><rect x="188" y="40" width="22" height="80" rx="2" fill="#3b82f6"/><polyline points="39,100 71,88 103,90 135,72 167,58 199,40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/><text x="39" y="134" text-anchor="middle" fill="currentColor">Q1</text><text x="199" y="134" text-anchor="middle" fill="currentColor">Q6</text></svg>
```

## 6. Network (one hub, many links)
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140"><g stroke="currentColor" stroke-opacity=".45" stroke-width="1.5"><line x1="120" y1="70" x2="172" y2="70"/><line x1="120" y1="70" x2="146" y2="115"/><line x1="120" y1="70" x2="94" y2="115"/><line x1="120" y1="70" x2="68" y2="70"/><line x1="120" y1="70" x2="94" y2="25"/><line x1="120" y1="70" x2="146" y2="25"/><line x1="146" y1="25" x2="172" y2="70"/><line x1="68" y1="70" x2="94" y2="115"/></g><g fill="#64748b" fill-opacity=".35" stroke="currentColor" stroke-width="1.5"><circle cx="172" cy="70" r="9"/><circle cx="146" cy="115" r="9"/><circle cx="94" cy="115" r="9"/><circle cx="68" cy="70" r="9"/><circle cx="94" cy="25" r="9"/><circle cx="146" cy="25" r="9"/></g><circle cx="120" cy="70" r="16" fill="#3b82f6" stroke="currentColor" stroke-width="1.5"/></svg>
```

## 7. Balance scale (a tradeoff that tips one way)
Tilt the beam toward the heavier side: here the right pan is lower.
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140" font-family="system-ui, sans-serif" font-size="12"><line x1="120" y1="50" x2="120" y2="124" stroke="currentColor" stroke-width="2"/><line x1="96" y1="125" x2="144" y2="125" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="50" y1="40" x2="190" y2="60" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><polygon points="114,56 126,56 120,46" fill="currentColor"/><g stroke="currentColor" stroke-opacity=".6"><line x1="50" y1="40" x2="32" y2="74"/><line x1="50" y1="40" x2="68" y2="74"/><line x1="190" y1="60" x2="172" y2="94"/><line x1="190" y1="60" x2="208" y2="94"/></g><path d="M28 74Q50 90 72 74z" fill="#f59e0b" fill-opacity=".35" stroke="#f59e0b" stroke-width="1.5"/><path d="M168 94Q190 110 212 94z" fill="#f59e0b" fill-opacity=".6" stroke="#f59e0b" stroke-width="1.5"/><text x="50" y="104" text-anchor="middle" fill="currentColor">Speed</text><text x="190" y="128" text-anchor="middle" fill="currentColor">Cost</text></svg>
```

## 8. Timeline (milestones and "now")
Filled dots are done, hollow dots are ahead.
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140" font-family="system-ui, sans-serif" font-size="12"><line x1="20" y1="70" x2="220" y2="70" stroke="currentColor" stroke-opacity=".5" stroke-width="2"/><circle cx="40" cy="70" r="7" fill="#3b82f6"/><circle cx="93" cy="70" r="7" fill="#3b82f6"/><circle cx="147" cy="70" r="7" fill="none" stroke="#3b82f6" stroke-width="2"/><circle cx="200" cy="70" r="7" fill="none" stroke="#3b82f6" stroke-width="2"/><line x1="120" y1="40" x2="120" y2="100" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4 3"/><text x="120" y="32" text-anchor="middle" fill="#ef4444">now</text><text x="40" y="98" text-anchor="middle" fill="currentColor">Plan</text><text x="93" y="98" text-anchor="middle" fill="currentColor">Build</text><text x="147" y="98" text-anchor="middle" fill="currentColor">Test</text><text x="200" y="98" text-anchor="middle" fill="currentColor">Launch</text></svg>
```

## 9. Gate (a check that lets some things through)
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140" font-family="system-ui, sans-serif" font-size="12"><line x1="20" y1="70" x2="104" y2="70" stroke="currentColor" stroke-width="2"/><polygon points="102,64 102,76 111,70" fill="currentColor"/><rect x="113" y="26" width="14" height="88" rx="3" fill="#f59e0b" fill-opacity=".8"/><line x1="130" y1="70" x2="210" y2="70" stroke="#10b981" stroke-width="2"/><polygon points="208,64 208,76 218,70" fill="#10b981"/><circle cx="34" cy="50" r="5" fill="currentColor" fill-opacity=".5"/><circle cx="52" cy="50" r="5" fill="currentColor" fill-opacity=".5"/><circle cx="70" cy="50" r="5" fill="currentColor" fill-opacity=".5"/><text x="60" y="94" text-anchor="middle" fill="currentColor">Requests</text><text x="120" y="132" text-anchor="middle" fill="currentColor">Review</text><text x="174" y="94" text-anchor="middle" fill="currentColor">Approved</text></svg>
```

## 10. Flywheel (four steps that feed each other)
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140" font-family="system-ui, sans-serif" font-size="12"><g fill="none" stroke="#8b5cf6" stroke-width="2.5"><path d="M128 33A40 40 0 0 1 159 64"/><path d="M159 80A40 40 0 0 1 128 111"/><path d="M112 111A40 40 0 0 1 81 80"/><path d="M81 64A40 40 0 0 1 112 33"/></g><g fill="#8b5cf6"><polygon points="153,58 165,58 159,67"/><polygon points="137,105 137,117 127,111"/><polygon points="75,86 87,86 81,77"/><polygon points="103,27 103,39 113,33"/></g><g fill="currentColor"><circle cx="120" cy="32" r="5"/><circle cx="160" cy="72" r="5"/><circle cx="120" cy="112" r="5"/><circle cx="80" cy="72" r="5"/></g><g fill="currentColor"><text x="120" y="20" text-anchor="middle">Users</text><text x="170" y="76">Content</text><text x="120" y="132" text-anchor="middle">Sharing</text><text x="70" y="76" text-anchor="end">Creators</text></g></svg>
```
