# Candidate App Handoff

Status: Active execution state
Last updated: 2026-07-10

## Current State

- Active branch: `feature/candidate-v2-rebuild`.
- Current rebuild target: canonical candidate routes under `/candidate/*`.
- Public landing page, `/candidate/setup`, `/candidate/session/[sessionId]`, `/candidate/dashboard`, `/candidate/launch`, and dev launch shells exist.
- `/candidate/session/[sessionId]` currently renders a planned-session shell from a setup-created durable session when the launch-session cookie resolves to the owning candidate identity. If durable recovery is unavailable, it falls back to the setup-created browser session-storage snapshot for local/dev continuity. Both paths carry setup input, a deterministic question category plan snapshot, optional/provisional fixture question wording, and provisional progress state.
- A provider-free question-wording boundary exists and is represented in the planned-session shell. It creates wording requests from setup plus plan snapshots, accepts only exact slot-mapped wording results, exposes an explicit provider-not-configured unavailable state, renders stored fixture wording as a read-only preview after strict parsing, opens a read-only question preview from that snapshot, and can start a live-question scaffold from valid carried wording. Browser-bridge and durable progress now support planned, question-preview, and live-question state plus current question index. The question shell includes an answer-draft scaffold with editable text draft state, disabled voice/photo affordances, durable text-draft persistence, durable progress persistence, a live-only typed answer submit attempt that verifies candidate ownership and saves a pending-analysis answer submission, then calls the route-level answer-analysis handoff that reads that pending submission but still fails closed while coaching remains disconnected. A typed answer-analysis provider adapter contract now defines how that saved answer, exact slot-mapped question, and setup context become a provider request, and how provider output must map back to the same answer/evidence contract before it can be accepted. The analysis route can now assemble and call an injected provider-request seam from that durable context, persist an adapter-valid provider result as an isolated V2 analysis snapshot, and return `answer_analysis_saved`; the live question shell can render that snapshot's candidate-safe coach feedback as a read-only current-answer surface. Default runtime behavior remains provider-unavailable.
- `candidate_practice_sessions` is the first V2 durable session persistence boundary for setup-created practice rounds. The migration and repository contract can store candidate ownership, optional role profile and host-launch links, setup snapshot, question plan snapshot, optional wording snapshot or wording status, progress state, answer drafts, and pending answer submissions. `/candidate/setup/start` now writes through this boundary when candidate identity is available and keeps the browser-bridge provisional response only when identity is unavailable. `/candidate/session/[sessionId]` now recovers candidate-owned durable sessions through the same launch-session identity boundary before falling back to browser storage, `/candidate/session/[sessionId]/progress` saves active question-preview progress for pause/resume recovery, `/candidate/session/[sessionId]/answer-drafts` persists typed drafts through the same ownership boundary, `/candidate/session/[sessionId]/answers` persists slot-scoped `pending_analysis` submissions, and `/candidate/session/[sessionId]/answers/[slotId]/analysis` creates an unavailable analysis request from the saved pending submission without writing legacy answers, feedback, summaries, or dashboard evidence. In explicit local dev host-launch mode, setup-start, session recovery, progress saves, answer-draft saves, answer-submit saves, and analysis requests resolve deterministic `dev-host-launch-*` cookies directly to fixture candidate profile ids without treating those non-UUID cookie values as DB launch-session ids.
- `/candidate/setup` preserves unsubmitted local browser draft state for the dev bridge, preserves drafts after failed session creation, and clears the submitted draft only after successful provisional session creation so returning to setup starts a clean prep context. Setup contract validation now runs client-side before POST, returns route-level `fieldErrors` for invalid setup payloads, and reports identity/persistence startup failures as `503` instead of masking them as invalid setup. Local dev host launch now resolves deterministic `dev-host-launch-*` cookies directly before falling back to `candidate_launch_sessions`.
- `/practice2`, `/session2/[sessionId]`, and `/dashboard2` remain compatibility redirects only.
- The rebuild is intentionally cleanroom: bring old app code back only when a numbered slice needs it.
- Future candidate workflow slices must reference V1 before implementation and record the V1 behavior being preserved, retired, or intentionally diverged from. Use [V1 SWOT And Rebuild Runway](./04-architecture/v1-swot-and-rebuild-runway.md) as the operating rule and source map.
- `db/exports/` is ignored because it contains local/Supabase backup artifacts.

## Recommended Next Slice

60. Define the next commit boundary after the live-session answer-analysis foundation. Recommended scope: decide whether to continue with default provider wiring/idempotency, browser-test fixture exposure for the read-only feedback surface, or commit/package the current submit-analysis foundation first. Keep dashboard evidence, summaries, legacy invited-session mutation, and broad UI rebuilds out unless explicitly resliced.

## Completed Slices

59. Add the first read-only coaching result surface from the isolated V2 analysis snapshot. The live question shell now stores an `answer_analysis_saved` snapshot returned by the analysis route, renders the current answer's candidate-safe coach feedback fields, and carries recovered durable analysis snapshots into the client shell. It does not render raw scores/evidence and does not write summaries, dashboard evidence, legacy final answer rows, retry/advance state, or media analysis. V1 reference remains the candidate active feedback sequencing, but V2 is using a minimal read-only surface rather than restoring the legacy feedback drawer. Defer: default provider wiring, idempotency reservation/replay, feedback interaction design, retry/continue behavior, media/audio analysis, summary/dashboard updates, QA eval export shape, and shared invited/candidate runtime persistence.

58. Add a deterministic provider-success persistence path for answer analysis. Added `answer_analysis_snapshots_json` to `candidate_practice_sessions` with migration, smoke, and repository coverage. The analysis route now accepts a deterministic injected provider result, parses it through the V2 adapter, persists adapter-valid output as a slot-scoped isolated V2 analysis snapshot, and returns `answer_analysis_saved`. Default runtime behavior remains provider-unavailable. V1 reference remains the legacy analysis route's provider-success sequencing, but V2 does not mutate legacy `InterviewSession`, `answers`, `eval_results`, summaries, or dashboard evidence. Defer: default provider wiring, idempotency reservation/replay, candidate-facing feedback UI, retry/advance, media/audio analysis, summary/dashboard updates, QA eval export shape, and shared invited/candidate runtime persistence.

57. Wire the analysis route to the provider adapter seam while keeping the provider unavailable by default. The answer-analysis route now accepts an injected `requestAnswerAnalysis` dependency, finds the exact worded question for the saved pending answer, builds the `answer_analysis_provider_requested` payload from setup/question/answer context, and calls the seam before still returning provider-not-configured. V1 reference remains the legacy analysis route and `useSessionAnswerMutations`: preserve the submit-then-analysis separation and question/context coupling, but do not yet reuse the legacy `InterviewSession` mutation path. Defer: default provider wiring, idempotency reservation/replay, successful provider result persistence, feedback UI, retry/advance, media/audio analysis, summary/dashboard updates, and shared invited/candidate runtime persistence.

56. Define the V2 answer-analysis provider adapter contract. Added `candidate-answer-analysis-adapter` with tests for provider request construction from a saved pending answer plus slot-mapped question/setup context, strict slot/index mapping, candidate-safe coach feedback fields, and evidence parsing that allows numeric scores only on `observed` evidence. Added the test to `test:candidate` and documented the provider request/result boundary in the data contract and spec. V1 reference checked: `useSessionAnswerMutations`, the legacy submit route, and legacy analysis route. Preserve: analysis happens after submit, uses the submitted transcript plus question/context, and must not mutate session state until provider success. Reinterpret: V2 now has a provider adapter contract that is independent from legacy `InterviewSession` mutation and dashboard evidence. Defer: route wiring to the adapter seam, idempotency enforcement, provider execution, successful analysis persistence, feedback UI, retry/advance, media/audio analysis, summary/dashboard updates, and shared invited/candidate runtime persistence.

55. Wire the browser-validation bridge for the analysis handoff. After a live-question typed answer is saved through `/candidate/session/[sessionId]/answers`, the V2 session shell now calls `/candidate/session/[sessionId]/answers/[slotId]/analysis` and surfaces the provider-not-configured response as candidate-readable copy. This proves the browser path from draft to pending answer to analysis request without evaluator/provider calls. V1 reference remains the submit-then-analysis sequencing in `useSessionAnswerMutations`. Preserve: analysis follows submit and uses the saved submitted answer. Reinterpret: V2 still stops at a provider-unavailable route response rather than entering feedback UI. Defer: evaluator/provider adapter, idempotency enforcement, feedback drawer, retry/advance, media/audio analysis, summary/dashboard updates, and shared invited/candidate live runtime persistence.

54. Add the V2 answer-analysis handoff boundary. Added lifecycle types for `answer_analysis_requested` and `answer_analysis_unavailable`, plus `/candidate/session/[sessionId]/answers/[slotId]/analysis`. The route resolves candidate identity, verifies the durable practice session belongs to that candidate, reads the saved slot-scoped `pending_analysis` submission, and returns provider-not-configured without writing feedback, summaries, dashboard evidence, legacy answer rows, or evaluator records. V1 reference checked: `useSessionAnswerMutations` calls submit first, then analysis with an idempotency key, and candidate active workspace shows feedback only after analysis returns. Preserve: analysis is after submit and uses the submitted answer as input. Reinterpret: V2 analysis handoff reads `candidate_practice_sessions.answer_submissions_json` and fails closed instead of calling the legacy analysis route. Defer: evaluator/provider adapter, idempotency enforcement, feedback drawer, retry/advance, media/audio analysis, summary/dashboard updates, and shared invited/candidate live runtime persistence.

53. Persist V2 pending typed answer submissions. Added `answer_submissions_json` to `candidate_practice_sessions`, lifecycle normalization for `pending_analysis` answer submissions, repository `saveAnswerSubmission`, and route behavior that verifies candidate ownership then persists a slot-scoped submitted answer snapshot. `/candidate/session/[sessionId]/answers` now returns `answer_submit_saved` with `next: "analysis_not_connected"` instead of the previous unavailable-only response, and the live-question scaffold shows candidate-readable saved-but-not-coached copy. V1 reference checked from the prior submit-boundary pass: candidate active question workspace and `useSessionAnswerMutations`. Preserve: submit is separate from draft save, the submitted transcript/modality/timestamp are captured before analysis, and candidate ownership gates submit. Reinterpret: V2 stores the pending submission in `candidate_practice_sessions.answer_submissions_json` rather than writing legacy `answers` or optimistic evaluation state. Defer: idempotency key enforcement, evaluator/analysis calls, feedback drawer, voice/media, retry/advance, summary/dashboard updates, and migration into shared invited/candidate live runtime rows.

52. Add the fail-closed typed answer-submit entry boundary. Added `/candidate/session/[sessionId]/answers` with dev host-launch identity resolution, candidate-owned durable session verification, nonblank typed draft validation, typed `answer_submit_requested` creation, and an explicit `answer_submit_unavailable` response while the answer lifecycle remains disconnected. The live-question scaffold now enables `Submit answer` only for nonblank typed drafts in `live_question` state, posts to the new route, and shows candidate-readable unavailable copy while preserving the draft. V1 reference checked: candidate active question workspace and `useSessionAnswerMutations`. Preserve: submit is separate from draft save, candidate identity/ownership must gate submit, and analysis is a later step. Reinterpret: V2 returns a typed unavailable boundary instead of optimistic legacy `AWAITING_EVALUATION`. Defer: final answer persistence, idempotency key enforcement, evaluator/analysis calls, feedback drawer, voice/media, retry/advance, summary/dashboard updates.

51. Add the first V1-informed live-question runtime boundary. Created `src/features/interview-session-v2/session-runtime-contract.ts` as the shared candidate-led/invited runtime vocabulary for planned, question-preview, and live-question progress plus consumer completion behavior. `/candidate/session/[sessionId]` can now start a live-question scaffold from a valid carried wording snapshot, persist `live_question` progress through the browser bridge and durable `/progress` route, and recover to the active question with answer submission still disabled. V1 reference checked: candidate-led active question/workspace, shared invited runtime, answer mutations, feedback drawer, progress, and completion behavior from `feature/candidate-module`. Preserve: explicit session start, current-question progress, pause/resume restoration, and shared-runtime direction. Reinterpret: V2 starts from carried wording snapshots and shared progress contracts before wiring legacy live `sessions`/`questions`. Defer/retire for now: evaluator/provider calls, feedback drawer, voice/media capture, summary/dashboard mutation, and duplicated candidate-only active workspace code.

50. Persist active session progress for intelligent pause/resume. Added a candidate-owned `/candidate/session/[sessionId]/progress` route, repository `saveProgress`, client calls from question-preview navigation, and candidate-suite coverage. Durable sessions now save planned versus question-preview state plus current question index so refresh, new tab, and later cross-device recovery can return the candidate to the active question surface with draft text intact. Browser-bridge sessions continue to use `sessionStorage` only.

49. Fix cross-tab durable session recovery for local dev host launch. Added a shared dev host-launch cookie identity helper and wired it into setup-start, `/candidate/session/[sessionId]`, and answer-draft persistence. New tabs can now recover candidate-owned durable sessions from the deterministic dev launch cookie instead of relying on tab-scoped `sessionStorage`; answer drafts use the same dev identity path. The dev cookie resolves candidate identity only and is not persisted as `candidate_launch_session_id` because it is not a UUID DB launch-session record.

48. Harden local dev host-launch setup submission. Diagnosed setup-submit `503` as the durable local Postgres path being active through `.env` `DATABASE_URL` while deterministic candidate fixtures were missing from the smoke DB, then found the dev launch cookie was also being passed into the UUID `candidate_launch_session_id` column. Seeded and validated the local candidate fixtures, added direct dev launch cookie identity resolution for `dev-host-launch-*` sessions without persisting that non-UUID cookie as a DB launch-session id, and documented the local smoke DB checks to run when setup submission returns `503`.

47. Tighten setup-start validation and failure classification. `/candidate/setup` now checks the shared setup contract before posting to `/candidate/setup/start`, prevents invalid over-limit setup values from triggering a console-only `400`, keeps invalid drafts from throwing during autosave, and shows the first setup contract error in the setup alert surface. The setup-start route now returns structured `fieldErrors` for invalid setup payloads and reports identity lookup or durable startup failures as `503` infrastructure failures instead of masking them as invalid setup.

46. Package the foundation commit boundary. Explicitly excluded disposable backup artifacts with `db/exports/` in `.gitignore`, ran candidate tests, typecheck, production build, practice-session migration apply, rollback smoke validation, and diff hygiene, then prepared the foundation package for `feature/candidate-v2-rebuild`. This package covers host launch through durable planned-session and answer-draft scaffolding without provider wiring, answer submission, feedback, dashboard updates, or live runtime behavior.

45. Persist answer drafts against `candidate_practice_sessions`. Added `answer_drafts_json` to the practice-session migration and smoke validation, extended the repository to restore/save candidate-owned drafts by session and slot, added `/candidate/session/[sessionId]/answer-drafts` with launch-session ownership resolution and fail-closed identity behavior, hydrates durable answer drafts into the question shell, and saves text draft changes for durable sessions. Browser-bridge sessions keep draft text component-local. No answer submission, evaluator/provider calls, feedback, summaries, dashboard reads, or live runtime behavior were added.

44. Add the typed answer lifecycle boundary stub. Added the candidate answer lifecycle contract for normalized text draft changes, submit-request events, and fail-closed submit-unavailable results with `answer_lifecycle_not_connected`. This is a typed boundary only and does not connect evaluator/provider wiring, answer submission, feedback, persistence by itself, scoring, summaries, dashboard reads, or live runtime behavior.

43. Add the answer-draft shell on the read-only question surface. The question preview now shows Type, Record, and Photo answer affordances, keeps Type selected, disables record/photo until media capture is deliberately wired, provides a labelled draft-answer text area, preserves typed text locally by question while navigating between preview questions, and keeps `Submit answer` disabled. No answer lifecycle contract, persistence, evaluator/provider calls, feedback, dashboard reads, or live runtime behavior were added.

42. Add durable planned-session recovery for `/candidate/session/[sessionId]`. The session page now has an injectable durable-session resolver, default recovery through `DATABASE_URL` plus the `ic_candidate_launch_session` cookie, candidate-ownership lookup against `candidate_launch_sessions`, and `candidate_practice_sessions` recovery for setup snapshot, question plan snapshot, optional wording snapshot, and progress. The planned-session client accepts a server-recovered initial session before browser storage is consulted, preserving the browser bridge as local/dev fallback. No provider calls, answer capture, answer submission, dashboard reads, or live runtime behavior were added.

41. Wire durable candidate practice-session creation behind `/candidate/setup/start` when candidate identity is available for the route. The setup-start route now uses an injectable identity/repository seam, resolves the launch-session cookie against `candidate_launch_sessions` when `DATABASE_URL` is configured, persists setup-created sessions into `candidate_practice_sessions`, returns the durable practice-session id as the candidate session route id, preserves browser-bridge provisional behavior when identity is unavailable, and fails closed when identity resolves but durable persistence cannot save. No provider calls, answer capture, answer submission, dashboard reads, or live runtime behavior were added.

40. Add the first durable candidate session persistence boundary for setup-created sessions. Added `candidate_practice_sessions`, rollback-only smoke validation, DB script wiring, and a query-client-backed repository that stores candidate ownership, optional role profile and host-launch links, setup snapshot, question plan snapshot, optional wording snapshot or wording status, and progress state. This does not wire `/candidate/setup/start` to durable persistence yet and does not add provider calls, answer capture, answer submission, dashboard reads, or live runtime behavior.

39. Add provisional session progress state for the browser/dev bridge. The provisional session store now defaults progress to planned/not-started, persists read-only question-preview state plus current preview question index, and the planned-session shell restores that progress across remount/reload while allowing read-only previous/next preview navigation. No answer capture, answer submission, provider calls, or durable persistence were added.

38. Define the successful setup submission reset boundary. `/candidate/setup` now preserves unsubmitted and failed-submit drafts but clears the candidate's setup draft only after successful provisional session creation, keeping the session snapshot in session storage while ensuring the next setup visit starts a clean prep context. The spec now treats intelligent statefulness and intentional top-scroll behavior as core UX requirements.

37. Add the first read-only question-start shell consuming the carried `questionWordingSnapshot` as the source of truth. The planned-session page now keeps `Start questions` disabled, adds a separate `Open first question preview` action, renders `Question 1 of N` with the stored question text, and explicitly omits text input, answer submission, analysis, durable sessions, and live runtime behavior.

36. Promote fixture-worded questions into the provisional session snapshot/store. `/candidate/setup/start` now returns `questionWordingSnapshot` beside setup and plan snapshots, browser session storage round-trips it, and `/candidate/session/[sessionId]` validates and renders the stored wording before falling back to fixture recomputation for stale dev snapshots. This preserves the setup -> plan -> wording trace while keeping production provider wiring, durable persistence, answer submission, and live runtime out of scope.

35. Add a non-AI fixture question-wording adapter behind the existing wording boundary. Fixture wording now produces deterministic, slot-mapped question text for local development, parses through the same strict result validator, distinguishes repeated category slots with distinct questions, and renders a read-only question preview on `/candidate/session/[sessionId]`. Production wording remains unavailable, `Start questions` stays disabled, and no durable persistence, provider call, answer submission, or live answer runtime was added.

34. Wire the question-wording boundary into the provisional planned-session shell. The shell now creates the wording request from the carried setup and plan snapshots, represents the provider-not-configured unavailable state in candidate-readable language, and keeps `Start questions` disabled until wording exists. No provider calls, durable persistence, or live answer runtime were added.

33. Add the provider-free question-wording boundary. The new contract creates `question_wording_requested` requests from one setup snapshot plus one `questionPlanSnapshot`, parses `questions_worded` results only when each question maps exactly to the carried plan slot order/category, rejects skipped/duplicated/misclassified slots, and exposes a `question_wording_unavailable` fail-closed state for provider-not-configured cases. No provider calls, durable persistence, or live answer runtime were added.

32. Promote the deterministic question plan into the provisional session contract. `/candidate/setup/start` now returns `questionPlanSnapshot` beside `setupSnapshot`, browser session storage round-trips that snapshot, and `/candidate/session/[sessionId]` renders the carried plan as the primary source with only a stale-dev-snapshot fallback. Session copy now frames the next boundary as question wording rather than question planning.

31. Add the first deterministic question-planning contract for the provisional planned-session shell. The new candidate question-plan module derives category slots from `interviewStage` and `questionCount`, using the canonical categories Screening, Behavioral, Culture / Fit, Scenario, and Technical / Role-Specific. `/candidate/session/[sessionId]` displays the planned category mix while clearly stating that question wording has not been generated yet. This remains local, non-AI, and non-durable.

30. Build the first planned-session shell behind `/candidate/session/[sessionId]`. Setup-created provisional sessions are saved to browser `sessionStorage` before navigation; the session route reads the matching setup snapshot client-side, scrolls to top, and shows target role, interview stage, question count, resume inclusion state, job description context, and a disabled `Start questions` boundary. Direct visits without a snapshot show a recovery state back to `/candidate/setup`. This remains non-durable and non-AI; it only proves the setup-to-session handoff and the next question-planning boundary.

29. Add the `/candidate/setup` to `/candidate/session/[sessionId]` provisional session creation boundary. The setup UI still emits the typed `ready_for_session_creation` transition, then defaults to POSTing the normalized payload to `/candidate/setup/start`; the server route validates setup input, creates a provisional session route id, and returns `session_created` plus `/candidate/session/{id}`. This deliberately does not generate questions, persist a durable practice session, or restore the full session runtime. Tests cover setup payload normalization, invalid setup rejection, route success/failure, UI boundary invocation, and UI error handling when session creation fails.

28. Wire production host-launch dependency assembly behind `/candidate/launch`. The exported route now uses dev launch dependencies only when explicit dev mode is enabled; otherwise it attempts production assembly from `CANDIDATE_HOST_LAUNCH_SECRET` plus `DATABASE_URL`, verifies host JWTs with the production verifier, uses the concrete candidate launch-session repository, and still fails closed at the placeholder TA/RW launch-context lookup until the real proc/query adapter is supplied. Tests cover unconfigured fail-closed behavior, dev launch preservation, production dependency assembly, production token verification, and configured-production fail-closed route behavior.

27. Reconcile concrete candidate identity/session storage with host launch. Added `006_candidate_host_launch_schema.sql`, host-launch identity trace columns, `candidate_launch_sessions`, smoke validation, and the query-client-backed candidate launch-session repository.

26. Add the host-launch orchestration boundary. The orchestrator composes token verification, launch-context lookup, candidate profile/session resolution, and route-compatible launch results without hard-coding production database access.

25. Add the candidate launch profile/session resolver boundary. The resolver maps verified host handoff plus normalized launch context to identity lookup/create, candidate profile, and app launch session.

24. Add the launch-context normalization boundary based on TA staging DB discovery. It normalizes candidate, source, job, resume availability, and AI consent context while excluding full resume text.

23. Add the production host-launch verifier boundary. It verifies the current HS256 shared-secret token shape with required `candidate_id`, `product`, `email`, and `exp`, optional issuer/timing claims, and optional job/source hints.

22. Add dev-only host launch mode and local token minting for fixture candidates. `/candidate/dev/launch` mints local host-shaped tokens only when explicit dev env is enabled.

21. Add the `/candidate/launch` route shell. It reads token/next params, delegates verification/profile resolution, strips token-bearing URLs through redirect, and sets the candidate launch cookie on success.

20. Preserve host-platform token intelligence and add the first host-launch contract scaffold.

19. Add `/candidate/setup` local draft preservation behind the typed setup contract. Browser storage is a dev bridge; production needs identity-backed persistence.

18. Add the first `/candidate/setup` typed payload and transition contract.

17. Replace the `/candidate/setup` placeholder with the first-pass setup UI and follow-up polish.

16. Promote canonical `/candidate/*` route names and keep temporary `*2` routes as redirects.

15. Tune public root page design and copy after screenshot review.

14. Rebuild the public root page using the tracked design-system source.

13. Bring the full `.untracked/design-system` file set into tracked `design-system/`.

12. Refactor the public root page into a restrained Interview Coach gateway.

11. Neutralize implementation-specific `candidate-v2-*` CSS class names and reorder `src/index.css`.

10. Promote layout tokens/primitives from `.untracked/design-system`.

9. Bring in the v1 app root page as-is for design-system review.

8. Add V2 evidence-first evaluation domain contracts.

7. Add the shared V2 completion behavior contract.

6. Bring in the session-domain types/contracts needed for completion behavior.

5. Promote first tracked candidate design-system primitives.

4. Re-establish V2 route scaffold for the temporary `*2` paths.

> Cleanroom reset decision: from slice 4 onward, the rebuild intentionally starts from minimal app code and brings old app behavior back only when a numbered slice requires it.

1. Repair the session GET/PATCH authorization blocker.

2. Add temporary V2 shell routes for `/practice2`, `/session2/[sessionId]`, and `/dashboard2`.

3. Promote the minimal design-system pieces needed by the temporary V2 route shells.

## Current Risks

- Production `/candidate/launch` remains fail-closed until the TA/RW launch-context lookup adapter is implemented and configured.
- Host-launch replay protection, resume text retrieval, durable `prepProfile` creation, and secret rotation are not implemented.
- `/candidate/setup` and `/candidate/session/[sessionId]` currently prove UI, typed setup contract, local draft preservation with a post-success reset boundary, provisional server transition, browser-fallback planned-session recovery with explicit progress state, deterministic local category planning carried as an explicit plan snapshot, a provider-free question-wording validation boundary, a stored read-only fixture question preview, a live-question scaffold with answer draft scaffolding, durable candidate practice-session storage, route-level durable setup-created session creation, durable planned-session recovery, durable text answer-draft persistence, pending typed answer submission persistence, and a fail-closed answer-analysis handoff when identity is available. OCR/file parsing, identity-backed setup draft persistence, generated question wording provider wiring, evaluator/provider calls, feedback, summaries, dashboard updates, and the full shared live runtime remain pending.
- Candidate setup local browser preservation does not satisfy the production new-device draft requirement.
- Temporary compatibility redirects should be removed once canonical `/candidate/*` routes have absorbed internal and external references.
- Historical candidate implementation tests are not fully restored on the cleanroom branch; keep `npm run test:candidate` scoped to deliberately restored surfaces.
- Dashboard Coach Plan remains the release direction; avoid spending additional polish on transition matrix/Quick View surfaces unless it supports migration or validation.
- Sensitive data can still be too visible in AI-quality/debug surfaces until masking/redaction work lands.

## Deprecation Check

For each future candidate workflow or dashboard refactor slice:

- Name the old surface or helper being superseded.
- Search call sites before removing or replacing behavior.
- Classify the old code as `keep as transition`, `remove now`, or `mark for retirement`.
- Keep tests aligned with that classification.
- Record transition/retirement status here.

## V1 Reference Rule

Before each meaningful candidate workflow slice:

- Inspect the matching V1 behavior from `feature/candidate-module` without switching the active rebuild worktree when possible.
- Record the V1 files checked and the behavior contract learned from them.
- State whether each relevant V1 behavior is `preserve`, `reinterpret`, `retire`, or `defer`.
- If V1, the original refactor pack, and the current V2 contract disagree, name the divergence before implementation so the user can steer.

V1 is a behavior reference, not a default source-code donor. The cleanroom V2 contracts remain the landing structure.

## Refresh Rule

At the end of each meaningful work session, rewrite this file so the next session can resume without reading the full doc set.
