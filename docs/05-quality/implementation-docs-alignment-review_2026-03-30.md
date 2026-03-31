# Implementation vs Documentation Alignment Review

Date: 2026-03-30
Reviewer: Codex
Scope: current codebase implementation patterns compared against the design, architecture, quality, requirements, and project docs under `docs/`, plus `docs/01-project/interview_coach_prd_v1.docx` and `docs/01-project/handoff.pdf`.

## Executive Summary

The repo is more coherent in code than it may feel day to day, but the coherence is concentrated in the session flow, auth boundary, runtime validation, and production-hardening work. The largest problem is not "bad code"; it is that several architecture and product-quality docs describe a more aspirational system than the one that actually exists.

The implementation has a few real non-negotiable patterns that should likely carry into any future app:

- state-driven session rendering
- server-owned authoritative session state
- candidate-token authorization on candidate APIs
- runtime schema validation at API and persistence boundaries
- increasing use of application-service extraction for route logic
- production-hardening patterns around idempotency, metrics, and contract tests

The blurrier areas are mostly product-layer concerns:

- recruiter readiness semantics and recruiter interpretation surfaces
- the exact candidate intake/personalization contract
- whether the design-system docs are strict governance or preferred direction
- whether event-log/SSE architecture is a target-state or an actual current constraint

## 1. Patterns Inferred From Actual Code

### 1.1 Intentional / Probably Non-Negotiable

#### State-driven screen selection

The candidate session experience is intentionally rendered from derived session state, not route shape.

Evidence:
- `src/lib/state/selectors.ts` computes `now.screen` from authoritative session state.
- `src/features/session/components/SessionOrchestrator.tsx` switches only on `now.status`, `now.requiresInitials`, and current question presence.
- `docs/03-design/ROUTING_AND_RENDERING.md`
- `docs/03-design/SCREEN_STATE_MODEL.md`

Why this feels real:
- the selectors are small, deterministic, and central
- the orchestrator is already shaped around this model
- tests and E2E flow assume `/s/[token]` remains stable while UI state changes underneath

#### Server-owned session truth

The code treats persisted server state as the source of truth for anything meaningful across refresh, resume, or trust boundaries.

Evidence:
- `src/lib/server/infrastructure/supabase-session-repository.ts`
- `src/app/api/session/[session_id]/route.ts`
- `src/lib/server/api-handler-utils.ts`

Why this feels real:
- session GET/PATCH are server-backed
- question submit/retry/analysis routes rehydrate session state before acting
- the client derives display state from fetched session data rather than reconstructing progress locally

#### Candidate-token auth boundary

Candidate access is not treated as soft convenience. It is an explicit, enforced server boundary.

Evidence:
- `src/lib/server/auth/candidate-token.ts`
- `src/app/api/session/[session_id]/route.ts`
- `src/lib/server/api-handler-utils.ts`

Why this feels real:
- token validation is centralized and reused
- mismatch and missing-token paths are explicit and instrumented
- recent quality docs and tests reinforce this as a hard requirement

#### Runtime validation over trust-by-convention

The repo increasingly prefers schema-backed inputs and persisted-output validation.

Evidence:
- `src/lib/domain/schemas.ts`
- `src/lib/api-client.ts`
- `src/lib/server/infrastructure/supabase-session-repository.ts`
- many API routes use `safeParse`

Why this feels real:
- request parsing is consistent across critical routes
- even persisted AI feedback is re-validated on read before use
- this pattern is reinforced by quality docs and tests

#### Critical-path operability patterns

Idempotency, metrics, and production contract validation are now meaningful architectural habits, not random bolt-ons.

Evidence:
- `src/app/api/session/[session_id]/questions/[question_id]/submit/route.ts`
- `src/lib/server/metrics.ts`
- `src/lib/server/production-contract.integration.test.ts`
- `docs/05-quality/test_pyramid_plan_2026-03-29.md`
- `docs/05-quality/production_*`

Why this feels real:
- these patterns appear in routes, tests, and quality governance docs
- there is clear recent investment in making them part of release posture

#### Semantic-token and pattern-component direction

The UI layer is not fully locked down, but the code clearly intends semantic tokens plus pattern components to be the main styling contract.

Evidence:
- `src/index.css`
- `src/components/patterns/*`
- `src/components/patterns/FormField.tsx`
- `docs/03-design/CANONICAL_DESIGN_SYSTEM_SPEC.md`
- `docs/03-design/TYPOGRAPHY & THEME_TOKENS.md`

Why this feels real:
- semantic variables are actually defined and used
- pattern components are real and widespread
- the design docs match the direction even if enforcement is incomplete

### 1.2 Fuzzy / Still Negotiable

#### Event-log and SSE architecture

The docs describe event-log source-of-truth plus `/now` projections and SSE streaming, but the current code is table-backed CRUD plus selector-driven projections. This feels like target-state architecture, not live invariant.

#### Recruiter readiness / interpretation product layer

The repo has readiness docs and a dashboard constitution direction, but the current recruiter product scope and current UI do not fully embody those semantics.

#### Candidate intake contract

The design and QA docs define a very specific one-question intake/tiering model, but the current implemented entry experience is a baseline-preparedness capture on the landing screen. That means the repo has not yet settled whether "intake" is a coaching-tier chooser, a baseline sentiment capture, or both.

#### Design-system strictness

The repo has a genuine design-system direction, but it is not yet governed tightly enough to treat every rule in the design docs as a live enforcement contract.

## 2. Where Implementation Aligns Tightly With Documentation

### 2.1 Routing and screen-state model

Strong alignment:
- `docs/03-design/ROUTING_AND_RENDERING.md`
- `docs/03-design/SCREEN_STATE_MODEL.md`
- `src/lib/state/selectors.ts`
- `src/features/session/components/SessionOrchestrator.tsx`
- `src/app/(candidate)/s/[token]/page.tsx`

Assessment:
- one invite route
- no URL-encoded question progress
- screen selection derived from session state
- resume/refresh behavior anchored in persisted state

This is one of the strongest doc-to-code matches in the repo.

### 2.2 Candidate practice flow shape

Broad alignment:
- `docs/02-requirements/user-stories.md`
- `docs/02-requirements/use-cases/v2/UC-C1-Candidate-Accesses-the-Interview-Session.md`
- `docs/02-requirements/use-cases/v2/UC-C2-Candidate-Responds-to-a-Question.md`
- `docs/02-requirements/use-cases/v2/UC-C4-Candidate-Reviews-AI-Feedback-and-Retries.md`
- `docs/02-requirements/use-cases/v2/UC-C5-Candidate-Views-Session-Summary-and-Concludes.md`
- `docs/03-design/user-flows/UF-C1 Candidate Starts Interview Session.md`
- `docs/03-design/user-flows/UF-C2 Candidate Answers Question + Autosave + Submit.md`
- `docs/03-design/user-flows` candidate feedback flow doc
- `docs/03-design/user-flows/UF-C4 Candidate Retries Question.md`
- `docs/03-design/user-flows/UF-C5 Candidate Resumes In-Progress Session.md`
- `src/features/session/components/LandingScreen.tsx`
- `src/features/session/components/UnifiedSessionScreen.tsx`
- `src/features/session/components/FeedbackDrawer.tsx`
- `src/features/session/components/SummaryScreen.tsx`
- `e2e/candidate/practice-session.spec.ts`

Assessment:
- tokenized access
- landing/start flow
- question answering
- submit then feedback
- retry
- summary and practice again

The exact UX details drift in places, but the core end-to-end shape is consistent.

### 2.3 Application-boundary extraction trend

Strong alignment:
- `docs/04-architecture/adr-application-boundaries.md`
- `src/lib/server/application/session/start-session.ts`
- `src/lib/server/application/session/get-session.ts`
- `src/lib/server/application/session/update-session.ts`
- `src/lib/server/application/invites/create-invite-batch.ts`

Assessment:
- not every route is fully extracted yet
- but the repo has clearly moved in this direction on critical flows
- quality docs also acknowledge this as the intended path

### 2.4 Production-hardening and testing posture

Strong alignment:
- `docs/05-quality/test_pyramid_plan_2026-03-29.md`
- `docs/05-quality/release-gate-checklist.md`
- `docs/05-quality/production_deployment_validation_checklist_2026-03-26.md`
- `docs/05-quality/initial_slos_2026-03-26.md`
- `docs/05-quality/ops_alert_policy.md`
- `src/lib/server/production-contract.integration.test.ts`
- `src/lib/server/application/session/session-lifecycle.integration.test.ts`
- `src/lib/server/application/invites/invite-batch.integration.test.ts`
- `e2e/candidate/practice-session.spec.ts`

Assessment:
- the repo really does have integration, browser, and production-contract coverage in the areas the docs emphasize
- recent quality documentation mostly matches the current hardening work

## 3. Where Implementation Drifted From Docs And Probably Should Not Have

### 3.1 Architecture docs describe a different backend shape than the live system

Docs:
- `docs/04-architecture/api-surface.md`
- `docs/04-architecture/state-and-streaming-contract.md`
- `docs/04-architecture/vertical-slice-contracts.md`
- `docs/04-architecture/architecture-overview.md`
- `docs/04-architecture/code-organization.md`
- `docs/01-project/handoff.pdf`

Current implementation:
- `src/app/api/session/[session_id]/route.ts`
- `src/app/api/session/start/route.ts`
- `src/app/api/session/[session_id]/questions/[question_id]/submit/route.ts`
- `src/lib/server/infrastructure/supabase-session-repository.ts`

Drift:
- docs specify `/api/session/{sessionId}/now`; code uses `GET /api/session/[session_id]`
- docs specify `/api/session/{sessionId}/start`; code uses `POST /api/session/start`
- docs specify draft route naming under `/question/{questionId}/draft`; code uses `/questions/[question_id]/answer`
- docs treat event log as source of truth and SSE as architectural contract; code persists directly to `sessions`, `questions`, `answers`, and `eval_results`

Why this should be corrected:
- these are not harmless wording differences
- they change the shape of how engineers reason about the system
- they make the architecture docs less trustworthy precisely where they claim to be stable contracts

Recommended action:
- either update the docs to the implemented CRUD/projection model
- or explicitly relabel those docs as target-state architecture and remove "locked for V1" framing

### 3.2 Candidate QA doc no longer matches the implemented session UX contract

Docs:
- `docs/05-quality/QA-checklist.md`

Current implementation:
- `src/features/session/components/LandingScreen.tsx`
- `src/features/session/components/FeedbackDrawer.tsx`
- `src/features/session/components/UnifiedSessionScreen.tsx`
- `src/features/session/components/SessionSurvey.tsx`

Drift examples:
- QA checklist requires exactly one intake question with exactly three options and no progress indicator; landing screen currently captures a five-point preparedness rating before start
- QA checklist forbids readiness language globally; summary survey asks "I feel more prepared after this session" and the repo retains readiness-band persistence in domain/repo shapes
- QA checklist prescribes a very specific feedback structure; current `FeedbackDrawer` uses summary, delivery pulse, content pulse, and next-step cards rather than the documented acknowledgement / single focus / why this helps / observations sequence

Why this should be corrected:
- QA docs are supposed to be ship-gating references
- if they do not describe the actual UX contract, they create false blockers and false confidence at the same time

Recommended action:
- rewrite the QA checklist to reflect the actual current candidate experience
- separate "current product contract" from "future design ideal" if both need to exist

### 3.3 Readiness governance docs conflict with current recruiter product scope

Docs:
- `docs/05-quality/readiness-band-definition.md`
- `docs/05-quality/readiness-eval-scenarios.md`
- `docs/04-architecture/gate-decisions.md`

Scope and implementation:
- `docs/02-requirements/user-stories.md`
- `src/app/(recruiter)/recruiter/page.tsx`
- `src/app/(recruiter)/recruiter/components/DashboardStats.tsx`
- `src/lib/services/dashboard-constitution.ts`

Drift:
- readiness docs treat recruiter-facing readiness as an active stable system behavior
- user stories explicitly mark recruiter readiness indicators, descriptors, and narrative summary as out of scope
- recruiter dashboard implementation currently shows invite/session stats, not recruiter-facing readiness interpretation
- `dashboard-constitution.ts` remains a stub, not a live constitution-backed system

Why this should be corrected:
- this creates confusion about whether readiness is a current product promise or a future capability
- it matters directly for the new candidate-led app, because it changes which ideas are safe to reuse

Recommended action:
- move readiness docs into one of two buckets:
  - "future recruiter interpretation model"
  - or "current active system contract"
- but do not keep both meanings mixed together

## 4. Where Implementation Drifted From Docs But Is Probably Okay

### 4.1 Framework-specific wording drift

`docs/03-design/ROUTING_AND_RENDERING.md` still includes some Vite/React wording, while the app is plainly Next.js App Router. The important design intent still holds, so this is worth cleanup but not architectural concern.

### 4.2 Design docs are stricter than live enforcement

The design-system docs describe a more governed token/pattern regime than the code fully enforces. That is okay as long as the team understands these docs are directional standards rather than fully audited conformance rules.

### 4.3 Historical remediation docs remain in docs

Several `production_remediation_*` docs are clearly marked historical. Keeping them is fine; they are not confusing on their own because their status labels are explicit.

## 5. Good Implementation Patterns That Exist But Should Be Formalized

### 5.1 Schema-backed API client contract

`src/lib/api-client.ts` quietly establishes a useful client pattern:
- candidate token header injection
- consistent JSON handling
- optional schema parsing at the response boundary

This is worth formalizing for any future app because it reduces trust-by-convention on the client.

### 5.2 Validated candidate session route wrapper

`src/lib/server/api-handler-utils.ts` is a strong reusable pattern:
- candidate auth
- session existence check
- question membership check
- correlation-aware error handling

This should be elevated into architecture guidance for any candidate-scoped mutation routes.

### 5.3 Production contract tests as release proof

`src/lib/server/production-contract.integration.test.ts` is better than a typical unit test artifact. It is a release-safety pattern that proves environment and infrastructure assumptions. This should be called out more explicitly in architecture and quality docs as part of the live system contract.

### 5.4 Repo-backed persisted-summary privacy behavior

The summary screen and repository implement a meaningful privacy pattern:
- browser summary can expire
- email remains the longer-lived copy
- repository clears expired browser summary state

Evidence:
- `src/features/session/components/SummaryScreen.tsx`
- `src/lib/server/infrastructure/supabase-session-repository.ts`

This should be documented as an intentional privacy rule, not left implicit in code.

### 5.5 E2E seam design

The repo has a deliberate browser-test seam:
- `src/lib/e2e/test-mode.ts`
- reflected in `docs/05-quality/test_pyramid_plan_2026-03-29.md`

This is already partly documented, but it is important enough to preserve explicitly when bootstrapping the next app.

## 6. Suggested Doc Upgrade Strategy

### 6.1 Make one short "current truth" layer

Add or update a small set of documents that describe only current, enforced reality:

- current API surface
- current candidate UX contract
- current recruiter scope
- current auth and trust boundaries

These should be considered the safe docs for new app bootstrapping.

### 6.2 Split "current contract" from "target architecture"

For architecture docs that are ahead of implementation:
- keep them if useful
- but relabel them clearly as target-state or migration guidance

Do not keep aspirational docs labeled as V1-locked contracts if the code does not honor them.

### 6.3 Promote implementation-proven patterns into reusable standards

The next app would benefit from a compact engineering standards doc that formalizes:

- state-driven screen orchestration
- candidate-token protected server routes
- schema validation at boundaries
- application-command extraction for complex route logic
- idempotency for write endpoints
- production contract tests for deployment assumptions

## 7. Bottom Line

The repo's real center of gravity is stronger than the docs currently make it feel. The most trustworthy patterns are in the code, especially around session state, auth, validation, and production hardening. The most misleading areas are the architecture docs that describe event-log/SSE projection contracts and the quality/readiness docs that still imply recruiter-facing interpretation capabilities beyond current scope.

If this repo remains the recruiter-led app while a new candidate-led app starts fresh, the best move is not to "copy the docs." It is to treat the code-backed patterns above as the baseline, then selectively modernize the docs so they describe what is actually stable and intentionally worth carrying forward.
