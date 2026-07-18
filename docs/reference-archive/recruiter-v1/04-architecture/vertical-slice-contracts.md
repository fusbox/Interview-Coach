# Vertical Slice Contracts (Walking Skeleton)

## Purpose

Define the canonical response shape for session hydration/resume (`/now`) and the
minimal endpoint contracts required for the walking skeleton vertical slice.

These contracts are designed to:
- Support exact resume across refresh and devices
- Enable progressive drafts with offline tolerance
- Enable idempotent server orchestration
- Support streaming status updates (SSE) with polling fallback

---

## Canonical Projection: Session Now

### GET `/api/session/{sessionId}/now`

#### Access
- Candidate-scoped (invite token or equivalent) or recruiter-scoped depending on caller
- Must enforce session ownership scope on server

#### Response: `200 OK`
```json
{
  "session": {
    "sessionId": "uuid",
    "status": "NOT_STARTED | GENERATING_QUESTIONS | IN_SESSION | AWAITING_EVAL | ERROR",
    "currentQuestionIndex": 0,
    "resumeToken": "opaque-string",
    "updatedAt": "2026-01-31T18:52:00Z"
  },
  "context": {
    "targetRole": "string",
    "jobDescriptionProvided": true,
    "intakeProvided": true
  },
  "question": {
    "questionId": "uuid",
    "index": 0,
    "text": "string",
    "tts": {
      "status": "NONE | GENERATING | READY | FAILED",
      "audioUrl": "https://.../file-or-signed-url",
      "generatedAt": "2026-01-31T18:52:00Z"
    }
  },
  "answer": {
    "attemptNumber": 1,
    "modality": "text | voice",
    "draft": {
      "text": "string",
      "revision": 12,
      "updatedAt": "2026-01-31T18:52:00Z",
      "source": "server"
    },
    "final": {
      "text": "string",
      "submittedAt": "2026-01-31T18:52:00Z"
    }
  },
  "evaluation": {
    "status": "NONE | PENDING | COMPLETE | FAILED",
    "updatedAt": "2026-01-31T18:52:00Z",
    "feedback": {
      "schemaVersion": "1.0",
      "highLevel": "string",
      "bullets": ["string", "string"],
      "nextStepPrompt": "string"
    }
  },
  "uiHints": {
    "canSubmit": true,
    "canRetry": true,
    "blockingReason": null,
    "pollAfterMs": 0,
    "recommendedNextAction": "START_SESSION | WAIT_FOR_QUESTIONS | ANSWER_QUESTION | WAIT_FOR_EVAL | VIEW_FEEDBACK"
  }
}
