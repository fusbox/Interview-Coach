# Candidate App Data Contract

Status: Canonical system truth
Last updated: 2026-07-29

## Purpose

This file defines the stable data vocabulary for the candidate app. It is the contract to read before changing schemas, route payloads, server actions, dashboard read models, or AI-output mappings.

This file may include implementation names where they are part of the current contract. Product-facing labels belong in [SPEC.md](./SPEC.md).

## Naming Rules

- Use `prepProfile` for the candidate-owned interview preparation domain concept.
- Keep current implementation names until a migration intentionally changes them:
  - table: `candidate_role_preparation_profiles`;
  - draft field: `role_profile_id`;
  - session intake field: `roleProfileId`.
- Do not introduce a separate "resume bridge" lane. Resume and JD context are evidence and framing sources.
- Do not use `oneBigUpgrade` as user-facing copy. Treat it as legacy/internal compatibility only; new feedback should use `coachSignal`.

## Parallel V2 Data Direction

Candidate V2 is allowed to rebuild candidate-facing routes and read models without historical legacy data accommodation. Existing old-route behavior may continue to read older payloads, but V2 should not deepen the dependency on legacy `eval_results.feedback_json`, hidden 1-5 score averages, `oneBigUpgrade`, or `meta.readinessLevel`.

V2 dashboard and session work should move toward:

- raw answer/session facts as persisted truth;
- immutable answer-attempt and evaluator-run lineage;
- evidence extraction outputs;
- criteria bands;
- category pattern gaps;
- candidate-safe feedback composition;
- derived dashboard read models that can explain every visible claim.

If an evidence-first result is adapted into the old `AnalysisResult` shape, that adapter is a bridge for existing rendering or AI-quality review. It is not the durable V2 evaluation contract.

### Database Execution Boundary

Application requests reach PostgreSQL only through trusted server-side `pg` connections. Browser identity is proved by app-owned or host-launch sessions before an ownership-scoped repository query. Supabase Auth claims and `auth.uid()` are not part of this data contract.

Migration `046_database_access_hardening.sql` separates the schema owner from the `interview_coach_runtime` execution role, removes public and Supabase Data API object access, enables RLS on every current public application table, gives only the runtime role an all-row staging policy, fixes every public `SECURITY DEFINER` search path, and grants direct function execution from a reviewed caller allowlist. The all-row policy is role containment, not candidate/recruiter row ownership. Server authorization remains mandatory.

Migration commands prefer the operator-only `DATABASE_MIGRATION_URL`; runtime code uses `DATABASE_URL`. Remote deployment preflight requires the `interview_coach_runtime` username. New tables must explicitly enable RLS, and new directly called functions must receive an explicit grant before the hardening smoke passes. See [Database Access Hardening](./07-ops/database-access-hardening.md).

### Answer Attempt And Evaluator Run

V2 distinguishes four levels that legacy slot-keyed JSON collapsed:

1. a planned question identity;
2. a question occurrence in one practice session;
3. one or more immutable answer attempts for that occurrence;
4. one or more evaluator runs against one fixed answer attempt.

Pre-submission edits are drafts and do not create attempts. The first accepted submit creates attempt one. A candidate-selected retry after feedback appends another attempt with `supersedesAnswerAttemptId` and `trigger: "feedback_retry"`. Provider retry, timeout recovery, and model/prompt A/B evaluation append evaluator runs for the same answer attempt instead of inflating candidate answer-attempt counts.

The normalized durable target uses stable `candidateAnswerAttemptId` and `candidateAnswerEvaluationRunId` values, candidate/session/question ownership, per-occurrence attempt number, answer mode/content/submission time, retry lineage, provider/model/prompt/evaluator metadata, immutable configuration manifest and fingerprint, input fingerprint, lifecycle timestamps, validation facts, and candidate-safe result snapshots. Model-stage manifests include the abstract reasoning posture plus the effective numeric thinking budget and whether thought output is included, so provider requests cannot change behind an unchanged fingerprint. Evaluator runs also carry a positive sequential `generationAttempt` within one answer attempt and purpose plus an explicit `claimExpiresAt` lease. A run id is the completion fence: only its own fresh `requested` row may transition once to `completed`, `failed`, or `rejected`. Terminal rows remain immutable. Candidate coaching permits at most one fresh requested run and one accepted completed result per answer attempt and input fingerprint; terminal retry appends the next generation without creating a new answer attempt. QA comparison may retain multiple same-input completed variants only when each variant has its own resolved configuration identity.

Repository/domain records expose timestamps as ISO strings even when the PostgreSQL driver returns `timestamptz` columns as JavaScript `Date` objects. Migration `009_candidate_answer_attempts_schema.sql` creates `candidate_answer_attempts` and `candidate_answer_evaluation_runs`; migration `015_candidate_answer_evaluator_run_claims.sql` adds generation, lease, stale-claim, and accepted-result fencing; migration `016_candidate_answer_evaluator_configuration_manifest.sql` adds immutable resolved configuration identity. Rows created during earlier V2 slices are marked `pre_manifest_v2` without invented stage settings, while every new row must be resolved. `candidate-answer-history-repository.ts` provides ownership-scoped append, replay-safe answer idempotency, immutable retry lineage, and evaluator-run claim/lifecycle operations. Existing `candidate_practice_sessions.answer_submissions_json` and `answer_analysis_snapshots_json` remain latest-attempt V2 build projections while session consumers migrate; they must not be treated as complete history. No V1-created app data is a V2 migration or runtime compatibility requirement.

### Voice Transcription And Answer Lineage

The ratified voice boundary is transcript-first. A transcription run is neither an answer attempt nor an evaluator run. Candidate-led and invited practice use the same domain vocabulary with separate owner-scoped persistence; a polymorphic owner record without strong foreign keys is not allowed.

Each audience stores metadata-only transcription runs with generated run identity, owner/session/question-slot identity, hashed operation key, audio input fingerprint, immutable submission path, accepted MIME/size/duration metadata, provider/profile/configuration identity, generation/lease timestamps, terminal lifecycle, output fingerprint, and a safe error code. Raw audio and duplicate transcript text are excluded from these run rows.

A completed transcription transaction writes the machine transcript, source run id, and bounded submission path (`quick_submit` or `transcript_review`) into the current audience session's recoverable voice-draft projection. That projection is mutable latest state, not answer history. Rerecording creates another run and moves the draft pointer. Exact response-lost replay returns the same saved transcript without another provider call.

Explicit answer submit appends the immutable answer attempt. A `voice` attempt requires:

- nonblank submitted transcript text;
- canonical answer mode `voice`;
- a completed source transcription run owned by the same audience principal, session, and question slot;
- server-resolved quick-submit or transcript-review provenance;
- server-derived provenance indicating whether the submitted transcript fingerprint differs from the transcription output fingerprint.

The answer attempt contains the candidate-authorized transcript that was submitted. Quick submit requires the answer and transcription-output fingerprints to match. Review may preserve the machine transcript or submit a corrected one, with edit state derived server-side. The evaluator receives the immutable attempt and never receives raw audio or a second competing machine transcript. The first voice release supplies `voiceMarkers: null`, so the existing evidence-first contract cannot emit delivery coaching. See [Voice Answer And Transcription Contract](./04-architecture/voice-answer-transcription-contract.md).

One quick-submit parent command derives stable transcription and answer child operation identities. Transcript completion and voice-answer append remain ordered durable boundaries: replay after transcript completion reuses the saved result and retries only the incomplete answer append. The transcription provider adapter and repository never write answer history directly.

Migration `030_voice_answer_transcription_foundation.sql` implements the storage boundary with `candidate_voice_transcription_runs` and `invited_practice_voice_transcription_runs`, plus separate `voice_transcript_drafts_json` session projections. Migration `031_voice_transcription_claims.sql` makes the user-authorized submission path immutable run identity. Candidate and invited repositories retain distinct ownership queries while sharing normalized claim vocabulary. Advisory-lock claims produce one provider owner under concurrency; matching completed current drafts replay; fresh work returns pending; changed audio or intent conflicts; matching stale work advances generation; and one operation is capped at three generations. Their completion operations derive the output fingerprint from the normalized transcript, terminalize one fresh run, and save its transcript draft atomically. Composite answer foreign keys and insert validation require the exact same audience owner, session, slot, index, completed current draft source, submission path, and candidate-authorized draft text; the database verifies `voiceTranscriptEdited` and requires quick-submit text to match the machine-output fingerprint. A completed run whose draft was superseded by deliberate rerecord remains metadata history and is not restored by replay.

The first accepted production adapter stores profile `google_gemini_2_5_flash_voice_transcription_v1`, model `gemini-2.5-flash`, and current immutable configuration fingerprint `9ce44b0bab357bed36b838e2d7f3788837175e22a4c201b9bc3e439d60ad8b22` on each newly claimed run. The current profile includes credentialed-accepted truthful `audio/webm` and `audio/mp4`; any media allowlist, prompt, model, schema, language, limit, or setting change advances the fingerprint. Provider errors persist only a bounded safe code. Raw provider request/output, audio bytes, and transcript duplicates do not enter transcription-run rows.

### V2 Evaluation Evidence

The V2 evaluation contract starts from evidence items, not dashboard claims.

Current source module:


Core vocabulary:

```ts
type EvidenceApplicability = "observed" | "not_elicited" | "insufficient_data" | "unscoreable";

type CriteriaBand =
    | "not_enough_evidence"
    | "emerging"
    | "clear"
    | "strong";

type EvaluationEvidenceItem = {
    criterionId: string;
    applicability: EvidenceApplicability;
    score?: number;
};
```

Contract rules:

- only `observed` evidence with a valid numeric score contributes to criteria-band averages;
- `not_elicited`, `insufficient_data`, and `unscoreable` evidence is excluded from averages and must not be treated as weak performance;
- an evidence set with no observed scored evidence maps to `not_enough_evidence`;
- candidate-facing reads expose qualitative bands and coach-language descriptions, not raw numeric scores;
- dashboard V2 claims should depend on this evidence summary layer before presenting preparedness language.

## Core Objects

### Candidate Identity

Current candidate-owned behavior is anchored by one opaque candidate profile resolved through either an app-owned account session or a host launch session.

Important fields:

- candidate profile id;
- email;
- display name;
- auth issuer;
- auth subject.

App-owned candidate profiles use `workspace = "interview_coach"` and carry one unique nullable `app_user_id` binding to the shared app-auth principal. Authorization requires the same active app user to hold the `candidate` role. Host-created candidate profiles keep `app_user_id` null and retain their provider/issuer/subject identity mapping. Neither email nor normalized display name is a profile-linking key.

The candidate audience cookie and host launch cookie are separate. A present candidate app-session cookie is authoritative for that request: invalid app-account access fails closed without consulting host launch. Host profile lookup, refresh, and launch-session creation require `candidate_profiles.app_user_id is null`. This prevents app-owned access from depending on host services and prevents host exchange from mutating an app-bound profile.

Registration must atomically create the app user, password credential, candidate role, app-owned candidate profile, and profile binding before a candidate session can be issued. Full product access additionally requires verified email. Verification and reset credentials are random single-use bearer tokens stored only as hashes. Automatic host/app profile linking and history merging are not part of the first-release contract.

Candidate password reset is one atomic credential boundary. Issuance applies only to an active, verified app user with the candidate role and one active `interview_coach` profile, supersedes earlier unused reset tokens, and returns no account-existence fact to the browser. Consumption locks the reset token and credential owner, rejects expired/used/replayed input, updates the scrypt hash, clears failed-login state, marks all reset tokens used, and revokes all active app sessions for that app user. It creates no new session and never touches `candidate_launch_sessions`. Reset-token rows, app-session rows, and auth-audit rows remain app-user facts; candidate-owned product data remains anchored to the unchanged `candidate_profile_id`.

Candidate account rate limits use `rate_limit_buckets` with purpose-scoped one-way request-source digests. Audit metadata contains bounded reason/provider/revocation facts only. Raw email, phone, postal data, names, candidate ids, passwords, bearer tokens, and token hashes are excluded from bucket keys and audit metadata.

Local development has two independent fixtures: explicit host candidates through `/candidate/dev/launch`, and app-account candidate seeds through the ordinary candidate login boundary. Fixture identity and seeded examples are development data, not durable product semantics.

### PrepProfile

`prepProfile` is the durable preparation context for one candidate and one target interview context.

Current backing:

- `candidate_role_preparation_profiles`;
- `candidate_practice_drafts.role_profile_id`;
- `candidate_practice_sessions.role_profile_id`;
- setup resolver: `src/features/candidate-setup-v2/candidate-setup-prep-context-repository.ts`.

Current contract:

```ts
type PrepProfile = {
    prepProfileId: string;
    candidateProfileId: string;
    targetRole: string;
    jobDescriptionSnapshot: string;
    practicePathNumber: number;
    resumeContextSnapshot?: unknown;
    source: "manual" | "host_platform" | "dev_seed";
    launchContext?: {
        sourceSurface?: string;
        hostDomain?: string;
        companyId?: string;
        platformCandidateId?: string;
        platformUserId?: string;
        jobCollectionId?: string;
        requirementId?: string;
        requirementCode?: string;
        talentChannelId?: string;
        jobDescriptionSource?: string;
        resumeSourceType?: string;
        resumeContentHash?: string;
    };
    status: "active" | "paused" | "archived";
};
```

Every newly persisted V2 setup session must have one candidate-owned prep-profile id. The current setup resolver supports these paths:

- verify an explicitly supplied `role_profile_id` against candidate ownership and active/paused state;
- in explicit local/dev manual setup, create path one when no active/paused exact match exists;
- reuse an exact-match profile only when it has no session activity, as repair for a partial setup write;
- return candidate-owned activity summaries without mutation when one or more exact matches have sessions;
- after an explicit candidate decision tied to one returned exact match, create a new independent `role_profile_id` for the submitted setup.

The manual resolver collapses inconsequential whitespace and keeps same-title contexts distinct when their job descriptions differ. `practice_path_number` is a private positive uniqueness ordinal under candidate + normalized role + normalized JD hash; it permits an intentional duplicate UUID while continuing to reject accidental same-path duplicates. It is not user-facing identity, lineage, ordering, or inherited progress. The exact-match response may expose only candidate-owned profile/session facts: opaque id, role, JD snapshot, created/latest-activity timestamps, original stage/count, completed session/question counts, and current active-round progress. The explicit separate-path request must carry one returned opaque id, and the repository revalidates candidate ownership, active/paused state, and the same normalized role/JD key before creating anything.

The profile stores only resume inclusion/capture-mode metadata in its current resume-context JSON; full resume text remains in governed session/setup snapshots. A failed session insert may leave a reusable profile without practice activity; dashboard profile selectors must not imply practice evidence from profile existence alone. Selecting an existing path from the setup conflict clears the submitted setup draft and navigates to canonical `/candidate/dashboard?prep=<roleProfileId>`. Closing the choice preserves the draft. Creating a separate path produces a blank-slate profile and first session with no inherited sessions, answers, Coach Plan coverage, Coach Update, queue, or evaluator evidence.

Future prep-context evolution rules:

- a resume revision stays under the same `role_profile_id`, but every session preserves the exact staged resume version/label it consumed;
- question wording does not embed candidate assistance. Hints and strong responses are separate candidate-owned question artifacts: hints are requested automatically when the question becomes current, while a strong response is requested only after an explicit candidate action;
- each assistance artifact is keyed by candidate profile, immutable practice session, question key, assistance kind, and a request fingerprint over the exact question/setup context. A successful artifact is replayed across reload, recovery, and tabs; a bounded claim lease prevents concurrent provider duplication, and one question/kind/code-generation revision permits at most three generation attempts before becoming non-retryable. A higher code-owned generation revision may atomically reopen only an older failed artifact, resets that revision's attempt count once, and never supersedes a succeeded artifact;
- assistance may consume the accepted processed resume snapshot staged for that session, remains absent from evaluator evidence and recruiter transcript reads, and must not invent candidate facts or ungrounded technical authority;
- answer evaluation and feedback consume the session's question/setup/answer facts independently and must not treat pre-answer assistance as candidate evidence;
- existing questions are never silently reinterpreted after a resume change;
- a later reconciliation service may compare a revised resume with current plan questions, propose slot/category-preserving one-for-one replacements, and version only candidate-accepted question replacements;
- a candidate-initiated interview-stage change creates a new linked `role_profile_id` with blank evidence. Stage lineage and update UI are not yet implemented.

Production identity rules:

- Production `/candidate/setup` requires an active candidate principal from either app-owned account access or verified host launch.
- App-owned access can create manual candidate-owned prep profiles and never receives host source metadata.
- Identity-only launch may create a manual candidate-owned prep profile when the candidate has no existing path; it never receives host source metadata.
- Job-aware prep profiles are found or created from candidate identity plus source platform and owned `JobCollectionID`; optional `RequirementID` is retained for later richer identity.
- Canonical host role/JD is server-staged and read-only. Browser-supplied mutation cannot be labeled or resolved as host-platform identity.
- Launch success creates no prep profile or practice session. Staging is consumed only with successful setup-session creation or an explicit existing-path selection.
- Host journey lineage is split intentionally: candidate identities retain provider/issuer/subject/workspace and platform candidate ids; launch sessions retain bounded source-surface, host-domain, platform-candidate, and optional job-collection facts; host-backed prep profiles retain source platform, job collection id, optional requirement id, and source launch-session id. Candidate-entered resume content does not acquire host provenance.

Reference: [Platform Launch PrepProfile Migration](./04-architecture/platform-launch-prepprofile-migration.md).

### Initial Setup Start Request

Initial durable setup and production question generation use a candidate-owned request claim before prep-context mutation or provider work. Migration `020_candidate_setup_start_idempotency.sql` creates `candidate_setup_start_requests`; the typed runtime contract lives in `candidate-setup-start-request.ts` and its Postgres repository.

The claim stores only:

- candidate profile id;
- SHA-256 idempotency-key hash;
- SHA-256 canonical request fingerprint;
- `pending`, `failed`, or `completed` lifecycle;
- positive claim generation and lease/expiry timestamps;
- the one accepted candidate practice-session id;
- bounded terminal error metadata.

It does not duplicate setup, JD, resume, generated questions, or an HTTP response body. Those remain in the candidate-owned immutable session snapshots. The request fingerprint covers canonical setup, entry mode, explicit prep-path decision, and the candidate-owned prep-context/host-launch anchor. A composite database constraint keeps the terminal session pointer owned by the same candidate as the claim. A 60-second lease fences synchronous provider work inside a 24-hour replay window. Same-fingerprint failure or stale-lease recovery increments generation; only the currently leased generation may atomically insert the session, complete the claim, and consume trusted setup staging. Completed replay loads the owned session pointer and skips prep resolution and provider generation. An unexpired key used with a changed setup/decision/context fingerprint is a conflict. Expired rows are indexed for a later bounded operational-retention job.

Browser setup drafts retain the raw opaque request key only for same-attempt retry/recovery and clear it with the successfully submitted draft. The raw key is never persisted in the claim table. See [Candidate Setup Start Idempotency](./04-architecture/candidate-setup-start-idempotency.md).

Question progress reference: [Question Preparedness Progress Contract](./04-architecture/question-preparedness-progress-contract.md).

Question category reference: [Question Category Contract](./04-architecture/question-category-contract.md).

Dashboard information architecture: [Evidence-First Dashboard Information Architecture](./04-architecture/evidence-first-dashboard-information-architecture.md).

The retired score-era instant-read plan remains available only through Git history.
Its numeric rollups, `overallRead`, and compatibility fallbacks are not V2 inputs.

Dashboard scoping transition:

1. Resolve every new setup or host-launched context to an opaque candidate-owned `role_profile_id`.
2. Honor an explicit opaque dashboard prep-context selection only after candidate ownership is proven.
3. Without an explicit selection, prefer the prep context containing an unfinished candidate-owned session, otherwise the latest completed practice context.
4. Keep active round, Coach Update, Coach Plan, Practice Next, history, and any derived coverage or attempt reads scoped to that selected id.

The current V2 read model uses candidate-owned `role_profile_id` for profile-backed contexts and isolates title-keyed grouping to historical sessions whose profile id is null. Normalized role title, job-description text, and readable URL metadata do not group profile-backed preparation contexts. Same-title contexts remain distinct. Canonical `/candidate/dashboard?prep=<roleProfileId>` navigation supports recovery and deep linking, but every read still resolves the id through candidate ownership.

### Follow-Up Practice Intent

Follow-up actions may route the candidate to `/candidate/practice/ready` with stable source metadata only. Feedback focus originates from a practiced Coach Update item; missing coverage originates from Coach Plan, Question Set, or Practice Next:

```ts
type CandidateFollowUpPracticeIntent =
    | {
        status: "candidate_follow_up_practice_intent_ready";
        kind: "practice_from_feedback";
        source: {
            kind: "coach_update_detail";
            candidatePracticeSessionId: string;
            questionKey: string;
        };
    }
    | {
        status: "candidate_follow_up_practice_intent_ready";
        kind: "practice_missing_evidence";
        source: {
            kind: "coach_plan";
            candidatePracticeSessionId: string;
            questionKey: string;
        };
    };
```

Once candidate identity and durable session access are available, the parsed intent may resolve to candidate-owned source facts:

```ts
type CandidateResolvedFollowUpPracticeIntent = CandidateFollowUpPracticeIntent & {
    status: "candidate_follow_up_practice_intent_resolved";
    source: CandidateFollowUpPracticeIntent["source"] & {
        targetInterviewId: string;
        targetRole: string;
        questionNumber: number;
        category: string;
        questionText: string;
        evidenceStatus: "practiced_with_coaching" | "missing_practice_evidence";
    };
    setupContext: {
        targetRole: string;
        jobDescription: string;
        interviewStage: CandidatePracticeSession["setupSnapshot"]["interviewStage"];
        questionCount: number;
        resumeIncluded: boolean;
    };
};
```

Follow-up practice rounds should converge on a durable practice intent before session creation. That durable intent supports the same route and persistence contract whether the candidate chooses one question, a selected bundle, or a full queued set.

An editable queue is not a practice intent. The durable target is one candidate-owned queue draft per `role_profile_id` plus normalized item rows. Queue items preserve a stable source-plan-question pointer, practice kind/reason, provenance, display position, and timestamps. The parent draft carries a version or equivalent optimistic concurrency value. The queue survives navigation, refresh, and later return, but it is never used as historical session lineage.

Current backing:

- `candidate_practice_intents`;
- `candidate_next_round_drafts` and normalized `candidate_next_round_draft_items`;
- repository adapter: `src/features/candidate-practice-v2/candidate-practice-intent-repository.ts`;
- creation adapter: `src/features/candidate-practice-v2/candidate-practice-intent-creation.ts`;
- editable-draft adapter: `src/features/candidate-practice-v2/candidate-next-round-draft-repository.ts`;
- launch service and adapter: `src/features/candidate-practice-v2/candidate-next-round-draft-launch.ts` and `candidate-next-round-draft-launch-repository.ts`;
- migrations: `db/migrations/008_candidate_practice_intents_schema.sql` and `db/migrations/013_candidate_next_round_drafts_schema.sql`;
- atomic database boundary: `public.snapshot_candidate_next_round_draft_to_intent(...)`;
- rollback-only validation: `db/validation/014_candidate_next_round_drafts_schema_smoke.sql`;
- durable staging route: `/candidate/practice/ready/[intentId]`;
- multi-item creation route: `/candidate/practice/ready/intents`.

Current durable contract:

```ts
type CandidatePracticeIntentRecord = {
    status: "candidate_practice_intent_record";
    candidatePracticeIntentId: string;
    candidateProfileId: string;
    source: "coach_update_detail" | "practice_builder" | "plan_aware_queue" | "coach_bundle";
    lifecycleState: "ready" | "consumed" | "cancelled" | "expired";
    consumedCandidatePracticeSessionId?: string | null;
    sourceNextRoundDraftId?: string | null;
    sourceNextRoundDraftVersion?: number | null;
    targetInterviewId: string;
    targetRole: string;
    itemCount: number;
    setupContext: CandidateResolvedFollowUpPracticeIntent["setupContext"];
    items: Array<{
        kind: "practice_from_feedback" | "practice_missing_evidence";
        source: CandidateResolvedFollowUpPracticeIntent["source"];
        display: CandidateResolvedFollowUpPracticeIntent["display"];
        assembly?: {
            source: "next_round_draft";
            candidateNextRoundDraftItemId: string;
            provenance: "coach_update" | "coach_plan" | "practice_next" | "candidate_selection" | "coach_bundle";
            displayPosition: number;
        };
    }>;
    createdAt: string;
    updatedAt: string;
};
```

Current accepted query values:

- `intent=coach-update-feedback-focus` maps to `practice_from_feedback`;
- `intent=coach-update-missing-evidence` maps to `practice_missing_evidence` only as a compatibility value; new Coach Update UI must not emit it, and the pointer source moves to Coach Plan/Practice Next;
- `fromSession` carries the source `candidate_practice_sessions` id;
- `questionKey` carries the source question slot/key.

Contract rules:

- parse repeated, missing, unknown, overlong, or unstable source params as no intent;
- do not parse or echo submitted answer text, coach observation text, job description text, resume text, score-like values, or other arbitrary query content;
- `/candidate/setup` remains the generic new-prep-context setup surface and should not render follow-up-practice intent UI;
- `/candidate/practice/ready` is the temporary pointer-based follow-up pre-session staging surface and must suppress source details when durable validation fails;
- `/candidate/practice/ready/[intentId]` is the durable follow-up pre-session staging surface and must resolve only candidate-owned `candidate_practice_intents` rows in `ready` state;
- every new one-question or multi-question round assembled from an existing prep context must route through `/candidate/practice/ready/[intentId]` before session start. Direct intent creation is allowed; bypassing the landing is not. A consumed intent or already-started session may resume directly because it is recovery, not a new launch;
- resolved intent requires current candidate ownership of the source `candidate_practice_sessions` row, an exact source question key in the source wording snapshot, optional selected target-interview context match, and intent-specific evidence semantics;
- durable intent creation requires one to twenty resolved items, no duplicated source session/question keys, and one shared target interview/setup context across all selected items;
- production queue and intent creation must use one candidate-owned opaque prep-context id; `candidate_practice_intents.role_profile_id` now carries that identity under a composite candidate/profile ownership constraint, while readable `target_interview_id` values remain display and bounded legacy compatibility metadata;
- `practice_from_feedback` resolves only when the source question has both answer evidence and accepted coach analysis evidence;
- `practice_from_feedback` uses `coach_update_detail` source posture; `practice_missing_evidence` uses Coach Plan/Practice Next source posture;
- `practice_missing_evidence` resolves only when the source question has no answer submission. A never-exposed canonical baseline question may resolve through the matching candidate-owned prep-context baseline while retaining the earliest original session as its lineage anchor; it does not need to be copied into that round's persisted wording snapshot;
- `POST /candidate/practice/ready/intents` accepts one to twenty stable source pointers plus a per-activation `Idempotency-Key`, and returns a `redirectTo` route for the durable ready page after identity and source validation succeed. It stores only the SHA-256 key hash and a fingerprint of the exact canonical server-resolved snapshot;
- `candidate_practice_intent_creation_requests` is the bounded candidate-owned replay ledger for direct one-question and fixed-set creation. Its unique candidate-plus-key hash points to one immutable intent for 24 hours. Exact replay returns that intent, changed source/order/items/prep context/snapshot content conflicts before mutation, and a new key permits intentional repractice of identical content;
- the browser retains at most one exact pending direct action in tab-scoped session storage. Refresh or an ambiguous transport failure reuses its key; an accepted destination clears it; a fingerprint conflict clears it before the next user activation receives a new key. The browser record contains only action source, opaque source session/question pointers, key, and timestamp and is not durable candidate history;
- `public.create_candidate_direct_practice_intent(...)` serializes candidate-plus-key requests and inserts the ready intent and request pointer in one transaction. It has no pending or lease state because no external provider work occurs; statement failure leaves neither row committed, so the same key can retry safely;
- `Start practice` from an editable queue validates its current version and source pointers, atomically creates the immutable intent snapshot, and clears or links the launched queue draft. A conflict returns without silently dropping newer selections;
- the atomic draft-snapshot function locks the exact candidate-owned draft, revalidates every source question and latest answer/analysis relationship, compares the submitted ordered payload with every normalized draft item, inserts one immutable `practice_builder` intent, clears the item rows, and increments the draft version in one statement. Its question-existence check uses persisted source-round wording for feedback-driven practice and permits the matching immutable prep-context baseline only for missing-evidence questions that were not exposed in the source round;
- the atomic intent-to-session function repeats the same source boundary before consuming the intent: feedback-driven questions must match persisted source-round wording, while a missing-evidence question may match exact wording in the owned prep-context baseline. The created session copies the exact immutable intent wording and lineage; failure leaves the ready intent unconsumed;
- repeated launch of the same draft version recovers the same ready intent, or its already-consumed session, instead of creating another round. A stale version, stale evidence, malformed payload, or ownership mismatch leaves the editable draft unchanged;
- the current intent builder requires every selected item to resolve to one opaque prep context and one matching staged setup snapshot, including interview stage and resume-inclusion posture. The product does not intentionally assemble mixed-profile/stage/resume rounds; mismatch is an integrity failure. Future resume revision work must explicitly stage one resume version before launch;
- one-question and fixed coach-bundle fast paths may create immutable intents directly, but still route to the durable ready landing; `Customize` may instead seed or merge items into the durable queue draft;
- the temporary query-pointer `/candidate/practice/ready` bridge is read-only compatibility UI. It may resolve and explain candidate-owned source context, but it never creates a durable intent or redirects as a side effect of GET rendering;
- `POST /candidate/practice/ready/[intentId]/start` accepts the immutable candidate-owned intent id as its one-use launch identity and no mutable round payload. A ready intent expires 24 hours after creation; cancelled, expired, unowned, changed, or malformed intents fail before session mutation;
- `public.start_candidate_practice_intent_session(...)` locks the exact intent, serializes candidate prep-context launch, validates its expected version and ordered source/session snapshots, rejects stale attempt-count inputs, inserts one normal `candidate_practice_sessions` row, and marks the intent `consumed` with `consumedCandidatePracticeSessionId` and `consumedAt` in one transaction;
- repeated or response-lost start submissions replay only the already-attached candidate-owned session whose immutable setup snapshot declares the same source intent. A same-candidate but unrelated session pointer is `consumed_mismatch`, not a valid replay;
- follow-up practice has no question-level attempt limit. The session input must carry follow-up lineage in setup, plan, and wording snapshots so downstream reads can show or aggregate: session attempt number for the selected target-interview context, question attempt number for each source question within that context, total question attempts, and total session attempts;
- follow-up question lineage must include the immediate source practice-session id and question key, canonical root source-session id and question key, source question number/text/category, local follow-up slot id/number, practice kind, and question attempt number. Root resolution walks and validates historical follow-up links so repeat practice launched from prior repeat practice does not reset the question-attempt sequence. One launched round rejects multiple selected occurrences that collapse to the same canonical root question. Queue-created rounds also carry source draft id/version plus each item's draft-item id, provenance, and display position into setup, plan, and wording snapshots. This keeps candidate dashboard trends, recruiter invited-session attempt counts, and company engagement rollups available without treating a repeated question as a duplicate baseline question.

### InterviewContext

The target interview context defines what practice is preparing for.

Required:

- target role;
- job description.

Optional:

- resume content;
- interview stage;
- question count;
- host-platform launch metadata when available.

Current setup rule: candidate-led `/candidate/setup` requires a job description because production entry is expected to supply JD context and the practice model is role-specific.

### ResumeProcessedArtifact

Resume acquisition is separate from resume persistence. Paste, document upload, photo capture, and trusted-host text all produce the same candidate-owned processed artifact before the text may enter setup or a session snapshot.

```ts
type ResumeInputSource = "pasted_text" | "document_upload" | "photo_capture" | "trusted_host";

type ResumeProcessedArtifact = {
    artifactId: string;
    candidateProfileId: string;
    roleProfileId: string | null;
    version: number;
    revision: number;
    source: ResumeInputSource;
    candidateLabel: string;
    normalizedText: string;
    sourceFingerprint: string;
    normalizedTextFingerprint: string;
    processingPolicyVersion: string;
    piiPolicyVersion: string;
    piiRedactionCounts: Record<string, number>;
    reviewState: "awaiting_review" | "accepted" | "replaced";
    createdAt: string;
    acceptedAt: string | null;
    originalRetained: false;
};
```

Rules:

- `normalizedText` is parsed and direct-PII-scrubbed under the recorded code-owned policy before persistence;
- candidate review or correction is required before `accepted` state;
- safe labels may retain a sanitized filename or generated source label, but never paths, URLs, identity ids, or source bytes;
- source bytes and unprocessed paste are request-scoped and excluded from Postgres, browser draft storage, logs, analytics, evaluator artifacts, and session snapshots;
- the durable source fingerprint supports idempotency and diagnostics but is not exposed to the browser;
- successful processing is not terminal until source disposal succeeds; terminal failures also dispose of source bytes and persist at most a bounded safe reason code;
- an accepted artifact version is immutable input to its prep/session history. Later replacement creates a new version rather than rewriting historical meaning.

### CandidateSetupResumeSelection

The processed artifact is immutable evidence; the setup selection is the mutable recovery pointer that says which artifact, if any, belongs to one still-open setup context.

```ts
type CandidateSetupResumeSelection = {
    candidateProfileId: string;
    setupOwnerKey: string; // server-derived candidate plus optional trusted-host setup scope
    revision: number;
    pendingOperationId: string | null;
    artifactId: string | null;
    lifecycleState: "pending" | "active" | "cleared" | "consumed";
    consumedRoleProfileId: string | null;
    consumedCandidatePracticeSessionId: string | null;
};
```

Rules:

- the browser may supply an opaque operation id, but the server derives the owner key from authenticated request context;
- only the current pending operation may finalize an artifact selection;
- a clear/change command supersedes pending work, and stale completion leaves at most an unselected candidate-owned artifact;
- recovery returns only an `active` candidate-owned artifact under current processing and PII policy;
- review acceptance and setup submission require the exact active artifact pointer, not merely any artifact owned by the candidate;
- successful durable setup consumes the pointer with the exact prep context and session, while immutable setup/follow-up snapshots retain the accepted artifact reference and safe label;
- no raw or processed resume text is duplicated into the selection row.

Migration `032_candidate_resume_processed_artifacts.sql` implements the first durable form for `pasted_text` and `trusted_host`; migrations `033_candidate_resume_document_upload.sql` and `034_candidate_resume_photo_ocr.sql` widen only the same provenance constraint to `document_upload` and `photo_capture` without adding raw-source columns. Migration `035_candidate_setup_resume_selections.sql` adds the text-free, lifecycle-fenced setup selection and consumption pointers. `POST /candidate/setup/resume-text` proves same-origin candidate identity before reading bounded pasted source, processes it under exact code-owned policy versions, and creates or recovers an `awaiting_review` artifact without persisting raw source. `POST /candidate/setup/resume-document` proves the same identity before reading an actually bounded 5 MiB stream, accepts only actual PDF/DOCX signatures/containers, extracts text under `candidate_resume_document_extraction_v1`, disposes app-owned binary buffers, and only then creates or recovers the same processed artifact. `POST /candidate/setup/resume-photo` proves identity before streaming a bounded multipart batch, accepts at most four exact-order JPEG/PNG/WebP/HEIC/HEIF pages, allows any one page to consume the 12 MiB aggregate source ceiling, checks actual signatures/container brands, and calls one exact-profile OCR runtime. The provider must return one same-order page result per source image. App-owned request/page buffers are zero-filled before only combined text enters the shared direct-PII processor and artifact repository. Document and photo source fingerprints cover exact source bytes plus their extraction/OCR configuration identity and are never returned to the browser. `POST /candidate/setup/resume-text/[artifactId]/accept` revision-fences candidate review and re-scrubs edits before acceptance. Identity-backed setup start requires an accepted artifact reference and reloads its canonical processed text through the active selection by candidate, owner key, artifact id, version, and revision; raw `CandidateSetupPayload.resumeText` without that reference is rejected before prep or wording work. The non-production identity-less browser bridge remains a compatibility exception only.

### CandidateResumeIngestionOperation

Migration `036_candidate_resume_ingestion_operations.sql` owns cross-instance admission and publication fencing for browser paste, document, and photo processing. This is an operational command ledger, not a resume-content store.

```ts
type CandidateResumeIngestionOperation = {
    operationId: string;
    candidateProfileId: string;
    setupOwnerKey: string;
    source: "pasted_text" | "document_upload" | "photo_capture";
    lifecycleState: "processing" | "completed" | "failed" | "superseded";
    claimGeneration: number; // 1..3
    claimExpiresAt: string;
    artifactId: string | null;
    terminalReason: string | null; // allowlisted operational category only
    inputSizeClass: "unknown" | "tiny" | "small" | "medium" | "large" | "maximum";
    pageCount: number; // 0..4
    durationMs: number | null;
};
```

Contract rules:

- the operation UUID is unique across candidates, setup owners, and sources; changed ownership or source is an idempotency/ownership conflict;
- one owner has at most one unexpired processing lease across all resume sources;
- source-specific global active and owner-window limits are decided in one database-serialized claim boundary;
- completed replay returns only the exact owned artifact and skips request-body consumption and provider/parser work;
- expired work may advance generation up to three, but only the current unexpired generation may atomically complete the operation and activate the pending setup selection;
- stale or superseded workers cannot publish, even when they finish extraction or OCR after losing ownership;
- the row never stores source text/bytes, OCR output, filenames, removed PII, fingerprints, provider payloads, or browser credentials.
- terminal rows require a bounded operational-retention job before production volume; active leases and completed operations still backing exact current-selection replay must be retained.

### CandidateHostLaunchSession

`candidate_launch_sessions` is the durable exchange boundary between a verified host token and the Interview Coach candidate session. It is not a copy of the host authentication session.

Required for every newly created production launch session:

- candidate profile, provider, issuer, subject, and trusted platform candidate id;
- SHA-256 launch-token fingerprint;
- launch-token expiry;
- independent Interview Coach session expiry;
- source surface and compact object-shaped context snapshot.

Optional:

- issuer-scoped launch-token id (`jti`);
- job collection id for job-aware launch;
- host domain.

Rules:

- raw launch tokens and complete JWT claim payloads are never persisted;
- token fingerprint is unique, and `(issuer, launch_token_id)` is unique when `jti` is supplied;
- no-job dashboard launch persists `job_collection_id = null`; an empty string is invalid;
- a uniqueness conflict is a replay result and must not return the previously created session;
- launch-token expiry and app-session expiry are distinct clocks;
- rows created before migration 017 may have null token metadata and are not invented or backfilled;
- the compact snapshot may carry candidate id, nullable job collection id, source surface, and host domain, but not resume text, JD text, or the raw host payload.
- the first production host-data adapter is TalentArbor-only: `CandidateMaster` is authoritative for candidate profile attributes, and job-aware launch additionally requires exact `CandidateJobCollectionTxn` ownership before reading canonical `JobCollection` context;
- identity-only launch does not infer a job, and an invalid or unowned requested job does not downgrade to identity-only success;
- provider/issuer/subject identity mappings cannot be silently relinked to another platform candidate, and disabled candidate profiles remain fail-closed;
- launch-context absence of resume or consent fields means those domains were not queried, not that the candidate lacks a resume or consent.

### App-owned candidate registration

- `app_users` owns the login email, password credential relationship, first/last/display name, email verification timestamp, status, and shared app-session relationship.
- An app-owned candidate has exactly one active `candidate_profiles` ownership anchor with `workspace = "interview_coach"` and the same `app_user_id`.
- Candidate registration profile data extends that anchor with normalized E.164 phone, nullable phone-verification time, `US` country code, and text ZIP/postal code. Phone and postal values are integration/profile facts, not authenticators.
- Candidate contact preferences are current mutable channel state. They cannot be interpreted as legal acceptance without a corresponding consent receipt.
- Candidate consent receipts are append-only facts carrying decision type, document key or authorization scope, explicit version, canonical URI where applicable, collection surface, timestamp, and bounded request metadata.
- Registration atomically creates the app user, credential, candidate role, candidate profile, registration profile, contact preferences, required receipts, and one hashed email-verification token. Provider delivery occurs afterward and may be retried without recreating identity facts.
- Duplicate or concurrent registration attempts for the same normalized email do not create a second user, candidate profile, or receipt set. Public responses do not disclose whether the address already exists.
- Email-verification GET requests never consume tokens. A same-origin POST atomically consumes one unexpired token, verifies the user, and invalidates sibling tokens. Replaying an already consumed token converges to the already-verified state.
- No app-owned registration path queries or mutates host identity, MSSQL launch context, trusted-host staging, or external candidate mappings. Future TA reconciliation uses a separate explicit external-identity mapping and never copies Interview Coach password hashes.

### CandidateHostLaunchSetupContext

`candidate_launch_setup_contexts` is transient immutable setup staging for one owned job-aware launch. It is not a prep profile, practice session, resume snapshot, or browser draft.

Required:

- active candidate launch session and the same candidate owner;
- source platform and positive job collection id;
- bounded canonical role and JD snapshots plus canonical JD SHA-256 hash;
- expiry no later than the launch session.

Rules:

- one staging row exists at most per launch session;
- role/JD never enter the URL, launch cookie, or compact launch-session JSON;
- setup reads staging through the active launch-session cookie and renders role/JD read-only;
- browser `setupEntryMode` is only a counterfactual/stale-tab marker; server staging remains authoritative;
- first-session creation consumes staging and marks the launch session in the same database statement;
- choosing an existing same-job prep path consumes staging only after ownership and source-job identity are revalidated;
- consumed or expired staging cannot create another host-backed path; abandoned rows become inaccessible at launch-session expiry and cascade when that launch session is removed;
- resume content is deliberately absent.

### CandidatePracticeSession

`CandidatePracticeSession` is the V2 durable boundary for a candidate-owned practice round created from setup.

Current backing:

- `candidate_practice_sessions`;
- repository adapter: `src/features/candidate-session-v2/candidate-practice-session-repository.ts`;
- migration: `db/migrations/007_candidate_practice_sessions_schema.sql`.

Current contract:

```ts
type CandidatePracticeSessionProgress = {
    status: "planned" | "question_preview" | "live_question" | "completed";
    currentQuestionIndex: number;
};

type CandidateAnswerDraft = {
    slotId: string;
    questionIndex: number;
    mode: "text";
    text: string;
    updatedAt: string;
};

type CandidateAnswerSubmission = {
    slotId: string;
    questionIndex: number;
    mode: "text";
    text: string;
    submittedAt: string;
    status: "pending_analysis";
};

type CandidateQuestionWordingGeneration = {
    status: "candidate_question_wording_generation_v1";
    provider: string;
    modelName: string;
    promptVersion: string;
    profileId: string;
    configurationFingerprint: string; // sha256
    requestFingerprint: string; // sha256 of bounded setup + exact ordered plan
    generatedAt: string;
    validation: {
        providerRequestVersion: string;
        providerOutputVersion: string;
        timeoutMs: number;
        transportAttemptCount: 1;
        latencyMs: number;
        tokenUsage: { inputTokens: number | null; outputTokens: number | null };
        rawOutputStored: false;
        promptStored: false;
    };
};

type QuestionWordingResult = {
    status: "questions_worded";
    questions: Array<{
        slotId: string;
        index: number;
        category: QuestionPlan["slots"][number]["category"];
        questionText: string;
    }>;
    generation?: CandidateQuestionWordingGeneration; // absent only on pre-provider V2 fixtures/follow-up compatibility snapshots
};

type CandidatePracticeSession = {
    candidatePracticeSessionId: string;
    candidateProfileId: string;
    roleProfileId?: string | null;
    candidateLaunchSessionId?: string | null;
    status: "planned" | "in_progress" | "completed" | "abandoned";
    setupSnapshot: CandidateSetupPayload & { createdAt: string };
    questionPlanSnapshot: QuestionPlan;
    questionWordingSnapshot?: QuestionWordingResult | null;
    questionWordingStatus: "not_requested" | "provider_not_configured" | "worded" | "failed";
    progress: CandidatePracticeSessionProgress;
    answerDrafts: Record<string, CandidateAnswerDraft>;
    answerSubmissions: Record<string, CandidateAnswerSubmission>; // latest-attempt recovery projection
    answerAnalysisSnapshots: Record<string, CandidateAnswerAnalysisProviderResult>; // latest accepted-analysis recovery projection
    feedbackActionEvents: Record<string, CandidateFeedbackActionEvent>;
    completionSnapshot?: CandidateLedSessionCompletionSnapshot | null;
};
```

Rules:

- `setupSnapshot`, `questionPlanSnapshot`, optional `questionWordingSnapshot`, `progress`, and `answerDrafts` remain session JSONB boundaries. Slot-keyed `answerSubmissions` and `answerAnalysisSnapshots` are latest-state recovery projections over normalized immutable answer attempts and evaluator runs; they are not legacy-data adapters and must not be treated as complete attempt history.
- Session lifecycle follows accepted practice evidence: `planned` means no answer has been accepted, the first accepted answer projection promotes the durable session to `in_progress`, and it remains `in_progress` until explicit completion succeeds even when the final answer is awaiting feedback/Finish. Draft text and page entry do not promote lifecycle state. Completed or abandoned sessions reject new answer attempts before immutable attempt or compatibility-projection writes. Historical answered rows left as `planned` are backfilled idempotently.
- The table is candidate-owned and may link to `prepProfile` through `role_profile_id` and to host launch through `candidate_launch_session_id`.
- Follow-up practice sessions created from `candidate_practice_intents` use the same durable table as setup-created sessions. Their `setupSnapshot.followUpPractice`, `questionPlanSnapshot.followUpPractice`, and `questionWordingSnapshot.followUpPractice` metadata must preserve the source intent, source route, session attempt number, item count, and per-question attempt lineage. This is the current V2 home for attempt context until a later normalized analytics/projection table is justified.
- `/candidate/setup/start` persists setup-created sessions into `candidate_practice_sessions` when candidate identity can be resolved from the route context. If identity cannot be resolved, the route may continue returning the browser-bridge provisional session result for local/dev continuity. If identity resolves but persistence fails, the route must fail closed.
- Initial setup-created rounds resolve ownership and prep context, create the deterministic plan, and then invoke the selected question-wording runtime exactly once before session insertion. Only an accepted exact slot/order/category mapping may be stored as `questionWordingSnapshot`; its immutable generation identity is part of that same session JSONB snapshot. Provider failure creates no session and consumes no trusted host setup staging. A prep context with no session may be reused by an explicit retry as partial-write repair. Follow-up practice snapshots exact selected source questions and must not invoke the wording provider.
- Production question wording is selected only by `CANDIDATE_QUESTION_WORDING_PROVIDER=google_genai`, exact profile `google_gemini_2_5_flash_question_wording_v2`, and a nonblank server-only `GEMINI_API_KEY`. The provider receives bounded role/JD/optional-resume/stage and exact plan-slot context inside an untrusted envelope; it receives no candidate identity, database ids, host token data, answers, evaluation, Coach Update, or dashboard facts. Runtime telemetry is metadata-only. Fixture and fault profiles are restricted to explicit local host-launch development mode and are unavailable in production.
- `/candidate/setup/start` returns `400` with setup `fieldErrors` only for invalid setup payloads. Candidate identity lookup, database schema, or durable session startup failures should return a fail-closed startup error, currently `503`, so local/dev database drift is not misreported as a candidate input problem.
- `/candidate/session/[sessionId]` may recover a setup-created practice round from `candidate_practice_sessions` only after the launch-session cookie resolves to the owning `candidateProfileId`. Recovered sessions hydrate the planned-session shell before browser storage is consulted. If durable recovery is unavailable, browser session storage remains the local/dev fallback.
- In explicit local dev host-launch mode, deterministic `dev-host-launch-*` cookies resolve directly to fixture `candidateProfileId` values for setup-start, durable session recovery, and answer-draft saves. These cookie values are not persisted into `candidate_practice_sessions.candidate_launch_session_id` because they are not UUID rows in `candidate_launch_sessions`.
- `/candidate/session/[sessionId]/progress` may save the active session view state to `candidate_practice_sessions.progress_state_json` for candidate-owned durable sessions. Current progress states are `planned`, `question_preview`, `live_question`, and `completed`; question-surface and completed states must carry the current question index. This supports pause/resume, refresh, cross-tab recovery back to the active question surface, and final round completion state.
- The answer-draft shell may save typed draft text to `candidate_practice_sessions.answer_drafts_json` through an ownership-scoped candidate session route when durable identity is available. Browser-bridge sessions keep answer draft text component-local only. Answer drafts must not write to `answers`, evaluator inputs, feedback, or dashboard read models until answer submission deliberately lands.
- `/candidate/session/[sessionId]/answers` is the candidate-owned answer-submit persistence boundary. It validates a nonblank typed draft payload, resolves candidate identity, verifies durable session ownership, and appends an immutable attempt to `candidate_answer_attempts` behind a slot-scoped database lock and idempotency key. Initial submit creates attempt one. Feedback retry is accepted only when the source attempt is the exact latest saved submission and analysis and a persisted feedback action authorizes `retry_current_question`; it appends the next attempt with `trigger: "feedback_retry"` and `supersedesAnswerAttemptId`. Concurrent or stale retry sources fail closed. The route writes the accepted attempt identity into the slot-scoped `pending_analysis` compatibility projection in `candidate_practice_sessions.answer_submissions_json`. If projection write fails after append, replay recovers the same attempt rather than duplicating history. Evaluator-run wiring remains a later explicit lifecycle step; this route must not write legacy `answers` or invent feedback/dashboard truth.
- `/candidate/session/[sessionId]/answers/[slotId]/analysis` is the answer-analysis handoff boundary. It resolves candidate identity, verifies durable ownership, reads the exact slot-scoped `pending_analysis` submission, claims the fenced evaluator run before adapter work, creates `answer_analysis_requested`, and returns candidate-safe unavailable behavior when no valid runtime exists. A configured runtime receives the saved attempt identity, exact slot-mapped worded question and planned purpose, and setup context. The accepted internal runtime result must match the claimed run id and shared input fingerprint before it can complete that run or replace the latest candidate-safe session projection. Route responses expose only `pending`, `recoverable`, `retryable`, or `unavailable` recovery capabilities. A replayed fresh claim returns pending without another adapter call. A transient terminal run may be followed by a new generation for the same attempt/fingerprint only when its durable validation policy permits it; a nonretryable terminal result blocks a new generation even if a client calls the route directly. Candidate coaching permits at most three generations for one answer attempt in ten minutes, excluding QA comparison. A completed accepted internal run repairs a missing candidate-safe projection without another adapter call and remains restorable when the current provider runtime is absent or has changed; a malformed completed result is unavailable rather than endlessly restorable. A rejected late completion cannot write the projection. The local deterministic fixture is enabled only by `CANDIDATE_ANSWER_ANALYSIS_PROVIDER=fixture` plus explicit local dev host-launch mode; it traverses the same extractor, deterministic appraisal, conditional verifier, composer, retry-budget, validation, and projection runtime as production adapters, but is not production coaching. `CANDIDATE_ANSWER_ANALYSIS_PROVIDER=fault` selects the allowlisted fail-first development harness only in the same explicit local mode and never in production. Exact server selection of `google_genai` plus `google_gemini_2_5_flash_v1` and a nonblank `GEMINI_API_KEY` invokes the conformed Google runtime only after the durable claim and supplies that claim's run id as a required completion fence. Missing/mismatched configuration, failed ownership, fresh replay, and completed projection repair make no Google call. The live provider supplies exact quotes and bounded semantic fields; application code reattaches immutable identity, computes exact offsets, and derives observable markers and missing-evidence codes before strict acceptance. The route persists accepted internal stage artifacts before writing only the candidate-safe session projection; it does not persist or return credentials, assembled prompts, raw provider output, provider exception bodies, or copied answer/JD/resume content outside the established evaluator/session boundaries. Continue or finish without coaching advances only session progress/completion; it creates no analysis snapshot or coached-answer fact. The answer-submit boundary rejects text above the evaluator's 20,000-character input ceiling. The route must not create summaries, dashboard evidence, legacy `eval_results`, or legacy answer-analysis fields.
- `/candidate/session/[sessionId]/coach-update/repair` is the ownership-scoped post-completion repair boundary. It accepts no answer, question, evaluator, provider, or prep-context identity from the browser. The server loads the candidate-owned completed session, immutable latest answer attempts, and evaluator-run history; rejects incomplete or cross-owner sessions; and invokes the existing answer-analysis boundary only for answered occurrences whose exact latest immutable attempt is recoverable or retryable under the current serving configuration. A request attempts no more than two eligible occurrences. Fresh pending claims, accepted results, nonretryable terminal results, malformed completed results, and generation-capped attempts do not create a provider call. Concurrent or repeated requests converge through the ordinary per-answer evaluator claim and deterministic analysis idempotency record. The response and diagnostics expose only bounded status and counts. After repair, the server reloads durable evidence and may invoke Coach Update synthesis only when every answered occurrence has one matching accepted `candidate_coaching` run. It never rewrites answers, completion snapshots, prior evaluator generations, or creates partial Coach Update content. The completion route may invoke this same repair service after first-write completion; dashboard `GET` remains side-effect free, and the unavailable Coach Update action calls the session-owned repair route rather than a dashboard evaluator endpoint.
- Production Coach Update synthesis is assembled only from the exact server environment tuple `CANDIDATE_COACH_UPDATE_PROVIDER=google_genai`, `CANDIDATE_COACH_UPDATE_PROFILE=google_gemini_2_5_flash_coach_update_v4`, and nonblank `GEMINI_API_KEY`. The provider request contains the synthesis fingerprint, bounded role/question/category text, response mode, direct V2 answer-usability, technical-accuracy, criterion-appraisal, and pattern-gap facts, accepted candidate-safe coaching, code-owned per-question and round-primary completion framing, and at most three recent independently evaluated comparable attempts per question. It contains no raw current/prior answer, candidate/session/prep identity, credential, database id, raw evaluator artifact, hidden plan, JD, resume, numeric score, or synthetic overall band. Google receives the request inside an explicitly untrusted JSON envelope and may return only bounded synthesis-language fields. Application code reattaches status, fingerprint, question mapping, answer/source lineage, accepted coaching, and transcript-canvas facts after exact structured-output validation. A generated-language rejection may trigger exactly one code-directed rewrite; rejected raw output is not retained or replayed, token/attempt metadata is aggregated, and the rewrite remains subject to the same fail-closed validation. Provider configuration and transport errors use allowlisted safe classifications; the API key, request envelope, prompt, raw output, generated text, and provider exception detail are never persisted or emitted to ordinary telemetry.
- `answer_analysis_provider_requested` is the V2 provider adapter input after `answer_analysis_requested`. It is created from one saved pending answer submission, one slot-mapped worded question, and the setup snapshot context. The adapter must fail if the question slot/index do not match the submitted answer.
- `evidence_first_evaluator_run_accepted` is the internal V2 evaluator result persisted on the fenced evaluator-run row. It contains only parsed accepted extraction, deterministic criterion appraisals and pattern gap, conditional verifier output when required, accepted feedback composition, candidate-safe feedback, bounded stage-attempt metadata, aggregate latency/token totals, and explicit no-prompt/no-raw-output retention markers. Its run id and all stage fingerprints must match the relational run fence. `answer_analysis_provider_result` is the bounded V2 session projection: answer identity, candidate-facing `coachFeedback`, candidate-safe feedback, the interaction intervention needed by staged feedback, and a non-numeric appraisal projection containing answer-usability status, technical-accuracy status, criterion applicability/bands, the code-owned question-preparedness result, and the selected pattern gap. It never carries legacy numeric evidence, hidden model prose, verifier output, raw extraction spans, or an exposed numeric mean/readiness score.
- `candidate_answer_coaching_facts` is the candidate-safe derived read model from one accepted `answer_analysis_provider_result`. It carries answer identity, provider/analyzed time, candidate-safe `coachFeedback`, explicit per-criterion qualitative facts, answer-usability and technical-accuracy status, the code-owned question-preparedness result, the selected pattern gap, and coverage buckets for observed, not-elicited, insufficient-data, and unscoreable criteria. It must not expose raw `score`, `averageScore`, the internal question-band transform, hidden numeric readiness, or legacy `oneBigUpgrade` as downstream product language. It is derived from the saved analysis snapshot and is not a separate persistence write.
- `candidate_question_preparedness_progress` is a read-time projection over the canonical prep-context baseline, immutable answer-attempt lineage, and accepted candidate-coaching evaluator runs. Each attempt is `emerging`, `clear`, `strong`, or `incomplete`; each canonical question retains its highest earned rated band while preserving latest-attempt and attempt-count facts for future regression work. The prep-context projection reports coverage, incomplete/unavailable counts, and counts by band separately. Unanswered questions are neutral, supplemental questions do not expand the baseline, immediate/latest coaching remains latest-attempt, and no numeric mean or readiness percentage crosses the product boundary.
- `session_runtime_facts` is the shared candidate-led/invited-candidate runtime read model. It carries session id, audience, target role, interview stage, question count, current question index, normalized question key/index/category/text, submitted answer mode/text/submitted-at/lifecycle status, optional `candidate_answer_coaching_facts`, answered/coached counts, and completion behavior. It is designed so candidate-led and invited-candidate session surfaces can derive from the same runtime facts while keeping entry/auth differences outside the shared layer.
- Candidate-only identity and launch details must not be pushed into `session_runtime_facts`. `candidateProfileId`, `candidateLaunchSessionId`, setup snapshots, resume content, setup draft state, browser-bridge state, and route persistence internals remain candidate-led boundary facts unless a later shared-runtime slice explicitly promotes one of them.
- Recruiter-created V2 practice uses `recruiter_invitation_question_sets`, `recruiter_invitation_batches`, `recruiter_invitation_recipients`, `invited_practice_sessions`, `invited_practice_access_tokens`, `invited_practice_browser_sessions`, `invited_practice_entry_signals`, `invited_practice_answer_attempts`, `invited_practice_answer_evaluation_runs`, and `recruiter_invitation_creation_requests`. The question-set row is a recruiter-owned hashed-action claim with `preparing`, immutable `ready`, or terminal `failed` lifecycle. It stores one fixed stage-derived plan and accepted V2 wording; concurrent exact claims converge, ready replay does not call the provider, and changed content conflicts. Every new authenticated create batch carries `source_recruiter_invitation_question_set_id`; an atomic wrapper verifies the same recruiter, action hash, ready/unexpired state, context, plan, and wording before it creates or replays the aggregate. The recipient is scoped to one invitation and is not a `candidate_profile`. Aggregate creation atomically creates every recipient, initial invited session, hashed/encrypted access token, and request pointer. Recruiter plus hashed idempotency key identifies a 24-hour creation request; the semantic fingerprint excludes generated ids and token material. A valid invitation-token hash may mint separately hashed, invite-scoped browser sessions capped by both a seven-day app lifetime and the source-token expiry. The immutable bearer remains attached to the original invite session but authorizes only that recipient lineage; exchange and clean-cookie resolution select its highest session `attempt_number`. Every live mutation still requires the route session id to equal that latest resolved session. `invited_practice_entry_signals` stores one immutable first initials entry plus expected-at-entry initials and match/mismatch result for the original invitation entry; it is evidence, not authentication, and later attempts reuse it without inventing another entry event. Invited session adapters project into `session_runtime_facts` with audience `invited_candidate`.
- Recruiter V2 display identity is `app_users.display_name`, owned by the same `app_users.user_id` principal used for authorization. Settings reads expose the current display name, read-only email, and an opaque revision derived from `updated_at`. Updates accept no user id, require the current revision, and atomically append metadata-only `recruiter_display_name_updated` audit evidence. `recruiter_profiles`, title, phone, and timezone are not active V2 settings sources. Newly rendered copy and later delivery attempts resolve the current app-user projection; previously provider-accepted message content is immutable historical output.
- Invited pre-submission text, accepted-submission, candidate-safe coaching, feedback-action, progress, and completion JSON on `invited_practice_sessions` are latest-state recovery projections. Complete answer history lives in immutable `invited_practice_answer_attempts`; evaluator claim/generation history lives in `invited_practice_answer_evaluation_runs`. Both use real invited-session/recipient or answer-attempt foreign keys and the same attempt-number, feedback-retry lineage, resolved-configuration fingerprint, 60-second lease, generation cap, terminal transition, and candidate-safe projection rules as candidate-led practice. A statement-level concurrent unique conflict is retried once so duplicated browser requests resolve the now-durable generation rather than surfacing an avoidable failure. Invited routes do not write `candidate_profiles`, `candidate_answer_attempts`, `candidate_answer_evaluation_runs`, Coach Update artifacts, or candidate dashboard facts.
- Whole-session invited repeat uses `parent_invited_practice_session_id` plus recipient-scoped `attempt_number`. A unique non-null parent index permits one direct child per completed session. `advance_invited_practice_attempt` locks the recipient lineage, creates or replays that child, copies the parent's immutable setup/plan/wording snapshots, initializes empty live projections, and atomically mints a fresh browser-session hash capped by the original token expiry. Prior browser sessions remain bounded and replay-capable; all resolve the same latest attempt. The repeat operation never copies or mutates answer attempts, evaluator runs, feedback, or completion history.
- Recruiter invited-session transcript reads are a narrow projection over the immutable wording snapshot and answer-attempt history. They return one question-ordered item per slot and select only the highest submitted `attempt_number` as the current employer-visible transcript. Draft JSON, superseded answer text, evaluator/coaching content, feedback actions, engagement/timing, candidate-led rows, and bearer material are not part of that projection. Session, recipient, and batch ownership must all match the authenticated recruiter id; a foreign or unknown session id resolves as not found.
- `recruiter_dashboard_v2_read_model` is a read-only application projection over recruiter-owned invitation batches and recipients, the newest invited session attempt, newest delivery attempt, browser-entry evidence, immutable initials signal, and a distinct answered-slot aggregate. It carries operational identity, role/stage, precise delivery/entry/practice state, question progress, session attempt, completion time, and last observed durable activity. `not_requested` email is not an error because copy-link handoff is valid. Its attention count is limited to initials mismatch, failed delivery, and unknown delivery outcome. The repository never selects invited draft or answer text, coaching, feedback actions, evaluator rows, provider references, token hashes/ciphertext, browser-session hashes, or candidate-led data. A later recruiter detail projection requires its own employer-visibility contract.
- `feedback_interaction_ready` is the V2 candidate-facing action contract derived from one accepted `answer_analysis_provider_result`. It renders only `candidate_safe_feedback` when evidence-first facts exist; hidden central read, criterion facts, numeric evidence, and legacy coach prose do not cross that UI path. Current stages are `acknowledgement`, `content_coaching`, optional `delivery_coaching`, and `next_step`. Current action kinds are `explore_feedback`, `show_next_feedback_stage`, `skip_to_next_question`, `skip_to_finish_session`, `continue_to_next_question`, `finish_session`, `retry_answer`, and `pause_session`. Retry is omitted when immutable attempt identity is unavailable.
- `feedback_action_selected` is the persistence event for one candidate-selected transition. It carries exact answer attempt identity, slot/index, current stage, action kind, transition, optional target stage, and timestamp. `candidate_practice_sessions.feedback_actions_json` stores only the latest event per slot as a recovery projection; it is not append-only interaction history and cannot by itself prove every feedback stage the candidate viewed. `/candidate/session/[sessionId]/feedback-actions` resolves candidate ownership, requires the event to match the exact latest saved submission and analysis attempt, derives the allowed interaction server-side, and rejects forged stage/action/transition/target combinations. The UI persists an event before executing its transition. A saved `retry_current_question` event authorizes only the next linked answer attempt from that exact source; it does not itself mutate answer history, completion, summary, dashboard, or legacy state. Add normalized feedback-interaction events only if product analytics, enterprise BI, or audit requirements need full Explore/Next/Skip/Retry history rather than recovery state.
- `candidate_session_completed` is the candidate-led completion snapshot for one setup-created practice round. It is derived server-side from `session_runtime_facts`, not from browser-supplied completion totals. It carries the session id, completed timestamp, final `completed` progress state, total/answered/coached counts, answered question keys, coached question keys, skipped-or-unanswered question keys, and the candidate dashboard next route. `/candidate/session/[sessionId]/complete` may persist it to `candidate_practice_sessions.completion_snapshot_json` only after resolving candidate ownership and recovering slot-mapped question wording. This does not create dashboard evidence, summary/debrief content, QA export rows, or legacy `sessions` mutations.
- `candidate_completed_round_read_models` is the first bridge from one completed V2 practice session into downstream candidate surfaces. It is derived from `candidate_practice_sessions` and produces:
  - `round`: target role, interview stage, completed timestamp, total/answered/coached counts, skipped-or-unanswered count, and optional follow-up session attempt context;
  - `dashboardUpdate`: a sparse Coach Update seed for the candidate dashboard, including the completion route, answered count, question count, and one candidate-safe coaching preview when coaching exists;
  - `postRoundReview`: a source review model with question text, category, practiced versus skipped/unanswered status, submitted answer text, optional per-question follow-up attempt context, and candidate-safe coach observation/focus when available;
  - `practiceNext`: a next-practice seed that prioritizes skipped/unanswered questions before coaching focus and new-round fallback.
- `candidate_completed_round_read_models` must not expose raw scores, averages, hidden readiness, `oneBigUpgrade`, legacy recruiter feedback JSON, dashboard lane claims, summary narrative, QA export data, or legacy `sessions` mutations. It is a derivation layer for surfaces, not a persistence write.
- `candidate_dashboard_v2_read_model` is the candidate dashboard consumption boundary over candidate-owned practice facts. It resolves one candidate-owned opaque `role_profile_id` before deriving claims, keeps same-title profile-backed contexts separate, and emits canonical `/candidate/dashboard?prep=<roleProfileId>` navigation only after candidate ownership is proven through scoped session facts. Title-keyed selection is restricted to historical records whose `role_profile_id` is null and cannot select or merge a profile-backed context. A malformed, stale, or unauthorized profile id falls back through the normal candidate-owned selection rule and is then canonicalized. Active round, completed-round sources, latest Coach Update, Coach Plan coverage, Practice Next, history, and attempt rollups must all use the selected prep context. `activeRound` is the selected-context unfinished practice summary. Headline and role-context answered/coached counts include active and completed question occurrences, count each latest slot submission once, and count coaching only when the latest analysis maps to that latest submission. Retry attempts, full-session attempts, and follow-up question attempts remain separate normalized lineage and do not inflate those question-evidence counts. Repeated follow-up practice remains linked to the same source question or plan item and does not increase baseline coverage. Dashboard composition is a read-time derivation for self-regulated learning support; it must not copy legacy `eval_results.feedback_json`, persist hidden score/average fields, or treat generated summary narrative as durable preparedness truth.
- `candidate_coach_update_artifact` is the versioned post-session synthesis contract for one completed practice session. It is tied to candidate and opaque prep-context ownership, source session id, immutable first-write completion fingerprint, source immutable answer-attempt ids, accepted evaluator-run ids, synthesis input fingerprint, provider/model/prompt/evaluator versions, generation attempt, lifecycle, validation metadata, and candidate-safe rendered content. Eligible input includes only the latest attempt for each question recorded as answered in the completion snapshot and exactly one completed `candidate_coaching` run whose validation disposition is `accepted` and whose attempt/input fingerprint matches. Requested, failed, rejected, stale, cross-candidate, cross-context, superseded, skipped, or unanswered facts are excluded. It may summarize the round, acknowledge evidence-supported effort or strengths, identify one primary focus, and describe evidence-specific movement against comparable accepted prior attempts for the same candidate-owned prep context and source plan question. It must not infer improvement from repetition or regression from hidden score changes. The service claims generation under a source-session lock, replays an existing requested/completed same-input claim, expires an abandoned requested claim after its bounded lease, permits a new generation attempt after terminal failure, re-reads source facts before completion, and rejects changed fingerprints. A completed read requires an accepted validation disposition and exact versioned candidate-safe content with no undeclared or score-like fields. Completion remains successful when synthesis is unavailable, and a later replay may repair the unchanged source session. The artifact preserves stable replay and QA lineage but is not durable preparedness truth. A later source session may supersede which artifact is primary without deleting older source-linked artifacts.
- Google Coach Update claim identity and terminal validation must include the exact `profileId` and code-owned `configurationFingerprint` in addition to provider/model/prompt/evaluator versions, request/output versions, timeout, transport count, latency/tokens, and no-prompt/no-raw-output declarations. New artifact claims persist the profile and configuration fingerprint as immutable relational fields and use them in replay matching; existing V2 development rows remain nullable rather than receiving invented history. These safe metadata fields bind a completed or failed artifact to the serving configuration without storing the assembled request or response. Changing any prompt, schema, model, timeout, or generation setting requires a new immutable profile/configuration identity and generation attempt rather than mutating or replaying an older artifact.
- `candidate_coach_update_detail` is the opened Coach Update read over the latest selected-context artifact and its practiced source items. Every item must have submitted practice evidence from the source session and may carry question text, category, candidate answer, accepted candidate-safe coach observation/focus, qualitative band when available, comparable-attempt context, and a `practice_from_feedback` action. Skipped or unanswered plan questions are excluded and remain in Coach Plan/Practice Next. Detail hrefs carry only stable source identifiers; they must not place submitted answer text, coach observation text, JD text, resume text, or score-like data in query params. The detail must not include raw scores, averages, mutable queue state, legacy `oneBigUpgrade`, recruiter feedback JSON, or durable preparedness conclusions.
- `candidate_dashboard_practice_direction` is the dashboard read-model split for next-practice meaning. It should expose:
  - `planProgress`: unfinished or remaining Coach Plan work for the selected target interview context, sourced from an active setup-created round first, then skipped/unanswered planned questions, then completed-plan or first-round fallback;
- `coachGuidedFocus`: feedback-based practice for the selected target interview context, sourced from candidate-safe coaching on a submitted answer.
  - Its visible question reference uses the canonical/root Coach Plan question key carried by follow-up lineage, while its action source retains the exact latest candidate practice session plus local question key. These identities must not be collapsed because follow-up sessions may reuse `slot-1`, `slot-2`, and similar local keys for different Plan questions.
  - Its recommendation is the accepted candidate-safe `biggestUpgrade` when available, with the accepted pattern-gap upgrade or coach observation as compatibility fallbacks. The candidate-safe `redoPrompt` remains retry language and must not be projected as a second dashboard question.
  The primary action should prioritize resuming active rounds, then finishing planned coverage, then feedback-based focus, then first/new-round setup. This shape prevents the dashboard from conflating "continue the plan" with "practice what the coach noticed." Both are derived reads, not persisted dashboard conclusions.
- `candidate_qa_eval_case`, `candidate_qa_eval_run`, and `candidate_qa_eval_comparison` are historical answer-only TypeScript export shapes. They remain useful design evidence for fixed-input identity, but they are not the authoritative V2 workbench contract because they omit current evidence-first layers, invited answer persistence, Coach Update artifacts, and immutable question-wording outputs. Do not build new persistence around these compatibility snapshots.

- The authoritative QA source is the exact immutable serving artifact: a candidate-led or invited answer attempt plus evaluator run, one Coach Update artifact plus its accepted run references, one candidate prep-context baseline question-wording snapshot, or one generated recruiter invitation question set. QA workflow persistence stores source references, copied non-content configuration/filter facts, structured review judgments, findings, remediation hypotheses, and recheck links. It must not duplicate candidate, answer, JD, processed-resume, coaching, prompt, or raw-provider content. Authorized detail reads resolve only rubric-required source content just in time. See [AI Eval Operator Workbench](./05-quality/ai-eval-operator-workbench.md).

- Migration `037_ai_eval_operator_workbench_foundation.sql` implements `ai_eval_operator_grants`, `ai_eval_work_items`, `ai_eval_reviews`, the versioned `ai_eval_failure_label_catalog`, `ai_eval_findings`, `ai_eval_remediations`, and the finding/remediation link. An active app user requires a separate active individual grant; app roles do not inherit access. Work items carry exactly one source reference and database-derived audience, stage, category, failure, provider, version, and configuration facts. Exact-source promotion is idempotent and returns the existing work item on replay. Creation rejects nonterminal/non-serving answer and Coach Update sources, candidate baseline profiles without immutable wording, and manual recruiter question sets. Core lifecycle, assignment, severity, disposition, source identity, and remediation fields are relational. Surface-specific layer judgments use enum-valued object-shaped `jsonb` because answer coaching, Coach Update, and question wording intentionally use different evolving rubrics. Finding source-reference JSON admits only bounded pointer keys and scalar values, never copied answer or context content. Each finding also has a draft-review-scoped `creation_request_key`; draft review persistence and finding insertion execute atomically, exact response-lost replay recovers the prior result, and changed reuse fails without advancing the review revision. Submitted reviews and their findings are immutable; drafts and mutable queue/remediation rows use revision fencing and record the active operator responsible for the latest mutation. Source deletion cascades through its work item/review/finding facts rather than blocking an approved candidate/invitation deletion; metadata-only audit retention remains separately governed.
- Migration `038_ai_eval_remediation_and_recheck.sql` completes the sequential improvement loop. Operator-scoped request keys make exact remediation creation replayable while immutable hypothesis identity prevents silent retargeting. `ai_eval_regression_cases` promotes one submitted finding plus its original exact work item without copying source content. `ai_eval_rechecks` records one immutable human outcome against a later submitted review from the same surface; the original output, an earlier output, an unsubmitted review, a cross-surface output, or a remediation without a governed change fails closed. A remediation can become `verified` only when every linked regression case has a latest `fixed` recheck and a verification note. Work-item state remains `remediation_in_progress` while any linked remediation is open, then reconciles to `verified` when verified coverage exists or `closed` when all terminal remediations end without verification. Recheck remains sequential verification, not provider execution or blind A/B comparison.
- Migration `039_ai_eval_scenario_workspace.sql` adds a separate synthetic QA artifact boundary under the same individual operator grant. `ai_eval_scenario_drafts` are owner-private, editable, revision-fenced working copies. One exact draft revision may stage one immutable operator version; baseline versions are shared and code-fingerprint checked. Immutable suite membership orders exact version ids. A run request freezes execution mode, suite/version ids, profile/configuration identity, and request fingerprint; exact request-key replay converges while changed reuse conflicts. Only baseline or requesting-operator versions may enter that run. Renewable global or targeted worker claims fence execution, and terminal case/layer rows preserve assertion results, reasons, candidate-visible output, and bounded diagnostics for 30 days. Completed layers cannot be rewritten or deleted and are skipped on recovery. Scenario/output content is deliberately durable synthetic QA material, not serving candidate data, and never enters metadata-only auth audit rows. A scheduled retention cleanup and deployed durable worker remain production dependencies.
- Migration `040_ai_eval_live_scenario_execution.sql` extends that boundary without changing candidate or recruiter serving data. A credentialed run freezes an explicit live-gate acknowledgement and a server-derived cost preview containing the exact selected/dependency scenario fingerprints, evaluator plus Coach Update profile/configuration identity, conservative provider-call and token envelopes, operator-configured rate snapshot, and process ceilings. Browser submission can only queue this immutable request. Renewable run claims and generation-fenced `ai_eval_scenario_live_operations` separately checkpoint validated evaluator and Coach Update results before downstream projections; completed operations are immutable and recover without another intentional provider call, while safe bounded failure metadata remains retryable or terminal. Worker configuration drift terminalizes only the currently claimed run. Actual calls/tokens/latency are derived diagnostics rather than billing authority. The database prevents concurrent intentional duplication, but provider acceptance followed by process death before the accepted checkpoint leaves a narrow at-least-once billing window. Same-profile sequential comparison is a derived read and requires identical scenario-input fingerprints and configuration identity; it persists no third output.

- `candidate_qa_eval_run` is one model/prompt/evaluator response against one fixed `candidate_qa_eval_case`. It carries model provider/name, prompt version, evaluator version, optional params, requested/completed timestamps, optional latency and token usage, parsed coach feedback, parsed evidence, and validation flags for case mapping, observed-only scoring, and candidate-safe projection language. It is the right home for internal evidence scores and model metadata. It is not a candidate-facing read model.
- `candidate_qa_eval_comparison` compares two `candidate_qa_eval_run` records only when their `caseId` and `inputFingerprint` match. A/B comparison means comparing different model or model/prompt responses to the same fixed prompt/context/input case, not comparing two candidate answers. Mismatched inputs must be flagged rather than silently compared.
- V2 QA records do not carry a generic source-app/app-name axis. They do retain a bounded audience/source kind because candidate-led and invited answer coaching share one evaluator job while using different ownership tables and access contracts. Question wording likewise distinguishes candidate baseline and generated recruiter invitation sources without treating them as different model jobs.
- The V2 feedback interaction contract preserves V1's useful submit -> coaching -> candidate choice cadence, but V2 feedback content is rebuilt from the new evaluation specs. New V2 code should not restore candidate-facing `oneBigUpgrade`, hidden scores, or the legacy feedback drawer schema as the durable contract.
- This table does not replace the legacy/live `sessions`, `questions`, `answers`, or evaluation rows yet. Live answer runtime, provider generation, dashboard reads, and summary/debrief persistence remain separate slices.
- Browser session storage remains a development bridge until all session progress and answer-draft persistence is identity-backed.

### QuestionPlan

`QuestionPlan` is the deterministic plan for the question category mix before AI question text generation.

Current implementation:

- domain helper: `src/lib/domain/question-plan.ts`;
- server compatibility re-export: `src/lib/server/services/question-plan-service.ts`;
- test: `src/lib/server/services/question-plan-service.test.ts`.

Current contract:

```ts
type InterviewStage =
    | "not_sure"
    | "initial_screening"
    | "initial_interview"
    | "follow_up_final"
    | "practice_only";

type InterviewStageOption = {
    value: InterviewStage;
    label:
        | "Not sure yet"
        | "I'm not sure / No interview scheduled yet"
        | "First conversation or screening"
        | "First interview"
        | "Follow-up or final interview"
        | "No interview scheduled";
    description: string;
};

type QuestionPlanCategory =
    | "screening"
    | "behavioral"
    | "culture_fit"
    | "case_scenario"
    | "technical_role_specific";

type QuestionPlanSlot = {
    id: string;
    index: number;
    category: QuestionPlanCategory;
};

type QuestionPlan = {
    interviewStage: InterviewStage;
    questionCount: number;
    categoryCounts: Record<QuestionPlanCategory, number>;
    slots: QuestionPlanSlot[];
};
```

Rules:

- clamp supported question counts to 1-20 for shared recruiter/candidate planning;
- preserve canonical category order: Screening, Behavioral, Culture/Fit, Case/Scenario, Technical/Role-Specific;
- treat the plan as the intended sampling strategy, not the definition of total interview preparedness;
- keep generated question text and answer evaluation separate from the deterministic plan.
- candidate `/candidate/setup` uses first-class stage/count controls. The UI merges `not_sure` and `practice_only` into one balanced-practice choice labelled "I'm not sure / No interview scheduled yet" and stores that selection as `practice_only` for new candidate submissions;
- candidate question snapshots use `QuestionPlan` ordering when an `interviewStage` is present; legacy `interviewType` ordering remains a compatibility fallback for older inputs.
- recruiter `/recruiter/create` sends `interviewStage` through the shared question generation boundary and derives count server-side from the stage: 5 for not-sure/general or screening, 7 for first interview, and 10 for follow-up/final. The browser does not choose or override recruiter question count.
- recruiter question slots are fixed by that resolved count. Empty slots may be authored manually or populated through **Generate questions**. Successful generation locks all slots and disables generation; **Start over** clears the whole generated set, unlocks the fixed slots, and re-enables generation. Advancing locks a complete manually authored set. No per-slot add/delete/clear control and no recruiter template source participates in V2 creation.
- shared question generation is now `QuestionPlan`-first for planned requests. The prompt tells the model how to use target role, JD, optional resume content, interview stage, and question count, then asks for exactly the planned category counts.
- generated-question provider payloads are flexible keyed category containers, not fixed legacy pools. Valid output may contain only the categories needed by the plan, including empty objects/arrays for zero-count categories.
- planned provider output uses `caseScenario` as the first-class keyed Case/Scenario container. Legacy provider payloads that still put case/scenario-like keys inside `behavioral` are normalized into `caseScenario` after parsing for compatibility.
- after provider parsing, the service repairs schema-valid output that under-fills a planned category by adding deterministic role-specific fallback questions. The UI may trim a larger pool down to the confirmed plan, but it should not silently accept fewer usable questions than `QuestionPlan.questionCount`.
- legacy `interviewType` remains compatibility-only for older candidate inputs and fallback ordering when no `interviewStage`/`QuestionPlan` is available. New recruiter and candidate setup work should use `interviewStage` plus `questionCount`; retiring `interviewType` is blocked until older-row read behavior is reviewed.
- V2 setup-created practice rounds persist the carried `questionPlanSnapshot` on `candidate_practice_sessions`. Candidate-led planning and progress must read the V2 lineage rather than infer coverage from recruiter/shared legacy rows.

### PracticeCoverageBaseline

`PracticeCoverageBaseline` is the release-basic rigor primitive for dashboard follow-up practice.

Rules:

- derive it from the prep-context-owned `rigorBaselineSnapshot`; a new V2 prep context without that snapshot is incomplete and must fail closed or be repaired before Coach Plan can claim coverage;
- keep `questionPlanSnapshot` scoped to the selected/generated practice round;
- keep `rigorBaselineSnapshot` scoped to the coach's baseline coverage expectation for the interview stage;
- persist a matching baseline wording snapshot with stable plan-question ids before deriving the first round;
- require every baseline round slot to reference one stable plan-question id and mark any above-baseline question as supplemental;
- treat `categoryMinimums` as the minimum category coverage for the planned interview scope;
- let dashboard visual models include planned-but-not-yet-practiced categories so Question Mix and the matrix show intended coverage before all categories have scored evidence;
- compare the baseline against practiced category counts before recommending lower-scoring matrix improvement cells;
- do not expose mastery, numeric scores, or hidden rigor terms to candidates;
- do not use it to change recruiter-invited feedback behavior.

Current shape:

```ts
type PracticeCoverageBaseline = {
  interviewStage: InterviewStage;
  minimumQuestionCount: number;
  categoryMinimums: Record<QuestionPlanCategory, number>;
};
```

Target prep-context and round snapshots:

- `questionPlanSnapshot`: immutable generated-round plan, sized to the candidate-selected question count.
- `rigorBaselineSnapshot`: immutable prep-context-owned stage baseline plan, sized by deterministic stage defaults: 5 for not-sure, screening, and practice-only; 7 for first interview; 10 for follow-up/final.
- `rigorBaselineQuestionWordingSnapshot`: immutable prep-context-owned worded baseline set whose stable plan-question ids are referenced by initial and follow-up round snapshots.

Landed in Slice 149: setup persists the full stage baseline and wording under the prep context, derives the initial round from that accepted set, marks above-baseline slots supplemental, and makes unexposed baseline questions executable follow-up choices. Future baseline revisions may add a structured role/JD adjustment layer without changing that ownership model.

### Candidate Dashboard And Coach Plan Reads

`CandidateDashboardV2ReadModel` is the dashboard home read for one selected candidate-owned prep context. It keeps the action loop, Coach Plan reference, and question-preparedness projection as separate fields rather than embedding Coach Update and Practice Next inside one score-oriented Plan object.

Relevant current shape:

```ts
type CandidateDashboardV2ReadModel = {
    selectedTargetInterview: CandidateDashboardTargetInterview | null;
    activeRound: CandidateDashboardActiveRound | null;
    coachUpdateState: CandidateDashboardCoachUpdateState;
    coachUpdateDetail: CandidateCoachUpdateDetail | null;
    practiceDirection: CandidateDashboardPracticeDirection;
    coachPlan: CandidateCoachPlanReference | null;
    questionPreparedness: CandidateQuestionPreparednessProgress | null;
};
```

`CandidateCoachPlanReference` owns canonical plan framing and teaching:

```ts
type CandidateCoachPlanReference = {
    source: {
        baselineCandidatePracticeSessionId: string;
        roleProfileId: string | null;
    };
    targetRole: string;
    stage: {
        id: InterviewStage;
        label: string;
        detail: string;
    };
    questionCount: number;
    practicedQuestionCount: number;
    missingEvidenceCount: number;
    categories: CandidateCoachPlanCategoryReference[];
    questions: CandidateCoachPlanQuestionReference[];
};
```

Rules:

- source every field from the selected owned prep context;
- keep Coach Update, Practice Next, Coach Plan, and the editable next-round draft distinct;
- derive Plan and progress reads from immutable baseline/session/attempt/evaluator facts;
- never expose hidden numeric averages or raw evaluator dimensions;
- keep opened-Plan presentation state in the browser when useful; the data contract does not require Categories, Skills, and Question Set faces.

### CandidateQuestionPreparednessProgress

`CandidateQuestionPreparednessProgress` is the current read-time progress projection. It replaces the retired hidden-score `PreparednessTarget` and its gauge renderer.

Current release shape:

```ts
type CandidateQuestionPreparednessProgress = {
    source: {
        persistence: "read_time_projection";
        bandSelection: "highest_earned";
        regressionPolicy: "deferred_keep_highest";
    };
    coverage: {
        canonicalQuestionCount: number;
        unpracticedQuestionCount: number;
        attemptedQuestionCount: number;
        evaluatedQuestionCount: number;
        incompleteQuestionCount: number;
        evaluationUnavailableQuestionCount: number;
    };
    achievement: {
        emerging: number;
        clear: number;
        strong: number;
    };
    questions: Array<{
        questionKey: string;
        questionNumber: number;
        category: QuestionPlanCategory;
        questionText: string | null;
        attemptCount: number;
        evaluatedAttemptCount: number;
        state: "not_practiced" | "evaluation_unavailable" | "incomplete" | "rated";
        band: "emerging" | "clear" | "strong" | null;
        highestEarnedAttemptId: string | null;
    }>;
};
```

Rules:

- highest-earned question progress is monotonic for the first release;
- unanswered baseline questions are neutral and contribute only to coverage;
- repeated practice does not increase coverage or question weight;
- incomplete and evaluation-unavailable are not low bands;
- missing optional evaluator history makes the projection unavailable rather than reclassifying practiced evidence;
- Strong-of-plan uses `achievement.strong` over `coverage.canonicalQuestionCount`;
- Plan completion is true only when the canonical count is greater than zero and every canonical question contributes to `achievement.strong`;
- `coverage.attemptedQuestionCount` remains separate supporting context;
- rendering and copy follow the [Dashboard Progress Visualization Contract](./03-design/dashboard-progress-visualization-contract.md).

### Optional CoachPlanCategoryPatternProjection

This optional projection joins canonical Coach Plan teaching with question-preparedness status when design review retains a category/question pattern view. It is not new persistence and does not require a Categories face.

```ts
type CoachPlanCategoryPatternProjection = {
    categories: Array<{
        categoryId: QuestionPlanCategory;
        label: string;
        plannedCount: number;
        practicedCount: number;
        statusCounts: {
            unpracticed: number;
            emerging: number;
            clear: number;
            strong: number;
            incomplete: number;
            evaluationUnavailable: number;
        };
        teaching: CandidateCoachPlanCategoryReference["teaching"];
        questionKeys: string[];
    }>;
};
```

Rules:

- preserve canonical category and question order;
- count each canonical question once;
- do not average a category into a score or label unpracticed questions weak;
- selecting a category opens teaching and question detail;
- an incomplete cross-context or question/category join fails closed.

### Optional CandidateCriterionBalanceProjection

This projection is not landed or required. It would summarize the five universal criteria, not the retired Substance/Structure/Delivery lanes, only if transcript-canvas evaluation and dashboard probes establish a distinct cross-question need.

Target shape:

```ts
type CandidateCriterionBalanceProjection = {
    status: "candidate_criterion_balance_projection";
    source: {
        persistence: "read_time_projection";
        roleProfileId: string;
        aggregation: "highest_per_question_then_qualitative_median";
    };
    contributingQuestionCount: number;
    criteria: Array<{
        criterion:
            | "answer_focus"
            | "organization"
            | "evidence_specificity"
            | "role_skill_signal"
            | "impact_judgment_takeaway";
        level: "emerging" | "clear" | "strong";
        contributingQuestionCount: number;
        excludedQuestionCount: number;
    }>;
};
```

Rules:

- derive only from accepted evaluator runs with canonical baseline lineage;
- give each canonical question at most one contribution per criterion;
- exclude `not_elicited`, `insufficient_data`, `unscoreable`, and missing accepted runs instead of mapping them to Emerging;
- expose qualitative levels and evidence counts only;
- when the evidence threshold is not met, do not render a radar;
- the UI never computes this projection from hydrated cards.

### Optional CoachPlanQuestionSetProjection

This optional presentation projection joins canonical Coach Plan order, question preparedness, and server-resolved practice capability. The same fields may support one adaptive opened Plan or a question drilldown; they do not require a Question Set face.

```ts
type CoachPlanQuestion = {
    questionKey: string;
    questionNumber: number;
    category: QuestionPlanCategory;
    questionText: string | null;
    visibility: "visible" | "hidden_until_reveal";
    state: "not_practiced" | "evaluation_unavailable" | "incomplete" | "rated";
    band: "emerging" | "clear" | "strong" | null;
    attemptCount: number;
    practiceCapability: "queued" | "available" | "round_full" | "unavailable";
};
```

Rules:

- practiced questions are visible by default;
- unpracticed wording remains hidden by default with a deliberate reveal option;
- visibility is based on practiced evidence, not current-round membership;
- opening a practiced question may lead to its accepted transcript/feedback detail;
- queue membership and practice capability come from the authoritative selected-context builder;
- future regression display waits on the separate regression contract.

### CoachUpdate

`CoachUpdate` is the post-practice debrief entry shown on the dashboard when new feedback exists.

Current release shape:

```ts
type CoachUpdate = {
    id: string;
    createdAt: number;
    sourceAnswerId: string;
    headline: string;
    priorityRead: string;
    chips: Array<{
        label: string;
        kind: "improved" | "watch" | "new_coverage" | "next";
    }>;
    archivedForDevelopment?: boolean;
};
```

Rules:

- new persisted answer feedback is the event that creates a new dashboard coach update;
- session recovery should patch missing feedback before dashboard reads rely on it;
- a new coach update replaces the previous visible update;
- development may preserve archived coach updates for review, but candidate UI does not need an inbox yet;
- the guided debrief should be sparse, skimmable, and escapable.

### PracticeNextRecommendation

`PracticeNextRecommendation` is the action model for what the coach wants the candidate to do next.

Current release shape:

```ts
type PracticeNextRecommendation = {
    primary: Array<{
        type: "new_coverage" | "improve_prior_answer";
        questionId?: string;
        label: string;
        rationale: string;
    }>;
    ordered: boolean;
    alternatives: Array<{
        type: "unanswered_question" | "polish_clear_area" | "dimension_lift";
        label: string;
        questionId?: string;
    }>;
};
```

Rules:

- remediation has priority over new coverage when all else is equal;
- if a practiced lane rates below clear or is unscoreable and unanswered baseline questions remain, recommend a primary pair: one improvement task and one new-coverage task;
- order primary tasks only when there is a clear dependency;
- alternatives should be secondary and should mainly expose unanswered questions until baseline coverage is complete;
- once all baseline questions are answered, alternatives may focus on polishing clear areas to strong or lifting a specific dimension.

### PracticeDraft

Practice drafts hold setup state before and during session creation.

Current backing:

- `candidate_practice_drafts`.

Important state:

- target role;
- job description;
- normalized resume context;
- intake/configuration JSON;
- resume target screen;
- linked session id;
- linked prep profile id;
- status;
- last activity timestamp.

Draft state is candidate-owned. Drafts and sessions must not be visible across candidate identities.

### Session

A candidate session is the immutable question-and-answer practice flow created from a draft.

Current backing:

- `sessions`;
- `questions`;
- `answers`;
- `eval_results`;
- summary/debrief fields on session.

Important behavior:

- question snapshots belong to the session;
- answers persist transcript/final text and modality;
- feedback analysis persists structured AI output;
- summary/debrief is generated after the session is complete;
- completed dashboard links should point to `/summary/[sessionId]`.

### Question

Questions should use the unified plain-language category presentation:

- Behavioral;
- Culture Fit;
- Technical;
- Scenario;
- Case;
- Screening.

Legacy labels such as STAR and PERMA may exist as mappings. They should not surface directly in candidate-facing UI.

For this release, the dashboard category cards should treat Screening as the
screening-only subset: interest, background, availability, logistics, and basic
qualification questions. Screening Basics in `/candidate/setup` can still emphasize
Culture Fit questions, but Culture Fit remains its own dashboard category.

### Answer

Answers persist:

- question id;
- session id;
- attempt number;
- final answer text/transcript;
- modality;
- submitted timestamp;
- analysis result when available.

Canonical answer modality is the persisted answer modality. `analysis.meta.modality` is diagnostic/evaluation metadata and should not be the UI source of truth for newly submitted answers.

Modality persistence rules:

- answer submit routes and server actions must pass explicit `text` or `voice` modality into the session orchestrator;
- Postgres answer upserts must persist `answers.modality`;
- answer analysis with audio input must reconcile the canonical answer modality to `voice` before persisting the updated session;
- dashboard read models may use `analysis.meta.modality` only as an older-row compatibility fallback, not as the normal correctness path.
- migration `005_backfill_answer_modality_from_analysis.sql` repairs previously persisted answers where feedback analysis proves voice input but the answer row still has the default `text` modality.

### V2 Evidence-First Evaluator

The canonical V2 evaluator contract is [Evidence-First Evaluator Contract](./05-quality/evidence-first-evaluator-contract.md). Its fixed unit is one immutable answer attempt and exact question occurrence. The accepted pipeline is extraction -> code validation/applicability/bands/pattern gap -> conditional verification -> feedback composition -> code validation -> candidate-safe projection.

The durable accepted record separates:

- answer-attempt and input-fingerprint identity;
- pipeline and per-stage provider/model/prompt/evaluator versions;
- accepted exact answer spans and category signals;
- universal criterion applicability plus qualitative band only when observed;
- selected pattern gap and optional verifier result;
- hidden feedback plan and candidate-safe coaching projection;
- validation/error codes, lifecycle timestamps, latency, and token usage.

No numeric score is part of the V2 evidence-first criterion contract. `not_elicited`, `insufficient_data`, and `unscoreable` never carry a qualitative band. Technical `supported` or `contradicted` accuracy claims require a versioned reference. Without one, technical accuracy is `not_assessed`, while directly observable role-skill evidence, practical application, reasoning, tradeoffs, assumptions, and verification awareness may still receive qualitative appraisals without implying factual correctness. Assembled prompts and unvalidated raw model responses are not persisted by default. Operational telemetry is metadata-only.

## Legacy Interview Preparedness Compatibility Model

`PrepSignal` and `PrepSignalLane` are retained only as documentation for older compatibility payloads. They are not the production dashboard progress model, are not a source for current Coach Plan presentation, and must not be introduced into new V2 dashboard reads. Current question progress uses `CandidateQuestionPreparednessProgress`; any future five-criteria visualization uses the separate optional candidate-owned criterion projection defined above.

Within an older payload that still carries this model, the lane ids remain stable:

```ts
type PrepSignalLane =
    | "role_fit"
    | "answer_substance"
    | "interview_structure"
    | "communication_delivery"
    | "interview_range";
```

Legacy lane labels:

- Answer Substance
- Interview Structure
- Communication Delivery

Role Fit was out of that release scope. Interview Range was represented as question category coverage cards, not as a lane.

Resume/JD context is evidence and signal framing, not a standalone lane.

Confidence is not a lane.

### PrepSignal

```ts
type PrepSignal = {
    signalId: string;
    prepProfileId: string;
    lane: PrepSignalLane;
    label: string;
    evidenceState: "not_practiced" | "emerging" | "clear" | "strong";
    evidenceCounts: Record<"not_practiced" | "emerging" | "clear" | "strong", number>;
    priority: "primary" | "supporting" | "background";
    sourceRefs: PrepEvidenceRef[];
};
```

### PrepEvidenceRef

```ts
type PrepEvidenceRef = {
    type:
        | "job_description"
        | "resume_context"
        | "question"
        | "answer"
        | "feedback_plan"
        | "content_pulse"
        | "delivery_pulse"
        | "coach_signal"
        | "summary";
    id?: string;
    label: string;
    excerpt?: string;
    questionText?: string;
    answerTranscript?: string;
    answerModality?: "text" | "voice";
    answerSubmittedAt?: number;
    sessionId?: string;
    sessionTitle?: string;
    sessionStatusLabel?: string;
    sessionActivityLabel?: string;
    sessionSortAt?: number;
    evaluation?: string;
};
```

Legacy evidence refs must use candidate-safe excerpts and evaluation copy. Any retained compatibility drilldown may show the candidate's own answer transcript, modality, submitted date, and session grouping context for practiced questions. Do not surface raw resume content, prompts, hidden numeric scores, or AI-quality internals in normal candidate UI.

Answer modality is persisted in `answers.modality` and should be carried into `PrepEvidenceRef.answerModality`. For historical answers saved before modality was written at every submit/recovery boundary, dashboard read paths may fall back to `analysis.meta.modality` when present. If neither source can prove voice mode, the UI must treat the answer as text rather than guessing.

`PrepEvidenceRef.evaluation` should preserve the full candidate-safe coach read. The dashboard may format recognized sections such as overall read, signal observations, biggest-lift guidance, and next step, but it must not truncate the detail modal content or expose internal labels such as "Coach signals" to candidates.

Dashboard drilldowns should group practiced Q/A cards by session, newest session first, then sort each session's questions by submitted answer time ascending.

Dashboard question coverage is plan-and-session truth, not evaluator score truth. Each planned question remains distinguishable as unpracticed, active, or practiced from the immutable prep-context baseline, session lineage, and accepted answer occurrences. Unanswered questions are coverage context and must never be converted into weak performance evidence.

Accepted evaluation contributes only the direct V2 qualitative facts attached to each answer occurrence:

- answer usability;
- technical accuracy as `supported`, `contradicted`, or `not_assessed`;
- criterion applicability as `observed`, `not_elicited`, `insufficient_data`, or `unscoreable`;
- an `emerging`, `clear`, or `strong` band only for an observed criterion;
- the selected pattern gap and candidate-safe coaching.

The dashboard must not reconstruct V1 numeric evidence, average criterion scores, synthesize an opaque per-answer `overallRead`, or infer prep-context readiness from missing evidence. Coach Plan coverage and Coach Update feedback remain distinct but adjacent product facts.

Future progression or trend UI must:

- compare independently evaluated immutable answer attempts with the same prep context and stable question lineage;
- preserve evaluator profile and configuration identity so unlike calibrations are not silently trended;
- distinguish improvement, stability, regression, and mixed evidence criterion by criterion;
- preserve `not_assessed` technical accuracy rather than treating it as weak or correct;
- require enough comparable evidence before presenting a durable trajectory;
- keep candidate-facing language qualitative and evidence-linked.

### Recommendation Priority

Practice Next is the only dashboard action surface for now, but the read model should separate plan-progress recommendations from feedback-based practice recommendations.

Priority:

1. Resume unfinished candidate-owned session.
2. Finish planned coverage that still lacks practice evidence.
3. Practice latest high-priority unresolved signal from coach feedback.
4. Practice next unpracticed primary signal.
5. Expand interview range or polish a clear/strong area.

## Feedback And Confidence

`user_feedback` is for helpfulness and product/coaching-output feedback.

Candidate confidence measurement is separate and should be stored as a self-reported preparedness feeling when implemented:

- pre-session confidence;
- post-session confidence;
- candidate id;
- prep profile id when available;
- session id when available;
- timestamp.

Confidence should never be treated as performance evidence.

## Privacy And Safety Rules

- Candidate-led practice content is not recruiter/hiring-decision data.
- Admin and QA surfaces require masking/redaction before broader review use.
- Runtime PII/sensitive-data scrubbing remains an open hardening item.
- AI-quality records must preserve evaluation utility without exposing sensitive candidate payloads in normal review surfaces.
- Policy/footer links remain integration-team owned until exact company-approved links are confirmed.

## Superseded Or Legacy Concepts

- `oneBigUpgrade`: legacy/internal output name retained only for older persisted payload compatibility. New generated output should use `coachSignal` and candidate-facing "biggest lift" language.
- `scoring_dimensions`: legacy/optional unless explicitly populated and consumed.
- `competencies`: prompt language may use competencies, but dashboard claims require populated evidence.
- Resume bridge lane: superseded; use resume/JD as evidence and framing across current V2 criteria and coaching.
- `PrepSignal` / `PrepSignalLane`: legacy compatibility model only; current dashboard progress uses question preparedness and the future five-criteria projection.

## Change Rule

Before changing a schema, payload shape, state value, signal id, lane id, or candidate-facing claim source, update this file in the same pass.
