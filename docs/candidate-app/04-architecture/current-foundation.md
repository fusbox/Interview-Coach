# Current Foundation

Date: 2026-05-08
Status: Current truth

## Purpose

This document records the intentionally implemented foundation of the candidate-led app. It should describe what exists now, not speculative architecture that may or may not be built later.

## Non-Negotiable Patterns

### Candidate-first shell

- Landing concerns and authenticated app-shell concerns are separated with route groups.
- The candidate app shell owns navigation, layout, and module boundaries.
- Reused session logic should sit below the app-shell boundary, not define it.

### Current-truth documentation

- Architecture docs should describe live structure and active decisions.
- Future ambitions should be captured separately as future-state notes, not mixed into current contracts.

### Shared navigation by configuration

- Suite navigation and interview-only nested navigation are centralized in one config module.
- Sidebar and mobile dock render from the same navigation source instead of duplicating labels and URLs.

### Explicit ownership boundaries

- Candidate setup, dashboard, and session ownership belong to the candidate module, even though deployment now targets the shared Interview Coach host.
- Cross-app concerns such as shared identity should be consumed through stable contracts rather than improvised in feature code.

### Design system starts small and operational

- Core colors are defined as CSS variables.
- Shell, card, and navigation patterns are implemented as reusable primitives before feature depth is added.
- The system is intentionally small enough to follow consistently.

## Implemented Structure

Current route files:

- [src/app/page.tsx](/c:/dev/Interview-Coach-Candidate/src/app/page.tsx)
- [src/app/(candidate)/layout.tsx](/c:/dev/Interview-Coach-Candidate/src/app/(candidate)/layout.tsx)
- [src/app/(candidate)/practice/page.tsx](/c:/dev/Interview-Coach-Candidate/src/app/(candidate)/practice/page.tsx)
- [src/app/(candidate)/dashboard/page.tsx](/c:/dev/Interview-Coach-Candidate/src/app/(candidate)/dashboard/page.tsx)
- [src/app/(candidate)/summary/page.tsx](/c:/dev/Interview-Coach-Candidate/src/app/(candidate)/summary/page.tsx)
- [src/app/(candidate)/session/[sessionId]/page.tsx](/c:/dev/Interview-Coach-Candidate/src/app/(candidate)/session/[sessionId]/page.tsx)

Current shared folders and files:

- [src/components/shell](/c:/dev/Interview-Coach-Candidate/src/components/shell)
- [src/components/ui](/c:/dev/Interview-Coach-Candidate/src/components/ui)
- [src/lib/cn.ts](/c:/dev/Interview-Coach-Candidate/src/lib/cn.ts)
- [src/lib/navigation.ts](/c:/dev/Interview-Coach-Candidate/src/lib/navigation.ts)
- [src/index.css](/c:/dev/Interview-Coach-Candidate/src/index.css)

## What This Foundation Avoids

- recruiter-oriented route structure inside candidate feature code
- speculative event architectures documented as current invariants
- identity assumptions hidden in UI code
- scattered navigation definitions
- design rules that exist only in prose

## Deployment Context

This repo remains the candidate incubation workspace. The deployable implementation target is now an Azure branch in the existing Interview Coach project, with routing governed by the [Shared Host Routing Contract](./shared-host-routing-contract.md) and [ADR-0006](../08-decisions/ADR-0006-shared-host-and-azure-branch-integration.md).

The current files here should be treated as source material to port into that shared app, not as a separate production deployment artifact.

## Next Logical Slice

The next implementation slice should be practice setup, not deeper shell refactoring.

That slice should add:

- setup form schema
- candidate-owned session creation boundary
- resume-text normalization contract
- placeholder application service interfaces for session start and session resume
- persisted draft/session screen-state contract for resume-across-refresh and resume-across-device
