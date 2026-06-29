# Candidate App Data Contract

Status: Canonical system truth
Last updated: 2026-06-27

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
- The preview seed intentionally carries multiple Irma prep contexts for dashboard QA. Current durable contexts include an active follow-up/final Client Services Specialist round, a completed follow-up/final Client Services Executive - WWT round, and a completed first-interview Client Services Representative round with 3 practiced voice answers against a 7-question baseline. The Representative context is the partial-baseline fixture for remediation plus unpracticed coverage behavior.

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
- planned provider output uses `caseScenario` as the first-class keyed Case/Scenario container. Legacy provider payloads that still put case/scenario-like keys inside `behavioral` are normalized into `caseScenario` after parsing for compatibility.
- after provider parsing, the service repairs schema-valid output that under-fills a planned category by adding deterministic role-specific fallback questions. The UI may trim a larger pool down to the confirmed plan, but it should not silently accept fewer usable questions than `QuestionPlan.questionCount`.
- legacy `interviewType` remains compatibility-only for older candidate inputs and fallback ordering when no `interviewStage`/`QuestionPlan` is available. New recruiter and candidate setup work should use `interviewStage` plus `questionCount`; retiring `interviewType` is blocked until older-row read behavior is reviewed.
- candidate-created sessions persist the resolved `QuestionPlan` as `sessions.intakeData.questionPlanSnapshot` at session creation time. This is the immutable planned sampling contract for that practice round and should be used for later dashboard coverage/recovery reads instead of rebuilding from mutable setup state.

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
