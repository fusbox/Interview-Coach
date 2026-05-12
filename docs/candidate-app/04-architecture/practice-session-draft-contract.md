# Practice Session Draft Contract

Date: 2026-04-03
Status: Proposed implementation contract for the next `/practice` slice

## Purpose

This document defines the candidate-owned setup/session state model that should support `/practice`, loading/generation, session entry, session resume, and post-session summary across authenticated routes and devices.

The goal is to preserve the recruiter app's "pick up where you left off" behavior while replacing invite-token ownership with authenticated candidate ownership.

## Core Principle

The current screen should be derived from persisted server state, not from local component state alone.

That means an authenticated candidate who opens the app on another device should be routed to the same logical place they left off:

- unfinished setup draft
- question generation in progress
- in-progress session
- completed summary/dashboard state

## Data Model Overview

### `CandidateProfile`

Account-level profile state owned by the authenticated candidate.

Recommended fields:

```ts
type CandidateProfile = {
  id: string;
  authSubject: string;
  email: string;
  displayName: string;
  resumeLibrary: ResumeAsset[];
  defaultResumeText: string | null;
  intakeProfile: CandidateIntakeProfile | null;
  createdAt: string;
  updatedAt: string;
};
```

### `PracticeSessionDraft`

Session-setup and pre-session generation state owned by one candidate.

Recommended fields:

```ts
type PracticeSessionDraftStatus =
  | "draft"
  | "generating"
  | "ready"
  | "in_session"
  | "completed"
  | "generation_failed";

type PracticeSessionDraft = {
  id: string;
  candidateProfileId: string;
  status: PracticeSessionDraftStatus;
  targetRole: string;
  jobDescription: string | null;
  resumeContext: ResumeContextSnapshot | null;
  customQuestions: CandidateCustomQuestion[];
  intakeResponses: PracticeIntakeResponse[];
  questionSetSnapshotId: string | null;
  sessionId: string | null;
  resumeTargetScreen: PracticeResumeTarget;
  lastActivityAt: string;
  generationStartedAt: string | null;
  generationFinishedAt: string | null;
  generationError: string | null;
  createdAt: string;
  updatedAt: string;
};
```

### `ResumeAsset`

Reusable profile-level resume source artifacts.

```ts
type ResumeAssetKind = "text" | "file" | "image";

type ResumeAsset = {
  id: string;
  kind: ResumeAssetKind;
  fileName: string | null;
  storagePath: string | null;
  extractedText: string;
  pageOrder: number | null;
  createdAt: string;
};
```

### `ResumeContextSnapshot`

Session-draft-level frozen resume context used for one question-generation request.

```ts
type ResumeContextSnapshot = {
  sourceAssetIds: string[];
  pastedText: string | null;
  extractedText: string;
  captureMode: "none" | "pasted_text" | "file_upload" | "image_capture" | "mixed";
};
```

### `CandidateCustomQuestion`

Candidate-authored extra questions that may be appended to an AI-generated set in a future `/practice` version.

```ts
type CandidateCustomQuestion = {
  id: string;
  questionText: string;
  order: number;
  source: "candidate";
};
```

### `CandidateIntakeProfile` and `PracticeIntakeResponse`

Personalization data should be modeled separately from the core draft fields so intake can evolve without bloating the base session contract.

```ts
type CandidateIntakeProfile = {
  preferredInterviewStyle?: string;
  targetChallenges?: string[];
  communicationGoals?: string[];
  extraContext?: string | null;
};

type PracticeIntakeResponse = {
  id: string;
  questionKey: string;
  answerText: string;
};
```

## Resume and Screen-State Rules

`resumeTargetScreen` should capture where the app should route the candidate when they return.

Recommended values:

```ts
type PracticeResumeTarget =
  | "practice_setup"
  | "practice_generating"
  | "session_entry"
  | "session_in_progress"
  | "session_summary"
  | "dashboard";
```

Rules:

- While `status = "draft"`, route to `/practice`.
- While `status = "generating"`, route to the generation/loading state for that draft.
- Once question generation succeeds and a session is attached, route to the session entry/in-progress screen dictated by persisted session state.
- Once the session completes, route to summary first, and then dashboard once the candidate intentionally exits the summary flow.
- On any app entry into a protected route, resolve the candidate's current active draft/session from server state and redirect if the requested route is stale.

## Autosave and Mutation Rules

### Setup validation

The first shared validation boundary is implemented in [practice-setup-schema.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/practice-setup/practice-setup-schema.ts) and covered by [practice-setup-schema.test.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/practice-setup/practice-setup-schema.test.ts).

- `targetRole` is required, trimmed, and length-limited.
- `jobDescription` is optional, trimmed, length-limited, and normalized to `null` when blank or omitted.
- `resumeText` is optional, trimmed, length-limited, and normalized to `null` when blank or omitted.
- Non-string setup payloads are rejected before they reach the future draft repository/service boundary.

### `/practice` draft editing

- Create or resume one active draft for the authenticated candidate.
- Autosave role, job description, resume text references, and future intake/custom-question fields to the server.
- Local form state can be optimistic, but server state remains the source of truth for resume/restore behavior.

### Submit for generation

- Freeze the draft inputs used for question generation.
- Transition draft status from `draft` to `generating`.
- Persist `resumeTargetScreen = "practice_generating"`.
- Run question generation and persist an immutable question snapshot.
- On success, attach `questionSetSnapshotId` and `sessionId`, then transition to `ready` or `in_session`.
- On failure, transition to `generation_failed`, preserve the last editable draft inputs, and return the candidate to a recoverable setup/error state.

### Enter and resume session

- Reuse the recruiter app's session-state-machine pattern below the app shell.
- Session UI should render from persisted session state and route params, not from one-off in-memory wizard state.
- Post-session summary should stay linked to the user-owned session and remain available from dashboard/history.

## Protected-Route Boundary

- `/` remains public.
- `/practice`, `/dashboard`, `/settings`, `/session/[sessionId]`, and summary/history routes are protected.
- The candidate identity source should be one authenticated profile contract, not ad hoc user IDs threaded through UI components.
- Guest trial is a future mode and should not shape the first protected-route implementation.

## Reuse Boundary from Recruiter App

Preserve these patterns:

- state-driven screen selection
- schema validation at route/service boundaries
- immutable generated question snapshots
- explicit session resume semantics
- candidate-only coaching visibility

Do not carry over these recruiter-specific assumptions:

- invite batch ownership
- recruiter candidate lists inside setup
- pre-session invite email workflows
- recruiter-authored question review UI as a required candidate-facing step

## Open Questions Before Implementation

- Should there be at most one active draft per candidate, or multiple named drafts?
- Should resume uploads be reusable profile assets by default, session-specific only, or both?
- Should custom candidate-authored questions ship in the first `/practice` implementation or remain a dormant schema extension?
- Should future intake responses be saved to `CandidateProfile`, `PracticeSessionDraft`, or both depending on question type?

## Recommended First Implementation Slice

Build `/practice` against a server-backed `PracticeSessionDraft` with:

- required `targetRole`
- optional `jobDescription`
- one normalized `resumeText` input path first
- placeholder support for future `customQuestions` and `intakeResponses`
- a draft `status` field and `resumeTargetScreen`
- a generation/loading route state that can resume safely after refresh

Once that is stable, expand the resume subsystem to file upload and multi-image capture, then layer candidate intake on top of the same draft contract.
