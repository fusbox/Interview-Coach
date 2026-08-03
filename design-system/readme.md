# Interview Coach Design System

This folder contains the active app-wide runtime design system. Local authoring inputs remain ignored outside the tracked runtime tree.

## Active Runtime

The application imports `design-system/styles.css` from `src/app/layout.tsx`. That entry point loads the canonical token files under `design-system/tokens/` before the provisional application CSS in `src/index.css`.

The active contract is:

- one unprefixed token namespace for every app audience;
- RGB triplet runtime colors consumed through `rgb(var(--token) / alpha)`;
- Atkinson Hyperlegible Next for body and interface text;
- IBM Plex Sans for display text;
- semantic role tokens for color, type, spacing, shape, elevation, motion, and layout;
- `legacy-compat.css` only as temporary support while provisional surfaces are replaced.

See `docs/03-design/design-system-foundation.md` for the governing installation and migration rules.

## Claude Design Authoring Snapshot

`Design system maturation.zip`, when present locally, is the latest Claude Design project export supplied for reconciliation. It is an upstream design input, not a runtime dependency and not a file to commit.

Within that package:

1. `Design System Reference.dc.html` is the strongest source of visual intent and role vocabulary.
2. Named screen files are composition references. They may be mature without being finalized.
3. `_ds/.../tokens/*` shows the authoring system's current executable values.
4. Package readmes, manifests, bundles, support files, uploads, scraps, and `gap-log.md` are noncanonical discovery material.

Do not extract the package over this folder wholesale. The authoring export can still contain retired candidate-prefixed names, mixed color formats, generated metadata, or illustrative behavior. Reconcile meaningful changes into the active global token contract instead.

## Current Production References

The latest local authoring snapshot includes mature-but-not-final mobile references for:

- `/candidate/setup`;
- the initial `/candidate/dashboard` view;
- the candidate session landing screen;
- the active candidate question screen.

These references guide production composition and responsive intent. They do not override route behavior, persistence, authorization, evaluator meaning, recovery states, accessibility, or the complete state matrix.

## Retired Authoring Material

The older component specimens, guidelines, UI kits, explorations, generated bundles, support files, and duplicate assets are retired from the current tree and remain available through Git history. Reintroduce a pattern only by reconciling it into the runtime token contract or production code.

`tokens/legacy-compat.css` remains imported as migration support. Do not add new production design decisions there.

## Reconciliation Workflow

For each new authoring snapshot:

1. Inspect the latest Design System Reference and named screen files.
2. Compare `_ds/styles.css` and `_ds/tokens/*` with the active runtime files.
3. Port only meaningful design changes, adapting them to the unprefixed RGB contract.
4. Verify token coverage, import order, Tailwind mappings, focused tests, typecheck, lint, and build as appropriate.
5. Record newly accepted surface direction in `docs/03-design/production-ui-workstream.md` or the governing surface contract.
