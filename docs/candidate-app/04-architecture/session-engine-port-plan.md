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
| Question generation | [question-service.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/services/question-service.ts) | Candidate draft generation can reuse question generation behind candidate draft ownership |

## Candidate Adapter Files

These files intentionally sit between authenticated candidate routes and the shared session engine:

| Area | File | Responsibility |
| --- | --- | --- |
| Session creation | [candidate-session-creation-service.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-session-creation-service.ts) | Reads a candidate-owned generating draft, creates a shared session, attaches session/snapshot IDs back to the draft, and cleans up on attach failure |
| Session loading | [candidate-session-loader.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-session-loader.ts) | Verifies `candidate_profile_id` plus `session_id` ownership before reading the shared session record |
| Session progress | [candidate-session-progress-service.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-session-progress-service.ts) | Starts, advances, pauses, resumes, and completes sessions after ownership checks |
| Answer and retry mutations | [candidate-session-answer-service.ts](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-session-answer-service.ts) | Submits and retries answers without invite-token dependency |
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
| Session mutation APIs can trust `validatedSessionHandler` alone | [submit route](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/api/session/[session_id]/questions/[question_id]/submit/route.ts), [analysis route](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/api/session/[session_id]/questions/[question_id]/analysis/route.ts), and [answer draft route](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/api/session/[session_id]/questions/[question_id]/answer/route.ts) | Candidate mutations should go through candidate ownership services or a future `/api/candidate/**` boundary |
| Recruiter review semantics are candidate feedback semantics | Recruiter session detail/review pages | Candidate summaries should avoid recruiter readiness labels unless deliberately reframed |

## Current Candidate Session Coverage

Already implemented:

- candidate-owned draft to session creation
- immutable question snapshot ID on the draft
- candidate-owned session route loading
- start, pause, resume, next question, and completion mutations
- answer submit, candidate-owned answer coaching, and retry server actions
- completed session summary route
- route metrics and mutation rate-limit/state-idempotency boundaries

Still future or intentionally deferred:

- richer session UI using the mature invite-session component stack
- durable request-replay idempotency for candidate API routes if candidate mutations move from server actions to HTTP APIs
- candidate repeat-practice flow from completed sessions
- browser smoke for seeded setup-to-summary happy path

## Implementation Rule

Before reusing a session file in candidate code, answer three checks:

1. Does it require invite-token, recruiter, or anonymous initials assumptions?
2. Does it read/write shared `sessions` without first proving candidate ownership?
3. Does it expose answer, resume, prompt, or coaching content to recruiter-facing logs or UI?

If any answer is yes, wrap it in a candidate adapter or keep it out of the candidate path.
