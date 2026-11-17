# Attribution for the Blueprint skills

The skill files in this folder are original writing for Blueprint unless a section below says a method was adapted. No text was copied from any source. Sources whose licence does not allow reuse (unlicensed repositories, CC BY-NC-ND, CC BY-SA text, the tldraw licence, copyrighted books and papers) informed general method only, as facts and ideas, and none of their wording is reproduced.

## Sources with attribution duties

### C4 model, by Simon Brown (CC BY 4.0)
- Source: https://c4model.com/
- Licence: Creative Commons Attribution 4.0 International, https://creativecommons.org/licenses/by/4.0/
- Required attribution line: "The zoom levels in blueprint-system-map are adapted from the C4 model by Simon Brown (https://c4model.com/), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Changes: reworded in plain language, reduced to the levels useful on a Blueprint canvas, and mapped onto Blueprint node and group kinds."

### Archify, by tt-a1i and Cocoon AI (Apache-2.0)
- Source: https://github.com/tt-a1i/archify (commit a7ed6fd6657da90414831d1d42cf95987188750c), file `references/authoring-defaults.md`
- Licence: Apache License 2.0, https://www.apache.org/licenses/LICENSE-2.0
- NOTICE text carried forward: "Archify. Copyright (c) 2026 tt-a1i (Archify). Copyright (c) 2025 Cocoon AI."
- Required statement of changes: "blueprint-system-map and blueprint-process-flow adapt two ideas from Archify: gates and conditions are shown on the relationship they qualify, and the reader's main path is laid out first with branches and returns placed off it. The ideas were rewritten for Blueprint's node and edge kinds; no Archify text or code is included."

### visual-explainer, by Nico Bailon (MIT)
- Source: https://github.com/nicobailon/visual-explainer (commit 9d5f880b7e8e0a9a80c890b8e1bb6918b68481ad), `plugins/visual-explainer/SKILL.md` ("Show, don't tell")
- Licence: MIT. Copyright (c) 2025 Nico Bailon. The MIT permission notice applies: "Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED."
- Adapted ideas (reworded): draw the difference between options (blueprint-options-compare), draw the mechanism rather than a labelled box and title a figure with its claim (blueprint-concept-explainer), never rely on colour alone (blueprint-declutter-and-svg-craft).

### information-overload skill (owned by the Blueprint author)
- The purpose test, "one home per fact" and title/caption merge rules in blueprint-declutter-and-svg-craft are adapted from the author's own private skill. Its product-specific case study and quotes were not used. No third-party licence applies.

## Facts and methods only (no text used)
- Causal loop diagrams (link polarity, reinforcing vs balancing loops by counting negative links, delay marks): general systems-dynamics method, cross-checked against the Wikipedia article "Causal loop diagram" (CC BY-SA 4.0). Written fresh; no wording reused. Used in blueprint-feedback-map.
- Concept maps (focus question, concept-link-concept propositions, avoid sentences in boxes): method of Novak and Cañas, IHMC, https://cmap.ihmc.us/docs/theory-of-concept-maps (copyrighted; idea only). Used in blueprint-concept-explainer.

## Per skill
| Skill file | Sources drawn on | Adapted vs fresh |
|---|---|---|
| blueprint-system-map.md | C4 model (CC BY 4.0); Archify (Apache-2.0) | Zoom levels adapted with attribution; gate-on-edge idea adapted; rest, mapping table and example written fresh |
| blueprint-feedback-map.md | Causal loop method (facts only) | Written fresh |
| blueprint-options-compare.md | visual-explainer (MIT) | "Draw the difference" idea adapted; rest written fresh |
| blueprint-process-flow.md | Archify (Apache-2.0) | Main-path-first idea adapted; rest written fresh |
| blueprint-concept-explainer.md | Concept-map method (idea only); visual-explainer (MIT) | Ideas adapted; text written fresh |
| blueprint-declutter-and-svg-craft.md | information-overload (author's own); visual-explainer (MIT) | Review steps adapted from the author's skill; SVG rules written fresh from Blueprint's sanitiser behaviour |
| blueprint-svg-motifs.md | none | All ten SVG recipes drawn fresh for Blueprint |

The arrangement guidance (choosing ring, hub, tree, flow or tiers from the system's shape), the "art on the part" rule and the symmetry/tidiness rules were added in the visual-v2 rewrite and are written fresh from general diagramming practice (centred ranks, midpoint ports, orthogonal routing with few bends); no source text was used.

All worked examples use invented, generic subjects.
