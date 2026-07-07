---
name: rangam-design
description: Use this skill to generate well-branded interfaces and assets for Rangam's job-seeker product (Interview Coach, delivered as "TalentArbor — Powered by Rangam"), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick map
- `readme.md` — full design guide: content voice, visual foundations, iconography, token dialects, index.
- `styles.css` → `tokens/*.css` — colors, typography, shape, elevation, motion, layout, brand surface utilities, fonts.
- `components/` — reusable primitives (actions, forms, display, feedback, structure, shell, icons). Each has `.jsx` + `.d.ts` + `.prompt.md`.
- `ui_kits/candidate/` — interactive job-seeker flow (dashboard → practice session).
- `guidelines/` — foundation specimen cards.
- `assets/` — TalentArbor + Rangam logos, favicon.

## Two token dialects
- Job-seeker (candidate) surfaces: `rgb(var(--candidate-*))` tokens, `.candidate-design-system` wrapper, `SurfaceCard`/`ActionButton`, `.surface-*` classes, tracked eyebrows. Prefer this for job-seeker work.
- Shared shadcn primitives: `hsl(var(--*))` tokens (Button, Card, Badge…).
