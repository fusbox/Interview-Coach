# Design System Foundation

Status: Current production UI contract
Last updated: 2026-07-27

## Purpose

Interview Coach uses one lean visual system across public, candidate-led, invited-candidate, recruiter, admin, and QA surfaces. There is no candidate/recruiter token dialect, wrapper class, or permanently parallel component language.

This document governs runtime installation. Product behavior remains governed by [SPEC](../SPEC.md), [DATA_CONTRACT](../DATA_CONTRACT.md), and the subsystem contracts linked from [HANDOFF](../HANDOFF.md).

## Source Order

When design artifacts disagree, use this order:

1. `Design System Reference.dc.html` from the latest local `design-system/Design system maturation.zip` authoring snapshot for visual intent and role vocabulary.
2. Tracked files under [design-system/tokens](../../design-system/tokens) for executable values and utilities.
3. The reference screen files in the maturation package for composition and responsive examples.
4. Package readmes, manifests, gap logs, and generated support material only when they agree with the first three sources.

The gap log is discovery input, not a ratified specification. Reference screens illustrate presentation; they do not override route, data, state, safety, or accessibility contracts.

The ZIP is local authoring input, not a runtime dependency or committed artifact. Do not extract it over the tracked folder. Reconcile upstream values into the unprefixed RGB runtime contract and preserve deliberate app-side adaptations such as the compatibility layer and canonical import order.

## Folder Boundary

The tracked `/design-system` folder is active, but not every file in it has the same status:

- `styles.css` and `tokens/*` are active runtime inputs;
- `tokens/legacy-compat.css` is active but transitional;
- a local maturation ZIP is the latest upstream authoring snapshot;
- older generated components, guidelines, UI kits, explorations, bundles, manifests, and support files are historical or transitional reference material unless explicitly reconciled into runtime code.

## Runtime Installation

[design-system/styles.css](../../design-system/styles.css) is the single global entry point imported before [src/index.css](../../src/index.css). Its canonical load order is:

1. `fonts.css`
2. `colors.css`
3. `typography.css`
4. `shape.css`
5. `elevation.css`
6. `motion.css`
7. `roles.css`
8. `spacing.css`
9. `layout.css`
10. `accessibility.css`
11. `utilities.css`

`legacy-compat.css` loads last as temporary migration support for provisional UI. It is not a design source and must not receive new production styling. Remove each compatibility role when its remaining consumer is replaced.

## Global Token Contract

- Token names are unprefixed and app-wide: `--background`, `--primary`, `--surface`, `--foreground`, and related role names.
- Runtime color values are bare RGB triplets, consumed as `rgb(var(--token) / alpha)`.
- Tailwind maps to the same RGB contract and keeps `<alpha-value>` support for utilities such as `bg-primary/90`.
- OKLCH is encouraged for palette authoring and perceptual calibration. Committed runtime values are converted to the supported sRGB result and stored as RGB triplets.
- No surface should introduce HSL, OKLCH, hex, or a second namespaced token dialect as a runtime token format.
- Raw values in the large provisional [src/index.css](../../src/index.css) remain migration debt, not permission to add more. Production surface passes should replace them with role tokens rather than mechanically preserving them.

## Visual Intent

- Body and interface text use Atkinson Hyperlegible Next. Display text uses IBM Plex Sans.
- A view has at most one spotlight surface, supported by feature and calm surfaces. Lower-prominence content should use negative space before another card.
- Green is a mark, signal, or selected-state accent. It is not a default full-surface color.
- Children placed on colored surfaces use the glass-on-color treatment rather than opaque nested cards.
- Primary and secondary workflow buttons share the 44px pill baseline unless a distinct control role is documented.
- A primary action placed directly on a spotlight or other saturated brand surface uses `.on-color-action`: an opaque white surface, solid brand-blue text, and the shared compact CTA elevation. This is a contrast affordance, not a glass child.
- Use the tracked eyebrow pattern for section-level labels and `label-micro` for dense in-component metadata.
- The preparedness ramp is `not practiced`, `emerging`, `clear`, and `strong`. It progresses from neutral slate through warm and green hues without using red or exposing a numeric score.
- Author against semantic role tokens for shape, elevation, motion, spacing, and color. Drop to a primitive only when no role fits and record a reusable gap when the exception recurs.
- The non-pill surface ramp is 12/16/24/32px with no 28px tier: 12px for inputs and short surfaces, 16px for nested cards and selection controls, 24px for standard outer surfaces and coach-voice surfaces, and 32px for spotlights and other singular focus regions. Pills, chips, circles, and authored identity marks retain their own role-specific silhouettes.

## Layout And Surface Roles

The global layout primitives are:

- `.app-grid` for the centered 76rem broad-workspace frame;
- `.app-grid--workflow` with `.app-grid` for a centered 70rem builder or transactional frame with a primary column and compact context rail;
- `.app-grid--form-flow` with `.app-grid` for a centered 56rem sequential setup or creation flow;
- `.app-grid--focused` with `.app-grid` for a centered 64rem session, landing, summary, or review frame;
- `.grid-12` for responsive 12-column composition;
- `.section-space` for route-level vertical rhythm.

These values are fluid ceilings, not fixed page widths. Full-width canvas or brand surfaces may remain edge-to-edge while their content uses the appropriate frame. Reading text still needs its own narrower measure inside any frame. Select the frame from the page job and simultaneous information density rather than stretching every desktop route to the broad workspace.

Form flows author hierarchy through semantic spacing roles rather than page-local values: `--gap-field` for label/control/help relationships, `--gap-cluster` for related blocks, `--gap-section` for major subsections, `--gap-workflow` for sequential decisions, `--pad-card` for ordinary card interiors, and `--pad-panel` for larger setup or debrief regions. A progress stepper spans the selected form-flow frame. A continuous vertical variant places its numbered rail beside each section, distinguishes upcoming, visited, active, and completed states, and updates the active state from scroll arrival without hiding downstream content.

The primary surface roles are:

- `.surface-spotlight`
- `.surface-feature-tint`
- `.surface-feature-dark`
- `.surface-calm`
- `.surface-coach-quiet`
- `.surface-plan`
- `.on-color-glass`
- `.on-color-glass-strong`
- `.on-color-action`

Older `.surface-base`, `.surface-elevated`, `.surface-blue`, `.surface-orange`, and `.surface-sky` classes remain compatibility inputs only. Do not use them for newly productized surfaces.

## Implementation Rules

- Consume the same tokens on every audience surface; audience differences come from product meaning and composition, not a second palette.
- Keep behavior, state derivation, persistence, and authorization outside presentation primitives.
- Preserve loading, empty, partial, failure, retry, conflict, unauthorized, and recovered states while replacing provisional markup.
- Promote a pattern into a shared primitive when it recurs or protects an important consistency/accessibility rule.
- Treat a surface-specific exception as deliberate debt with a named removal or promotion trigger.
- Apply depth through semantic elevation roles. `--elevation-cta` is reserved for primary actions and resolves to a short neutral-first drop shadow with a restrained blue tint; selected controls use fill and contour, not CTA elevation.
- Use `.surface-coach-quiet` only for reviewed coaching that remains available as quiet dashboard history: opaque powder blue with blue ink in light mode, deep ink blue with light ink in dark mode, short row elevation, and no backdrop blur. It is not a preparedness state or a second spotlight.
- Use `.surface-plan` for the closed-home Coach Plan reference object: opaque matte blue with white ink, no visible border or backdrop blur, panel elevation, and one restrained inset contour. The same role must render the complete Plan Dial and its legend in every closed dashboard composition; do not maintain a separate pulse or glass variant.
- Coach identity is semantic rather than decorative. Explicit neutral coach interpretation uses the `surface` compass variant in the shared circular surface frame; the calm variant remains appropriate on blue spotlight surfaces and CTA remains a separate authored treatment. Generic processing/success states and utility headers use ordinary state or navigation affordances instead of a coach avatar.
- Use `.untracked/ui-lab` for interactive visual exploration. Do not add mock routes under `src/app`.

## Verification

A foundation or shared-token change must verify:

- the canonical import order;
- no active `--candidate-*` tokens or `.candidate-design-system` wrapper;
- no mixed runtime color formats in `design-system/tokens`;
- Tailwind token and opacity behavior;
- focused component tests, typecheck, lint, and production build;
- responsive and accessibility checks when a product surface is changed.
