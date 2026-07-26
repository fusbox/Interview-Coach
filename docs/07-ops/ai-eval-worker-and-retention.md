# AI-Eval Worker And Retention Operations

Status: Implemented local Slice 188 contract; deployment evidence remains open
Last updated: 2026-07-24

## Purpose

The AI-eval scenario workbench queues durable synthetic QA runs. Browser routes may submit and inspect those runs, but they must never own provider execution, lease recovery, or retention deletion. This contract production-shapes the existing worker and 30-day run expiry without changing evaluator behavior or candidate-serving output.

The implementation is environment-neutral. A container, VM service, or other process supervisor may host it later as long as the runtime and database boundaries below remain intact.

## Worker Boundary

The service worker:

- requires an explicit database connection outside the bounded local one-shot mode;
- validates process policy and, for credentialed execution, the existing provider/cost/call gate before claiming work;
- processes one durable run at a time while retaining the accepted per-run case concurrency policy;
- polls with bounded delay instead of busy-looping or exiting merely because the queue is temporarily empty;
- renews the existing generation-fenced run claim while provider work is active;
- stops claiming new work after `SIGINT` or `SIGTERM`, marks itself unready, lets the current durable run reach its existing checkpoint/finalization boundary, and then closes database and health resources;
- exposes metadata-only liveness/readiness facts when a health port is configured;
- emits structured metadata events containing lifecycle, run id, counts, durations, and safe error codes, never scenario text, answers, prompts, model raw output, credentials, or candidate data.

Bounded environment controls:

| Variable | Default | Bounds / meaning |
| --- | --- | --- |
| `AI_EVAL_SCENARIO_WORKER_POLL_INTERVAL_MS` | `2000` | `250-60000`; idle polling delay |
| `AI_EVAL_SCENARIO_WORKER_ERROR_BACKOFF_MS` | `5000` | `1000-300000`; delay after a poll/job failure |
| `AI_EVAL_SCENARIO_WORKER_MAX_CONSECUTIVE_ERRORS` | `5` | `1-100`; readiness becomes false at this threshold and recovers after a successful poll |
| `AI_EVAL_SCENARIO_WORKER_HEALTH_PORT` | unset | Optional `1024-65535` HTTP port for `/healthz` and `/readyz` |
| `AI_EVAL_SCENARIO_WORKER_HEALTH_HOST` | `0.0.0.0` | Bind host for the optional metadata-only health server |
| `AI_EVAL_SCENARIO_WORKER_ID` | generated | Optional stable deployment instance id; no identity or secret content |

`/healthz` reports whether the process loop is alive. `/readyz` reports whether configuration and database startup checks passed, shutdown has not begun, and the consecutive-error threshold has not been reached. Neither endpoint queries or returns scenario content.

Local and deployed process supervisors invoke:

```powershell
npm run qa:ai-eval:scenario-worker:service
```

This entrypoint is intentionally a long-running credentialed worker. It requires an explicit `DATABASE_URL`, the existing accepted live-provider configuration, and the explicit live-run confirmation already enforced by the one-shot worker.
Database connection and query waits are bounded so an unreachable database causes process failure or readiness degradation instead of an indefinite startup or poll hang.

## Retention Boundary

Scenario runs carry an immutable `retention_expires_at` timestamp. Expiry makes a terminal run eligible for cleanup; it does not itself delete data.

The cleanup command:

- defaults to dry-run and requires explicit `--apply` for deletion;
- requires an explicit database connection and a maintenance-capable database role;
- uses an idempotency key and input fingerprint;
- accepts a cutoff no later than the database clock and a batch limit of `1-500`;
- selects only `completed`, `failed`, or `cancelled_before_start` runs whose retention deadline has passed;
- excludes queued, partial, running, claimed, or otherwise active runs;
- serializes apply operations with a transaction advisory lock and row locks;
- deletes the run and its case, layer, and live-operation children atomically;
- leaves immutable scenario versions and suites intact because runs reference reusable synthetic inputs;
- writes a durable metadata-only operation record with selected/deleted child counts and remaining expired-run count;
- preserves ordinary direct-delete rejection. Trigger bypass is permitted only inside the owner-executed cleanup function, and public execution is revoked.

Deployment must grant only `EXECUTE` on the cleanup function to a dedicated maintenance role. The web application role must not own the function, hold table-delete privileges for this purpose, or receive the maintenance connection string.

Operator commands:

```powershell
# Preview one bounded batch. No deletion occurs.
npm run qa:ai-eval:retention

# Apply one bounded batch after reviewing the dry-run counts.
npm run qa:ai-eval:retention:apply
```

Both commands require an explicit `DATABASE_URL`. The cutoff defaults to the database clock, the batch defaults to `100`, and the command accepts `--cutoff=<ISO-8601>`, `--batch-limit=<1-500>`, and `--request-key=<uuid>`. The request fingerprint excludes the process instance id so an identical operation may safely retry from a replacement maintenance process; the immutable receipt retains the instance that first completed it.

## Failure And Recovery

- An idle queue is healthy and does not terminate service mode.
- A transient worker error increments a metadata-only consecutive-error count, backs off, and remains recoverable.
- Readiness becomes false at the configured error threshold; a later successful poll resets the count.
- Process loss relies on the existing claim expiry and generation fencing. Completed provider-operation checkpoints remain immutable and are not repeated.
- Cleanup is transactional. A trigger, lock, or delete failure rolls back both deletion and its operation record.
- Replaying an identical cleanup request key returns its prior result. Reusing that key with changed inputs fails closed.
- A shutdown during an idle delay exits promptly. A shutdown during provider work waits for the current run boundary rather than abandoning accepted output or claiming another run.

## Acceptance Evidence

Slice 188 is complete when:

1. service-mode policy, idle polling, error backoff/recovery, readiness, structured events, and graceful shutdown have focused tests;
2. migration and database smoke prove dry-run, apply, idempotent replay, changed-input conflict, batching, active-run exclusion, direct-delete rejection, cascade counts, and durable metadata;
3. the existing AI-eval workbench/evaluator suites, typecheck, lint, and diff checks pass;
4. local evidence is described as production-shaped, not as proof of a deployed supervisor, alert sink, maintenance-role grant, or retention schedule.

Local acceptance evidence:

- `npm run test:ai-eval-workbench`: 101 tests passed;
- `npm run db:smoke-ai-eval-scenario-workspace`: passed migrations `037-041`, the existing scenario lifecycle smoke, and retention dry-run/apply smoke;
- retention smoke proved exact replay, changed-input conflict, batch `2` of `3`, atomic run/case/layer/live-operation deletion, direct-delete rejection, metadata-only receipts, and preservation of active and non-expired runs;
- `npm run typecheck` and `npm run lint`: passed.

## Release Dependencies

- Select and configure the actual process supervisor and restart policy.
- Route structured events and readiness failures to the approved telemetry and alert sink.
- Create separate application, worker, and maintenance database roles with least privilege.
- Schedule cleanup and prove it in the deployed database with a non-production expired fixture.
- Confirm the organizational retention period; changing 30 days requires an explicit policy and migration decision.
