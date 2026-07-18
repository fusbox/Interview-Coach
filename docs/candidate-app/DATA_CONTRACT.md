# Candidate App Data Contract

Status: Canonical system truth
Last updated: 2026-07-18

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

### Answer Attempt And Evaluator Run

V2 distinguishes four levels that legacy slot-keyed JSON collapsed:

1. a planned question identity;
2. a question occurrence in one practice session;
3. one or more immutable answer attempts for that occurrence;
4. one or more evaluator runs against one fixed answer attempt.

Pre-submission edits are drafts and do not create attempts. The first accepted submit creates attempt one. A candidate-selected retry after feedback appends another attempt with `supersedesAnswerAttemptId` and `trigger: "feedback_retry"`. Provider retry, timeout recovery, and model/prompt A/B evaluation append evaluator runs for the same answer attempt instead of inflating candidate answer-attempt counts.

The normalized durable target uses stable `candidateAnswerAttemptId` and `candidateAnswerEvaluationRunId` values, candidate/session/question ownership, per-occurrence attempt number, answer mode/content/submission time, retry lineage, provider/model/prompt/evaluator metadata, immutable configuration manifest and fingerprint, input fingerprint, lifecycle timestamps, validation facts, and candidate-safe result snapshots. Model-stage manifests include the abstract reasoning posture plus the effective numeric thinking budget and whether thought output is included, so provider requests cannot change behind an unchanged fingerprint. Evaluator runs also carry a positive sequential `generationAttempt` within one answer attempt and purpose plus an explicit `claimExpiresAt` lease. A run id is the completion fence: only its own fresh `requested` row may transition once to `completed`, `failed`, or `rejected`. Terminal rows remain immutable. Candidate coaching permits at most one fresh requested run and one accepted completed result per answer attempt and input fingerprint; terminal retry appends the next generation without creating a new answer attempt. QA comparison may retain multiple same-input completed variants only when each variant has its own resolved configuration identity.

Repository/domain records expose timestamps as ISO strings even when the PostgreSQL driver returns `timestamptz` columns as JavaScript `Date` objects. Migration `009_candidate_answer_attempts_schema.sql` creates `candidate_answer_attempts` and `candidate_answer_evaluation_runs`; migration `015_candidate_answer_evaluator_run_claims.sql` adds generation, lease, stale-claim, and accepted-result fencing; migration `016_candidate_answer_evaluator_configuration_manifest.sql` adds immutable resolved configuration identity. Rows created during earlier V2 slices are marked `pre_manifest_v2` without invented stage settings, while every new row must be resolved. `candidate-answer-history-repository.ts` provides ownership-scoped append, replay-safe answer idempotency, immutable retry lineage, and evaluator-run claim/lifecycle operations. Existing `candidate_practice_sessions.answer_submissions_json` and `answer_analysis_snapshots_json` remain latest-attempt V2 build projections while session consumers migrate; they must not be treated as complete history. No V1-created app data is a V2 migration or runtime compatibility requirement.

### V2 Evaluation Evidence

The V2 evaluation contract starts from evidence items, not dashboard claims.

Current source module:

- `src/features/evaluation-v2/evaluation-domain.ts`

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

Current candidate-owned behavior is anchored by a candidate profile resolved from auth handoff data.

Important fields:

- candidate profile id;
- email;
- display name;
- auth issuer;
- auth subject.

Local development can use dev candidate identities, but production behavior must depend on the host-platform identity contract.

Temporary deployed preview rule:

- `CANDIDATE_AUTH_MODE=preview_test` exists only for branch/Vercel preview validation before the TalentArbor launch-token/API contract is available.
- It is allowed only when `VERCEL_ENV=preview` and `ALLOW_CANDIDATE_PREVIEW_AUTH=true`.
- The default preview candidate is Irma Castillo at `irma.castillo@talentarbor.local`, resolved through the existing candidate profile identity path with issuer `interview-coach-preview`.
- Preview test auth must not be enabled for production deployments or treated as the future TalentArbor integration pattern.
- Preview seed data is applied with `npm run db:seed-candidate-preview` after the normal Postgres migrations.
- The preview seed intentionally carries multiple Irma prep contexts for dashboard QA. Current durable contexts include an active follow-up/final Client Services Specialist round, a completed follow-up/final Client Services Executive - WWT round, and a completed first-interview Client Services Representative round with 3 practiced voice answers against a 7-question baseline. The Representative context is the partial-baseline fixture for remediation plus unpracticed coverage behavior.

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
- runtime hints, strong-response guidance, and feedback consume that session's resume snapshot;
- existing questions are never silently reinterpreted after a resume change;
- a later reconciliation service may compare a revised resume with current plan questions, propose slot/category-preserving one-for-one replacements, and version only candidate-accepted question replacements;
- a candidate-initiated interview-stage change creates a new linked `role_profile_id` with blank evidence. Stage lineage and update UI are not yet implemented.

Production identity rule:

- Production `/candidate/setup` requires an active verified launch-session identity.
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

Signal mapping reference: [Preparedness Signal Map](./04-architecture/preparedness-signal-map.md).

Question category reference: [Question Category Contract](./04-architecture/question-category-contract.md).

Instant-read dashboard reference: [Instant Read Surface Plan](./04-architecture/instant-read-surface-plan.md).

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
- `practice_missing_evidence` resolves only when the source question has no answer submission;
- `POST /candidate/practice/ready/intents` accepts one to twenty stable source pointers plus a per-activation `Idempotency-Key`, and returns a `redirectTo` route for the durable ready page after identity and source validation succeed. It stores only the SHA-256 key hash and a fingerprint of the exact canonical server-resolved snapshot;
- `candidate_practice_intent_creation_requests` is the bounded candidate-owned replay ledger for direct one-question and fixed-set creation. Its unique candidate-plus-key hash points to one immutable intent for 24 hours. Exact replay returns that intent, changed source/order/items/prep context/snapshot content conflicts before mutation, and a new key permits intentional repractice of identical content;
- the browser retains at most one exact pending direct action in tab-scoped session storage. Refresh or an ambiguous transport failure reuses its key; an accepted destination clears it; a fingerprint conflict clears it before the next user activation receives a new key. The browser record contains only action source, opaque source session/question pointers, key, and timestamp and is not durable candidate history;
- `public.create_candidate_direct_practice_intent(...)` serializes candidate-plus-key requests and inserts the ready intent and request pointer in one transaction. It has no pending or lease state because no external provider work occurs; statement failure leaves neither row committed, so the same key can retry safely;
- `Start practice` from an editable queue validates its current version and source pointers, atomically creates the immutable intent snapshot, and clears or links the launched queue draft. A conflict returns without silently dropping newer selections;
- the atomic database function locks the exact candidate-owned draft, revalidates every source question and latest answer/analysis relationship, compares the submitted ordered payload with every normalized draft item, inserts one immutable `practice_builder` intent, clears the item rows, and increments the draft version in one statement;
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
    answerSubmissions: Record<string, CandidateAnswerSubmission>; // latest-attempt compatibility read
    answerAnalysisSnapshots: Record<string, CandidateAnswerAnalysisProviderResult>; // latest-run compatibility read
    feedbackActionEvents: Record<string, CandidateFeedbackActionEvent>;
    completionSnapshot?: CandidateLedSessionCompletionSnapshot | null;
};
```

Rules:

- `setupSnapshot`, `questionPlanSnapshot`, optional `questionWordingSnapshot`, `progress`, and `answerDrafts` remain session JSONB boundaries. Slot-keyed `answerSubmissions` and `answerAnalysisSnapshots` are latest-result compatibility reads during migration to normalized immutable answer attempts and evaluator runs; they must not be treated as complete attempt history.
- Session lifecycle follows accepted practice evidence: `planned` means no answer has been accepted, the first accepted answer projection promotes the durable session to `in_progress`, and it remains `in_progress` until explicit completion succeeds even when the final answer is awaiting feedback/Finish. Draft text and page entry do not promote lifecycle state. Completed or abandoned sessions reject new answer attempts before immutable attempt or compatibility-projection writes. Historical answered rows left as `planned` are backfilled idempotently.
- The table is candidate-owned and may link to `prepProfile` through `role_profile_id` and to host launch through `candidate_launch_session_id`.
- Follow-up practice sessions created from `candidate_practice_intents` use the same durable table as setup-created sessions. Their `setupSnapshot.followUpPractice`, `questionPlanSnapshot.followUpPractice`, and `questionWordingSnapshot.followUpPractice` metadata must preserve the source intent, source route, session attempt number, item count, and per-question attempt lineage. This is the current V2 home for attempt context until a later normalized analytics/projection table is justified.
- `/candidate/setup/start` persists setup-created sessions into `candidate_practice_sessions` when candidate identity can be resolved from the route context. If identity cannot be resolved, the route may continue returning the browser-bridge provisional session result for local/dev continuity. If identity resolves but persistence fails, the route must fail closed.
- Initial setup-created rounds resolve ownership and prep context, create the deterministic plan, and then invoke the selected question-wording runtime exactly once before session insertion. Only an accepted exact slot/order/category mapping may be stored as `questionWordingSnapshot`; its immutable generation identity is part of that same session JSONB snapshot. Provider failure creates no session and consumes no trusted host setup staging. A prep context with no session may be reused by an explicit retry as partial-write repair. Follow-up practice snapshots exact selected source questions and must not invoke the wording provider.
- Production question wording is selected only by `CANDIDATE_QUESTION_WORDING_PROVIDER=google_genai`, exact profile `google_gemini_2_5_flash_question_wording_v1`, and a nonblank server-only `GEMINI_API_KEY`. The provider receives bounded role/JD/optional-resume/stage and exact plan-slot context inside an untrusted envelope; it receives no candidate identity, database ids, host token data, answers, evaluation, Coach Update, or dashboard facts. Runtime telemetry is metadata-only. Fixture and fault profiles are restricted to explicit local host-launch development mode and are unavailable in production.
- `/candidate/setup/start` returns `400` with setup `fieldErrors` only for invalid setup payloads. Candidate identity lookup, database schema, or durable session startup failures should return a fail-closed startup error, currently `503`, so local/dev database drift is not misreported as a candidate input problem.
- `/candidate/session/[sessionId]` may recover a setup-created practice round from `candidate_practice_sessions` only after the launch-session cookie resolves to the owning `candidateProfileId`. Recovered sessions hydrate the planned-session shell before browser storage is consulted. If durable recovery is unavailable, browser session storage remains the local/dev fallback.
- In explicit local dev host-launch mode, deterministic `dev-host-launch-*` cookies resolve directly to fixture `candidateProfileId` values for setup-start, durable session recovery, and answer-draft saves. These cookie values are not persisted into `candidate_practice_sessions.candidate_launch_session_id` because they are not UUID rows in `candidate_launch_sessions`.
- `/candidate/session/[sessionId]/progress` may save the active session view state to `candidate_practice_sessions.progress_state_json` for candidate-owned durable sessions. Current progress states are `planned`, `question_preview`, `live_question`, and `completed`; question-surface and completed states must carry the current question index. This supports pause/resume, refresh, cross-tab recovery back to the active question surface, and final round completion state.
- The answer-draft shell may save typed draft text to `candidate_practice_sessions.answer_drafts_json` through an ownership-scoped candidate session route when durable identity is available. Browser-bridge sessions keep answer draft text component-local only. Answer drafts must not write to `answers`, evaluator inputs, feedback, or dashboard read models until answer submission deliberately lands.
- `/candidate/session/[sessionId]/answers` is the candidate-owned answer-submit persistence boundary. It validates a nonblank typed draft payload, resolves candidate identity, verifies durable session ownership, and appends an immutable attempt to `candidate_answer_attempts` behind a slot-scoped database lock and idempotency key. Initial submit creates attempt one. Feedback retry is accepted only when the source attempt is the exact latest saved submission and analysis and a persisted feedback action authorizes `retry_current_question`; it appends the next attempt with `trigger: "feedback_retry"` and `supersedesAnswerAttemptId`. Concurrent or stale retry sources fail closed. The route writes the accepted attempt identity into the slot-scoped `pending_analysis` compatibility projection in `candidate_practice_sessions.answer_submissions_json`. If projection write fails after append, replay recovers the same attempt rather than duplicating history. Evaluator-run wiring remains a later explicit lifecycle step; this route must not write legacy `answers` or invent feedback/dashboard truth.
- `/candidate/session/[sessionId]/answers/[slotId]/analysis` is the answer-analysis handoff boundary. It resolves candidate identity, verifies durable ownership, reads the exact slot-scoped `pending_analysis` submission, claims the fenced evaluator run before adapter work, creates `answer_analysis_requested`, and returns candidate-safe unavailable behavior when no valid runtime exists. A configured runtime receives the saved attempt identity, exact slot-mapped worded question and planned purpose, and setup context. The accepted internal runtime result must match the claimed run id and shared input fingerprint before it can complete that run or replace the latest candidate-safe session projection. Route responses expose only `pending`, `recoverable`, `retryable`, or `unavailable` recovery capabilities. A replayed fresh claim returns pending without another adapter call. A transient terminal run may be followed by a new generation for the same attempt/fingerprint only when its durable validation policy permits it; a nonretryable terminal result blocks a new generation even if a client calls the route directly. Candidate coaching permits at most three generations for one answer attempt in ten minutes, excluding QA comparison. A completed accepted internal run repairs a missing candidate-safe projection without another adapter call and remains restorable when the current provider runtime is absent or has changed; a malformed completed result is unavailable rather than endlessly restorable. A rejected late completion cannot write the projection. The local deterministic fixture is enabled only by `CANDIDATE_ANSWER_ANALYSIS_PROVIDER=fixture` plus explicit local dev host-launch mode; it traverses the same extractor, deterministic appraisal, conditional verifier, composer, retry-budget, validation, and projection runtime as production adapters, but is not production coaching. `CANDIDATE_ANSWER_ANALYSIS_PROVIDER=fault` selects the allowlisted fail-first development harness only in the same explicit local mode and never in production. Exact server selection of `google_genai` plus `google_gemini_2_5_flash_v1` and a nonblank `GEMINI_API_KEY` invokes the conformed Google runtime only after the durable claim and supplies that claim's run id as a required completion fence. Missing/mismatched configuration, failed ownership, fresh replay, and completed projection repair make no Google call. The live provider supplies exact quotes and bounded semantic fields; application code reattaches immutable identity, computes exact offsets, and derives observable markers and missing-evidence codes before strict acceptance. The route persists accepted internal stage artifacts before writing only the candidate-safe session projection; it does not persist or return credentials, assembled prompts, raw provider output, provider exception bodies, or copied answer/JD/resume content outside the established evaluator/session boundaries. Continue or finish without coaching advances only session progress/completion; it creates no analysis snapshot or coached-answer fact. The answer-submit boundary rejects text above the evaluator's 20,000-character input ceiling. The route must not create summaries, dashboard evidence, legacy `eval_results`, or legacy answer-analysis fields.
- `/candidate/session/[sessionId]/coach-update/repair` is the ownership-scoped post-completion repair boundary. It accepts no answer, question, evaluator, provider, or prep-context identity from the browser. The server loads the candidate-owned completed session, immutable latest answer attempts, and evaluator-run history; rejects incomplete or cross-owner sessions; and invokes the existing answer-analysis boundary only for answered occurrences whose exact latest immutable attempt is recoverable or retryable under the current serving configuration. A request attempts no more than two eligible occurrences. Fresh pending claims, accepted results, nonretryable terminal results, malformed completed results, and generation-capped attempts do not create a provider call. Concurrent or repeated requests converge through the ordinary per-answer evaluator claim and deterministic analysis idempotency record. The response and diagnostics expose only bounded status and counts. After repair, the server reloads durable evidence and may invoke Coach Update synthesis only when every answered occurrence has one matching accepted `candidate_coaching` run. It never rewrites answers, completion snapshots, prior evaluator generations, or creates partial Coach Update content. The completion route may invoke this same repair service after first-write completion; dashboard `GET` remains side-effect free, and the unavailable Coach Update action calls the session-owned repair route rather than a dashboard evaluator endpoint.
- Production Coach Update synthesis is assembled only from the exact server environment tuple `CANDIDATE_COACH_UPDATE_PROVIDER=google_genai`, `CANDIDATE_COACH_UPDATE_PROFILE=google_gemini_2_5_flash_coach_update_v1`, and nonblank `GEMINI_API_KEY`. The provider request contains the synthesis fingerprint, bounded role/question/category text, response mode, accepted candidate-safe coaching, and at most three recent candidate-safe comparable projections per question; it contains no raw current/prior answer, candidate/session/prep identity, credential, database id, raw evaluator artifact, hidden plan, JD, or resume. Google receives the request inside an explicitly untrusted JSON envelope and may return only bounded synthesis-language fields. Application code reattaches status, fingerprint, question mapping, answer/source lineage, and accepted coaching after exact structured-output validation. Provider configuration and transport errors use allowlisted safe classifications; the API key, request envelope, prompt, raw output, generated text, and provider exception detail are never persisted or emitted to ordinary telemetry.
- `answer_analysis_provider_requested` is the V2 provider adapter input after `answer_analysis_requested`. It is created from one saved pending answer submission, one slot-mapped worded question, and the setup snapshot context. The adapter must fail if the question slot/index do not match the submitted answer.
- `evidence_first_evaluator_run_accepted` is the internal V2 evaluator result persisted on the fenced evaluator-run row. It contains only parsed accepted extraction, deterministic criterion appraisals and pattern gap, conditional verifier output when required, accepted feedback composition, candidate-safe feedback, bounded stage-attempt metadata, aggregate latency/token totals, and explicit no-prompt/no-raw-output retention markers. Its run id and all stage fingerprints must match the relational run fence. `answer_analysis_provider_result` remains the candidate-safe session compatibility projection: answer identity, candidate-facing `coachFeedback`, no legacy numeric evidence for new runs, candidate-safe feedback, and only the interaction intervention needed by the staged feedback UI. Hidden feedback plans, extraction, criteria, pattern gaps, and verifier facts do not cross into session/browser state. Legacy persisted analysis shapes remain bounded readable compatibility input and are projected down when parsed.
- `candidate_answer_coaching_facts` is the candidate-safe derived read model from one accepted `answer_analysis_provider_result`. It carries answer identity, provider/analyzed time, the candidate-safe `coachFeedback`, qualitative `overallRead`, per-criterion qualitative facts, and coverage buckets for observed, not-elicited, insufficient-data, and unscoreable criteria. It must not expose raw `score`, `averageScore`, hidden numeric readiness, or legacy `oneBigUpgrade` as downstream product language. It is derived from the saved analysis snapshot and is not a separate persistence write yet.
- `session_runtime_facts` is the shared candidate-led/invited-candidate runtime read model. It carries session id, audience, target role, interview stage, question count, current question index, normalized question key/index/category/text, submitted answer mode/text/submitted-at/lifecycle status, optional `candidate_answer_coaching_facts`, answered/coached counts, and completion behavior. It is designed so candidate-led and invited-candidate session surfaces can derive from the same runtime facts while keeping entry/auth differences outside the shared layer.
- Candidate-only identity and launch details must not be pushed into `session_runtime_facts`. `candidateProfileId`, `candidateLaunchSessionId`, setup snapshots, resume content, setup draft state, browser-bridge state, and route persistence internals remain candidate-led boundary facts unless a later shared-runtime slice explicitly promotes one of them.
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
  The primary action should prioritize resuming active rounds, then finishing planned coverage, then feedback-based focus, then first/new-round setup. This shape prevents the dashboard from conflating "continue the plan" with "practice what the coach noticed." Both are derived reads, not persisted dashboard conclusions.
- `candidate_qa_eval_case` is the V2 QA/evaluation export case shape for answer-quality review. It is derived from `candidate_practice_sessions` only when a submitted answer and exact slot-mapped worded question exist. It carries a stable case id, stable input fingerprint, redacted candidate identity, optional role-profile link, interview stage, question count, compact setup context, question text/category/purpose, submitted answer text/mode/submitted-at, expected signal applicability, and privacy fingerprints for JD/resume context. It should include full candidate answer text because the evaluator job requires it, but it should not repeat full JD/resume blobs when fingerprints and compact excerpts are sufficient for review.
- `candidate_qa_eval_run` is one model/prompt/evaluator response against one fixed `candidate_qa_eval_case`. It carries model provider/name, prompt version, evaluator version, optional params, requested/completed timestamps, optional latency and token usage, parsed coach feedback, parsed evidence, and validation flags for case mapping, observed-only scoring, and candidate-safe projection language. It is the right home for internal evidence scores and model metadata. It is not a candidate-facing read model.
- `candidate_qa_eval_comparison` compares two `candidate_qa_eval_run` records only when their `caseId` and `inputFingerprint` match. A/B comparison means comparing different model or model/prompt responses to the same fixed prompt/context/input case, not comparing two candidate answers. Mismatched inputs must be flagged rather than silently compared.
- V2 QA/evaluation export shapes intentionally do not carry a source-app or app-name field. The candidate/recruiter app distinction is a V1 routing and ownership concern, not a V2 answer-evaluator distinction. When a future shared invited/candidate runtime needs different permissions, that should be modeled through session/audience/access boundaries rather than treating AI calls as separate app sources.
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
- candidate `/practice` uses first-class stage/count controls. The UI merges `not_sure` and `practice_only` into one balanced-practice choice labelled "I'm not sure / No interview scheduled yet" and stores that selection as `practice_only` for new candidate submissions;
- candidate question snapshots use `QuestionPlan` ordering when an `interviewStage` is present; legacy `interviewType` ordering remains a compatibility fallback for older inputs.
- recruiter `/recruiter/create` sends `interviewStage` and `questionCount` through the same shared question generation boundary so generated questions reflect the intended interview moment and count without changing recruiter-invited answer feedback behavior.
- shared question generation is now `QuestionPlan`-first for planned requests. The prompt tells the model how to use target role, JD, optional resume content, interview stage, and question count, then asks for exactly the planned category counts.
- generated-question provider payloads are flexible keyed category containers, not fixed legacy pools. Valid output may contain only the categories needed by the plan, including empty objects/arrays for zero-count categories.
- planned provider output uses `caseScenario` as the first-class keyed Case/Scenario container. Legacy provider payloads that still put case/scenario-like keys inside `behavioral` are normalized into `caseScenario` after parsing for compatibility.
- after provider parsing, the service repairs schema-valid output that under-fills a planned category by adding deterministic role-specific fallback questions. The UI may trim a larger pool down to the confirmed plan, but it should not silently accept fewer usable questions than `QuestionPlan.questionCount`.
- legacy `interviewType` remains compatibility-only for older candidate inputs and fallback ordering when no `interviewStage`/`QuestionPlan` is available. New recruiter and candidate setup work should use `interviewStage` plus `questionCount`; retiring `interviewType` is blocked until older-row read behavior is reviewed.
- legacy candidate-created sessions persist the resolved `QuestionPlan` as `sessions.intakeData.questionPlanSnapshot` at session creation time. In V2 cleanroom work, setup-created practice rounds persist the carried `questionPlanSnapshot` on `candidate_practice_sessions` first; later live-runtime wiring can decide how and when to mirror that into `sessions`/`questions` rows.

### PracticeCoverageBaseline

`PracticeCoverageBaseline` is the release-basic rigor primitive for dashboard follow-up practice.

Rules:

- derive it from `rigorBaselineSnapshot` when present, falling back to `questionPlanSnapshot` only for older rows;
- keep `questionPlanSnapshot` scoped to the selected/generated practice round;
- keep `rigorBaselineSnapshot` scoped to the coach's baseline coverage expectation for the interview stage;
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

Current persisted snapshots:

- `questionPlanSnapshot`: immutable generated-round plan, sized to the candidate-selected question count.
- `rigorBaselineSnapshot`: immutable stage-defined baseline plan, currently sized by deterministic stage defaults: 5 for not-sure, screening, and practice-only; 7 for first interview; 10 for follow-up/final.

Current limitation: the baseline uses deterministic stage weighting only. The durable v2 contract should add a structured role/JD adjustment layer and, eventually, a coach baseline question set so the app can stash unasked baseline questions and avoid recommending questions too similar to those already practiced.

### CoachPlan

`CoachPlan` is the dashboard home-base read model for a selected `prepProfile`.

It is derived from persisted setup, session, question, answer, and analysis evidence. It is not a new persistence requirement for the first implementation slice.

Current release shape:

```ts
type CoachPlan = {
    prepProfileId: string;
    targetRole: string;
    interviewStage: InterviewStage;
    baselineQuestionCount: number;
    selectedFace: "categories" | "skills" | "question_set";
    planGoals: string[];
    rationaleSummary: string[];
    preparednessTarget: PreparednessTarget;
    categoryFace: CoachPlanCategoryFace;
    skillsFace: CoachPlanSkillsFace;
    questionSetFace: CoachPlanQuestionSetFace;
    coachUpdate?: CoachUpdate;
    practiceNext: PracticeNextRecommendation;
};
```

Rules:

- source the model from the selected target interview context only;
- keep fixed framing brief and candidate-facing;
- never expose hidden numeric averages or raw score dimensions;
- let the UI remember the last selected face for a prep context, but default to `categories`.

### PreparednessTarget

`PreparednessTarget` is the derived visual read that sits in the Coach Plan fixed framing.

It answers:

- how many baseline questions have at least one usable answer;
- what the current aggregate prep state is for practiced baseline questions;
- whether repeat practice produced improvement or watch items.

Current release shape:

```ts
type PreparednessTarget = {
    baselineQuestionCount: number;
    practicedBaselineQuestionCount: number;
    state: "not_practiced" | "emerging" | "clear" | "strong";
    coverageRatio: number;
    coverageSummary: string;
    coachObservation: string;
    movement: {
        improvedCount: number;
        watchCount: number;
    };
    explainer: string;
};
```

Aggregation rule:

1. For each practiced baseline question, average the rated dimensions that have valid numeric scores.
2. Average those per-question averages across practiced baseline questions.
3. Map the hidden aggregate to the qualitative evidence state.

Release threshold compatibility may use the existing dashboard mapping:

- score >= 4: `strong`;
- score >= 3: `clear`;
- score >= 1: `emerging`;
- no usable practiced evidence: `not_practiced`.

Repeat-practice rules:

- repeat practice does not increase `practicedBaselineQuestionCount`;
- latest clear or strong evidence can promote the current question read;
- one weaker repeat becomes a caution or watch item, not an automatic demotion;
- repeated weaker evidence or regression on a high-priority baseline question can lower the current read;
- mixed evidence should produce coach copy that explains the tension instead of pretending the state is absolute.

Zero-practiced rule:

- show the plan as ready but without practice evidence;
- do not imply failure;
- point to the first recommended practice action.

Rendering rule:

- render one rounded gauge arc whose fill proportion is `practicedBaselineQuestionCount / baselineQuestionCount`;
- the filled arc uses the current aggregate qualitative prep-state color;
- the unfilled track remains muted and must not read as weak performance;
- the center shows the qualitative state chip plus `X/Y practiced`;
- supporting copy combines practiced/to-practice status into one coach-voice coverage summary;
- the coach observation uses first person, addresses the candidate directly, starts from "I see...", and frames `clear`/`strong` as affirmation and `emerging` as encouragement;
- future recommendation CTAs can attach one or two highest-value practice targets once Practice Next exposes that target data to the Coach Plan target surface;
- hover/focus/tap explainer copy may label practiced vs unpracticed context and summarize the current read without exposing numeric scores.

### CoachPlanCategoryFace

The Category face shows only categories present in the baseline plan.

Current release shape:

```ts
type CoachPlanCategoryFace = {
    categories: Array<{
        categoryId: QuestionPlanCategory;
        label: string;
        plannedCount: number;
        practicedCount: number;
        state: "not_practiced" | "emerging" | "clear" | "strong";
        teaching: {
            whyHere: string;
            purpose: string;
            strongAnswerShape: string[];
            watchOuts: string[];
        };
        questions: CoachPlanQuestion[];
    }>;
};
```

Rules:

- chart segment size may reflect planned count, but chart choice can change if count-based segments become hard to read;
- chart labels may render near segments when space allows;
- selecting a segment or label opens a teaching-first coaching sheet;
- non-sheet screen area should remain available for clickaway or tapaway close.

### CoachPlanSkillsFace

The Skills face shows the three release lanes as the only first-pass tap targets.

Current release shape:

```ts
type CoachPlanSkillsFace = {
    lanes: Array<{
        laneId: "answer_substance" | "interview_structure" | "communication_delivery";
        label: string;
        state: "not_practiced" | "emerging" | "clear" | "strong";
        teaching: {
            whyItMattersHere: string;
            strongAnswerShape: string[];
        };
        dimensions: Array<{
            dimension: Dimension;
            label: string;
            state: "not_practiced" | "emerging" | "clear" | "strong";
            evidenceStatus: "observed" | "not_elicited" | "insufficient_data" | "unscoreable";
        }>;
    }>;
};
```

Rules:

- child dimensions are not first-pass chart tap targets;
- the lane coaching sheet should show all lane dimensions together;
- current scoring must be hardened before dimension-level claims become prominent.

### CoachPlanQuestionSetFace

The Question Set face shows the planned coach sequence.

Current release shape:

```ts
type CoachPlanQuestion = {
    questionId: string;
    planIndex: number;
    categoryId: QuestionPlanCategory;
    questionText: string;
    visibility: "visible" | "hidden_until_reveal";
    status: "unanswered" | "answered" | "repeat_practiced";
    attempts: Array<{
        answerId: string;
        submittedAt: number;
        transcript: string;
        modality: "text" | "voice";
        state: "emerging" | "clear" | "strong" | "unscoreable";
        movement?: "improved" | "steady" | "watch";
    }>;
};
```

Rules:

- answered questions are visible by default;
- unanswered questions are hidden by default with a reveal option;
- visibility is based on answered/unanswered state, not current-round membership;
- opening a question first shows the full question and answer transcript;
- future annotation can mark transcript phrases, sections, or milestones with progressive feedback.

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
qualification questions. Screening Basics in `/practice` can still emphasize
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

No numeric score is part of the V2 evidence-first criterion contract. `not_elicited`, `insufficient_data`, and `unscoreable` never carry a qualitative band. Technical `supported` or `contradicted` claims require a versioned reference; otherwise technical role-skill evidence is `unscoreable`. Assembled prompts and unvalidated raw model responses are not persisted by default. Operational telemetry is metadata-only.

The following `AnalysisResult`, score, `FeedbackPlan`, and `CoachSignal` sections document V1/compatibility data. They do not override the V2 contract or authorize new V2 writes in those shapes.

### Legacy AnalysisResult

Answer analysis is the strongest current source for preparedness evidence.

Important fields:

- `acknowledgement`;
- `contentPulse`;
- `deliveryPulse`;
- `feedbackPlan`;
- `recommendation`;
- `nextAction`;
- `coachSignal`;
- legacy/internal `oneBigUpgrade` only as compatibility fallback for older persisted feedback JSON;
- hidden numeric `scores`;
- metadata for QA/evaluation.

For the release dashboard, Substance, Structure, and Delivery are derived from
the internal numeric scores on completed-session analyses rather than from
qualitative pulse/anchor inference. Signposting belongs to Structure only.

The old analysis route should not be used for active behavior. Current candidate/recruiter feedback should use the question-scoped analysis flow.

### Per-Question Preparedness Evidence

Current release behavior derives preparedness evidence from completed answer analyses and their hidden numeric scores. Dimension scores now carry an applicability guard so the dashboard can distinguish observed evidence from dimensions that were not validly scoreable.

```ts
type DimensionScoreApplicability =
    | "observed"
    | "not_elicited"
    | "insufficient_data"
    | "unscoreable";

type DimensionScore = {
    applicability?: DimensionScoreApplicability;
    score?: number;
    label: string;
};
```

Rules:

- `observed` means the answer gave usable evidence for that dimension and should include `score` from 1-5;
- omitted `applicability` is legacy-compatible and is treated as `observed` only when a valid numeric `score` exists;
- `not_elicited` means the question or modality did not reasonably ask for that signal;
- `insufficient_data` means the candidate attempted an answer but did not provide enough evidence to rate that dimension;
- `unscoreable` means the answer is blank, off-topic, corrupted, or otherwise cannot be evaluated;
- dashboard lane/category averages must include only observed or legacy-unspecified numeric scores;
- non-observed dimensions must not be converted into low scores or candidate-facing failure states.

The durable direction remains a more explicit per-question evidence contract where each answered question records what the evaluator actually observed, what could not be observed, and how confident the evaluator was in that judgment.

Future evaluator records should preserve these facts separately:

- evaluator version;
- question category and difficulty band;
- transcript/input quality;
- one entry per expected signal dimension;
- signal applicability: observed, not elicited, insufficient data, or unscoreable;
- raw score only when the signal was observed;
- evaluator confidence for the individual judgment;
- short candidate-safe evidence excerpt or rubric anchor.

Contract invariants:

- never emit a numeric score for a signal that was not observed;
- never treat too-short, off-topic, no-response, or otherwise unusable input as low performance;
- make non-observation explicit instead of relying on a missing signal entry;
- derive lane/category/overall dashboard state from the evidence stream, not directly from evaluator prose;
- preserve evaluator version on every persisted evaluation used for trend or comparison reads.

Three release lanes contain dimensions with different observability profiles. Focus, specificity, structure, signposting, filler control, and conciseness are broadly observable in most answers. Outcome/impact, rationale/judgment, and resilience/ownership are more elicitation-dependent and require the question or follow-up to create the right evidence opportunity. A future follow-up coach should deliberately create those opportunities instead of letting the dashboard silently mark the candidate weak for evidence the session never elicited.

### Legacy AI Capture AppName

V1 AI capture distinguished app ownership:

- `candidate_app` for candidate-led sessions with candidate/prepProfile context;
- `recruiter_app` for recruiter-invited sessions.

That distinction remains relevant only to legacy capture and routing. V2 evaluator runs intentionally omit a candidate-app/recruiter-app source axis because candidate-led and invited sessions use the same evaluator job. Audience permissions and visibility belong to session ownership/access contracts, not model-response comparison. Candidate-only legacy fields such as `coachSignal` must not be copied into the V2 evaluator contract.

### FeedbackPlan

`feedbackPlan` is the bridge between per-answer coaching and interview preparedness.

Important fields:

- `signal.valence`;
- `signal.detectability`;
- `primaryAnchor.source`;
- `primaryAnchor.dimension`;
- `primaryAnchor.candidateEvidence`;
- `intervention.type`;
- `centralRead`.

`feedbackPlan` remains useful for candidate-facing modal explanation, but the
release dashboard lane state and fill should not depend on `primaryAnchor`
inference.

### CoachSignal

`coachSignal` is the replacement for candidate-facing "one big upgrade" language.

Current status: implemented in the answer-feedback schema, model prompt, sanitizer, session feedback UI, dashboard loader, and prepProfile read-model adapters. Older persisted feedback JSON may still contain `oneBigUpgrade`; read paths may map it to `coachSignal`, but new generation and candidate-facing code should not depend on the legacy field name.

Current contract:

```ts
type CoachSignal = {
    focus: string;
    rationale: string;
    targetMoment?: string;
    trySayingThis: string;
};
```

Candidate-facing labels should use plain coaching language such as "For the biggest lift" when appropriate.

## Interview Preparedness Contract

The top-level lane ids are immutable unless a new ADR changes the model:

```ts
type PrepSignalLane =
    | "role_fit"
    | "answer_substance"
    | "interview_structure"
    | "communication_delivery"
    | "interview_range";
```

Candidate-facing lane labels:

- Answer Substance
- Interview Structure
- Communication Delivery

Role Fit is out of release scope. Interview Range is represented as question category coverage cards, not as a lane.

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

Evidence refs must use candidate-safe excerpts and evaluation copy. Dashboard lane and category drilldowns may show the candidate's own answer transcript, modality, submitted date, and session grouping context for practiced questions. Do not surface raw resume content, prompts, hidden numeric scores, or AI-quality internals in normal candidate UI.

Answer modality is persisted in `answers.modality` and should be carried into `PrepEvidenceRef.answerModality`. For historical answers saved before modality was written at every submit/recovery boundary, dashboard read paths may fall back to `analysis.meta.modality` when present. If neither source can prove voice mode, the UI must treat the answer as text rather than guessing.

`PrepEvidenceRef.evaluation` should preserve the full candidate-safe coach read. The dashboard may format recognized sections such as overall read, signal observations, biggest-lift guidance, and next step, but it must not truncate the detail modal content or expose internal labels such as "Coach signals" to candidates.

Dashboard drilldowns should group practiced Q/A cards by session, newest session first, then sort each session's questions by submitted answer time ascending.

Dashboard question coverage uses generated-session question coverage plus submitted-answer score evidence. Category state/color is derived from practiced/scored questions only; unanswered upcoming questions are coverage context and must not be treated as zero-score evidence. When multiple sessions contribute to the same category, category state must be recomputed from the weighted average of practiced/scored questions rather than preserving the strongest historical state.

Question category read-model cards must distinguish each question's candidate-facing status as `Practiced` when an answer was submitted and `Upcoming` when the question exists but is unanswered. They also carry optional lane-specific score states for the release dashboard matrix:

```ts
type PrepQuestionCategoryCard = {
    categoryId: "behavioral" | "culture_fit" | "technical" | "case_scenario" | "screening";
    label: string;
    questionCount: number;
    practicedQuestionCount?: number;
    upcomingQuestionCount?: number;
    questionStatuses?: Array<{
        questionId: string;
        questionNumber: number;
        questionText?: string;
        status: "practiced" | "upcoming";
    }>;
    evidenceState: "not_practiced" | "emerging" | "clear" | "strong";
    averageScore?: number;
    laneStates?: Partial<Record<"answer_substance" | "interview_structure" | "communication_delivery", {
        evidenceState: "not_practiced" | "emerging" | "clear" | "strong";
        averageScore?: number;
        scoreCount: number;
    }>>;
    sourceRefs: PrepEvidenceRef[];
};
```

`questionStatuses.questionText` carries generated planned question text when available so dashboard Question Set reveal can show the actual unanswered question instead of only `Q# + category`. It is optional for older rows and fallback coverage rows.

The dashboard preparedness matrix is a derived UI model, not persisted data. Rows are generated/practiced question categories, columns are the fixed release lanes, and each cell is computed from `PrepQuestionCategoryCard.laneStates` when available. If lane-specific category scores are unavailable, the UI may fall back conservatively to the lane state only when matching evidence exists.

The dashboard instant-read surface is also a derived UI model, not persisted data. It summarizes the same scoped prepProfile evidence used by the matrix, but it must stay qualitative and low-detail:

```ts
type InstantReadPreparednessModel = {
    overallRead: {
        label: string;
        state: "not_practiced" | "emerging" | "clear" | "strong";
        summary: string;
    };
    lanes: Array<{
        id: "answer_substance" | "interview_structure" | "communication_delivery";
        label: string;
        state: "not_practiced" | "emerging" | "clear" | "strong";
        evidenceLevel: "none" | "thin" | "enough" | "strong";
        fillPercent?: number;
    }>;
    categoryCoverage: Array<{
        categoryId: "behavioral" | "culture_fit" | "technical_role_specific" | "case_scenario" | "screening";
        label: string;
        plannedCount: number;
        practicedCount: number;
        state: "not_practiced" | "emerging" | "clear" | "strong";
    }>;
};
```

Rules:

- source the model from the same selected-target-interview scope as the matrix;
- use color for qualitative preparedness state;
- use fill, opacity, or quiet marks for evidence amount and question coverage;
- do not show numeric scores, percentages, raw scoring dimensions, or hidden model terms on the instant-read surface;
- keep the matrix as the evidence-backed detail layer for lane, category, and cell drilldowns.

### Evidence States

| State | Meaning |
| --- | --- |
| `not_practiced` | The signal matters, but no usable answer evidence exists yet. |
| `emerging` | The candidate attempted the signal, but evidence is thin, incomplete, unclear, or growth-oriented. |
| `clear` | The candidate showed usable evidence, though focused improvement may remain. |
| `strong` | The candidate showed strong or repeated support for the signal. |

Evidence states are qualitative. They are not scores.

Current state vocabulary intentionally remains `not_practiced | emerging | clear | strong`. The future contract should consider splitting `not_practiced` into two internal facts:

- `to_practice`: no usable practice evidence exists yet because the planned category or signal has not been attempted.
- `awaiting_evidence`: the candidate practiced, but the relevant signal was not elicited or the input was insufficient.

That distinction is durable product logic, but adopting it as runtime state vocabulary is a separate implementation slice. Until then, UI and read models must avoid wording that implies failure when the system merely lacks valid evidence.

### Progression Rules

- Latest strong evidence immediately elevates the current signal to `strong`.
- Latest clear evidence immediately elevates the current signal to `clear`.
- One weak latest answer should not erase a strong history.
- Repeated weak evidence after strong evidence can pull a signal down.
- Weak and strong evidence must both remain available in source history.
- Lane fill is a quiet visual cue only; do not expose percentages or numeric readiness.
- Future confidence and trajectory indicators must be evidence-gated. A single answer can move the displayed latest read, but durable confidence should require repeated observations and reasonable consistency.
- Future trend arrows must compare like with like: do not trend silently across evaluator-version changes, and do not treat normal evaluator noise as candidate movement.
- Raw scores from different question difficulties should not be averaged directly if difficulty bands become first-class in the evaluator record. Difficulty normalization must be calibrated before cross-difficulty trends are used.

### Future Reliability Controls

The following controls are not release-complete runtime behavior, but they are durable requirements for any stronger longitudinal preparedness model:

- pin or record evaluator version per evaluation and avoid silent cross-version trend claims;
- periodically re-score a gold-standard answer set to estimate evaluator noise by signal;
- set movement thresholds above the measured noise floor before showing trajectory;
- use robust aggregates rather than simple means so one unusually good or poor answer cannot define a lane;
- require minimum evidence before marking a state as durable or confirmed;
- keep high-water history available internally so one weak answer does not erase previously strong evidence;
- audit Delivery-lane signals for fairness risk, especially filler control and conciseness, so accent, dialect, ESL status, disability, or neurodivergent communication patterns do not proxy into an invalid readiness claim.
- harden score applicability so every dimension-level claim can distinguish observed evidence from not-elicited, insufficient-data, and unscoreable answers.

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
- Resume bridge lane: superseded; use resume/JD as evidence and framing across lanes.

## Change Rule

Before changing a schema, payload shape, state value, signal id, lane id, or candidate-facing claim source, update this file in the same pass.
