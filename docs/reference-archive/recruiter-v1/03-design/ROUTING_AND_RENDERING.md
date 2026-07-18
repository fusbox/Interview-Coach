# ROUTING_AND_RENDERING.md

Purpose: define the current routing boundary for the session experience so route handling stays boring and the candidate UI remains state-driven.

---

## Core Definitions

### Route entry

In the current app, the route entry point is a Next.js App Router page or layout that:
- reads route params
- validates or resolves entry inputs
- bootstraps session context
- renders the session shell

Current examples:
- `src/app/(candidate)/s/[token]/page.tsx`
- `src/app/(candidate)/s/[token]/layout.tsx`

### Screen

A Screen is a coherent state-driven UI surface inside the session experience. A Screen:
- renders one meaningful phase of the session
- reads derived session state
- calls session actions through context/hooks
- does not own URL progression

Current examples:
- `InitialsScreen`
- `LandingScreen`
- `UnifiedSessionScreen`
- `SummaryScreen`

---

## Rule Of Flow

Routes choose entry points.  
Entry points bootstrap session state.  
Derived state chooses screens.  
Screens do not choose routes.

---

## Current Rendering Model

The live app renders the candidate experience from persisted session state plus derived `now` state.

High-level algorithm:

1. Candidate opens `/s/[token]`
2. The entry route resolves token-scoped session access
3. Session state is loaded into context
4. `selectNow()` derives the current screen/state contract
5. `SessionOrchestrator` renders the correct screen from derived state
6. Screen actions mutate session state through APIs/context
7. UI changes because state changed, not because the route changed

Key implementation references:
- `src/lib/state/selectors.ts`
- `src/features/session/context/SessionContext.tsx`
- `src/features/session/components/SessionOrchestrator.tsx`

---

## Current File And Responsibility Model

### Route-layer responsibilities

Allowed:
- parse invite token / route params
- perform entry-time session bootstrap
- render candidate shell / provider tree
- handle route-level access failures

Not allowed:
- encode question progression in the URL
- move question/review/summary state into route structure
- duplicate screen-selection logic in multiple places

### Screen-layer responsibilities

Allowed:
- read derived session state
- call context actions such as start, submit, retry, complete
- open overlays and compose UI sections

Not allowed:
- change the route to advance the session
- depend on URL shape for current question or review state
- become the source of truth for resumability

---

## Current URL Policy

Allowed:
- `/s/[token]`
- diagnostic query params in development when explicitly needed

Not allowed:
- `/s/[token]/q/[index]`
- `/s/[token]/screen/[screen]`
- any route scheme that encodes retries, evaluation state, or session progress

Reason:
- refresh/resume comes from persisted session state
- the URL identifies the session access point, not the current step within the session

---

## Refresh And Resume Contract

Invariant:
- reopening the invite link should restore the candidate to the correct live session state

Current mechanism:
- authoritative session state is fetched from the server
- derived `now` state selects the visible screen
- the candidate stays on the same entry route while state changes underneath

---

## Anti-Patterns

- router-driven question progression
- screen components importing router hooks to advance the session
- duplicating screen selection outside the orchestrator/state model
- building new flows that depend on URL reconstruction instead of persistence

Treat these as bugs unless there is an explicit architectural decision to change the model.

---

## Practical Guidance For New Development

- if you add a new session phase, first decide how it will appear in derived state
- keep route changes for access and shell concerns, not session progression
- prefer updating selectors/orchestrator over adding route branches for in-session UI changes

---

## Acceptance Criteria

This model is being respected when:

- the candidate session experience stays on `/s/[token]` while progressing
- refreshing the invite link restores the correct UI state
- route files remain thin entry/bootstrap layers
- screens remain state-driven and route-agnostic
