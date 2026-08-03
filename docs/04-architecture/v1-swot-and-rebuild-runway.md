# V1 SWOT And Rebuild Runway

Status: Working architecture and operating reference
Last updated: 2026-07-18

## Purpose

This document keeps the cleanroom rebuild grounded in two references at once:

- The immutable V1 snapshot at `618808e174fd1ad73bb7eceadf4f03aa74b1a664`, which is the best behavior reference for what already worked in the candidate app.
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

Use `git show 618808e174fd1ad73bb7eceadf4f03aa74b1a664:<path>` to inspect V1 without switching away from the active rebuild worktree.

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

## Slice 93 Integrated Read

The original refactor plan still supplies the architectural test: one session experience, one answer lifecycle, one evidence-first evaluation engine, and two intentional completion destinations. The cleanroom rebuild has now established more of that foundation than the earlier runway recorded: durable candidate practice sessions, planned and worded questions, live progress, answer drafts and submissions, idempotent analysis boundaries, fixture coaching snapshots, feedback action events, completion snapshots, dashboard read models, durable follow-up intents, and cross-session practice-attempt lineage all exist. Slot-keyed answer submissions and analysis snapshots still preserve only the latest in-session answer, so feedback-driven retry lineage is the next data gap to close before staged feedback can create it.

What remains is not another plumbing-first detour. The next gap is turning those boundaries into the real candidate experience while keeping them capable of converging with the invited-candidate runtime.

### V1 Disposition For The UI Build

- **Preserve:** pre-session entry before question one; one-question-at-a-time live workspace; text/voice mode parity; explicit progress; pause/resume and current-question recovery; acknowledgement before detailed coaching; explore-or-skip feedback; conditional retry versus continue; finish on the last question; clear completion destination.
- **Reinterpret:** V1's standalone candidate summary becomes candidate-led dashboard Coach Update and next-practice guidance; hints and strong-response examples must be checked against the new coaching model; dashboard Coach Plan and queue ideas should consume V2 read models and durable practice intents rather than legacy feedback JSON.
- **Retire:** candidate-led and invited duplicate runtimes; scaffold preview as a production mode; hidden-score and legacy `feedback_json` conclusions as dashboard truth; candidate setup as the destination for follow-up practice.
- **Defer:** production voice/photo capture, attempt-count UI, performance-over-time charts, final dashboard visual composition, and recruiter route migration until the core candidate surfaces and evidence-first feedback path are productized.

### Current Divergences To Keep Explicit

- V1 routes candidate-led completion through a standalone summary. V2 routes candidate-led completion to `/candidate/dashboard`; invited completion may remain summary/debrief-oriented.
- V1's interaction cadence is useful, but its feedback content and score-derived dashboard conclusions are not the V2 source of truth.
- The refactor pack preferred adapting the existing shared runtime. The cleanroom rebuild may establish newly factored shared modules instead, provided candidate-led and invited flows derive from the same runtime facts and answer lifecycle rather than creating a third path.
- V2 carries cross-session question lineage, immutable answer attempts within a question occurrence, and separate evaluator-run lineage, so feedback retries, intentional repractice, and model A/B runs are not conflated. Candidate-visible attempt treatment remains deferred until a real trend or progress presentation is designed.

## Slice 140 Integrated Read

The earlier runway's lifecycle, evaluator, Coach Update, queue, and follow-up-launch work is now landed. The original refactor pack's candidate-side architecture phases are correspondingly advanced:

| Original phase | V2 position after Slice 139 |
| --- | --- |
| Shared session experience | Shared runtime facts, shell, landing composition, and completion adapters exist for candidate-led use; invited routing and constraints have not converged. |
| One answer lifecycle | Typed drafts, immutable submissions, feedback retries, evaluator runs, failure recovery, and exact resume state are durable. |
| Canonical categories | Deterministic planning and production wording use the canonical category contract. |
| Evidence-first contracts and evaluator | The first production Gemini profile, validation, redaction, telemetry, QA identity, and live gates are landed. |
| Dashboard migration | Evidence-first read models, Coach Update, Coach Plan, Practice Next, queue, and immutable follow-up intents are landed; final presentation is not. |
| Legacy retirement | Candidate V2 no longer needs V1 data compatibility, but V1 routes, invited runtime, compatibility redirects, and transitional fixtures still require deliberate disposition. |

This means the shortest path to a credible candidate demo is no longer more domain scaffolding. It is productionizing the candidate-led text-practice surfaces without weakening the contracts underneath them.

### V1 Disposition For The Production Surface Milestone

- **Preserve:** pre-session entry; the fade into practice; one question at a time; visible round progress; exact current-question/draft/feedback recovery; question-audio prefetch and no-repeat intent for the later media phase; acknowledgement before detailed coaching; explore-or-skip feedback; feedback-driven retry; explicit continue/finish; and a clear completion destination.
- **Reinterpret:** V1's visual workspace through the candidate design system; its candidate summary through dashboard Coach Update and Practice Next; its hints and strong-response material through accepted V2 evidence and reference contracts; and its invited/candidate completion branch through typed completion adapters.
- **Retire:** separate candidate-led and invited answer engines; score-derived feedback and dashboard truth; a standalone candidate-led summary route; preview as a production session mode; setup as a follow-up destination; and a pause screen that replaces the candidate dashboard as the durable home.
- **Defer:** TTS/voice/photo capture, invited initials and recruiter constraints, surveys, resume ingestion/revision, candidate attempt charts, model-comparison UI, and broader reference/settings surfaces. Their seams must remain possible, but they do not belong in the production-surface milestone.

### Staged Artifact Intake

The uncommitted `dashboard-demo`, `settings-demo`, and adjacent design documents are exploratory design work. They are not silently promoted into the product contract.

| Artifact idea | Disposition | Reason |
| --- | --- | --- |
| Bento/grid-led dashboard composition, compact role context, sparse Coach Update entry, transcript canvas, and responsive sheet patterns | Preserve as design input | These can improve hierarchy and interaction without changing evidence meaning. |
| Interactive transcript evidence spans | Reinterpret through accepted evaluator spans | Exact accepted offsets can support annotation; generated gap insertion, inferred filler, and hover-only explanations cannot be assumed. |
| Preparedness gauge, radar, heatmap, `Strong`/`Emerging` rollups, and colored overall-round status | Retire from the milestone | They turn model bands or marker frequency into score-like conclusions and conflict with the evidence-first dashboard contract. |
| Recruiter sharing, prepared badges, feedback strictness, destructive data controls, resume swapping/regeneration, and benchmark-oriented reference copy | Defer for separate contracts | Each changes privacy, evaluation, retention, or question-lineage behavior and requires explicit product and security decisions. |
| Simulated alerts, mock data, client-only export/delete, and false real-time AI stage logs | Retire as runtime behavior | A production surface must call durable boundaries and describe only work the runtime can prove. |

### Ratified Slices 141-144

1. **Typed session productionization:** finish responsive question, draft, evaluation, immediate feedback, retry, failure, recovery, exit, and completion presentation over `SharedLivePracticeShell`; do not add media or change evaluator behavior.
2. **Dashboard home productionization:** replace the scaffold with the stable state-priority shell over the existing read model, using the prototype only for safe visual composition.
3. **Dashboard work-surface productionization:** finish Coach Update detail, Coach Plan, Practice Next, and the durable builder/queue with truthful responsive, accessibility, and failure states.
4. **Integrated milestone acceptance:** prove the candidate-led typed journey end to end in fixture and guarded live-provider modes across mobile and desktop, then run the senior milestone gate.

This is one commit-scale milestone because all four slices change the presentation of the same already-integrated candidate loop. It explicitly excludes resume/media, invited convergence, host staging acceptance, QA reviewer tooling, settings/reference expansion, and speculative longitudinal charts.

### Later Phase Order

After the candidate-led production-surface milestone, choose the next phase from release need rather than proximity of prototype files:

1. App-owned recruiter login, route ownership, and the standalone invite-creation/handoff baseline.
2. Invited-candidate convergence over the shared session kernel and intentional debrief destination.
3. Real TA host-launch and deployment acceptance plus release operations as an externally gated parallel track.
4. Recruiter dashboard/settings, then approved TA recruiter launch, candidate/job prefill, and messaging handback.
5. Resume file/photo ingestion plus production TTS/voice/media with their privacy and recovery contracts.
6. QA reviewer/model-comparison workflow, technical-reference governance, longitudinal views, BI projections, admin disposition, and legacy retirement.

## Slice 147 Recruiter Pivot

The candidate-led production milestone cleared the condition that previously deferred recruiter route migration. Time constraints and missing host-owned launch details now favor a standalone recruiter V2 baseline rather than more speculative candidate integration work.

- **Preserve:** V1 Postgres app-owned auth concepts, recruiter route ownership, create/batch workflows, invite persistence and retries, dashboard status, invite-token entry, and initials mismatch signaling.
- **Reinterpret:** V1 modules through current V2 design, ownership, idempotency, question, session, attempt, evaluator, and completion contracts; email delivery gains explicit per-recipient outcomes while copy-link plus copy-message remain operational fallback affordances.
- **Retire:** recruiter question templates, duplicate invited/candidate answer engines, legacy score-derived feedback, and V1 data compatibility. App-owned email retires only after TalentArbor replaces bulk delivery and required evidence.
- **Defer:** TA recruiter launch and authorized prefill, TalentArbor messaging handback/API, admin/QA migration, media, and longitudinal reporting until the standalone invite journey is stable.

Candidate host-launch mechanics establish a useful security pattern but do not prove recruiter identity or authorization. See [Recruiter V2 Delivery And Host Integration](./recruiter-v2-delivery-and-host-integration.md).
