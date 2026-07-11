# Candidate Session Engine Port Plan

Date: 2026-05-13
Status: Working integration map

## Purpose

This document identifies which migrated recruiter app session-engine files are safe to reuse for candidate-led Interview Coach, which files need candidate-specific adapters, and which recruiter/invite-token assumptions should stay out of the authenticated candidate path.

It resolves the first session-engine planning slice: candidate-safe file inventory plus recruiter-only exclusions.

## Current Direction

Self-serve candidate practice and recruiter invite-token practice should converge on the same core session model, persistence, state transitions, answer schema, and AI feedback services.

They should not share entry/auth assumptions:

- self-serve candidate routes use authenticated candidate profile ownership through `candidate_profile_id`
- recruiter invite routes use invite token/session access through `/s/[token]`
- recruiter review routes use recruiter user ownership through `recruiter_id`

## Candidate-Safe Shared Files

These files are reusable by candidate-led sessions with no candidate-specific fork planned:

| Area | File | Candidate Use |
| --- | --- | --- |
| Domain model | [types.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/domain/types.ts) | Shared `InterviewSession`, `Question`, `Answer`, and `SessionStatus` types |
| Domain state | [session-state-machine.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/domain/session-state-machine.ts) | Shared status transitions for start, pause/resume, review, and completion |
| Domain orchestration | [orchestrator.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/session/orchestrator.ts) | Shared pure session functions such as `submitAnswer`, `nextQuestion`, and analysis context construction |
| Session persistence interface | [repository.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/domain/repository.ts) | Shared repository contract |
| Session persistence implementation | [postgres-session-repository.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/infrastructure/postgres-session-repository.ts) | Shared Postgres-backed session reads/writes |
| Repository factory | [session-repository.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/infrastructure/session-repository.ts) | Shared backend selector, currently Postgres-only |
| Application commands | [get-session.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/application/session/get-session.ts), [update-session.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/application/session/update-session.ts), [start-session.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/application/session/start-session.ts) | Candidate services may reuse these only after candidate ownership has been resolved |
| AI analysis | [ai-service.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/services/ai-service.ts) | Candidate answer analysis can reuse the provider/schema boundary; prompts must keep candidate privacy rules |
| Question generation | [question-generation-service.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/services/question-generation-service.ts) | Recruiter and candidate flows share the AI provider/schema/capture boundary while passing different actor/app context |

## Candidate Adapter Files

These files intentionally sit between authenticated candidate routes and the shared session engine:

| Area | File | Responsibility |
| --- | --- | --- |
| Session creation | [candidate-session-creation-service.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-session-creation-service.ts) | Reads a candidate-owned generating draft, creates a shared session, attaches session/snapshot IDs back to the draft, and cleans up on attach failure |
| Question snapshot generation | [question-generation-service.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/services/question-generation-service.ts) | Generates a recruiter-compatible question set, then flattens it into a candidate immutable session question snapshot ordered by lightweight practice configuration |
| Session loading | [candidate-session-loader.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-session-loader.ts) | Verifies `candidate_profile_id` plus `session_id` ownership before reading the shared session record |
| Session progress | [candidate-session-progress-service.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-session-progress-service.ts) | Starts, advances, pauses, resumes, and completes sessions after ownership checks |
| Answer and retry mutations | [candidate-session-answer-service.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-session-answer-service.ts) | Submits and retries answers without invite-token dependency |
| Shared session API authorization | [candidate-route-auth.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate-route-auth.ts) and [api-handler-utils.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/api-handler-utils.ts) | Allows mature invite-session API routes to serve either invite-token sessions or authenticated candidate-owned sessions after profile/draft ownership is proven |
| Mutation guard | [candidate-mutation-boundary.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-mutation-boundary.ts) | Applies candidate mutation rate limits and documents state-idempotency |
| Route surface | [session page](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/session/[sessionId]/page.tsx) and [CandidateSessionPage.tsx](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-session/CandidateSessionPage.tsx) | Renders authenticated candidate-owned sessions |
| Server actions | [candidate session actions](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-session/actions.ts) | Resolves the current candidate profile before invoking mutation services |
| Summary | [summary page](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/summary/[sessionId]/page.tsx) and [candidate-summary-loader.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-summary-loader.ts) | Loads completed candidate-owned session summaries |

## Recruiter And Invite-Token Exclusions

Do not port these assumptions into authenticated candidate routes:

| Assumption | Current Source | Candidate Direction |
| --- | --- | --- |
| Invite token is the candidate access boundary | `/s/[token]` route group and shared session API handlers | Candidate routes should use `candidate_profile_id` ownership instead |
| Recruiter owns session visibility through `recruiter_id` | [recruiter session details](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/(recruiter)/recruiter/sessions/[id]/page.tsx) | Candidate visibility must not depend on recruiter ownership |
| Initials gate is required for invite participants | [orchestrator.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/session/orchestrator.ts) and invite UI components | Authenticated candidates already have a candidate identity; initials gate is not part of the first self-serve flow |
| Practice-again issues a fresh invite token | [practice-again page](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/(candidate)/s/[token]/practice-again/page.tsx) | Candidate repeat practice should create/restore candidate-owned drafts instead |
| Shared session APIs can rely only on invite-token auth | [submit route](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/api/session/[session_id]/questions/[question_id]/submit/route.ts), [analysis route](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/api/session/[session_id]/questions/[question_id]/analysis/route.ts), [TTS route](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/api/tts/route.ts), [tips route](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/api/tips/generate/route.ts), and [strong response route](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/api/response/generate/route.ts) | Shared session APIs may be reused only when they authorize either invite token access or authenticated candidate profile ownership for the target session |
| Recruiter review semantics are candidate feedback semantics | Recruiter session detail/review pages | Candidate summaries should avoid recruiter readiness labels unless deliberately reframed |

## Current Candidate Session Coverage

Already implemented:

- candidate-owned draft to session creation
- AI-backed candidate question generation through the shared question generation service
- immutable generated question snapshot attached to the candidate session and draft
- candidate-owned session route loading
- start, pause, resume, next question, and completion mutations
- answer submit, candidate-owned answer coaching, and retry server actions
- completed session summary route
- route metrics and mutation rate-limit/state-idempotency boundaries
- seeded setup-to-summary browser smoke through `npm run test:e2e:candidate-seeded`
- live candidate session UI reusing mature recruiter session workspace patterns: sticky progress header, `SessionPromptShell`, default voice-mode active question surface, Hints/Example panels, text-mode answer workspace, text submission multistep loader, coaching/retry/continue controls, pause/resume/complete states, and the hidden engagement debug inspector
- invite-session parity for candidate-owned session entry and active-question controls: an entry screen before Q1, no active-card `Start Practice` button, invite-style `Exit Session` header language, read-question playback, Q1/Qn+1 TTS prefetching from the candidate session route, and active-question visual states aligned with the recruiter invite flow
- candidate active-question service parity: TTS, smart hints, strong response, answer submit, and answer analysis now use the same shared session API/service path as invite sessions, with candidate-owned authorization fallback instead of requiring an invite token
- browser-validated voice/text answer flow: local candidate E2E mode can exercise read-question audio, voice capture/submission, text fallback submission, analysis, question progression, completion, and summary navigation without relying on a physical microphone

Still future or intentionally deferred:

- deeper feedback/debrief parity with the mature invite-session component stack, including feedback drawer behavior, transcript/audio playback in feedback, summary/debrief handoff, follow-up email parity, and the final decision on whether generation should wait for Q1 audio before routing into `/session/[sessionId]`
- durable request-replay idempotency for candidate API routes if candidate mutations move from server actions to HTTP APIs
- candidate repeat-practice flow from completed sessions

## Implementation Rule

Before reusing a session file in candidate code, answer three checks:

1. Does it require invite-token, recruiter, or anonymous initials assumptions?
2. Does it read/write shared `sessions` without first proving candidate ownership?
3. Does it expose answer, resume, prompt, or coaching content to recruiter-facing logs or UI?

If any answer is yes, wrap it in a candidate adapter or keep it out of the candidate path.
