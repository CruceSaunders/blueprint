---
name: blueprint-product-map
description: Load before drawing an app or website idea in Blueprint - "visualize my app idea", a sitemap or screen map, a user flow through screens, onboarding or checkout, low-fidelity wireframes, an MVP scope, or how a product's screens, features and data fit together. For the technical services behind it use blueprint-system-map; for a non-screen process use blueprint-process-flow.
---

# Product map (apps, websites, user flows)

**Use when** the reader is a founder or builder deciding what the product is: which screens exist, how a user moves through them, what ships first.
**Do not use** for servers, databases and APIs (system-map) or for a business process with no screens (business-map or process-flow).

## Pick one view per visual
An app idea usually needs 2-4 visuals in one system, not one crowded canvas. Make them in this order and stop when the idea is clear:
| Visual | Answers | Build |
|---|---|---|
| `concept` | What is it, for whom, why now | `hub`: the product card (`weight: "lg"`) in the middle; 4-6 spokes: user, problem, core action, value, how it earns. `relates` edges with a 1-3 word label |
| `screen-map` (sitemap) | What screens exist and how they nest | `tree` from the entry screen; one `card` per screen, `icon` matching its job; tab-bar or top-nav sections as the first rank |
| `user-flow` (one per key task) | How one user finishes one task | `flow` RIGHT; screens as `card`s, user actions as `flow` labels ("taps Pay"), decisions as `diamond`s; success end `good`, drop-off end `warn` |
| `mvp-scope` | What ships first and what waits | `row` of three `option` groups: Now, Next, Later; features as `pill`s; Now holds 3-5 items at most |
| `data` (only when asked) | What the app stores | system-map data-model rule: a card per entity, `relates` with cardinality |

Name the visual by its view (`screen-map`, `flow-signup`), and put the task in the visual `description` ("new user: download to first habit logged").

## Screens are cards with a wireframe as art
- A screen card's `art` is a **low-fidelity wireframe** of that screen, `size: "md"` (`lg` only for the one focal screen). Draw it as inline SVG on a phone (`viewBox="0 0 90 160"`) or browser (`viewBox="0 0 160 100"`) frame.
- Wireframe grammar, nothing else: a rounded outer frame, a top bar line, grey blocks for text (`rect` rows, `fill="currentColor" fill-opacity=".15"`), one filled accent block for the primary button, a circle for an avatar or photo, a box with an X for an image. No real copy, no lorem ipsum, no brand colours. At most one accent fill per screen: the thing the user taps next.
- The screen's real content goes in `subtitle` (<= 8 words: "Pick a plan, see price") and detail in `explanation` (fields, states, empty state, error state).
- Same frame size and stroke width on every screen of a visual, so they read as one set. Reuse one SVG skeleton and change only the inner blocks.
- No wireframe needed: a screen nobody is deciding about yet gets `icon` only. Wireframe the 3-6 screens that carry the idea.

## User flow method
1. Pick one user and one goal. Write both in the description.
2. Happy path first: entry screen to the moment of value, straight along the axis.
3. Each edge is what the user does, in their words ("enters email", "skips"). System actions (an email sent, a payment charged) go in the subtitle of the screen they produce, not as extra nodes.
4. Branches: one `diamond` per real decision ("Has account?"), one labelled edge per answer. Errors and empty states that send the user back: an edge to the earlier screen labelled with the cause.
5. Mark the drop-off risk: the screen where users most likely quit gets `tone: "warn"` and its reason in `explanation`. Unknowns get `state: "question"`.
6. Over 8 screens: split by task (`flow-signup`, `flow-checkout`).

## Status for ideation and review
- `state` carries maturity: `idea` (not decided), `question` (open issue), `decided`, `built`. Use it on screens and features so the same map works for brainstorming now and review later.
- In review mode, compare against what exists: screens that are `built` but missing from the flow, flows that end before the value moment, and Now-scope items that are not on any flow.

## Mapping onto Blueprint
| Concept | Blueprint |
|---|---|
| Screen / page | `card` + wireframe `art` (or `icon`) |
| Navigation section, tab | first rank of the `tree`, or a `tint` group |
| User action | `flow` edge, label = the action |
| Screen changes state (empty to filled) | `becomes` between two cards of the same screen |
| Decision / branch | `card`, `shape: "diamond"`, titled as a question |
| Feature in scope | `pill` inside an `option` group (Now / Next / Later) |
| Needs something first (login, payment set up) | `requires` |
| Outside service (Stripe, Google sign-in) | `card`, `tone: "muted"`, top level, outside any group |

## Worked example (habit app signup flow)
Plan: flow RIGHT, four screens with phone wireframes, one decision; settings and paywall left out.
```json
{
  "projectId": "habit-app", "systemId": "onboarding", "visualId": "flow-signup",
  "layout": { "direction": "RIGHT" },
  "ops": [
    {"op": "add_node", "node": {"id": "welcome", "kind": "card", "title": "Welcome", "subtitle": "Promise and one button", "art": {"size": "md", "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 90 160\"><rect x=\"3\" y=\"3\" width=\"84\" height=\"154\" rx=\"12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\"/><circle cx=\"45\" cy=\"52\" r=\"18\" fill=\"currentColor\" fill-opacity=\".15\"/><rect x=\"18\" y=\"82\" width=\"54\" height=\"7\" rx=\"3\" fill=\"currentColor\" fill-opacity=\".3\"/><rect x=\"24\" y=\"95\" width=\"42\" height=\"5\" rx=\"2.5\" fill=\"currentColor\" fill-opacity=\".15\"/><rect x=\"14\" y=\"130\" width=\"62\" height=\"14\" rx=\"7\" fill=\"#6366f1\"/></svg>"}, "explanation": "First screen after install. One line on what the app does and a Get started button."}},
    {"op": "add_node", "node": {"id": "has-account", "kind": "card", "shape": "diamond", "title": "Has account?", "explanation": "Returning users sign in; new users go straight to picking a habit."}},
    {"op": "add_node", "node": {"id": "pick", "kind": "card", "title": "Pick a habit", "subtitle": "Six suggestions, one custom", "weight": "lg", "art": {"size": "lg", "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 90 160\"><rect x=\"3\" y=\"3\" width=\"84\" height=\"154\" rx=\"12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\"/><rect x=\"14\" y=\"16\" width=\"46\" height=\"7\" rx=\"3\" fill=\"currentColor\" fill-opacity=\".3\"/><g fill=\"currentColor\" fill-opacity=\".15\"><rect x=\"14\" y=\"34\" width=\"28\" height=\"26\" rx=\"5\"/><rect x=\"48\" y=\"34\" width=\"28\" height=\"26\" rx=\"5\"/><rect x=\"14\" y=\"66\" width=\"28\" height=\"26\" rx=\"5\"/><rect x=\"48\" y=\"66\" width=\"28\" height=\"26\" rx=\"5\"/><rect x=\"14\" y=\"98\" width=\"28\" height=\"26\" rx=\"5\"/></g><rect x=\"48\" y=\"98\" width=\"28\" height=\"26\" rx=\"5\" fill=\"none\" stroke=\"currentColor\" stroke-dasharray=\"3 3\"/><rect x=\"14\" y=\"134\" width=\"62\" height=\"14\" rx=\"7\" fill=\"#6366f1\"/></svg>"}, "explanation": "The value moment starts here: the user commits to one habit. Most likely drop-off if the choices feel generic.", "tone": "warn"}},
    {"op": "add_node", "node": {"id": "sign-in", "kind": "card", "title": "Sign in", "subtitle": "Apple or email", "icon": "log-in", "explanation": "Returning users only."}},
    {"op": "add_node", "node": {"id": "today", "kind": "card", "title": "Today", "subtitle": "First check-in done", "icon": "circle-check", "tone": "good", "explanation": "Home screen with the habit logged once. Success for this flow."}},
    {"op": "add_edge", "edge": {"id": "e1", "source": "welcome", "target": "has-account", "kind": "flow", "label": "taps Get started", "explanation": "The only action on the welcome screen."}},
    {"op": "add_edge", "edge": {"id": "e2", "source": "has-account", "target": "pick", "kind": "flow", "label": "no", "explanation": "New users skip sign-up until after the first check-in."}},
    {"op": "add_edge", "edge": {"id": "e3", "source": "has-account", "target": "sign-in", "kind": "flow", "label": "yes", "explanation": "Returning users sign in."}},
    {"op": "add_edge", "edge": {"id": "e4", "source": "pick", "target": "today", "kind": "flow", "label": "logs first day", "explanation": "Choosing a habit logs day one immediately."}},
    {"op": "add_edge", "edge": {"id": "e5", "source": "sign-in", "target": "today", "kind": "flow", "label": "signed in", "explanation": "Returning users land on Today."}}
  ]
}
```
The happy path runs straight through the wireframed screens; only Pick a habit is large, because it is the screen being decided.
