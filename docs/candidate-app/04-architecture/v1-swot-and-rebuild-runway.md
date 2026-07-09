# V1 SWOT And Rebuild Runway

Status: Working architecture and operating reference
Last updated: 2026-07-09

## Purpose

This document keeps the cleanroom rebuild grounded in two references at once:

- V1 on `feature/candidate-module`, which is the best behavior reference for what already worked in the candidate app.
- The original refactor pack in `.untracked/interview-coach-refactor-agent-reference-pack`, which defines the target direction: one session experience, one answer lifecycle, evidence-first evaluation, and dashboard migration away from legacy feedback truth.

The rebuild direction has changed from a strangler refactor to a cleanroom rebuild. That changes the implementation method, not the north star.

## Operating Rule

Before every meaningful candidate workflow slice, inspect the matching V1 behavior first.

Each slice should include a short V1 reference note in the handoff or working notes:

- V1 files checked.
- Behavior to preserve.
- Behavior to retire, quarantine, or reinterpret.
- Any divergence between V1, the refactor pack, and current V2 contracts.
- Any decision needed from the user before implementation.

V1 is a behavior and test reference, not a default source-code donor. Bring old code into V2 only when the slice names the behavior it preserves and the current V2 contract has a clean place for it.

If V1 and the refactor target disagree, do not silently choose. Name the tradeoff first.

## V1 Reference Map

Use `git show feature/candidate-module:<path>` to inspect V1 without switching away from the active rebuild worktree.

Practice setup:

- `src/features/practice-setup/PracticeSetupPage.tsx`
- `src/features/practice-setup/PracticeSetupForm.tsx`
- `src/features/practice-setup/actions.ts`
- `src/lib/server/candidate/candidate-practice-draft-repository.ts`
- `src/lib/server/candidate/candidate-session-creation-service.ts`

Candidate-led session:

- `src/features/candidate-session/CandidateSessionPage.tsx`
- `src/features/candidate-session/CandidateActiveQuestionWorkspace.tsx`
- `src/features/candidate-session/actions.ts`
- `src/lib/server/candidate/candidate-session-loader.ts`
- `src/lib/server/candidate/candidate-session-progress-service.ts`
- `src/lib/server/candidate/candidate-session-answer-service.ts`

Shared invited-session runtime:

- `src/features/session/components/InterviewSessionScreen.tsx`
- `src/features/session/components/SessionOrchestrator.tsx`
- `src/features/session/components/UnifiedSessionScreen.tsx`
- `src/features/session/context/SessionContext.tsx`
- `src/features/session/hooks/session-mutations/useSessionAnswerMutations.ts`
- `src/features/session/components/FeedbackDrawer.tsx`

Candidate summary and dashboard:

- `src/features/candidate-summary/CandidateSummaryPage.tsx`
- `src/features/candidate-summary/CandidateSummaryFinalizer.tsx`
- `src/features/candidate-dashboard/CandidateDashboardPage.tsx`
- `src/lib/server/candidate/candidate-dashboard-loader.ts`
- `src/lib/server/candidate/prep-profile-read-model.ts`

Original refactor plan:

- `.untracked/interview-coach-refactor-agent-reference-pack/README.md`
- `.untracked/interview-coach-refactor-agent-reference-pack/workpass-1-shared-session-lifecycle-inventory.md`
- `.untracked/interview-coach-refactor-agent-reference-pack/02-shared-session-kernel-refactor.md`
- `.untracked/interview-coach-refactor-agent-reference-pack/03-evidence-first-evaluation-engine.md`
- `.untracked/interview-coach-refactor-agent-reference-pack/04-dashboard-persistence-telemetry-guardrails.md`
- `.untracked/interview-coach-refactor-agent-reference-pack/06-current-codebase-seams-and-legacy-map.md`

## V1 SWOT

### Strengths

- V1 proves a full candidate-led loop exists: setup, question generation, session entry, voice/text answering, feedback review, retry, pause/resume, summary, and dashboard return paths.
- V1 already has useful candidate-owned persistence concepts: practice drafts, resume target screens, role preparation profiles, session links, summary finalization, and dashboard read models.
- V1 has a mature live-session interaction model to study: question audio, text and voice modes, answer submission loaders, feedback drawer, retry/continue decisions, hints, example answers, and transcript recovery.
- V1 includes a real dashboard shape with Coach Plan, category/skill/question faces, Coach Update, Next Practice Round, and prep-profile read-model mapping.
- V1 tests and services expose many edge contracts that should not be rediscovered from scratch.

### Weaknesses

- Candidate-led sessions and invited sessions do not actually share one runtime. `CandidateActiveQuestionWorkspace` duplicates the shared `UnifiedSessionScreen` path and created voice/text divergence.
- `/practice`, `/session/[sessionId]`, `/summary/[sessionId]`, and `/dashboard` are not the canonical V2 route namespace and make app flow harder to trace.
- Candidate auth, dev auth, local identity, Supabase/Postgres migration, and host-platform launch assumptions are layered together from several pivots.
- The dashboard depends heavily on legacy `eval_results.feedback_json`, hidden scores, pulses, and feedback-plan semantics that the refactor pack explicitly says should not become durable truth.
- V1 UI surfaces carry design-system and copy drift from multiple product arcs.
- Candidate completion in V1 routes through summary before dashboard. V2 still needs the dashboard return behavior after a session is finished.

### Opportunities

- Use V1 as a capability ledger while letting V2 keep clean route, identity, setup, question-plan, wording, progress, and draft contracts.
- Restore the live runtime in slices instead of copying the old session workspace wholesale.
- Preserve proven statefulness: pause/resume, current question recovery, answer drafts, completion routing, and recovery states.
- Bring over useful service boundaries only after mapping them to V2 vocabulary: candidate identity, practice session, question slot, answer attempt, feedback artifact, dashboard evidence.
- Replace legacy dashboard truth with evidence-first facts, criteria bands, category lenses, and derived read models.
- Let the design system reset the UI while V1 informs interaction affordances and failure states.

### Threats

- Cleanroom work can accidentally lose subtle V1 behaviors unless V1 is checked before each workflow slice.
- Copying V1 source too eagerly can import the same sprawl the rebuild is meant to remove.
- Host launch details are still incomplete; dev host launch must unblock local work without becoming the production identity model.
- Scaffolding can become sticky if provider, answer, feedback, and dashboard boundaries are not retired or replaced intentionally.
- Legacy hidden-score language can leak back into candidate-facing UI if dashboard migration is not handled as a separate evidence-first pass.
- Tests can drift if the rebuilt candidate suite stops checking both V2 contracts and preserved V1 behavior.

## Integrated Read

The original refactor plan assumed the existing app would be strangled into a shared kernel:

1. Inventory current paths.
2. Make the shared runtime candidate-owned capable.
3. Move candidate-led sessions onto the shared runtime.
4. Add canonical categories and evidence-first contracts.
5. Introduce evaluator V2 behind a flag.
6. Move the dashboard to criteria bands and derived evidence.
7. Retire legacy paths.

The cleanroom rebuild has changed the order:

- V2 has already established canonical `/candidate/*` routes, a design-system direction, setup contracts, host-launch boundaries, deterministic question planning, strict question-wording validation, durable `candidate_practice_sessions`, progress state, and answer-draft persistence.
- V2 has not yet restored the real live-answer runtime, answer submission, evaluator wiring, feedback rendering, summary, or dashboard migration.
- Some later-phase ideas are already represented as contracts, but the main missing middle is still the live runtime and one answer lifecycle.

This means the next runway should not jump straight to dashboard or evaluator UI. It should first restore the live question loop on top of the V2 persistence and route contracts, using V1 as a behavior checklist and the refactor pack as the target architecture checklist.

## Recommended Runway

Good next commit milestone:

Restore a V2 live-question runtime foundation that can start a session, answer by typed text, persist progress and drafts, and stop before evaluator/provider feedback if those dependencies are not deliberately wired.

Suggested slices:

1. V1 live-session capability ledger for the current V2 session shell.
   - In bounds: inspect V1 session, shared runtime, progress, answer, feedback recovery, and tests; document preserved/retired behavior; add or update V2 acceptance tests where useful.
   - Out of bounds: source copying, evaluator changes, dashboard changes.
2. V2 live-session state contract.
   - In bounds: define typed states/events from planned preview to live question, answer draft, submitting, submitted-unavailable, feedback-unavailable, paused, and completed.
   - Out of bounds: real evaluator/provider calls.
3. Start-live transition from carried wording snapshot.
   - In bounds: convert the read-only preview into an explicit startable live session only when question wording exists and maps to the plan.
   - Out of bounds: question generation provider wiring.
4. Typed answer submission persistence for text mode.
   - In bounds: save one answer attempt with idempotency, loader/error states, current question ownership, and recovery.
   - Out of bounds: scoring, feedback composition, dashboard read updates.
5. Voice/photo affordance decision slice.
   - In bounds: decide whether V2 restores voice first, keeps it disabled until shared runtime parity, or stages it behind a capability flag; preserve privacy copy and browser permission handling.
   - Out of bounds: broad media storage redesign.
6. Feedback boundary adapter.
   - In bounds: decide whether the next pass uses a legacy adapter, a provider-unavailable state, or the evidence-first contract stub.
   - Out of bounds: full evaluator V2 unless intentionally started as its own milestone.
7. Candidate completion route.
   - In bounds: finish session to candidate dashboard or summary/dashboard according to the current product spec, preserve setup reset and session resume boundaries.
   - Out of bounds: full dashboard redesign.

After that milestone, the next coherent arc is dashboard migration: build the read model from answer attempts, question categories, and evidence-first feedback artifacts instead of treating legacy feedback JSON as durable dashboard truth.
