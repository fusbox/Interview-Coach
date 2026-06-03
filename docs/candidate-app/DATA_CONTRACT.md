# Candidate App Data Contract

Status: Canonical system truth
Last updated: 2026-06-01

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
- Do not use `oneBigUpgrade` as user-facing copy. Treat it as legacy/internal until replaced by `coachSignal`.

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
- practice focus;
- question count;
- host-platform launch metadata when available.

Current setup rule: candidate-led `/practice` requires a job description because production entry is expected to supply JD context and the practice model is role-specific.

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

Canonical answer modality is the persisted answer modality. `analysis.meta.modality` is diagnostic/evaluation metadata and should not be the UI source of truth.

### AnalysisResult

Answer analysis is the strongest current source for preparedness evidence.

Important fields:

- `acknowledgement`;
- `contentPulse`;
- `deliveryPulse`;
- `feedbackPlan`;
- `recommendation`;
- `nextAction`;
- legacy/internal `oneBigUpgrade` until replaced by `coachSignal`;
- hidden numeric `scores`;
- metadata for QA/evaluation.

For the release dashboard, Substance, Structure, and Delivery are derived from
the internal numeric scores on completed-session analyses rather than from
qualitative pulse/anchor inference. Signposting belongs to Structure only.

The old analysis route should not be used for active behavior. Current candidate/recruiter feedback should use the question-scoped analysis flow.

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

`coachSignal` is the desired replacement for candidate-facing "one big upgrade" language.

Current status: not fully implemented.

Expected future contract:

```ts
type CoachSignal = {
    label: string;
    qualityBand: "foundation" | "sharpen" | "polish" | "reinforce";
    targetMoment?: string;
    rationale: string;
    trySayingThis?: string;
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

- Role Fit
- Answer Substance
- Interview Structure
- Communication Delivery
- Interview Range

Resume/JD context is evidence and signal framing, not a lane.

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
};
```

Evidence refs must use candidate-safe excerpts. Do not surface raw resume content, full transcripts, prompts, or AI-quality internals in normal candidate UI.

### Evidence States

| State | Meaning |
| --- | --- |
| `not_practiced` | The signal matters, but no usable answer evidence exists yet. |
| `emerging` | The candidate attempted the signal, but evidence is thin, incomplete, unclear, or growth-oriented. |
| `clear` | The candidate showed usable evidence, though focused improvement may remain. |
| `strong` | The candidate showed strong or repeated support for the signal. |

Evidence states are qualitative. They are not scores.

### Progression Rules

- Latest strong evidence immediately elevates the current signal to `strong`.
- Latest clear evidence immediately elevates the current signal to `clear`.
- One weak latest answer should not erase a strong history.
- Repeated weak evidence after strong evidence can pull a signal down.
- Weak and strong evidence must both remain available in source history.
- Lane fill is a quiet visual cue only; do not expose percentages or numeric readiness.

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

- `oneBigUpgrade`: legacy/internal output name; migrate to `coachSignal` and candidate-facing "biggest lift" language.
- `scoring_dimensions`: legacy/optional unless explicitly populated and consumed.
- `competencies`: prompt language may use competencies, but dashboard claims require populated evidence.
- Resume bridge lane: superseded; use resume/JD as evidence and framing across lanes.

## Change Rule

Before changing a schema, payload shape, state value, signal id, lane id, or candidate-facing claim source, update this file in the same pass.
