# Design System Foundation

Date: 2026-07-06
Status: Current truth

## Purpose

This document captures the candidate app design-system source now tracked in the shared Postgres-migrated app repo. The recruiter app already has a mature HSL/shadcn token foundation, so candidate implementation should keep the scoped RGB bridge for job-seeker surfaces while using the tracked design-system files as the broader source of truth.

The full design-system pack has been brought over from `.untracked/design-system` into tracked `design-system/`. That directory is the canonical imported source for V2 rebuild work. Production app code under `src` should consume or promote pieces deliberately from `design-system/` as each UI slice requires them, rather than maintaining a second hand-translated copy of the whole system.

## Implementation Files

- Full design-system source: [design-system](../../../design-system)
- Candidate public landing page: [src/app/page.tsx](../../../src/app/page.tsx)
- Shared app styles and candidate bridge: [src/index.css](../../../src/index.css)
- Root layout and hydration suppression: [src/app/layout.tsx](../../../src/app/layout.tsx)
- Candidate shell primitives: [src/components/shell](../../../src/components/shell)
- Candidate UI primitives: [src/components/ui/ActionButton.tsx](../../../src/components/ui/ActionButton.tsx), [src/components/ui/FormField.tsx](../../../src/components/ui/FormField.tsx), [src/components/ui/PageIntro.tsx](../../../src/components/ui/PageIntro.tsx), [src/components/ui/SurfaceCard.tsx](../../../src/components/ui/SurfaceCard.tsx)
- Candidate navigation and mock data: [src/lib/navigation.ts](../../../src/lib/navigation.ts), [src/lib/mock-data.ts](../../../src/lib/mock-data.ts)
- Design-system demo overlay: [src/components/demo/DesignSystemDemoOverlay.tsx](../../../src/components/demo/DesignSystemDemoOverlay.tsx)

The last three bullets describe prior shared-repo integration targets from the pre-reset app. In the V2 cleanroom branch, those app components should be reintroduced only when a numbered slice needs them.

## Token Strategy

The shared app keeps its existing HSL tokens such as `--background`, `--primary`, `--surface-base`, and `--text-primary`. These continue to support recruiter/admin/QA pages and shadcn-style components.

The candidate system uses RGB triplet tokens with a `--candidate-*` prefix:

- `--candidate-background`
- `--candidate-surface`
- `--candidate-surface-subtle`
- `--candidate-surface-alt`
- `--candidate-surface-elevated`
- `--candidate-border`
- `--candidate-foreground`
- `--candidate-display-foreground`
- `--candidate-muted`
- `--candidate-placeholder`
- `--candidate-primary`
- `--candidate-primary-soft`
- `--candidate-primary-wash`
- `--candidate-secondary-brand`
- `--candidate-secondary-soft`
- `--candidate-accent`
- `--candidate-accent-soft`
- `--candidate-accent-wash`
- `--candidate-success`

This avoids a subtle but dangerous class of bugs: Tailwind classes like `bg-primary` are compiled as `hsl(var(--primary))` in this repo, while the candidate prototype consumed `rgb(var(--primary))`. Prefixing candidate tokens lets both systems coexist.

## Layout Primitives

The ported candidate layout utilities are:

- `.candidate-design-system` for candidate route boundaries.
- `.app-grid` for the shared max-width rail.
- `.grid-12` for 12-column composition.
- `.section-space` for consistent vertical rhythm.

Candidate routes should wrap feature surfaces in `.candidate-design-system` before using candidate primitives.

## Surface Primitives

The candidate surface utilities are:

- `.surface-base`
- `.surface-elevated`
- `.surface-blue`
- `.surface-orange`
- `.surface-sky`

`surface-sky` keeps the prototype's exact blue gradient:

```css
linear-gradient(135deg, rgba(246, 250, 255, 0.98), rgba(232, 241, 255, 0.92))
```

The shadow is intentionally reduced from the prototype because the original lift felt too distant on the shared landing page.

## Typography Primitives

The ported typography utilities are:

- `.eyebrow`
- `.display-hero`
- `.section-title`
- `.copy-lg`
- `.copy-sm`
- `.feature-title`
- `.feature-body`

Display-scale typography uses `--candidate-display-foreground`, a lighter ink value for larger text. Smaller foreground text continues to use the darker `--candidate-foreground` for crisp body and component copy.

The candidate design system now uses `Atkinson Hyperlegible Next` for body and UI text and `IBM Plex Sans` for display text, as defined in [design-system/tokens/fonts.css](../../../design-system/tokens/fonts.css). Candidate surfaces should preserve that pairing unless a later design-system decision changes it; do not fall back to the earlier Inter/Outfit or Space Grotesk/Manrope prototype pairings by accident.

## Component Primitives

The candidate component set now available in the shared repo includes:

- `CandidateShell`
- `CandidateSidebar`
- `CandidateMobileDock`
- `ActionButton`
- `FieldGroup`, `FieldLabel`, `FieldHint`, `textFieldClassName`, `textareaFieldClassName`
- `PageIntro`
- `SurfaceCard`
- `DesignSystemDemoOverlay`

The copied components were adapted to candidate-prefixed RGB tokens so they do not depend on or overwrite recruiter token semantics.

## Focused Session Composition

The production typed-session shell establishes a shared candidate/invited composition over audience-neutral runtime facts:

- a compact sticky context header constrained by `--layout-session-max`, with role, current-question text, safe exit, and segmented progress;
- a stable question stage using `--candidate-primary-wash`, a low-contrast primary border, and `--radius-session` on larger screens without card elevation;
- one white response composer using `--radius-card` and `--elevation-card` without an additional visible border;
- one immediate-coaching surface using the same primary wash and border language without side stripes, nested cards, or provider-internal progress claims;
- a compact saved-answer disclosure once coaching is present, keeping the candidate's accepted words recoverable while giving coaching the stronger reading emphasis.

The session shell presents mode controls only when an adapter declares more than one usable answer mode. Disabled voice, recording, photo, or other future controls are not placeholders. The stateful shell and staged-feedback components remain the implementation primitive; route adapters own persistence, evaluator, completion, and audience-specific return behavior.

## Candidate Dashboard Composition

The production candidate home uses the 12-column app grid as a responsive bento composition over durable dashboard facts:

- the selected role is the page title beneath a compact `Practice home` label;
- one state-priority module receives the dominant footprint: active round, unseen Coach Update, Practice Next, or executable Coach Plan progress;
- supporting Coach Update, Practice Next, and Coach Plan modules remain visible when truthful but do not receive equal action emphasis;
- Coach Update uses primary-blue surfaces, Practice Next uses viridian wash surfaces, and Coach Plan uses a neutral reference surface unless it owns the next move;
- `--radius-widget`, semantic icon capsules, and the established card/widget elevation roles provide component consistency;
- full-surface color, spacing, and footprint establish hierarchy; dashboard widgets do not use colored side stripes, score-like gauges, or generic metric rails.

The sticky header is a separate utility layer: white candidate-initial identity badge, opaque prep-context selector, and authoritative next-round draft trigger/count. Activity counts may appear inside the context menu as ownership-safe context, but no context-switcher or home-surface color implies preparedness, mastery, or evaluator bands.

Dashboard secondary surfaces extend the same semantic language without becoming miniature dashboards:

- Coach Update is a top-anchored responsive review sheet. Its current question card pairs a primary-blue **What I noticed** region with a viridian **Try next** region; the color contrast separates feedback from feedforward and never communicates a performance band.
- Coach Plan is a neutral reference layer. Exact practiced/baseline counts are allowed, but category selection uses count-and-status text rather than progress bars that could be mistaken for scores.
- Practice actions reuse one source component: the immediate action is primary blue, while the durable queue toggle is a quieter bordered control with a viridian selected state.
- The next-round builder keeps the ratified persistent-header morph, centered carried-over label/count, header-owned `Start practice`, candidate-owned authoritative notices, keyboard/touch reorder controls, and equal-width `Cancel` / `Clear all` footer actions.
- Responsive dialogs preserve focus trapping, Escape and tapaway close at the top level, focus return, reduced-motion behavior, and no horizontal overflow at the 390px mobile floor.
- Answer transcript annotation is not a decorative design primitive. It becomes available only when a read model supplies exact accepted evaluator evidence spans for the displayed text.

## Button Shape Guidance

The shared `Button` primitive supports newer `emphasis`, `density`, `shape`, and `label` props while still carrying older `variant` and `size` props. New candidate work should prefer the newer props.

Use `shape="app"` for primary and secondary workflow actions inside app surfaces, including setup submission, dashboard navigation, feedback actions, and summary navigation. This maps to the taller rounded-2xl button treatment and should be the default for candidate product flows.

Use `shape="pill"` for compact chips, mode toggles, filter-like controls, and public/marketing-style CTA clusters where the pill shape communicates selection or lightweight navigation. Avoid using pill buttons for major app workflow actions unless the surrounding component is intentionally chip-like.

Use `shape="square"` for icon-only or utility controls.

The current codebase still contains a mix of legacy `rounded-md`, manual `rounded-xl`, `shape="pill"`, and `shape="app"` usage across recruiter, candidate, admin, and QA surfaces. This is acceptable during candidate integration, but new dashboard and practice work should follow the shape roles above so button emphasis remains predictable.

## Hydration Baseline

The root layout uses `suppressHydrationWarning` on `<html>` because browser tools can inject attributes such as `data-scribe-recorder-ready` before React hydrates. That warning is low-risk when it is limited to an extension-injected root attribute. Component-level hydration mismatches, dynamic dates, random values, invalid HTML nesting, or differing server/client branches should still be investigated and fixed.

## Live Mockup Isolation

Do not add new design mockups under `src/app`, even when their route returns 404 in production. Next still compiles, type-checks, and lints those modules, so experimental imports, copy, and component APIs can block the production build.

Use a separate `.untracked/ui-lab` Vite app for interactive React page mockups:

- keep its own `package.json`, lockfile, TypeScript config, Vite config, entrypoint, and fixture data;
- keep `.untracked` gitignored and excluded from the production root TypeScript project before introducing TS/TSX there;
- run it independently with `npm --prefix .untracked/ui-lab run dev` on a nonproduction port;
- consume exported design tokens, fonts, icons, and copied/pure presentational primitives only;
- never import Next routes, server modules, repositories, authentication, database clients, environment access, or provider runtimes;
- use synthetic fixture JSON with no real candidate, recruiter, invite, resume, answer, or coaching data;
- let mockups explore layout, interaction, responsive behavior, and content hierarchy without asserting that their data or product claims exist;
- promote a result through spec decision first, then implement it against production contracts rather than moving the mockup route wholesale.

Static HTML design studies may remain under `docs/candidate-app/03-design` because the root TypeScript config already excludes `docs`. Existing `src/app/candidate/*-demo` routes are transitional inputs only; do not use them as the pattern for new mockups, and move or retire them once equivalent UI-lab studies are preserved.

## Usage Rules

- Keep recruiter/admin/QA pages on the existing shared HSL token system unless there is an explicit shared-design refactor.
- Use candidate-prefixed tokens or the candidate utility classes for candidate routes.
- Do not redefine `--primary`, `--surface`, `--muted`, or other shared token names inside candidate wrappers.
- Promote new patterns into shared candidate primitives only after they appear in more than one candidate surface or protect an important consistency rule.
- Prefer single-column stacked sections for candidate explanatory content unless a product workflow truly benefits from side-by-side comparison.
- Keep live mockups outside the production app tree and require an explicit spec/promotion pass before their ideas enter runtime code.
