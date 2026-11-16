# Blueprint site: design lock

Literal values live in `app/globals.css` (`@theme` + `:root`). Links, labels and product images live in `site.config.ts`.

## Colour (from `assets/icon/icon.svg`)
| Role | Light | Dark |
|---|---|---|
| Page | `#F6F7FB` | `#0A0E1F` |
| Raised surface | `#ECEFF8` | `#10162D` |
| Text | `#10162F` | `#EEF1FA` |
| Muted text | `#4A5372` | `#A3ACC8` |
| Rule / border | navy 12% | sky 16% |
| Grid lines | `#3A4C8F` 9% | `#8FB4FF` 7% |
| Primary action | `#1E2A5E` on white text | `#8FB4FF` on `#0A0E1F` text |
| Single accent | `#FFC857`, the command caret only | same |

## Type
Schibsted Grotesk 400-700 for everything; JetBrains Mono for the command and file paths.
Display `clamp(2.5rem, 1.1rem + 5.4vw, 5.4rem)` / 0.98 / -0.035em. H2 `clamp(2rem, 1.1rem + 3vw, 3.6rem)` / 1.02 / -0.03em.
Lead `clamp(1.125rem, 1rem + 0.45vw, 1.3rem)` / 1.5. Small 15px.

## Shape
Radius 14px on captures and code blocks, 12px on buttons. One shadow, on product captures only. Grid 56px.

## Motion (all off under `prefers-reduced-motion`)
- Hero entrance: rise + unblur, 800ms, `cubic-bezier(0.22, 1, 0.36, 1)`, 90ms stagger.
- Hero capture: settles from a 9deg tilt as it scrolls in (scroll-driven, CSS only, where supported).
- Signature: the `/visualize this system` command types (900ms, steps), then the map draws in top-down (clip-path, 1500ms).
- Reveals: 700ms rise on headings and list rows; hidden only when JS is on.
- Hover: buttons lift 1px; relationship words get an underline sweep.

## Component index
| Component | Use |
|---|---|
| `Actions` | The only buttons: Download (primary) + GitHub (secondary). Hero and close only. |
| `ShotImage` | Every product image; light/dark pair from `SHOTS`. Real captures only (`scripts/shoot.sh`). |
| Text beat | H2 + one lead paragraph, max 40rem. |
| Kind list | The nine relationship kinds, word + meaning on one line. |
| Code block | Real paths only. |
