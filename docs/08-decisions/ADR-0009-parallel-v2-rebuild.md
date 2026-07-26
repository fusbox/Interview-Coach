# ADR-0009: Parallel V2 Rebuild

Date: 2026-07-06
Status: Accepted

## Context

The candidate app has accumulated implementation debt through several legitimate pivots:

- candidate-scoped proof of concept work;
- recruiter-first invite flows without authenticated candidate ownership;
- Supabase database and auth assumptions;
- migration to Postgres for company deployment;
- multiple session, answer-feedback, and dashboard respecs;
- renewed candidate-dashboard work after recruiter compatibility work had already shaped much of the shared code.

The current app still contains valuable working behavior, especially Postgres repositories, candidate ownership checks, question planning, idempotent answer submission, AI quality capture, and the existing recruiter invite flow. It also contains UI and lifecycle sprawl that now works against a production-ready candidate experience.

The refactor reference pack establishes the target architecture:

- one shared session runtime;
- one answer lifecycle;
- evidence-first evaluation;
- separate completion destinations;
- candidate dashboard read models built from evidence and criteria rather than legacy hidden-score payloads.

The design-system reference under `.untracked/design-system` gives the candidate-facing rebuild a credible visual and interaction substrate: tokens, component patterns, UI kits, voice rules, and a job-seeker surface language. The current dashboard header change is a small preview of that direction, not a durable architecture decision by itself.

There is no requirement to preserve historical legacy candidate data in the V2 experience.

## Decision

Proceed with a parallel V2 rebuild instead of continuing to polish the existing candidate dashboard and session surfaces in place.

The V2 effort originally planned to use twin `*2` routes while proving the new architecture. After the clean rebuild reset, the durable route contract is the final actor namespace:

- `/candidate/setup` for candidate-owned practice setup;
- `/candidate/session/[sessionId]` for the rebuilt shared session experience;
- `/candidate/summary/[sessionId]` only if summary remains a separate completion surface;
- `/candidate/dashboard` for the rebuilt Coach Plan dashboard;
- `/recruiter/*` for recruiter-owned surfaces when recruiter rebuild work is explicitly scoped.

Temporary paths such as `/practice2`, `/session2/[sessionId]`, and `/dashboard2` may remain as compatibility redirects during the rebuild. They are no longer product route names.

V2 is allowed to rebuild UI surfaces from the ground up, but it must reuse proven services where they remain clean and production-relevant:

- Postgres configuration, migrations, and repository patterns;
- candidate identity and ownership checks;
- `QuestionPlan` and question generation repair;
- idempotency boundaries;
- AI quality capture and admin replay artifacts;
- safe route logging and error response helpers.

V2 must not reuse old UI structure merely to preserve familiarity. The old dashboard, candidate session workspace, and recruiter create surfaces are reference implementations, not architectural anchors.

## Scope Rules

The first V2 slice is candidate-first:

1. Build a coherent candidate vertical: setup, session, answer feedback, completion, and dashboard return.
2. Make the session runtime shared-capable during that slice.
3. Keep recruiter-invited production behavior stable until an explicit recruiter V2 slice starts.
4. Use the design-system reference as the source for candidate-facing visual language.
5. Keep old routes available until V2 has equivalent tested behavior.

The first V2 slice does not include:

- a full recruiter rebuild;
- historical candidate data migration into V2;
- legacy dashboard compatibility work beyond keeping old routes stable;
- replacing all AI evaluation behavior in one pass;
- durable queue persistence unless it is explicitly scoped as part of the slice.

## Data And Evaluation Direction

V2 should treat legacy `eval_results.feedback_json`, hidden 1-5 score payloads, `oneBigUpgrade`, and legacy readiness metadata as compatibility artifacts for old routes and old rows.

V2 should prefer:

- raw answer/session facts as persisted truth;
- evidence extraction outputs;
- criteria bands;
- category pattern gaps;
- candidate-safe feedback composition;
- derived dashboard read models that can explain each visible claim.

If V2 temporarily adapts evidence-first output into the old `AnalysisResult` shape, that adapter is a bridge for existing rendering and admin tooling. It is not the new domain contract.

## Design-System Direction

Candidate V2 surfaces should use the job-seeker design-system dialect:

- candidate tokens consumed with the production pattern, such as `rgb(var(--candidate-primary))` and `rgb(var(--candidate-foreground) / 0.84)`;
- the preparedness ramp based on `--prep-*` states once promoted to tracked code;
- calm coach voice, direct second person, and first-person coach observations where appropriate;
- restrained app UI, not dashboard-card mosaics;
- charts and visual controls only when they explain practice state or next action.

Before production V2 depends on `.untracked/design-system`, the relevant tokens, component guidance, and assets must be promoted into tracked repo files or copied into a tracked implementation package.

## Consequences

Benefits:

- V2 can remove stale UI and lifecycle assumptions instead of routing around them.
- The session-kernel refactor and dashboard rebuild can align around the same answer/evaluation model.
- Old routes remain available for comparison and recruiter regression protection.
- No legacy data accommodation reduces accidental coupling to outdated feedback semantics.

Tradeoffs:

- V2 may keep temporary compatibility redirects while canonical `/candidate/*` routes are wired.
- Test coverage must prove both old-route stability and V2 behavior during the overlap.
- Shared services need stricter ownership boundaries because old and new routes will call them at the same time.
- The team must resist adding broad V2 scope before the first candidate vertical slice is stable.

## Execution Guardrails

- Start each V2 slice by updating SPEC/HANDOFF or a linked implementation plan.
- Implement in small vertical slices with route-level behavior visible at the end of each slice.
- Keep old routes stable until V2 replacement behavior is tested and intentionally switched over.
- Do not add candidate-facing claims without updating `SPEC.md`.
- Do not change schema, payload, or durable state semantics without updating `DATA_CONTRACT.md`.
- Do not let `.untracked/design-system` remain the only source for production-critical tokens or components.
- Do not make recruiter V2 the first proving ground.
- Do not expose candidate-facing numeric scores, pass/fail language, ranking, or hiring-decision claims.

## First Implementation Plan

The historical first implementation plan is preserved at:

- [Parallel V2 Rebuild Implementation Plan](../reference-archive/candidate-interim/planning/2026-07-06-parallel-v2-rebuild.md)

Current sequencing lives in [HANDOFF](../HANDOFF.md).
