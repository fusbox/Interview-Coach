# Candidate-Driven Interview Coach Implementation Plan

Status: Proposed
Date: 2026-05-08

## 2026-05-08 Deployment Update

New deployment guidance confirms that recruiter and candidate implementations will share `https://interviewcoach.talentarbor.com` and the existing Azure project/repo path.

This changes the packaging strategy, not the candidate product boundary:

- candidate code should be integrated through an Azure branch based on the migrated recruiter Postgres branch
- the candidate landing page should own `/`
- candidate authenticated routes should own `/practice`, `/dashboard`, `/session/[sessionId]`, and summary/history paths
- recruiter/admin/QA paths remain `/recruiter/**`, `/admin/**`, and `/qa/**`
- `/recruiter` should become the deployed recruiter create landing target, with `/recruiter/create` retained as a compatibility redirect or alias

See [Shared Host Routing Contract](./shared-host-routing-contract.md) and [ADR-0006](../08-decisions/ADR-0006-shared-host-and-azure-branch-integration.md).

## Recommendation

Do not treat this as a continuation of the recruiter app with a few candidate exceptions, even though the deployment target is now a shared app.

Treat it as a new candidate-facing app shell built around an already reusable session engine.

The safest setup is:

- preserve the current session experience from landing through summary
- preserve recruiter invite entry via `/s/[token]`
- introduce a separate authenticated candidate area for self-serve practice
- introduce a shared RangamWorks shell that can be reused by the resume builder, interview coach, and auto-applicant
- keep candidate account/profile concerns separate from recruiter auth concerns
- keep route, cookie, API, and middleware ownership explicit because both implementations now share one host

This keeps the current regression surface smaller and avoids repeating the PoC-to-product blending problem.

---

## What We Can Preserve

These parts already form a good reusable core:

- session UI orchestration in [SessionOrchestrator](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/session/components/SessionOrchestrator.tsx)
- session rendering screens in [src/features/session/components](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/session/components)
- session provider + domain hooks in [SessionContext](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/session/context/SessionContext.tsx) and [useSessionLifecycleMutations](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/session/hooks/session-mutations/useSessionLifecycleMutations.ts)
- session creation API in [start session route](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/api/session/start/route.ts)
- role/JD/resume-aware AI services and prompts under [src/lib/server/services](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/services) and [prompts.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/ai/prompts.ts)
- recruiter invite candidate entry at [src/app/(candidate)/s/[token]/page.tsx](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/(candidate)/s/[token]/page.tsx)

The core takeaway: the session engine is not the problem. The app shell and ownership model are the problem.

---

## What Should Not Be Reused As-Is

These areas are too recruiter-shaped to become the candidate app foundation:

- recruiter auth and login flow in [login page](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/login/page.tsx)
- recruiter shell in [recruiter layout](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/(recruiter)/recruiter/layout.tsx)
- recruiter navigation in [RecruiterSidebar](/c:/tmp/Interview-Coach-Recruiter-postgres/src/components/layout/RecruiterSidebar.tsx) and [RecruiterMobileDock](/c:/tmp/Interview-Coach-Recruiter-postgres/src/components/layout/RecruiterMobileDock.tsx)
- recruiter create wizard in [create page](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/(recruiter)/recruiter/create/page.tsx)

The create wizard is still useful as a source of field models and interaction ideas, especially [StepJobAndQuestions](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/(recruiter)/recruiter/create/components/StepJobAndQuestions.tsx), but it should be refactored into shared primitives instead of cloned.

---

## Recommended Route Model

Keep invite-based practice and self-serve candidate practice as separate entry paths that converge on the same session feature.

Recommended route structure:

- `/`
  - interview coach top-level landing page for this app
- `/practice`
  - authenticated candidate practice setup
- `/dashboard`
  - authenticated candidate dashboard
- `/session/[sessionId]`
  - authenticated candidate-owned session resume path
- `/s/[token]`
  - recruiter invite path, preserved for external candidate access
- `/recruiter`
  - recruiter create landing target in deployment
- `/recruiter/create`
  - compatibility redirect or alias for the existing create route

Recommended route groups in the standalone incubation repo:

- [src/app/(marketing)](/c:/dev/Interview-Coach-Candidate/src/app/(marketing))
- [src/app/(coach-authenticated)](/c:/dev/Interview-Coach-Candidate/src/app/(coach-authenticated))
- [src/app/(invite)](/c:/dev/Interview-Coach-Candidate/src/app/(invite))

Do not force authenticated self-serve candidates through the invite-token route.  
Do not force recruiter invite candidates through account-only routes.

Both should render the same session feature once session access is resolved.

When ported into the shared Azure branch, candidate route groups must coexist with existing recruiter route groups and middleware. Add route tests for candidate, recruiter, admin, QA, anonymous, and invite-token contexts before considering the integration safe.

---

## Recommended Navigation Setup

Build a shared app shell now, even though only the interview coach app is in this repo.

Create a reusable shell with:

- desktop sidebar
- mobile dock
- config-driven nav items
- optional nested nav for the active app

For the first RangamWorks implementation, the interview coach shell should render:

- `Back to RangamWorks` -> `https://rangamworks.com/job-seeker/dashboard`
- `Resume Builder` -> `https://resumebuilder.rangamworks.com`
- `Interview Coach` -> local landing page in dev, deployed coach base URL in prod
- `Job Auto-Applicant` -> `https://autoapplicant.rangamworks.com`

Interview Coach nested sidebar links:

- `Practice`
- `Dashboard`

Mobile dock rules:

- default top-level only on non-coach pages
- when inside interview coach routes, render:
  - Back to RangamWorks
  - Interview Coach
  - Practice
  - Dashboard

Implementation direction:

- extract shared nav primitives from the recruiter components
- create `AppSidebar` and `AppMobileDock`
- make recruiter shell a consumer of the shared primitives later if desired

This avoids baking RangamWorks cross-app navigation into recruiter-only components.

---

## Auth and Identity Recommendation

Your first build target should be the TalentArbor/RangamWorks authenticated handoff path, not standalone direct auth.

Recommended order:

1. support authenticated candidate entry from TalentArbor/RangamWorks login or portal launch
2. define shared candidate profile schema
3. keep standalone local/password auth for development until the external handoff is available

Recommended identity model:

- `candidate_profiles`
  - canonical candidate profile for all three apps
- `candidate_identities`
  - provider identity bindings such as Okta subject, email, issuer, tenant
- app-specific usage tables
  - interview coach sessions
  - resume builder documents
  - auto-applicant artifacts

Do not make the interview coach own the canonical candidate identity long-term.

Instead, let this app consume a shared candidate identity/profile contract.

For now, add an auth adapter boundary so current recruiter Supabase auth does not leak into candidate flows:

- recruiter auth resolver
- RangamWorks SSO resolver
- future standalone candidate auth resolver

That boundary should decide:

- who the user is
- what shell to render
- what session/dashboard records they can access

---

## Session Ownership Recommendation

The current model is invite-first:

- session row
- candidate token
- optional candidate snapshot embedded in `intake_json`

That is fine for recruiter invitations, but self-serve practice needs account ownership.

Add explicit session ownership fields for candidate-driven mode:

- `session_source`
  - `invite`
  - `self_serve`
- `candidate_profile_id`
- `workspace`
  - `rangamworks`
  - `talentarbor`
- `app_module`
  - `interview_coach`

Keep candidate token auth only for invite flows.

For self-serve sessions, use authenticated candidate identity plus session ownership checks.  
For invite sessions, keep the current token mechanism in [candidate-token.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/auth/candidate-token.ts).

---

## Candidate Practice Setup Scope

This should be its own feature slice, not a tweak to the recruiter wizard.

Suggested feature:

- [src/features/practice-setup](/c:/dev/Interview-Coach-Candidate/src/features/practice-setup)

Responsibilities:

- target role input
- optional JD input
- resume input options:
  - paste text
  - upload file
  - capture photo(s)
- text extraction normalization
- intake/personalization inputs
- create self-serve session

Suggested internal split:

- [components/PracticeSetupForm.tsx](/c:/dev/Interview-Coach-Candidate/src/features/practice-setup/components/PracticeSetupForm.tsx)
- [components/ResumeInputTabs.tsx](/c:/dev/Interview-Coach-Candidate/src/features/practice-setup/components/ResumeInputTabs.tsx)
- [components/ResumePhotoCapture.tsx](/c:/dev/Interview-Coach-Candidate/src/features/practice-setup/components/ResumePhotoCapture.tsx)
- [components/ResumeUpload.tsx](/c:/dev/Interview-Coach-Candidate/src/features/practice-setup/components/ResumeUpload.tsx)
- [lib/normalize-resume-text.ts](/c:/dev/Interview-Coach-Candidate/src/features/practice-setup/lib/normalize-resume-text.ts)
- [server/create-candidate-session.ts](/c:/dev/Interview-Coach-Candidate/src/features/practice-setup/server/create-candidate-session.ts)

Important boundary:

- extraction/OCR output becomes normalized text
- downstream coach logic should continue consuming plain `resumeText`

That keeps AI services unchanged.

---

## Resume Ingestion Recommendation

Normalize all resume intake into a single downstream field:

- `resumeText`

Source-specific preprocessing can vary:

- pasted text: trim and store directly
- uploaded file: extract text from PDF/DOCX
- photo capture: OCR each image, merge by page order

Also persist source metadata for supportability:

- source type
- page count
- extraction confidence if available
- original filename or image count

But keep the coach services consuming normalized text only.

---

## Candidate Dashboard Scope

This is the largest new module and should be scoped separately from session launch.

Phase 1 dashboard scope:

- recent practice sessions
- status and last activity
- target role per session
- ability to resume in-progress session
- ability to repeat a completed session
- summary snippets for completed sessions

Phase 2 dashboard scope:

- practice history by role
- readiness trend
- top coaching themes
- saved resume/profile completeness
- suggested next practice action

Suggested feature slice:

- [src/features/candidate-dashboard](/c:/dev/Interview-Coach-Candidate/src/features/candidate-dashboard)

Suggested server slice:

- [src/lib/server/application/candidate-dashboard](/c:/dev/Interview-Coach-Candidate/src/lib/server/application/candidate-dashboard)

Do not build the dashboard directly on recruiter session-summary assumptions.  
Those summaries are invite/recruiter oriented and will drag the wrong semantics into the candidate app.

---

## Intake and Personalization Recommendation

Re-enable the old PoC intent, not the old PoC implementation.

Recommended rule:

- preserve the idea of candidate personalization
- redesign the data model and UX from scratch

Suggested intake model additions:

- confidence rating
- target interview type
- upcoming interview timeline
- biggest concern
- optional must-practice areas
- optional resume text

Persist these as structured `intakeData`, not UI-specific flags.

This aligns with the existing schema shape in [schemas.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/domain/schemas.ts) and the prompt contract already using `resumeText`.

---

## Phased Implementation Order

### Phase 0: Stabilize boundaries

- keep recruiter flows working
- preserve `/s/[token]`
- extract shared shell/navigation primitives
- add auth boundary abstraction

### Phase 1: Shared-host candidate shell

- public landing page at `/`
- authenticated candidate landing page at `/dashboard`
- shared RangamWorks sidebar/mobile dock
- interview coach landing route
- placeholder dashboard route
- placeholder practice route

### Phase 2: Self-serve practice creation

- role + JD form
- resume text input
- create candidate-owned session
- redirect into shared session experience

### Phase 3: Resume upload and photo capture

- file upload text extraction
- multi-image OCR capture flow
- normalized resume text persistence

### Phase 4: Candidate dashboard

- recent sessions
- resume session
- repeat session
- summary history

### Phase 5: Intake revamp

- structured personalization flow
- prompt integration validation
- dashboard and summary tie-ins

### Phase 6: Standalone talentarbor auth

- direct candidate sign-up/sign-in
- shared profile contract across all three apps

---

## Folder Direction

Recommended additions:

- [src/app/(coach-authenticated)/dashboard/page.tsx](/c:/dev/Interview-Coach-Candidate/src/app/(coach-authenticated)/dashboard/page.tsx)
- [src/app/(coach-authenticated)/practice/page.tsx](/c:/dev/Interview-Coach-Candidate/src/app/(coach-authenticated)/practice/page.tsx)
- [src/app/(coach-authenticated)/session/[sessionId]/page.tsx](/c:/dev/Interview-Coach-Candidate/src/app/(coach-authenticated)/session/[sessionId]/page.tsx)
- [src/components/layout/AppSidebar.tsx](/c:/dev/Interview-Coach-Candidate/src/components/layout/AppSidebar.tsx)
- [src/components/layout/AppMobileDock.tsx](/c:/dev/Interview-Coach-Candidate/src/components/layout/AppMobileDock.tsx)
- [src/components/layout/app-nav.ts](/c:/dev/Interview-Coach-Candidate/src/components/layout/app-nav.ts)
- [src/features/practice-setup/*](/c:/dev/Interview-Coach-Candidate/src/features/practice-setup)
- [src/features/candidate-dashboard/*](/c:/dev/Interview-Coach-Candidate/src/features/candidate-dashboard)
- [src/lib/server/application/candidate-sessions/*](/c:/dev/Interview-Coach-Candidate/src/lib/server/application/candidate-sessions)
- [src/lib/server/application/candidate-dashboard/*](/c:/dev/Interview-Coach-Candidate/src/lib/server/application/candidate-dashboard)
- [src/lib/auth/app-access/*](/c:/dev/Interview-Coach-Candidate/src/lib/auth/app-access)

Keep existing session feature code where it is unless a move materially improves clarity.

---

## Key Setup Decisions

If you want the cleanest path, make these decisions explicit now:

1. The interview session engine is shared infrastructure, not recruiter UI.
2. Candidate self-serve and recruiter invite are separate entry modes.
3. RangamWorks shell/navigation is a shared app concern, not an interview-coach-only concern.
4. Candidate identity must have its own shared contract across all three apps.
5. Resume ingestion should normalize to text before the session/AI layers see it.

---

## Short Version

Build a new candidate-facing shell around the current session engine.

Do not migrate the PoC UI forward.  
Do not keep extending recruiter-specific routes/components to handle candidate self-serve mode.  
Do preserve the current session flow, AI contracts, and invite-token route.

That gives you the least risky path to:

- RangamWorks SSO first
- shared cross-app navigation
- self-serve practice creation
- later dashboard and intake expansion
