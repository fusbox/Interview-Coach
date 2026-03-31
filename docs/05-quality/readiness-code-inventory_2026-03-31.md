# Readiness Code Inventory

Date: 2026-03-31
Status: Inventory plus implementation update
Owner: Codex review pass

## Purpose

This document inventories all meaningful readiness-related implementation in the current recruiter-led app and recommends how to handle each area given the current conservative product posture.

The goal is not to erase useful work. The goal is to separate:

- live product coupling that should be refactored out of current flows
- dormant or internal-only readiness code that can be quarantined
- low-cost primitives that may be worth keeping if renamed or generalized

## Executive Summary

The largest active readiness coupling is not in the recruiter dashboard. It is in the AI service and the core session/analysis domain model.

At a high level:

- `AIService` currently computes and injects explicit readiness labels into answer analysis metadata and uses readiness language in summary-generation prompts.
- Session and analysis domain types, schemas, and persistence still treat readiness as part of the live data contract.
- Most recruiter-facing readiness interpretation appears dormant, stubbed, or internal-only.
- Several UI primitives and summary copy paths still carry readiness wording that no longer matches the intended product exposure.

Recommended posture:

1. Remove readiness from active user-facing and recruiter-facing product flows.
2. Quarantine internal/dev-only readiness tooling instead of deleting it immediately.
3. Preserve only neutral primitives that are still broadly useful after renaming or genericization.

## Implementation Update

As of the latest cleanup pass, the main recommendation in this document has been partially implemented.

Completed:

- active candidate-facing readiness wording was removed from the summary experience and AI prompt framing
- dormant recruiter/dev readiness surfaces were explicitly marked as internal-only calibration tooling
- session-level readiness was removed from the live `InterviewSession` contract, runtime schemas, and repository mapping

Intentionally retained:

- hidden per-answer calibration metadata via `analysis.meta.readinessLevel`
- internal/dev evaluation and export support that depends on that hidden metadata

Still open:

- readiness-specific design tokens and badge variants remain available in the design layer and can be genericized later if desired
- database-level `readiness_band` storage may still exist physically even though it is no longer mapped into the live app contract

## Classification Legend

- `Keep`: acceptable in current app as-is
- `Genericize`: keep the capability, but remove readiness-specific framing
- `Quarantine`: preserve for internal/future use, but remove from current-truth architecture and active product expectations
- `Remove-later`: plan a code cleanup/removal pass after adjacent dependencies are unwound

## Inventory

### 1. Live Domain and AI Coupling

These files are the most important readiness-related implementation because they affect current behavior and data contracts.

#### `src/lib/server/services/ai-service.ts`

Observed coupling:

- Computes `RL1` to `RL4` via `calculateReadiness(...)`
- Injects `meta.readinessLevel` into per-answer analysis results
- Uses readiness wording in prompt guidance for follow-up behavior
- Uses readiness wording in session summary prompting
- Provides readiness-coded fallback metadata in degraded paths

Why it matters:

- This is active behavior, not historical residue
- It shapes both model output and downstream metadata
- Any attempt to remove readiness from the product without touching this file will be incomplete

Recommendation:

- `Genericize` the hidden scoring logic if it still helps with quality calibration
- `Remove-later` explicit `RL*` labels from answer metadata
- `Remove-later` readiness-specific wording from prompts and summaries

Suggested target state:

- internal scoring may remain hidden if it improves AI consistency
- public/current contracts should not expose readiness labels or readiness-band semantics

#### `src/lib/domain/types.ts`

Observed coupling:

- `AnalysisResult.meta.readinessLevel?: string`
- `InterviewSession.readinessBand?: string | null`

Why it matters:

- These fields make readiness part of the live domain model
- They encourage downstream use even where the feature is no longer product-valid

Recommendation:

- `Remove-later`

Suggested target state:

- remove readiness from the core domain model unless a live shipped feature truly depends on it
- if internal scoring survives, keep it internal to service/application layers rather than in shared product-facing types

#### `src/lib/domain/schemas.ts`

Observed coupling:

- `AnalysisResultSchema.meta.readinessLevel`
- `InterviewSessionSchema.readinessBand`
- `UpdateSessionSchema.readinessBand`

Why it matters:

- Schemas reinforce readiness as part of the runtime contract
- These fields will block a clean contract simplification unless updated together with the types

Recommendation:

- `Remove-later`

Suggested target state:

- align schema cleanup with type cleanup and persistence cleanup in one coordinated pass

#### `src/lib/server/infrastructure/supabase-session-repository.ts`

Observed coupling:

- reads `readiness_band` from persistence
- writes `readiness_band` back to persistence

Why it matters:

- This is the persistence layer backing the session-level readiness contract
- It keeps readiness attached to the session aggregate even though the app no longer meaningfully uses it in the main recruiter product

Recommendation:

- `Remove-later`

Suggested target state:

- stop reading/writing `readiness_band` once all callers and schemas have been updated
- database migration can be deferred until application cleanup is complete

### 2. Dormant Recruiter Interpretation and Dev Tooling

These files preserve meaningful work, but they do not appear to represent the current shipped product.

#### `src/lib/services/dashboard-constitution.ts`

Observed coupling:

- readiness-oriented interpretation scaffolding
- references to strong signals tied to `RL3` and `RL4`
- implementation remains largely stubbed

Why it matters:

- This is conceptual weight without corresponding live product behavior
- Keeping it active in current-truth docs would misrepresent the app

Recommendation:

- `Quarantine`

Suggested target state:

- treat as dormant future-use logic or move to an internal archive area if retained

#### `src/app/(recruiter)/recruiter/dev-eval/types.ts`
#### `src/app/(recruiter)/recruiter/dev-eval/components/SessionEvalForm.tsx`
#### `src/app/(recruiter)/recruiter/dev-eval/export-utils.ts`
#### `src/app/api/dev/export-session/[sessionId]/route.ts`

Observed coupling:

- evaluation rubric includes readiness-level accuracy
- exports include answer readiness metadata
- internal UI displays aggregate and AI readiness fields

Why it matters:

- this is internal/dev-only tooling, not primary product UX
- it may still be useful for experimentation, audits, or future evaluation work

Recommendation:

- `Quarantine`

Suggested target state:

- explicitly label this surface as internal evaluation tooling
- do not let it define the public or product-facing truth of the app
- if dev-eval remains active, decide later whether it should assess readiness, generic calibration quality, or neither

### 3. Candidate-Facing Copy and Presentation Residue

These files affect what candidates see or how current UI concepts are framed.

#### `src/features/session/components/SummaryScreen.tsx`

Observed coupling:

- stock narratives include readiness-heavy language
- loading/skeleton section still frames part of the experience as readiness-related
- footer copy references workforce readiness

Why it matters:

- this is visible product language
- even if the underlying algorithm remains internal, visible readiness language signals a product promise and interpretation layer that the current app is not trying to expose

Recommendation:

- `Genericize` or `Remove-later` depending on the specific string

Suggested target state:

- emphasize strengths, growth areas, and next steps without readiness-band framing
- treat brand copy separately from product classification language

#### `src/features/session/components/SummaryUtilities.ts`

Observed coupling:

- readiness wording influences icon/title heuristics

Why it matters:

- low-risk, low-value coupling

Recommendation:

- `Remove-later`

### 4. UI Primitives and Style Tokens

These are not the source of product drift, but they do encode readiness language into the design layer.

#### `src/components/patterns/StatusBadge.tsx`
#### `src/components/ui/badge.tsx`
#### `src/index.css`

Observed coupling:

- readiness-specific badge variants
- readiness color tokens
- readiness-oriented semantic naming

Why it matters:

- design primitives outlive individual features
- readiness naming in primitives encourages future accidental reuse and weakens semantic clarity

Recommendation:

- `Genericize`

Suggested target state:

- convert readiness-specific tokens and variants into neutral status or semantic-intent tokens where still useful
- remove variants that exist only to support inactive readiness flows

## Recommended Cleanup Sequence

### Phase 1. Remove visible readiness semantics from active UX

Scope:

- `src/lib/server/services/ai-service.ts`
- `src/features/session/components/SummaryScreen.tsx`
- `src/features/session/components/SummaryUtilities.ts`

Goal:

- current candidate experience should not present or imply a readiness-band feature

Notes:

- this is the highest-value cleanup because it aligns shipped behavior with intended product posture

### Phase 2. Quarantine dormant recruiter/dev readiness surfaces

Scope:

- `src/lib/services/dashboard-constitution.ts`
- `src/app/(recruiter)/recruiter/dev-eval/*`
- `src/app/api/dev/export-session/[sessionId]/route.ts`

Goal:

- preserve potentially useful internal work without allowing it to distort current app architecture or docs

Notes:

- this can be done with clear naming, route isolation, and documentation status markers before any deeper deletion decision

### Phase 3. Remove readiness from the live domain contract

Scope:

- `src/lib/domain/types.ts`
- `src/lib/domain/schemas.ts`
- `src/lib/server/infrastructure/supabase-session-repository.ts`

Goal:

- eliminate readiness as a first-class product data contract unless a real shipped feature still requires it

Notes:

- perform this as a coordinated refactor so types, schemas, persistence, and tests move together

### Phase 4. Genericize remaining design primitives

Scope:

- `src/components/patterns/StatusBadge.tsx`
- `src/components/ui/badge.tsx`
- `src/index.css`

Goal:

- preserve useful status styling without encoding inactive product semantics into the design system

## Recommended Decision

The best balance of clarity and preservation is:

- remove readiness from active product behavior and user-facing language
- quarantine internal recruiter/dev readiness work
- retain only neutral primitives and hidden calibration logic that still earns its keep

This avoids two bad outcomes:

- pretending readiness is a live product feature when it is not
- deleting all related work before deciding what parts might still be useful in a future product

## Follow-On Work

Recommended next artifact:

- a concrete remediation plan that turns this inventory into implementation tasks grouped by:
  - public UX cleanup
  - AI/prompt cleanup
  - contract and persistence cleanup
  - internal tooling quarantine

Recommended caution:

- do not remove readiness fields from the live domain model until all current call sites, tests, and persistence mappings are accounted for in one pass
