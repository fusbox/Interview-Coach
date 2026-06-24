# Candidate App Data Contract

Status: Canonical system truth
Last updated: 2026-06-22

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

### PrepProfile

`prepProfile` is the durable preparation context for one candidate and one target interview context.

Current backing:

- `candidate_role_preparation_profiles`;
- `candidate_practice_drafts.role_profile_id`;
- `sessions.intakeData.roleProfileId`.

Current contract:

```ts
type PrepProfile = {
    prepProfileId: string;
    candidateProfileId: string;
    targetRole: string;
    jobDescriptionSnapshot: string;
    resumeContextSnapshot?: unknown;
    source: "practice_setup" | "host_platform" | "seed";
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

The dashboard may support multiple prep profiles later. Current work should first make one active target interview context reliable and explainable.

Production identity rule:

- Production `/practice` should require a trusted host-platform launch context.
- Host-launched prep profiles should be found or created from candidate identity plus platform job identity, primarily `JobCollectionID` and `RequirementID` when available.
- Manual role/JD profile creation remains a local-development behavior unless a future standalone mode is explicitly designed.

Reference: [Platform Launch PrepProfile Migration](./04-architecture/platform-launch-prepprofile-migration.md).

Signal mapping reference: [Preparedness Signal Map](./04-architecture/preparedness-signal-map.md).

Question category reference: [Question Category Contract](./04-architecture/question-category-contract.md).

Instant-read dashboard reference: [Instant Read Surface Plan](./04-architecture/instant-read-surface-plan.md).

Current dashboard scoping rule:

1. Prefer an unfinished candidate-owned session as the selected target interview context.
2. Honor an explicit dashboard target-role selection when it matches one of the candidate's available target interview contexts.
3. Otherwise use the latest practice activity as the selected target interview context.
4. Keep dashboard stats, Practice Next, Previous Sessions, and Preparedness Map evidence scoped to that selected target interview title until the multi-profile manager is implemented.

This is a first guard against mixed-role dashboard pollution. A later profile manager can tighten the selector to `prepProfileId` plus job-description snapshot when the UI supports switching between multiple active target interviews with the same role title.

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

Current setup rule: candidate-led `/practice` requires a job description because production entry is expected to supply JD context and the practice model is role-specific.

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
- after provider parsing, the service repairs schema-valid output that under-fills a planned category by adding deterministic role-specific fallback questions. The UI may trim a larger pool down to the confirmed plan, but it should not silently accept fewer usable questions than `QuestionPlan.questionCount`.
- legacy `interviewType` remains compatibility-only for older candidate inputs and fallback ordering when no `interviewStage`/`QuestionPlan` is available. New recruiter and candidate setup work should use `interviewStage` plus `questionCount`; retiring `interviewType` is blocked until older-row read behavior is reviewed.
- candidate-created sessions persist the resolved `QuestionPlan` as `sessions.intakeData.questionPlanSnapshot` at session creation time. This is the immutable planned sampling contract for that practice round and should be used for later dashboard coverage/recovery reads instead of rebuilding from mutable setup state.

### PracticeCoverageBaseline

`PracticeCoverageBaseline` is the release-basic rigor primitive for dashboard follow-up practice.

Rules:

- derive it from the same `buildQuestionPlan` allocation used for question generation;
- treat `categoryMinimums` as the minimum category coverage for the planned interview scope;
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

### AnalysisResult

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

Current release behavior derives preparedness evidence from completed answer analyses and their hidden numeric scores. The durable direction is a more explicit per-question evidence contract where each answered question records what the evaluator actually observed, what could not be observed, and how confident the evaluator was in that judgment.

Future evaluator records should preserve these facts separately:

- evaluator version;
- question category and difficulty band;
- transcript/input quality;
- one entry per expected signal dimension;
- signal applicability: observed, not elicited, or insufficient data;
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

### AI Capture AppName

Shared AI calls must record the correct app ownership:

- `candidate_app` for candidate-led sessions with candidate/prepProfile context;
- `recruiter_app` for recruiter-invited sessions.

Candidate-only answer feedback fields such as `coachSignal` may be generated and rendered for candidate-led sessions. Recruiter-invited answer feedback should not request or render candidate-only coaching fields unless the recruiter-app experience is explicitly changed.

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

### Recommendation Priority

Practice Next is the only dashboard action surface for now.

Priority:

1. Resume unfinished candidate-owned session.
2. Practice latest high-priority unresolved signal.
3. Practice next unpracticed primary signal.
4. Expand interview range or polish a clear/strong area.

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
