# Candidate App Spec

Status: Canonical product intent
Last updated: 2026-07-17

## Purpose

The candidate app helps a job seeker prepare for a target interview by creating a role-specific practice round, coaching each answer, summarizing what to strengthen, and showing ongoing interview preparedness.

This file is the product boundary. It should describe what the candidate experiences and what the app may claim. It should not describe database tables, implementation files, package scripts, or code-level architecture.

## Product Scope

The candidate app is part of the shared Interview Coach host at `interviewcoach.talentarbor.com`.

Candidate-facing routes are expected to include:

- `/` public Interview Coach landing page.
- `/candidate/setup` candidate-owned practice setup.
- `/candidate/session/[sessionId]` candidate-owned live practice session.
- `/candidate/summary/[sessionId]` candidate-owned session debrief, if summary remains a separate surface.
- `/candidate/dashboard` candidate-owned interview preparedness dashboard.

The production-quality candidate rebuild uses the `/candidate/*` namespace rather than the temporary `*2` route names from the original parallel-route plan. `/candidate` itself is not a product UI surface; it should redirect or guard to the appropriate candidate destination, usually `/candidate/dashboard`. Temporary paths such as `/practice2`, `/session2/[sessionId]`, and `/dashboard2` may remain only as compatibility redirects while links and tests move to the canonical namespace. Rebuilt candidate routes must keep the same candidate-facing product claims and privacy boundaries described in this spec unless this file is updated first.

Production V2 candidate surfaces should depend on tracked design-system wrappers and tokens, not directly on `.untracked/design-system` files. The untracked design-system pack may remain a reference while components are promoted slice by slice.

The V2 rebuild branch intentionally starts from a minimal app scaffold. Existing app code should be brought back only when a numbered slice requires it, with the source/reference named in the commit and handoff.

Recruiter, admin, and QA routes share the deployable app, but candidate practice data is candidate-owned. Recruiters and hiring-decision users should not see candidate-led practice content. Admin and QA access may exist only for support, quality, and operational review with appropriate privacy controls.

Recruiter-created invite flows may share question planning services with the candidate app. When recruiter question setup changes, invited-session answer feedback, retry/continue behavior, and summary behavior should remain stable unless a recruiter-facing product change is explicitly specified.

## Core Candidate Flows

### Public Entry

The public page introduces Interview Coach as a TalentArbor/Rangam gateway for visitors who arrive directly at `interviewcoach.talentarbor.com`.

The public page should:

- make the product name and preparation purpose clear in the first viewport;
- route job seekers to `https://talentarbor.com/job-seeker`;
- route employer/client visitors to `https://rangam.com/employers`;
- keep employee/recruiter login available as a low-prominence utility action;
- explain product value through coaching instead of scoring, flexible practice guided by the interview stage the candidate is preparing for, support for many job types beyond tech/corporate roles, and grounded guidance about interview question types, why they are used, and how strong answers are shaped;
- avoid abstract product metaphors or decorative visuals that do not map to a real user action or product state;
- state plainly that candidate-led practice is for preparation and review, not employer hiring decisions.

After login or verified host launch, the candidate should return to the intended candidate route when that integration contract is available.

### Host Launch Security And Session Contract

The production host launch token is a short-lived, signed, one-time exchange credential. It is not the Interview Coach session and must not be retained as one.

- `/candidate/launch?token=...` accepts an HS256 JWT only at the server boundary, removes the token from the redirect URL, returns a non-cacheable no-referrer redirect, and never persists or logs the raw token or full claim payload. Deployment access logs in front of the app must redact the token query value.
- Required trusted claims are `candidate_id`, `email`, `product: "interview-coach"`, `iss`, numeric `iat`, and numeric `exp`. `jti`, `source_portal`, `source_surface`, and `job_collection_id` are supported context claims; `job_collection_id` is optional because a host dashboard quick-link is not job-aware.
- The accepted launch-token lifetime defaults to no more than two minutes. Future-issued tolerance is bounded separately. Wrong algorithm/signature, product, issuer, source portal, timing, or required identity fails closed before host data lookup.
- The server hashes the normalized raw token with SHA-256. A token fingerprint, or an issuer-scoped `jti` when supplied, may create at most one Interview Coach launch session. A replay does not recover or disclose the session created by the first exchange; the candidate must return to the host for a newly minted launch token.
- The Interview Coach session gets its own server-governed lifetime, currently configurable up to seven days. Its cookie expiry does not inherit the launch token's remaining seconds.
- The trusted host candidate id must match the candidate resolved from the host data source. Job-aware launch must additionally prove that the candidate owns the requested host job-activity row. Email is a profile attribute, not an ownership key.
- Identity-only launch and job-aware launch use the same security boundary. The server chooses the canonical entry route after identity resolution: job-aware launch enters setup; identity-only launch enters setup when the candidate has no prep contexts and otherwise enters the dashboard. An unsigned browser `next` value cannot override that production decision.

### Practice Setup

In production, `/candidate/setup` requires an active verified Interview Coach launch session. An identity-only host dashboard launch may create a candidate-owned manual prep context when the candidate has no existing prep contexts; it must not invent host job identity. A job-aware launch may prepopulate target role and job description only after the app proves the signed candidate owns the requested job activity and reads canonical host job context.

Job-aware canonical role and JD are staged server-side with the launch session, never placed in the URL or cookie, and rendered read-only. Browser submissions carry only an entry-mode marker; the server reattaches and validates the canonical snapshot. Interview stage, question count, and optional resume remain candidate choices. The launch exchange itself creates neither a prep context nor a practice session.

The staged job snapshot survives refresh and new tabs while its launch session is active. It is consumed atomically only when setup creates a practice session or when the candidate deliberately opens an already-existing path for that same host job. A stale tab cannot reuse consumed staging. Host changes after launch do not silently rewrite the accepted snapshot.

The candidate creates a practice round by providing:

- target role, required;
- job description, required;
- resume content, optional, supplied as pasted text or extracted text from an uploaded resume file or resume photo;
- what interview moment they are preparing for, required;
- question count, required.

The default setup should stay short. Stage and question count are first-class practice configuration, not intake. Future advanced setup may expand inline for additional coaching customization, but it should not make setup feel like a long intake interview.

Setup submission must produce a typed payload before any session-generation side effect runs. The payload includes normalized `targetRole`, normalized `jobDescription`, nullable normalized `resumeText`, `interviewStage`, `questionCount`, and resume capture mode. When candidate identity and durable dependencies are available, the server must first resolve one candidate-owned opaque prep context and then persist the new practice session with that `roleProfileId`, setup snapshot, deterministic `questionPlanSnapshot`, and available `questionWordingSnapshot`. It returns `/candidate/session/[sessionId]` only after durable session creation succeeds. An explicit non-production browser bridge may still create a provisional route id when durable storage is absent. No production question-generation call is implied by this transition.

Manual setup must not silently reuse a candidate-owned prep context that already has practice activity when normalized role and normalized JD are an exact match. Before creating a session, show every active/paused exact match in a choice dialog with its creation date, latest practice activity, role, expandable JD, original interview stage and count, completed-session count, completed-question count, and active-round progress when present. `View in dashboard` selects that opaque context and clears the submitted setup draft. `Start a separate path` creates a new independent `role_profile_id` and first round from the submitted setup; it does not inherit sessions, answers, plan coverage, or coaching evidence from the matched context. Exact-match profiles with no session activity may be reused only as repair for a prior partial setup write and should not be presented as practice evidence.

Setup draft preservation should begin before session creation. Once the candidate has supplied the required role and job description, setup should create or restore an editable draft, autosave normalized setup fields, and restore the same draft when the candidate revisits or reloads. Production persistence must be identity-backed so the same candidate can return from another authenticated device; local browser persistence is acceptable only as a development bridge while the verified host-launch identity boundary is being built.

During a practice session, intelligent statefulness should restore the candidate to the meaningful point where they left off. When a candidate has opened a question surface, pause/resume, refresh, or a new tab/device recovery should restore the active session view and current question index, not only the session setup and draft text. Text answer drafts should recover with the same question context.

Setup draft state remains editable and restorable until a setup submission successfully creates the next session boundary. Failed submissions must preserve the draft so the candidate can retry without losing work. Successful session creation should clear the setup draft for that candidate so returning to `/candidate/setup` starts a new prep context instead of re-opening an already-submitted setup.

When the candidate chooses an interview stage, the setup surface should recommend a default question count for that stage while still allowing the candidate to choose a different count. Recommendation help text should use first-person coach voice and explain that the coach will guide further practice after the first session.

Resume upload and resume photo capture must normalize to text before downstream generation and coaching. The first UI may expose the file/photo capture and review-text surface before OCR or parser wiring lands, but it must not imply that raw files or photos are the coaching payload.

A resume belongs to the prep-context history but is consumed through an immutable session snapshot. Question generation, hints, strong-response guidance, and feedback use the resume staged for that round. A later resume change must not silently reinterpret or rewrite already-generated questions. The future update flow may evaluate the revised resume against the existing plan, propose one-for-one question replacements that preserve category/slot logic, and let the candidate accept individual replacements. Accepted replacements version the affected plan-question identities while retaining the same `role_profile_id`; historical sessions continue to explain themselves from their original resume and question snapshots. Every follow-up pre-session landing should show the staged resume label, such as the uploaded filename or a generated label for pasted text, with an optional preview affordance.

Interview stage has a different identity consequence. A candidate-initiated stage change creates a new linked `role_profile_id` with a blank practice/evidence history; it does not mutate the stage of an existing prep path or port evidence from the prior stage. Stage-transition UI, lineage fields, and resume-question reconciliation are deliberately deferred beyond the exact-match choice slice.

Question planning should stay deterministic and explainable before any AI question text is generated. The app may use target role, job description, resume context, interview stage, and question count to choose the intended category mix, but it should not imply that the generated question set alone defines overall interview preparedness.

Question wording must be requested from the explicit setup snapshot plus the carried `questionPlanSnapshot`. Provider or fixture output must be parsed through a typed result boundary that maps every question back to exactly one plan slot in order. Results that skip, duplicate, reorder, or misclassify plan slots must fail closed rather than being repaired silently. Until a provider is deliberately wired, the wording boundary should expose an explicit unavailable state instead of fabricating live-session questions.

Candidate setup should clearly state:

- what data is used for coaching;
- that resume content is optional;
- that candidate-led practice is for coaching and preparation;
- that hiring-decision users should not use candidate-led practice content for selection decisions.

Setup and session-launch transitions should include progress/loading UI so candidates understand when the app is preparing the plan, extracting resume text, generating questions, or moving into the session.

### Live Session

The live session should feel equivalent in quality to the recruiter-invited practice session experience while preserving candidate ownership.

During the cleanroom rebuild, `/candidate/session/[sessionId]` may first render a planned-session shell before the live runtime is restored. When a candidate-owned durable practice-session id can be resolved through the verified launch-session identity, that shell should recover the persisted setup snapshot, carried `questionPlanSnapshot`, optional `questionWordingSnapshot`, wording status, provisional progress, answer drafts, and pending answer submissions from `candidate_practice_sessions`. Browser session storage remains only a local/development bridge when durable identity or durable session recovery is unavailable. The shell should show the target role, interview stage, question count, resume inclusion state, role/JD context, the carried `questionPlanSnapshot`, and the carried provisional `questionWordingSnapshot` when present. It may create the provider-free question-wording request, show the explicit wording-unavailable state while provider wiring is absent, render deterministic fixture wording as a scaffold-only read-only preview after strict slot parsing, and open a read-only question preview from that wording snapshot for local validation. Provisional progress includes planned/not-started, read-only-question-preview, and started-live-question scaffold state plus the current question index; durable sessions should save that progress on navigation or live start so pause/resume, refresh, and cross-tab recovery return to the active question surface. The question shell may expose a local answer-draft surface with text entry and visible voice/photo affordances; text drafts should persist through the durable practice-session boundary when identity is available and stay component-local for browser-bridge sessions. The scaffold may start from carried local or stored wording before production provider wiring lands, typed draft submission may save a candidate-owned pending-analysis answer submission after ownership verification, and an analysis handoff route may read that saved pending submission before returning an explicit provider-not-configured unavailable state or, in explicit local dev validation mode, a deterministic fixture coaching snapshot. Answer-submit and answer-analysis mutations should be idempotent per candidate-owned practice session and question slot: V2 contracts use the candidate profile as actor, slot-scoped `candidate_answer_submit` or `candidate_answer_analysis` scopes, explicit `Idempotency-Key` values when supplied, deterministic fallback keys from the submitted payload when not supplied, replay for completed matching work, retryable `409` for matching in-flight work, and nonretryable `409` for key reuse with a different payload. The provider adapter should use the saved answer, the exact slot-mapped question, and setup context to request coaching, then accept only provider output that maps back to the same answer and evidence contract. Valid provider output may be persisted as an isolated V2 analysis snapshot, and the live question shell may show its candidate-safe coach feedback as a read-only current-answer surface. After that feedback appears, the live shell should provide the next executable transition: continue to the next live question, or finish the session on the last question. Finishing must call the candidate-owned completion route before routing to `/candidate/dashboard`. That pending submission, analysis request, provider adapter, analysis snapshot, feedback transition, and completion action must not create summaries, dashboard evidence, or legacy final answer rows until those lifecycles land. Media capture must stay disabled or unavailable until deliberately wired.

The production live-practice shell supersedes the planned/preview scaffold as candidate UI. It renders one question at a time from audience-neutral `SessionRuntimeFacts`, keeps answer and coaching mutation ownership outside the shared view, and accepts narrow completion/return adapters for candidate-led and invited practice. Candidate-led exit always returns to the dashboard context for the session's target role without clearing live progress; invited exit may later return to the invitation landing boundary. Persisted `question_preview` progress is a compatibility state only and must migrate to the equivalent live question. The candidate completion mutation and role-scoped dashboard destination are fixed, but the final feedback-stage finish CTA presentation remains deliberately unresolved.

Typed answers must expose truthful mutation states without collapsing draft save, answer acceptance, and coaching analysis into one generic loading state. Draft changes save after a short debounce and flush on field exit, answer submit, and page exit where the browser permits it. A draft-save failure must leave the response editable and offer an in-place save retry. After answer acceptance, the submitted response becomes read-only; if coaching analysis fails, the UI must state that the answer is already saved and retry only analysis rather than submitting the answer again. Submit and analysis loading states must prevent duplicate actions, and recovered pending-analysis answers must preserve their submitted text and offer the same analysis-only recovery. Failed answer or analysis work must release its pending idempotency record so an immediate retry can proceed. If a process stops before cleanup, a matching pending request becomes retryable after a two-minute recovery window; completed matching requests still replay their stored result, and key reuse with a different payload still fails closed. Voice and photo answers remain unavailable until their privacy, permission, storage, transcription, and provider contracts are deliberately wired.

Answer history must distinguish drafting, answer attempts, and evaluator runs. Pre-submission edits remain one discardable draft. The first accepted submission creates answer attempt one for that question occurrence. Choosing retry after coach feedback creates a new immutable answer attempt linked to the attempt it supersedes; it must not overwrite the earlier submitted answer or its coaching. Retrying failed analysis creates the next durably leased evaluator generation against the same answer attempt, not another answer attempt. Fresh matching client replays recover one requested generation, completed matching work replays its accepted result, and an expired or terminal generation cannot later complete. Candidate coaching permits no more than one fresh requested run and one accepted result for one answer-attempt/input-fingerprint unit. Model/prompt A/B comparisons likewise attach multiple evaluator runs to the same fixed answer attempt and input fingerprint without inheriting that single-accepted coaching restriction. Practicing the question in a later session creates a new question occurrence with the existing cross-session follow-up lineage. Candidate-visible attempt counts and charts remain deferred, but the durable lineage must support later candidate progress views, recruiter engagement context, QA comparison, and enterprise BI without reconstructing overwritten JSON.

Question audio should use an optional shared lifecycle rather than audience-specific controllers. When an adapter is configured, the landing prefetches question one, entering a question prefetches the current and next question, the Start practice gesture unlocks browser audio, and a question that has already played in that browser session does not auto-play again after refresh. Recovered-session playback may follow the adapter's stable default until product testing justifies more tuning. V1's TTS route is coupled to legacy authorization and must not be copied; production TTS transport, V2 ownership checks, provider selection, retry behavior, and observability remain separate implementation work.

The production candidate flow should be setup submission, then a pre-session landing page, then the live session after the candidate chooses to continue. Initial and follow-up candidate-led rounds should share one landing composition with variant facts: the initial round summarizes its role, stage, question count, and optional resume context; follow-up rounds summarize the selected practice items without sending the candidate through generic setup again. Both variants should make pause-and-return behavior clear, use candidate-led privacy language, and expose one primary start action. Preserve a dedicated landing-to-session overlay that reads "Entering practice space." It should fade in over the landing, hold while the live workspace mounts underneath, and fade away to reveal the first question; reduced-motion preferences should remove the animation without removing the orienting transition. It must not imply a live interview, recruiter presence, or session generation when a durable round already exists.

Invited candidates retain V1's two-stage entry pattern as a separate entry variant: initials confirmation first, then the pre-session landing. Initials are a lightweight possible-misinvitation signal for the recruiter, not authentication or proof of identity. Invited copy may explain recruiter answer visibility, return through the original invitation, and invited completion behavior; those claims must not leak into authenticated candidate-led practice. Candidate-led rounds do not need initials entry or invitation-link guidance.

Pre-session confidence should be optional and must never gate the start action. When its persistence contract lands, use a fully labeled non-emoji scale and store it as a self-reported confidence measurement, separate from answer evaluation and generic product feedback. Do not ship a selector that discards the response. V1 does not have dual preview/live modes, and V2 should not make scaffold preview mode part of the production candidate session by default. If a preview capability is later designed, it should have a distinct product purpose and should not be a read-only mirror of the active session UI.

Read-only question preview navigation belongs only to the scaffold pre-live preview state. Once the candidate starts live practice, the session should show live-answer controls and must not expose previous/next preview controls.

Submitting an answer does not by itself advance to the next question. Submit saves the answer and requests coaching; after coaching is ready, the next transition is driven by the feedback action contract: explore or skip, then retry/revise, continue, finish, or pause. The app persists a valid candidate-selected transition before executing it.

After coaching is ready, the candidate-facing interaction preserves the useful V1 cadence without copying V1 content. It starts with a brief acknowledgement, then reveals answer-content coaching, optional delivery coaching when warranted, and a final next step. Intermediate stages let the candidate continue exploring coaching or skip ahead; the final stage chooses the appropriate emphasis among retry, continue, finish, or pause. Retry is offered only when the coaching result is tied to immutable answer-attempt identity, and becomes primary only when the coaching read indicates revision would help. Continue becomes finish on the last question. Feedback copy and evidence mapping come only from the V2 candidate-safe evaluation projection, not legacy scoring, hidden evaluator prose, or legacy field names.

Downstream session, summary, and dashboard surfaces should consume candidate-safe coaching facts derived from the accepted analysis snapshot. Those facts may include qualitative bands, coach copy, observed/excluded evidence counts, and coverage context, but they should not show raw scores, averages, or hidden readiness calculations as product language.

QA/evaluation should be built for evaluator review and model-response comparison, not as another candidate dashboard surface. The V2 export shape should start with a fixed QA case from setup context, one exact worded question, and one submitted answer; attach one or more model/prompt/evaluator runs to that case; and compare two runs only when they share the same case id and input fingerprint. This supports A/B comparison of different model responses to the same prompt/context. It should not include a source-app/app-name axis because V2 AI calls serve the same interview-coach evaluator job across the rebuilt surfaces.

Production V2 analysis must follow the [Evidence-First Evaluator Contract](./05-quality/evidence-first-evaluator-contract.md). One immutable answer attempt is the fixed evaluation unit. A model may identify exact quote strings and bounded semantic classifications and later compose coaching from code-accepted facts, but code owns immutable schema/fingerprint identity, exact offset attachment, observable-marker and missing-evidence derivation, applicability, qualitative bands, category pattern gaps, conditional verification, safety checks, retries, the 45-second aggregate budget, and the candidate-safe projection. Stage adapters perform one transport attempt per invocation and may not hide SDK retries. Missing, unelicited, sensitive, unusable, or technically unverifiable evidence must not become a low-performance band. Technical correctness claims require a supplied versioned reference. Candidate identity, launch secrets, self-reported confidence, assembled prompts, and unvalidated raw output are excluded from normal provider/telemetry persistence. Accepted extraction, appraisal, verifier, feedback-plan, and stage metadata stay in the fenced internal evaluator-run result; session/browser state receives only candidate-facing coaching and its minimal interaction directive. The first conformed provider profile is the code-owned Google Gen AI `google_gemini_2_5_flash_v1` profile. It keeps all candidate material in a separately marked untrusted user-data envelope, uses strict structured-output validation, records effective thinking budgets and disabled thought return in the immutable manifest, and maps provider failures to safe internal codes. The answer-analysis route selects it only from the exact server provider/profile/key contract and invokes it only after candidate ownership and a durable evaluator-run claim; replay, completed repair, unauthorized work, and invalid configuration make no provider call. Two credentialed seven-case gates, an offline same-profile repeatability comparison, and one disposable-DB candidate-route flow have passed with the same immutable configuration fingerprint. Technical-reference sourcing beyond supplied QA references, production observability, organizational deployment readiness, human qualitative review, and serving-profile promotion remain fail-closed integration work. The ratified provider-specific decisions, configuration manifest, candidate failure behavior, and conformance gate are implementation authority in the [Production Evaluator Integration Contract](./05-quality/production-evaluator-integration-contract.md).

The V2 rebuild has no migration or runtime compatibility requirement for app data created by V1. Temporary compatibility projections and migration backfills may bridge only records created during the staged V2 build, must identify unknown historical settings truthfully, and must not become production acceptance requirements.

The completed-round bridge should keep candidate review question-first while separating immediate feedback from post-session synthesis. In-session feedback evaluates one submitted answer and supports the next in-session choice. Coach Update synthesizes what the latest completed practice adds to the coach's understanding and what that means for the candidate's next useful move. Its detail includes only questions practiced in the source session, with candidate answer, accepted candidate-safe coaching, and evidence-specific comparison to prior attempts when comparable evidence exists. Skipped or unanswered planned questions remain missing coverage in Coach Plan and Practice Next; they are not Coach Update feedback and must not be presented as weak performance.

The exact Coach Update wording should be stored as a versioned operational coaching artifact tied to its source prep context, completed session, immutable answer attempts, accepted evaluator runs, input fingerprint, prompt/evaluator versions, and creation time. This supports stable replay and QA without making the update a durable preparedness conclusion. A later completed round may supersede which update is primary without deleting older source-linked artifacts. Repeat-practice copy may acknowledge effort and describe specific supported movement, but repetition is not automatic improvement and a hidden-score delta is not candidate-safe progression or regression evidence.

Session completion is the durable boundary that makes post-session synthesis eligible. The first accepted completion snapshot is immutable and duplicate completion requests must replay it rather than rewrite its timestamp or question sets. After completion persists, the app may repair missing candidate coaching only for the exact latest immutable answer attempt of each answered occurrence. Repair must reuse the ordinary ownership-scoped answer-analysis claim/runtime boundary, preserve evaluator generations, and obey the same pending, retryable, nonretryable, lease, configuration, and generation-cap policy as in-session analysis. One repair request may attempt at most two eligible answers so a completed round cannot create an unbounded provider fan-out; additional eligible work remains explicitly retryable. Completion replay and the unavailable Coach Update action share this repair contract, while dashboard reads remain side-effect free. Coach Update generation runs only after every answered occurrence has one matching accepted candidate-coaching run. A missing, pending, rejected, malformed, superseded, or nonretryable evaluator result must keep partial synthesis forbidden. Repair or synthesis failure must not roll back the completed round or prevent dashboard return. A later repair action may regenerate the artifact from the same unchanged source facts.

Coach Update generation must claim one versioned artifact attempt against one candidate-owned completed session. Its synthesis input includes only the latest immutable answer attempt for each answered source item, one completed `candidate_coaching` evaluator run whose validated disposition is `accepted` for each included attempt, and candidate-safe comparable history from the same prep context and source plan question. Requested, failed, rejected, mismatched, or superseded evaluator runs are not accepted synthesis evidence. The service must re-read and re-fingerprint its source facts before accepting generated content. A changed completion, attempt, evaluator-run, ownership, or prep-context fingerprint rejects the artifact as stale; a missing accepted run leaves Coach Update unavailable rather than producing a partial or legacy-derived update. Generation claims and terminal transitions are replay-safe; an abandoned requested claim becomes a terminal failure after the bounded claim lease so an unchanged source can be retried. Candidate-safe content must match the exact versioned runtime schema, carry an accepted validation disposition, and reject undeclared or score-like fields before it can be read as completed. Raw provider output is not stored as candidate-safe content before validation.

The Coach Update provider is a language synthesizer, not an evidence owner. Its bounded request excludes current and prior raw answers, candidate identity, launch credentials, database ownership ids, raw evaluator output, and hidden evaluator plans. It receives only the practiced question, response mode, and accepted candidate-safe coaching facts required to write a round title, summary, primary focus, and per-question comparison language. Code reattaches immutable question, answer, source, accepted-coaching, and comparison-count facts after strict fingerprint, cardinality, order, schema, and prohibited-language validation. One artifact claim owns one 12-second provider attempt with no hidden transport retry; a terminal failure is retried only by claiming a later artifact generation attempt against unchanged source facts. Metadata-only telemetry may record provider/model/prompt/evaluator versions, synthesis fingerprint, outcome, safe error code, latency, attempt count, and token counts, but not prompts, answers, job descriptions, resumes, raw output, or generated coaching text. A development fault injector must be server-controlled, environment-selected, and unavailable outside explicit local development.

The first production Coach Update serving profile is `google_gemini_2_5_flash_coach_update_v1`, selected only by `CANDIDATE_COACH_UPDATE_PROVIDER=google_genai`, that exact `CANDIDATE_COACH_UPDATE_PROFILE`, and a nonblank server-only `GEMINI_API_KEY`. It uses pinned `gemini-2.5-flash` metadata, one code-owned system instruction, one untrusted JSON data envelope, provider structured output, and one transport call. The provider may generate only bounded title, summary, primary-focus, and question-comparison strings. Code owns the status, synthesis fingerprint, question identity/order, artifact lineage, and final hydration. Missing, mismatched, or invalid production configuration leaves synthesis unavailable and never falls back to the deterministic fixture. Fixture and fault profiles remain explicit-local-development behavior only.

The exact Coach Update profile now has a code-owned configuration manifest and fingerprint covering provider/profile/model, prompt and evaluator versions, request/output versions, the exact system-instruction fingerprint, structured-response-schema fingerprint, timeout, and generation settings. The [Live Coach Update Validation Runbook](./05-quality/live-coach-update-validation-runbook.md) is its serving gate: explicit CLI and environment acknowledgement, one synthetic credentialed request, redacted ignored evidence, human review of candidate-facing language, and a separate disposable-DB completion/artifact/replay/dashboard reconciliation. The first credentialed gate and durable reconciliation passed. Any change to prompt, schema, model, timeout, or generation settings must advance immutable configuration identity and repeat the gate; a passing synthetic request alone is not end-to-end evidence or deployment approval.

Coach Update should remain a visible node in the practice loop. A noncritical `New` chip or emphasis may disappear after the candidate opens the latest update by comparing its fingerprint with browser-held seen state. Opening the update is not currently a durable learning or review fact, and the update remains available after the emphasis clears. Durable cross-device seen state should be added only if notification semantics or engagement analytics later require it.

The first V2 dashboard route boundary should consume completed-round facts as a read-time projection from candidate-owned `candidate_practice_sessions`. This keeps the dashboard traceable to setup -> question wording -> answer submission -> accepted coaching -> completion, and avoids creating a second durable dashboard truth before multi-round aggregation requirements are clear. Cross-role inventory and selected profile-backed context reads must remain complete rather than silently dropping older work behind a recent-session limit. If later dashboard performance or trend computation requires persistence, that should be a deliberate projection-table slice with clear invalidation rules.

The dashboard should make the learning loop legible without turning it into analytics UI. Before showing the learning loop, the dashboard should choose one selected target interview context and keep Coach Update, plan progress, practice-from-feedback guidance, stats, active-round resume state, and latest-round review scoped to that context. The visible dashboard should name the selected role context and offer an obvious way to switch when more than one target interview context exists. When the selected context has an unfinished round, the dashboard should show that active round as first-class resume state with the role, answered progress, current question position, and route back into the session. Headline answered/coached evidence counts include both active and completed rounds in that context: each submitted question occurrence counts once regardless of retry attempts, and coaching counts only when the latest submission has a matching accepted analysis projection. Session and immutable question-attempt counts remain separate data dimensions and do not inflate these question widgets. Coach Update is the feedback side: what the latest practice showed for the selected role. The next-practice area is the feedforward side: what to try next for that same role. That feedforward area must distinguish plan progress from feedback-based practice. Plan progress means the broader Coach Plan for the selected role context: resume an unfinished round, finish planned questions that still lack practice evidence, or start the first role plan. Practice from feedback means a focused next step based on what the coach observed in answers the candidate already practiced for that role. When both are relevant, the dashboard should make both visible while keeping the priority clear, usually by asking the candidate to finish already-planned practice before treating feedback focus as the whole plan. This pairing follows the self-regulated learning framing from the referenced learning-analytics paper: learners need indicators for reflection/monitoring and indicators for planning/recommendation. V2 should express that through candidate-friendly product language, not academic labels, scores, rankings, or durable dashboard conclusions.

The selected dashboard target context should remain stable until the candidate explicitly switches it or enters a session belonging to another context. In-app dashboard destinations, including session exit and completion, must carry that target context; a bare or invalid dashboard URL may select a sensible fallback once, then canonicalize to the selected context. The fallback may prefer an active round and then recent completed activity, but it must not keep silently changing Current focus during normal in-app navigation.

Follow-up practice must not send candidates through generic `/candidate/setup`. A plan-progress action for unanswered planned questions should create one candidate-owned, plan-aware practice intent containing every selected missing-evidence question and route to focused-practice staging. A Practice from Feedback action should create or resolve a focused intent for the coached question. Both paths must retain source session/question lineage and revalidate candidate ownership before creating the follow-up session. The durable focused-practice ready surface is the follow-up round's pre-session landing: its explicit Start action creates the session at live question one and redirects directly into the shared workspace rather than presenting a second session landing. The destination session owns the entry transition, mounts live Q1 beneath it, removes the one-time entry marker, and fades the overlay away; the ready route must not start a transition that cannot survive navigation.

App-internal mutation redirects must return same-origin relative locations. They must not reconstruct candidate routes from a server-bound request origin because development bindings, reverse proxies, and deployment ingress can expose internal hosts or ports such as `0.0.0.0` that are not browser-reachable.

Every preparation context requires an opaque durable id regardless of role-title similarity. Production dashboard, queue, intent, and session reads should use candidate-owned `roleProfileId` or its future equivalent as the authoritative context identity. Role title, normalized role title, job description, and URL copy are never identity. The canonical V2 dashboard URL carries this identity as `/candidate/dashboard?prep=<roleProfileId>` for direct links and refresh recovery, and the server resolves it only against the current candidate's sessions before returning facts. The former `targetRole` query is a bounded compatibility selector only for records whose `role_profile_id` is null; it must never select or merge a profile-backed context. A bare, malformed, stale, or unauthorized selector may choose the normal fallback once and must then canonicalize. Same-title preparation contexts must remain distinguishable.

When the candidate selects a feedback action, the app persists it before executing the transition so refresh and new-tab recovery can resume from the chosen state. The action is tied to the exact saved coaching result and immutable answer attempt for the same answer slot and question index. Retry reopens the preserved submitted answer as an editable draft; submitting that retry creates a new linked answer attempt. Provider/analysis retry remains a separate evaluator run for the same answer attempt. Persisting an action is still distinct from executing retry, continue, finish, pause, summary generation, or dashboard updates.

An accepted answer must remain durable and locked when evaluator work times out, fails, is rejected, or is abandoned. Refresh, navigation, and a new tab recover that submitted answer as one of four candidate-safe analysis states: a fresh claim is pending; an accepted internal result with a missing session projection is recoverable; a transient terminal result is retryable; and a configuration, safety, validation, malformed-completed-result, or exhausted-cap outcome is unavailable. Recovery must not reopen answer submission or append another answer attempt. A retryable result may claim a new evaluator generation for the same answer attempt and input fingerprint only when the durable run policy permits it. Candidate coaching is capped at three generations for one answer attempt in ten minutes, excluding QA comparison, and a nonretryable terminal result blocks direct or duplicate POST attempts at the claim boundary. A completed accepted internal result repairs its candidate-safe projection without another provider call and without requiring the current provider runtime to remain configured. When coaching is unavailable, the candidate can continue to the next question or finish the round; that path creates no fallback coaching and no coached-answer fact. Expired or superseded runs cannot complete late or project candidate coaching. Development validation uses only an allowlisted server-environment fault harness in explicit local mode; no fault control may be accepted from a URL, request body, preview, or production runtime.

Completing a candidate-led round should create a durable completion snapshot from server-recovered session facts. The snapshot should distinguish answered questions from skipped or unanswered questions, preserve the final completed progress state and current index, and route the candidate to `/candidate/dashboard` as the next home-base surface. Completion does not by itself create a summary, dashboard evidence, QA export, or legacy invited-session mutation.

The V2 durable persistence boundary for setup-created practice rounds is `candidate_practice_sessions`. It stores the setup snapshot, carried question plan snapshot, optional question wording snapshot or wording status, progress state, answer drafts, pending answer submissions, answer idempotency records, answer analysis snapshots, selected feedback actions, and the candidate-led completion snapshot with candidate ownership, required prep-context linkage for newly created durable setup work, and optional host-launch session context. `/candidate/setup/start` resolves an explicitly supplied profile only after candidate ownership verification. Explicit local/dev setup may otherwise create or reuse a manual profile from candidate identity plus normalized role and JD hash. Production launch identity may not create a manual profile from browser-supplied role/JD; it must supply a trusted host-resolved profile id and fails closed until that adapter exists. Browser-bridge provisional state remains an explicit non-production exception when durable storage is absent.

`/candidate/setup/start` should distinguish candidate-correctable setup contract errors from startup infrastructure failures. Invalid setup payloads should return `400` with structured field errors that the setup UI can show before or after POST. Candidate identity lookup, database schema, and durable persistence failures should return a fail-closed startup error, not an invalid-setup response.

Expected behavior:

- candidate sees an entry screen before the first question;
- question audio is prepared so the first question can play promptly;
- candidate can answer by voice or text;
- candidate can open hints and example/strong-response coaching;
- candidate can submit an answer and receive feedback through the shared feedback flow;
- candidate can retry when coaching indicates the answer needs work;
- candidate can continue or finish when the answer is ready enough to move on;
- candidate can pause/resume without losing progress;
- candidate can reach dashboard without weakening session ownership.

For the parallel V2 rebuild, candidate-owned session completion should return the candidate to the dashboard home base so post-practice Coach Update and next-practice guidance are the first follow-up surfaces. V1 candidate work did not establish a final finish-session CTA or dashboard-return presentation, so V2 must treat that interaction design as unresolved even though the candidate-owned completion route already returns a dashboard destination. Recruiter-invited completion behavior should remain summary-oriented unless a recruiter-facing change is explicitly scoped.

The candidate-led feedback flow may show candidate-only coaching elements such as "For the biggest lift." Recruiter-invited sessions share core answer analysis, but their existing user-facing feedback behavior should remain stable unless a recruiter-app change is explicitly specified.

Candidate-led and recruiter-invited candidate sessions should converge around shared runtime facts where practical: question identity, prompt text, category, submitted answer, coaching facts, current position, and completion behavior. Candidate-led host launch, profile ownership, setup drafts, resume capture, and browser-bridge recovery are candidate-app concerns and should not leak into invited-session product behavior.

The live-practice shell should also expose one shared question-audio lifecycle boundary. The landing surface prepares question 1 audio; entering a question prepares that question and the next question; starting from the landing user gesture unlocks playback; and automatic playback is play-once for a question within the current browser session so refresh does not unexpectedly replay it. Recovery on another tab or device may follow the recovered-session state without stronger replay guarantees. The audio transport must authorize against V2 session ownership and must not copy the legacy candidate-token `/api/tts` route unchanged. Until that route and provider are deliberately wired, the shared shell must keep the audio lifecycle optional and fail closed without presenting a working playback control.

### Candidate UI Productization Runway

The current V2 session and dashboard screens are behavior scaffolds over increasingly durable contracts. They prove ownership, planning, wording, progress, answer, analysis, feedback-action, completion, dashboard-read, and follow-up-intent boundaries; they are not the final candidate-facing composition.

The production-shaped landing, shared live-practice shell, and typed-answer mutation/recovery states have landed. Complete the session milestone in this order:

1. Add immutable answer-attempt identity and evaluator-run lineage while preserving a compatibility read for the latest accepted answer.
2. Wire the ratified evidence-first evaluator contract to durable evaluator-run orchestration and a production provider without weakening its prompt/input, validation, timeout/retry, redaction, observability, or QA policies.
3. Browser-validate and refine the staged V2 feedback behavior that now preserves acknowledgement, explore/skip, feedback-triggered retry, continue, and finish cadence.
4. Validate completion into the candidate dashboard, then shape the dashboard's final information architecture around Coach Update, Coach Plan, and flexible next-practice assembly.

Attempt lineage should remain available in durable session facts and read models during this milestone. Standalone attempt-count labels, chips, and charts are deferred until the core session and dashboard surfaces are productized and a clear candidate trend use case is designed. This does not block recruiter or company reporting contracts from consuming the same lineage later.

### Post-Round Destination

After the final question, a candidate-led session should complete durably and route to `/candidate/dashboard`, where Coach Update and next-practice guidance provide the post-round read. Candidate-led completion should not require an intermediate standalone summary page. Recruiter-invited sessions may retain a summary/debrief destination through the shared completion-behavior contract.

If a standalone candidate summary is later justified, it should:

- congratulate the candidate in a candidate-facing voice;
- summarize strengths;
- identify the primary growth area;
- provide momentum and next steps;
- collect candidate feedback separately from confidence measurement;
- offer low-emphasis navigation back to dashboard and new-role setup.

### Dashboard

The dashboard should become the candidate's home base for interview preparedness.

The dashboard should be organized around a `prepProfile`: the candidate's preparation context for a target interview.

The dashboard should show:

- the target interview context currently being prepared;
- a Coach Plan home-base surface that explains what the candidate is preparing for, why that plan fits the target interview, how much of the baseline has evidence, and what to practice next;
- a preparedness target that gives the candidate a fast, non-score read of progress toward the coach's baseline;
- three Coach Plan faces: Categories, Skills, and Question Set;
- coaching sheets that explain categories, skill lanes, and questions before showing deeper evidence;
- a matrix-backed interview preparedness map during transition while the Coach Plan surfaces mature;
- the next practice action;
- evidence-backed drilldowns by category, skill lane, question, or lane/category cell;
- confidence trend when implemented.

The dashboard should not become a page of generic cards. It should visually answer:

- what successful preparation looks like for this target interview;
- what evidence the candidate has already built;
- what is still thin or unpracticed;
- what the candidate should do next.

The selected target interview context should be changed through a compact prep-context switcher rather than a persistent sidebar/mobile dock on `/candidate/dashboard`. The switcher should show the selected role, a compact rounded-end gauge filled to practiced-question coverage and colored by qualitative prep state, and a last-practiced timestamp formatted in the browser's local timezone when available. The gauge should not show `X/Y` text in the center because coverage should support, not compete with, the preparedness read. The footer action should be `Prep for a new role` and route to `/candidate/setup`. This keeps `Next practice round` as the only persistent dashboard action while still allowing candidates to start preparing for a different role.

Cross-role reminders are allowed only as a secondary surface. They should not appear inside the selected role's Coach Update, Plan Progress, Practice from Feedback, or latest-round review because that creates mixed-role guidance. For example, an unfinished Packaging Associate round may be useful to remind the candidate about while viewing a CSR dashboard, but it should be visually and semantically separate from the CSR Coach Plan.

The Coach Plan is the intended release direction for the normal candidate dashboard experience. It should feel like a familiar home base with very visible post-practice debrief UI when applicable. The current matrix may remain as a transition/detail surface, but it should not receive more polish unless that work supports migration or validation.

### Coach Plan

The Coach Plan is the dashboard's primary home-base object.

It has fixed framing plus three faces.

Fixed framing should include:

- target role;
- interview stage;
- baseline question count;
- a short, list-friendly explanation of why this plan fits the role, JD, and stage;
- a preparedness target;
- compact progress and movement microcopy.

The fixed framing should be brief enough that the selected face remains visible. A richer plan reference may live behind an orientation/help affordance. That reference may explain the full plan, category meanings, response frameworks, the difference between selected round count and baseline count, and how candidates can practice flexibly without treating every round as a literal interview simulation.

The three faces are:

- Categories: interview-demand categories in the plan, what each category is trying to elicit, and how much category coverage has been practiced.
- Skills: the answer-quality lanes the coach uses to evaluate answers.
- Question Set: the planned coach sequence through the baseline question set.

The first V2 Coach Plan reference lands Categories and Question Set only. The Skills face and any aggregate preparedness state remain deferred until cross-session evidence-first evaluator aggregation is ratified. The plan reference must not infer mastery, readiness, or answer quality from coverage.

For a profile-backed prep context, the canonical baseline is the earliest original session created under that opaque `role_profile_id`, not the newest round and not a follow-up session. Its immutable setup, question-plan, and question-wording snapshots define the current stage, baseline count, categories, and question sequence shown by the reference. Dashboard retrieval must load the complete candidate-owned session history for the selected `role_profile_id`; a bounded recent-activity query is insufficient because it can omit the baseline after a long practice history. Historical null-profile contexts may remain a bounded compatibility read until they are repaired, but that limitation must not affect profile-backed work.

Baseline coverage is evidence lineage, not activity volume. A baseline question is practiced once at least one submitted answer in the selected prep context resolves to that question's canonical root. Submitted answers from an unfinished round count because they are already durable evidence. Drafts do not count. Feedback retries and later follow-up rounds may add attempts, but repeated practice of the same root question must not increase the coverage numerator. Malformed, cross-candidate, or cross-prep-context lineage must fail closed and must not count.

The Coach Plan entry should open an accessible reference layer. Categories is the default view and teaches the purpose, useful answer shape, and common weak patterns for only the categories present in the baseline. Question Set shows practiced questions by default and keeps missing-evidence wording hidden until the candidate deliberately reveals it. The reference does not duplicate answer transcripts or Coach Update content. Per-question builder toggles inside this reference remain deferred to the unified Practice Next action slice.

First visit should default to Categories. After the candidate changes faces, the app may remember the last selected face for that prep context.

Desktop may use arrows for face-to-face navigation. Mobile should support swipe. Animation may use a light perspective treatment so the interaction reads as rotating between faces instead of a generic 2D carousel, but animation polish should not outrank clarity, accessibility, or mobile stability.

### Preparedness Target

The preparedness target is a qualitative visual read of progress toward the coach's baseline.

It should combine:

- baseline coverage: how many baseline questions have been answered at least once;
- aggregate current prep state for the practiced baseline questions;
- movement indicators from repeat practice, such as improved and watch counts;
- explainer text on hover, focus, or tap.

The target must not behave like a score. It may show `X/Y practiced` and a simple visual proportion of practiced baseline questions, but it must not expose numeric scoring averages, raw hidden scoring dimensions, or percentage copy as a candidate-facing grade. Repeat practice must not increase the coverage numerator, but repeat practice can improve or caution the aggregate current read.

The intended release visual is a simple rounded gauge. The filled arc shows the proportion of recommended baseline questions practiced at least once, and the fill color uses the aggregate qualitative prep-state color for practiced evidence. The center should show the prep-state chip and `X/Y practiced`. Supporting copy should summarize coverage in coach voice, such as "You've practiced 3 of the 5 questions I've recommended," followed by a short first-person coach observation that starts from "I see..." and frames clear/strong states as affirmation and emerging state as encouragement. Hover, focus, or tap may show a compact explainer with practiced/unpracticed context and state copy.

At zero practiced questions, the target should use a start-state treatment that explains the plan is ready but no practice evidence exists yet. It should point the candidate toward the first recommended practice action rather than showing an empty failure state.

### Coach Plan Faces

The Category face should show only categories present in the baseline plan. The category chart should be the main selector. Labels may appear next to segments when space allows. Selecting a segment or label opens a coaching sheet with non-sheet screen area available for clickaway/tapaway close.

Category identity should use a reusable dashboard chip palette where categories need to be scanned as categories rather than as prep-state reads. Initial palette usage applies to Category face labels, Question Set face/modal category markers, and Next Practice Round queued-question category chips. The Coach Update carousel nav indicator and category sheet header are intentionally excluded for now.

The Category coaching sheet should start with role/stage/JD-specific teaching:

- why this category appears in this plan;
- what the question type is trying to learn;
- what a strong answer needs to do;
- common weak patterns to avoid.

The progress side may show planned questions, practiced questions, coach comments, and next practice guidance.

The Skills face should use three lane-level targets: Answer Substance, Interview Structure, and Communication Delivery. Child dimensions should not be first-pass tap targets. They should appear in the lane coaching sheet so candidates can understand what rolls up into the lane without needing to tap small chart segments.

The Question Set face should default to the planned coach sequence. Answered questions should be visible. Unanswered questions should be hidden by default with a reveal option. The basis is answered/unanswered, not current-round membership, so paused sessions do not reveal questions the candidate has not yet encountered unless the candidate chooses to reveal them.

Opening a question should show the full question and answer transcript first. Future feedback annotation may highlight answer phrases, bracket sections, or mark milestones with color-coded annotations that reveal coaching detail progressively.

### Stable Dashboard Shell

The production dashboard shell is stable across prep-context states even when its emphasis changes. It contains:

- a sticky candidate-identity and prep-context header;
- one compact `Coach Plan` page introduction;
- an active-round surface when unfinished practice exists;
- one sparse Coach Update entry and one Coach Update detail experience;
- a distinct Practice Next surface for feedback-driven guidance;
- a distinct Coach Plan surface for planned coverage;
- a persistent next-round draft control that consumes its own durable contract, with later secondary history still deferred.

The shell follows the state priority ratified in the dashboard information architecture. An unfinished round owns the primary button. Without one, the latest Coach Update receives the strongest review emphasis. Without an update needing review, the read model's Practice Next or executable plan-progress decision owns the primary button. Other regions remain visible when truthful, but they must not compete with another button of equal emphasis. A completed plan may open the selected-context practice builder when that context has executable choices or saved draft items. It must remain truthful and buttonless when no executable follow-up exists, and it must never route to generic new-context setup.

The first stable-shell implementation removes the scaffold's completed-round, answered-question, and coached-answer metric strip from the primary candidate composition. Those derived facts may remain in read models for diagnostics and later justified uses, but they are not the organizing story of the dashboard. It also removes the always-open duplicate latest-round transcript. Practiced-question detail belongs to the single Coach Update detail experience; unanswered coverage belongs to Coach Plan and Practice Next.

The sticky header resolves display identity from the candidate-owned profile, resolves the selected opaque prep-context id before presenting role information, supports switching among candidate-owned contexts, and retains `Prep for a new role` as the route to `/candidate/setup`. When that opaque context resolves a candidate-owned next-round draft and canonical Coach Plan, the persistent next-practice control opens the responsive builder and shows the authoritative queued count. Legacy or unresolved contexts retain a bounded on-page Practice Next fallback and must not fabricate a queue count or imply that a draft was loaded.

### Coach Update And Debrief

When a practice round is completed, the dashboard should show the latest Coach Update entry. The update should feel like the coach has a fresh, synthesized read from that practice rather than a replay of the immediate feedback already shown after each answer.

The Coach Update opens a sparse guided debrief sequence, not a trapping wizard. Each step should be skimmable and offer escape routes:

- close or click away;
- use the question-level practice actions;
- open the relevant Coach Plan face;
- open detail only on demand.

The first debrief read should lead with the latest practiced questions rather than an analytic axis. The opened Coach Update should use the same question-feedback surface as Question Set: full question, candidate answer/transcript, coach observation, and one focused way to strengthen or keep using the answer pattern. It must not include skipped or unanswered plan questions. Those remain visible through Coach Plan and Practice Next. The Coach Update card itself should stay sparse and should not preview all tactical guidance before the candidate opens it. The card is itself the action target; it should not carry a separate `Review update` button.

For repeat practice, the update may compare the latest accepted answer attempt with comparable prior attempts for the same prep context and source plan question. It may identify specific supported movement, stability, or unresolved evidence and acknowledge effort. It must not equate repetition with improvement, infer regression from hidden score movement, or compare unrelated questions or prep contexts. When evidence is not comparable, the update should remain neutral.

The opened Coach Update should feel personal and space-efficient: a coach-avatar motif plus one short context-setting statement should replace redundant eyebrow/title copy, and the header should avoid explanatory help text when the controls can carry the interaction model. Question navigation should act like a carousel indicator, and only the current question should receive the full `Q# / category` chip treatment. Non-current questions may be dots. Desktop should provide explicit previous/next controls around the carousel indicator; mobile can use swipe or tap navigation. The swipe/drag behavior is Embla-backed, while the dashboard component owns the local accessibility contract: a named carousel region, named slides, disabled previous/next states, current dot/chip state, a polite live status, hidden non-current slides, and suppressed tab stops inside non-current feedback cards. Feedback slides should share the same scroll viewport and keep the action block anchored to the bottom of the slide so different question lengths do not produce visibly different bottom scroll endpoints. The Coach Update card should avoid repeated visible eyebrows and should only use icons when they improve scanning without consuming too much transcript width. Category should appear once in the debrief navigation rather than being repeated inside the question card. The coach observation card should include both the current read and the strengthening guidance separated as distinct text blocks, rather than splitting guidance into a second card. Choosing, swiping, or stepping to a different question should reset the feedback content scroll to the top. The coach observation region should be accessible as `Coach observation`.

The next Coach Update card iteration should treat each carousel item as one contained feedback card, with adjacent cards peeking and subtle edge fades indicating swipeability. The current exploratory direction applies the in-session active-question gradient to the full Coach Update sheet/modal, including the main header, while active and peek cards stay white/paper. The modal header should be a quiet identity bar containing only an inline `MessageSquareQuote` coach mark, the shorter title, and close action; the coach mark and title should be vertically centered and should not use a filled avatar/badge surface. Carousel navigation belongs at the top edge of the card/content area and should be visually smaller than the header identity. Arrow controls should keep a 36px tap target while rendering as transparent hit areas around the icon rather than visible circular buttons. The active card should feel more interactive than static dashboard surfaces by using broad gray shadow with a subtle blue temperature, smooth scale/opacity changes as cards move in and out of view, and Embla snap-list dot navigation instead of a category pill indicator. The active dot should use the same primary-blue value as the inactive dot border, and nav arrows should use the same blue theme. The card header should stay compact and self-contained with `Q#`, category chip, prep-state chip, and the question prompt using reduced text size and line height for mobile fit, without the prior `surface-sky` nested header treatment. The answer transcript is the primary content area and preserves the shared transcript text styling as the future annotation surface. The compact coach observation area may temporarily tell the candidate to keep the annotated guidance in mind for the next practice attempt. On mobile, the opened Coach Update should behave as a top-anchored full-width sheet with a small bottom tapaway gap, matching the category/lane modal posture. This Coach Update presentation is intentionally separate from the Question Set modal until the pattern is validated.

The guided sequence should end with Practice Next. Coach Update remains available after review; opening it may clear a noncritical `New` treatment but does not remove the update from the loop.

Coach Update presentation resolves the newest generation attempt for the latest completed round in the selected candidate-owned prep context. Its lifecycle is explicit:

- `pending`: the newest artifact is still requested, so the entry says the update is being prepared and cannot be opened;
- `ready`: the newest artifact is completed, accepted, and has candidate-safe content, so the sparse entry opens that exact immutable artifact;
- `unavailable`: the newest artifact failed, was rejected, or no artifact was produced for the completed round, so the entry confirms that practice remains saved without exposing provider, validation, or error-code detail;
- `awaiting practice`: the selected prep context has no completed round, so the entry explains that a future completed round will produce the first update.

The read model must not fall back from a newer failed or pending generation attempt to older Coach Update prose for the same source round. Older versioned artifacts remain available for QA lineage and later history work, but they do not overwrite the truth of the latest attempt.

The first `New` treatment is browser-held presentation state. It stores only an opaque candidate/prep-context-scoped presentation key for the latest ready artifact. The initial server and client render must stay hydration-safe; after browser state resolves, an unseen artifact may receive `New` emphasis. Opening the update clears that emphasis in the current browser and allows Practice Next to take stronger action priority when no active round exists. This interaction performs no server mutation, is not learning evidence, and may legitimately appear new again on another device or after local browser storage is cleared.

### Practice Next

Practice Next should remain the main action surface, but it should not collapse every recommendation into the same meaning. The candidate should be able to tell whether the next action is:

- **Plan progress**: finish or continue practice that belongs to the selected role's Coach Plan, including an unfinished round or planned questions without practice evidence;
- **Practice from feedback**: work on something the coach noticed in a submitted answer.

Unanswered planned questions are missing practice evidence, not evidence of weak performance. Feedback-based guidance should not hide unfinished plan coverage, and unfinished plan coverage should not erase useful coaching from answers the candidate did practice.

The coach may recommend one primary task or a pair of primary tasks. If a practiced answer or lane is below clear or unscoreable and unanswered baseline questions remain, the dashboard should present both:

- one improvement/remediation task;
- one new-coverage task.

When order matters, the coach should recommend an order and explain why. When there is no clear dependency, both primary tasks may be presented as useful next options.

Alternatives should be secondary. They should mainly let candidates keep momentum by browsing unanswered questions. After all baseline questions have at least one answer, alternatives may shift toward polishing clear areas to strong or improving specific dimensions.

Question-level surfaces may expose follow-up practice actions before the final queue UI lands. A practiced Coach Update item may expose a feedback-focus action. A skipped or unanswered planned question may expose a missing-coverage action only from Coach Plan, Question Set, or Practice Next, not from Coach Update. Both use stable source pointers and candidate-owned resolution. They must not put submitted answer text, coach observation text, JD text, resume text, or score-like values in query params. Failed durable validation suppresses source details rather than falling back to URL-derived copy.

The durable follow-up practice target is `/candidate/practice/ready/[intentId]`, backed by `candidate_practice_intents`. Every newly assembled round from an existing prep context must land there before live practice, whether it contains one question, a candidate-built set, a plan-aware queue, or a coach-suggested bundle. A fast path may bypass the editable builder but must not bypass the pre-session landing. Resuming a session that was already started is not a new launch and may return directly to its saved live-session state. The candidate should see a lightweight pre-session staging surface that confirms the role, selected practice questions, and staged resume context without restating the full new-context setup form. The temporary `/candidate/practice/ready` query-pointer bridge may create a one-question durable intent and redirect to the durable route when persistence is available. Multi-question builders and queues should use the same stable-pointer creation contract through `/candidate/practice/ready/intents`. `/candidate/setup` remains the generic new-prep-context setup surface and should not carry follow-up-practice UI.

Candidates may practice the same question as many times as they choose. Repeated practice should preserve question-level attempt context within the selected prep/practice plan, not overwrite the original answer or collapse repeated attempts into one event. Candidate dashboard surfaces may later use this for performance-over-time views, but current scaffold UI should not add standalone attempt-count treatment before the core session and dashboard surfaces are productized. Company and recruiter-facing engagement reads may roll this up as session attempts, question attempts, and total attempts, while still respecting candidate-led privacy boundaries.

Question-level feedback and plan surfaces expose two distinct practice actions when the selected prep context has a durable builder:

- **Practice this now** as the immediate one-question practice affordance;
- **Add this to my next round** / **Added** as the candidate-visible queue affordance.

These labels describe different commitments and must not be used interchangeably. `Practice this now` snapshots only the chosen question into an immutable intent and routes to the ready landing. `Add to next round` changes only the candidate-owned editable draft, stays on the current review/reference surface, and updates the shared builder count and state everywhere. Removing the same item from any surface removes it from that one draft. If the server cannot prove an eligible source pointer in the selected opaque prep context, the queue action is suppressed rather than simulated with local state.

Queue selections are candidate work and must be durable by default. The editable next-round draft is scoped by candidate and opaque prep-context id and survives navigation, refresh, and later return. It is not an executable practice intent and must not become historical session truth.

Follow-up practice should support flexible next-round assembly without turning the new-context setup page into a generic router. Ideas to scope soon:

- **Practice builder**: a dashboard surface where coach-recommended items, queued items, and missing-coverage items can be assembled into a focused round before launch.
- **Question-level fast path**: `Practice this now` creates a one-question follow-up round from the selected Coach Update item and lands on a lightweight practice-ready staging surface.
- **Plan-aware queue**: queued questions are shown against the selected prep context's question plan, distinguishing feedback-driven practice, missing evidence, coverage gaps, and foundational plan coverage.
- **Coach suggested bundles**: the coach may offer candidate-selectable bundles such as quick focus, balanced round, finish planned coverage, or category-specific review.

General, foundational, and referential coach guidance that does not change per answer, such as interview concepts, best practices, and the overall practice plan, should have a stable home in the selected prep context. That guidance may sit adjacent to, or partially power, the plan-aware queue surface.

Shared question-feedback surfaces should reflect the selected prep context's durable queue consistently. Coach Update and Question Set feedback surfaces should use the same per-question queue affordance. Turning it on adds that source question to the durable next-round draft; turning it off removes it without changing the current feedback location. Removing the same question from the Next Practice Round surface should update its state everywhere.

The `Next practice round` surface is backed by one durable editable draft per candidate and opaque prep context. Queue counts, contents, source feedback states, removal, ordering, and clear-all operate only on that draft. Changing prep context closes the opened surface but does not discard either context's draft. Queue mutations must prove candidate ownership and use optimistic versioning or an equivalent conflict boundary so cross-tab or cross-device edits cannot silently overwrite one another.

The responsive practice builder must load only after the dashboard has resolved one candidate-owned opaque prep context. Its carried-over header count, queued items, available items, and launch request all refer to that exact `role_profile_id`; role text is display context and never identity. The builder may offer eligible questions from that context's canonical Coach Plan. Missing-evidence choices point to the original plan occurrence. Previously practiced choices point to the newest occurrence in the same canonical question lineage whose latest submitted answer has matching accepted coaching. The server derives practice kind and provenance from those durable facts instead of trusting browser-supplied labels or evidence claims. Questions without a valid missing-evidence or coached source remain visible in the broader plan where appropriate but are not offered as executable builder items.

Builder add, remove, reorder, and clear mutations return the authoritative current draft. Reorder must be operable without drag-and-drop, including on touch and keyboard devices. A stale version returns a conflict together with the latest candidate-owned draft; the client replaces its stale view, preserves no unaccepted optimistic claim, and tells the candidate that newer changes were loaded. Capacity, invalid-source, malformed-order, ownership, network, and persistence failures remain distinct and must not fabricate a changed count. Clear-all requires confirmation. Removing the last item leaves a usable empty builder rather than implying that the surface or prep context was deleted.

Mutable queue items should be normalized because they are individually added, removed, reordered, deduplicated, and queried. Each item preserves a stable source-plan-question pointer, practice reason, provenance, position, and timestamps. On `Start practice`, the server validates the current draft and atomically creates one immutable `candidate_practice_intents` snapshot while clearing or linking the launched draft. The ready intent remains recoverable if navigation or session creation fails, and idempotent start consumes it into one session. Existing sessions always explain their contents from the immutable intent and session snapshots, never from the later mutable queue.

The builder keeps its local draft intact until atomic launch reports a durable destination. If intent creation succeeds but the response or navigation fails, retrying the same draft version recovers that ready intent, or its already-consumed session, rather than creating another round. A version conflict reloads the newer draft instead of launching stale contents. Every newly snapshotted builder round stops at the existing `/candidate/practice/ready/[intentId]` landing before live practice; direct session recovery is reserved for an intent that was already consumed.

Direct one-question and fixed-set actions should claim activation immediately in the client so a rapid repeat cannot emit another request before disabled UI renders. Production acceptance additionally requires a request-level idempotency key for these direct creation routes. That key must replay one user action without treating a later intentional repractice of the same question or fixed set as a duplicate.

One-question `Practice this now` and fixed coach-bundle fast paths may create immutable intents directly. The fixed-action vocabulary is:

- **Practice this now**: snapshot one eligible source question;
- **Practice this bundle** or a specific task label such as **Finish planned practice**: snapshot the complete fixed set without mutating the editable draft;
- **Customize round**: open the selected-context builder so the candidate can assemble or revise a round before launch;
- **Start practice**: atomically snapshot the current builder draft.

A coach bundle may later offer `Customize round`, which seeds or merges eligible items into the durable practice builder before launch. Bundle generation itself requires a trustworthy coach-output contract and is not implied by generic UI availability; until that producer lands, the app may exercise the `coach_bundle` intent boundary in contract tests but must not fabricate candidate-facing bundles. Unanswered-plan coverage is a valid fixed set derived from durable Coach Plan facts and may pair `Finish planned practice` with `Customize round`. Every resulting immutable intent preserves its source (`coach_update_detail`, `plan_aware_queue`, `coach_bundle`, or `practice_builder`) and per-item provenance through ready landing, session creation, and later attempt lineage.

The dashboard header should be persistent while the candidate scrolls, using sticky or fixed positioning as needed by the shell. It should use a compact candidate-initial avatar badge as the upper-left identity anchor instead of a visible product title, keep the selected prep context legible, and keep the truthful next-round draft count and builder action available in the viewport. The avatar badge uses a white surface, muted neutral border, and initials derived from the candidate display name or email. The header fade should be soft, with no hard bottom border or backdrop-filter boundary. Opening should visually connect the button to the expanded surface: the surface should use the same radius, open from the measured button position, slide downward as it expands, and leave the button label and count badge in the same size, font, and center alignment as the button. The opened surface may place its outer top edge above the trigger by the modal top padding value, then position the carried-over title row at that padding offset with the trigger's measured height; this preserves title alignment while giving the modal enough top breathing room. The opened next-round label should remain visually lighter than primary page content so it reads as a carried-over control label rather than a competing page title. The opened surface should use a single full-width centered title row rather than a separate inline label, so the title cannot drift from the trigger's positioning model. The reference package in `docs/candidate-app/morphing-button-to-modal` shows the intended reserved-footprint/morph pattern; implementation may land in stages as long as the persistent header and same-radius opening direction remain intact.

Per-question removal is immediate and uses a smaller, quieter red clear affordance aligned with the queued question metadata row. In queued question cards, the Q number should be plain left-aligned text with a trailing colon, with pill chips reserved for category and prep state, and the question text should use the same text size, weight, line height, and spacing as the shared Coach Update / Question Set feedback question text. The opened next-round surface header should carry the primary `Start practice` CTA directly below the carried-over title row, without extra explanatory heading/body copy. `Clear all` is a medium-weight, borderless, red ghost-style secondary action paired with `Cancel`; both footer actions should have equal width, and `Clear all` requires confirmation before removing every queued question.

## Interview Preparedness Product Rules

Interview preparedness is not a candidate-facing score.

The candidate-facing performance scaffold uses stable top-level lanes:

- Answer Substance
- Interview Structure
- Communication Delivery

The lane scaffold should stay fixed. Lane state may be derived from hidden answer-evaluation scoring, but the dashboard must present the result qualitatively and evidence-first.

Interview range is represented through the category axis of the preparedness map, not as a lane. Expected categories are:

- Behavioral
- Culture / Fit
- Scenario
- Technical / Role-Specific
- Screening

Behavioral questions ask for real past examples. Scenario questions ask what the candidate would do in an imagined work situation. Culture/Fit questions ask about motivation, values, work style, and role alignment. Screening questions ask about basic interest, background, qualifications, availability, or logistics. Technical/Role-Specific questions ask about job-specific knowledge, tools, processes, or judgment.

Category coverage should distinguish practiced questions from generated-but-unanswered upcoming questions. Category state and lane/category cell state should be based on practiced/scored answers only; unanswered upcoming questions should not count as zero-score evidence.

The dashboard may expose lane-only, category-only, and lane/category-cell drilldowns. All three views must reuse the same evidence-safe interaction model: practiced question and candidate answer cards first, then candidate-safe "My Read" detail copy.

For the release matrix view, question categories should render as rows and the fixed performance lanes should render as columns: Substance, Structure, and Delivery. This keeps the matrix narrow enough for mobile while preserving the row/column/cell drilldown model.

What varies by target interview is the question mix, evidence, drilldown content, and next practice recommendation, based on the target role, job description, resume context, interview stage, generated questions, answers, coaching feedback, and summaries.

The app distinguishes the selected practice round from the coach's baseline coverage expectation for the interview moment. The selected round may contain fewer questions than the baseline. In that case, the generated round should use an appropriate sample of the baseline mix, while the dashboard can still show remaining planned coverage as upcoming/to-practice areas. The current release baseline is deterministic by interview stage; future revisions may adjust that baseline using structured role/JD signals such as industry, role family, level, compliance risk, or client-facing intensity.

The candidate should understand that a practice round is not always a literal simulation of the whole interview. It is a flexible way to practice answering questions within the coach's broader baseline plan. Candidates may practice fewer questions than the baseline when time or focus requires it.

Repeated attempts belong to the flexible-practice model. They should count as additional practice evidence for the same source question or coach-plan item, not as new baseline questions. Read models may carry attempt counts and source-question lineage before the final UI is designed. Candidate-facing attempt history or trend direction is a later design problem, not a requirement for the current scaffolds; when it lands, it should avoid implying that repeating a question is a penalty.

Resume and job description context are source evidence. They are not standalone dashboard lanes.

Role Fit is out of current-release dashboard scope unless a specific future extraction/evaluation contract supports candidate-facing claims.

Confidence is a self-reported trend. It is not performance evidence and is not a preparedness lane.

"Was this helpful?" feedback is product/coaching-output feedback. It is not confidence data and not performance evidence.

## Candidate-Facing Claims

The app may make claims such as:

- "You have practiced this area."
- "Your latest answer gives clear evidence here."
- "This area is starting to build evidence."
- "This is useful to practice next."
- "Your resume content was used to shape coaching for this role."
- "You practiced this kind of question."
- "This question is upcoming in an unfinished round."

The app must not claim:

- that the candidate is hireable or not hireable;
- that the candidate is likely to be selected;
- that a numeric readiness score represents interview success;
- that a recruiter or hiring manager has reviewed candidate-led practice;
- that resume/JD alignment is definitive unless a specific extraction/evaluation contract supports that claim.

## Non-Goals For Current Release

- No candidate-facing numeric interview preparedness score.
- No hiring-decision assessment.
- No recruiter visibility into candidate-led practice content.
- No multi-role dashboard manager beyond what is needed to safely avoid mixed-role confusion.
- No inline modal mini-practice engine separate from the standard session route.
- No standalone resume-builder or career-navigator module inside this release.

## UX Guardrails

- Keep setup short and progressive.
- Use plain-language labels, not internal model or product-planning terms.
- Prefer graphical, evidence-backed preparedness views over long text blocks.
- Use microinteractions to reveal why an area matters and what evidence supports it.
- Candidate surfaces should be intentionally stateful. Preserve unsubmitted or in-progress candidate work by default, but define explicit reset boundaries when a user action completes or replaces that work, such as successful setup submission creating a session.
- Landing on a candidate page, screen, or view should set scroll position to the top unless a specific interaction pattern intentionally preserves scroll. Any exception should be deliberate and documented by the slice that introduces it.
- Candidate draft state should be preserved on revisit by default, including reloads and new-device return flows once durable identity-backed storage is available. Local-only preservation is not enough for production setup, session-planning, or dashboard queue drafts.
- Keep one clear next action on the dashboard.
- Make empty states educational without overexplaining implementation.
- Avoid exposing raw AI internals, hidden scoring, or privacy-sensitive source content in candidate UI.
- Keep Coach Plan fixed framing compact and list-friendly.
- Use neutral UI structure for labels and coach voice for interpretation.
- In narrative coach copy, refer to app concepts naturally: "answer structure" rather than "Structure" as a standalone noun.
- In chips, labels, headings, and fragments, app terms may be capitalized and emphasized, such as **Structure** improved.

## Change Rule

Do not broaden candidate-facing scope or add new candidate claims without updating this file first.

Shared services used by both candidate-led and recruiter-invited sessions must preserve recruiter-invited user-facing behavior unless this SPEC or a recruiter-app spec explicitly changes that behavior.

Parallel V2 route work may rebuild candidate-facing UI and composition from the design-system direction, but it must not broaden candidate claims, expose hidden scores, or weaken candidate ownership boundaries.
