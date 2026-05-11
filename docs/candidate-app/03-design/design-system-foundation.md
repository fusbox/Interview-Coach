# Design System Foundation

Date: 2026-05-10
Status: Current truth

## Purpose

This document captures the candidate app design system now ported into the shared Postgres-migrated app repo. The recruiter app already has a mature HSL/shadcn token foundation, so the candidate system is implemented as a scoped RGB bridge instead of replacing the shared app tokens.

## Implementation Files

- Candidate public landing page: [src/app/page.tsx](../../../src/app/page.tsx)
- Shared app styles and candidate bridge: [src/index.css](../../../src/index.css)
- Root layout and hydration suppression: [src/app/layout.tsx](../../../src/app/layout.tsx)
- Candidate shell primitives: [src/components/shell](../../../src/components/shell)
- Candidate UI primitives: [src/components/ui/ActionButton.tsx](../../../src/components/ui/ActionButton.tsx), [src/components/ui/FormField.tsx](../../../src/components/ui/FormField.tsx), [src/components/ui/PageIntro.tsx](../../../src/components/ui/PageIntro.tsx), [src/components/ui/SurfaceCard.tsx](../../../src/components/ui/SurfaceCard.tsx)
- Candidate navigation and mock data: [src/lib/navigation.ts](../../../src/lib/navigation.ts), [src/lib/mock-data.ts](../../../src/lib/mock-data.ts)
- Design-system demo overlay: [src/components/demo/DesignSystemDemoOverlay.tsx](../../../src/components/demo/DesignSystemDemoOverlay.tsx)

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
- `--candidate-muted`
- `--candidate-placeholder`
- `--candidate-primary`
- `--candidate-primary-soft`
- `--candidate-secondary-brand`
- `--candidate-secondary-soft`
- `--candidate-accent`
- `--candidate-accent-soft`
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

The shared repo currently uses `Inter` for body text and `Outfit` for display text in [src/app/layout.tsx](../../../src/app/layout.tsx). The earlier standalone candidate repo referenced `Space Grotesk` and `Manrope`; that direction is not currently active in the shared repo.

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

## Hydration Baseline

The root layout uses `suppressHydrationWarning` on `<html>` because browser tools can inject attributes such as `data-scribe-recorder-ready` before React hydrates. That warning is low-risk when it is limited to an extension-injected root attribute. Component-level hydration mismatches, dynamic dates, random values, invalid HTML nesting, or differing server/client branches should still be investigated and fixed.

## Usage Rules

- Keep recruiter/admin/QA pages on the existing shared HSL token system unless there is an explicit shared-design refactor.
- Use candidate-prefixed tokens or the candidate utility classes for candidate routes.
- Do not redefine `--primary`, `--surface`, `--muted`, or other shared token names inside candidate wrappers.
- Promote new patterns into shared candidate primitives only after they appear in more than one candidate surface or protect an important consistency rule.
- Prefer single-column stacked sections for candidate explanatory content unless a product workflow truly benefits from side-by-side comparison.
