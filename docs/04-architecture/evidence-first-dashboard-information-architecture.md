# Evidence-First Dashboard Information Architecture

Status: Ratified
Date: 2026-07-14

## Purpose

The candidate dashboard is the home base between practice activities. It should make the learning loop legible:

1. orient to one interview-preparation context;
2. resume unfinished practice when it exists;
3. understand what the coach learned from the latest completed practice;
4. relate that feedback to the broader Coach Plan;
5. choose and launch the next useful practice.

The dashboard is not an analytics report, a readiness score, or a second evaluator. Persisted practice and evaluator facts remain the evidence source. Dashboard claims are derived from those facts, except for versioned coaching artifacts whose exact candidate-facing wording must remain stable.

## Prior-Behavior Disposition

| V1 or scaffold behavior | Disposition | V2 direction |
| --- | --- | --- |
| Role-context switcher | Preserve and harden | Select an opaque candidate-owned prep-context id. Role title is display text only. |
| Normalized role title as dashboard identity | Retire | Same-title preparation contexts must remain distinct. |
| Coach Update as the post-practice learning entry | Preserve and reinterpret | Show a synthesized review of the latest settled question, distinct from immediate in-session feedback. |
| Question-first evidence review | Preserve | Each Coach Update checkpoint contains the exact settled question and accepted evidence that produced it. |
| Unanswered questions inside Coach Update | Retire | Unanswered plan coverage belongs to Coach Plan and Practice Next. |
| Coach Plan as a stable reference | Preserve and reinterpret | Keep plan coverage, category teaching, question set, broader guidance, and transparent highest-earned question progress available without score-driven mastery claims. |
| Candidate-managed next-round queue | Preserve and harden | Replace dashboard-local state with a durable editable draft scoped to one prep context. |
| Local queue as session-launch truth | Retire | Snapshot validated queue items into an immutable practice intent at launch. |
| One-question and coach-bundle fast paths | Preserve | Create immutable practice intents directly when editing is unnecessary. |
| Preparedness matrix, hidden score rollups, and analytics-first hero metrics | Retire from the primary surface | Keep only evidence-safe derived reads that help the candidate understand progress or choose an action. |
| Duplicate always-open Coach Update and latest-round review surfaces | Retire | Use one Coach Update entry with one detail experience. |

## Identity Invariant

Every preparation context has an opaque durable id, currently `role_profile_id`. Candidate/session/dashboard/queue/intent reads must prove both candidate ownership and prep-context identity.

Role title, normalized role title, job description text, and URL metadata are not preparation-context identity. The same candidate may prepare for multiple jobs with the same title. A canonical dashboard URL may carry an opaque prep-context id for refresh recovery and deep linking, but the server must resolve it through current candidate ownership before returning facts.

V1 had unique prep records available but still grouped dashboard rows through a normalized role title. V2 explicitly supersedes that shortcut.

## Stable Shell And State Priority

The final composition should keep these stable concepts available for the selected prep context:

- prep-context identity and switcher;
- active-round status;
- Coach Update;
- Practice Next;
- Coach Plan reference;
- prior practice/history as secondary detail.

The shell changes emphasis without changing the meaning of its regions:

1. If an unfinished round exists, resuming it is the primary action.
2. After a newly settled question, Coach Update receives the strongest review emphasis and a noncritical `New` treatment.
3. After the candidate opens the update, its content remains available while Practice Next can take stronger action emphasis.
4. Without a new update or active round, Practice Next is primary.
5. Without a valid prep context, the candidate enters new-context setup rather than receiving mixed-role or fabricated dashboard claims.

Opening Coach Update is not currently a durable product fact. The first `New` treatment may compare the latest update fingerprint with browser-held seen state. It may reappear on another device without affecting correctness. Add durable cross-device review state only if notification semantics, engagement analytics, or another product requirement justifies it.

The selector must not silently lose an older profile-backed prep context behind a recent-session window. Until a deliberate summary projection exists, cross-role inventory and the selected context derive from complete candidate-owned session history. Query pressure or hydration cost should trigger a versioned projection with explicit invalidation, not a correctness-reducing cap.

## Feedback Boundaries

### In-Session Feedback

In-session feedback is immediate question-level evaluation and coaching. It helps the candidate understand the answer they just gave and choose whether to retry, continue, finish, or pause.

### Coach Update

Coach Update is a settled-question synthesis. It explains what the latest successfully persisted answer and accepted evaluation add to the coach's understanding and what that means for the candidate's next decision. It is not a replay of every in-session card, and it does not wait for the session to end.

Coach Update receives a code-owned framing for the exact accepted answer checkpoint. It does not recalculate answer quality, count criterion bands, or stack several observations into a different valence. A `move_on` answer remains complete and is represented through a grounded example of the response pattern that worked. A `polish` answer may receive one optional refinement without being recast as deficient. A `remediate` answer carries the accepted improvement focus.

The source set is the one question settled by the checkpoint. It may refer naturally to the coaching already given while adding cross-attempt or plan context. Later checkpoints create new immutable items rather than replacing prior question history.

The synthesis may include:

- a concise round-level reflection;
- evidence-supported strengths or effort acknowledgement;
- one primary focus or next useful move;
- question-first detail links;
- a progression, stability, or unresolved-evidence observation when a comparable prior attempt exists.

Repeat-practice comparisons must match the same prep context and source plan question. They must be evidence-specific. Repetition is evidence of effort, not automatic improvement. A weaker or missing signal is not regression unless the evaluator contract supports a comparable, candidate-safe claim. Insufficient comparison evidence produces a neutral observation.

The exact generated Coach Update should be stored as a versioned operational coaching artifact tied to its source session, canonical question, exact answer attempt, accepted evaluator run, input fingerprint, prompt/evaluator versions, and creation time. This preserves stable replay and QA lineage without turning the artifact into durable preparedness truth. A later settled question may supersede which update is primary without deleting older source-linked artifacts.

### Coach Update Synthesis Runtime

The provider boundary receives one bounded, versioned synthesis request assembled from accepted candidate-safe coaching facts. It may receive the target role, practiced question text and category, response mode, accepted coaching projection, and a bounded set of comparable prior accepted projections. It must not receive current or prior raw answer text, candidate identity, launch/session credentials, recruiter data, database ownership ids, raw evaluator output, hidden evaluator plans, or any identifier that code can reattach after generation.

The provider writes synthesis language only: a round title, summary, primary focus, and one comparison message per practiced question. Code owns and attaches the output status and input fingerprint, plus question order, answer/source identity, accepted coaching fields, per-question completion posture, round-primary posture, comparison kind/count, and final artifact hydration. Coach Update preserves the immutable practice-round item order rather than sorting by question number, while each visible `Q#` resolves through server-owned follow-up provenance to the question's canonical full-Plan position. Provider language output must match an exact schema, preserve question order and cardinality, honor the supplied framing without recomputing valence, and pass fingerprint-envelope, score/rank, and safety-language checks before code can create candidate-safe content. Raw provider output and assembled prompts are not persisted or emitted to normal telemetry.

One durable artifact claim owns a 12-second aggregate runtime budget. The normal path makes one provider transport attempt. Deterministic candidate-language rejection may make one code-directed rewrite attempt inside that same claim and budget; rejected prose is neither retained nor supplied back to the provider, and the rewrite must pass the identical validation boundary. Timeout, rate limit, provider failure, malformed output, or a second language rejection moves that artifact attempt to a classified terminal state; a later explicit completion replay or repair pass may claim a new generation attempt against the same unchanged source fingerprint. The existing 120-second claim lease recovers work abandoned before a terminal transition. A provider result arriving after the runtime timeout has no repository capability and therefore cannot complete or overwrite an artifact.

Operational telemetry is metadata-only: provider/profile/model/prompt/evaluator versions, safe configuration and synthesis fingerprints, outcome/error code, elapsed time, transport-attempt count, and optional token counts. Development fault injection is server-controlled and available only in explicit local dev mode. It is selected through an allowlisted environment value, never a request/query parameter, and must be disabled by construction in preview and production.

The first serving profile is bound to a code-owned configuration manifest covering the model, prompt/evaluator/request/output versions, exact system-instruction and response-schema fingerprints, timeout, and generation settings. Credentialed validation has two intentionally separate proofs: one fixed synthetic provider gate that inspects but does not retain the request, and one disposable-DB completion/artifact/replay/dashboard reconciliation. The provider gate cannot prove ownership or persistence; the application reconciliation cannot by itself prove request minimization because candidate-owned Coach Update detail legitimately persists the candidate transcript. Both must pass, and human review must reject synthesis language that is structurally valid but unsupported, misleading about progression, or not useful enough to serve.

### Coach Plan And Practice Next

Unanswered planned questions are missing coverage, not feedback and not poor performance. They belong to Coach Plan and Practice Next. Feedback-driven practice and unfinished plan coverage can both be visible, but their sources and meanings remain distinct.

Follow-up rounds carry two identities that must stay separate. The exact source-session id plus round-local question key remains the action pointer for retrying the practiced occurrence. Plan joins, visible `Q#` references, preparedness, and answer-review placement use the resolved canonical root session plus root question key. A reused local key such as `slot-1` cannot join Coach Update evidence to Coach Plan by itself.

Practice Next uses an explicit plan-aware policy instead of incidental array order. Across eligible coached questions it ranks the latest attempt posture in this order: incomplete, Emerging, Clear, Strong, then evaluation unavailable. Canonical Plan order is the deterministic tie-break. During first-pass completion, unanswered canonical coverage outranks repeat practice and all practice entry points resolve into the original canonical session.

## Editable Queue And Immutable Launch

The candidate may assemble a custom next round from Coach Update, Coach Plan, missing coverage, or other eligible questions. Editable selection state and executable launch state are separate boundaries.

### Durable Queue Draft

The persistence target is one candidate-owned queue draft per prep context plus normalized item rows. Each item should preserve a stable plan-question/source pointer, practice reason, provenance, display order, and timestamps. A version or equivalent optimistic concurrency value prevents silent cross-tab or cross-device overwrites.

Normalized rows are preferred for the mutable queue because the app must add, remove, reorder, deduplicate, query, and reconcile individual items. JSONB remains appropriate for the later immutable intent snapshot.

### Launch Rules

- `Practice this now` creates a one-item immutable practice intent directly.
- A fixed `Practice this bundle` action may create a multi-item immutable intent directly.
- `Customize round` opens the selected-context builder; a future trusted coach-bundle producer may seed or merge eligible bundle items into that draft.
- `Add to next round` mutates the selected prep context's queue draft.
- `Start practice` validates and snapshots the current queue draft into `candidate_practice_intents`.
- Snapshot creation and queue clearing/linking occur atomically.
- The ready intent remains recoverable if navigation or session creation fails.
- Session creation consumes the intent idempotently and preserves exact item, source, prep-context, and attempt lineage.

Direct one-question and fixed-set creation actions claim activation immediately in the client and use a candidate-owned request key plus exact server-resolved snapshot fingerprint. Exact concurrent or response-lost replay recovers one immutable intent, changed content under the same key conflicts before mutation, and a new key preserves intentional repractice. Builder launch remains a separate atomic boundary using the draft id and version.

The interaction language is shared across Practice Next, Coach Update, and Coach Plan. Immediate actions never mutate the builder. Queue toggles never create a session or navigate away. Fixed-set actions never silently merge with the candidate's editable draft. Builder counts and per-question queued state come from the same authoritative draft model, and a surface with no server-resolved eligible choice does not invent a local queued state. The `coach_bundle` source remains an executable persistence contract, but candidate-facing coach bundles require a separate trusted recommendation producer and are not fabricated by the dashboard.

The mutable queue must never be used later to explain what an existing session contained. Historical session meaning comes from the immutable intent and session snapshots.

## Source And Claim Matrix

| Surface or claim | Authoritative source | Allowed interpretation | Prohibited shortcut |
| --- | --- | --- | --- |
| Selected prep context | Candidate-owned `role_profile_id` | Display role/stage/job hints after ownership resolution | Normalized role title as identity |
| Active round | Candidate-owned unfinished practice session | Resume state and remaining item count | Cross-role latest-session fallback after explicit selection |
| Coach Update | Settled question checkpoint, immutable attempt, accepted evaluator run, versioned synthesis artifact | Latest-practice reflection and evidence-specific comparison | Unanswered plan items, hidden scores, or unvalidated model prose |
| Coach Update `New` emphasis | Latest update fingerprint plus noncritical seen state | Presentation emphasis only | Treating opened state as learning evidence |
| Coach Plan coverage | Prep-context plan and practiced source-question lineage | Practiced versus unpracticed coverage | Treating unanswered questions as weak answers |
| Practice from feedback | Accepted candidate-safe coaching tied to a practiced answer attempt | Focused retry or follow-up practice | Deriving from raw provider output or legacy score |
| Plan progress | Active round or unpracticed plan questions | Finish planned coverage | Mixing unrelated prep contexts |
| Queue draft | Candidate-owned prep-context queue and item rows | Editable future-round selection | Using it as historical session truth |
| Ready round | Immutable candidate-owned practice intent | Exact launch snapshot | Editing after launch or trusting query copy |
| Attempt movement | Same prep context and source question with comparable accepted evidence | Specific progress, stability, or unresolved need | Global readiness, automatic improvement, or score delta copy |

## Failure And Recovery Rules

- Invalid or unauthorized prep-context ids fail closed and must not fall back to another context while preserving the invalid selection as if it succeeded.
- Coach Update generation failure must not erase the settled answer, accepted evaluation, feedback action, canonical cursor, or in-session feedback. The dashboard may show a truthful pending or unavailable update state and retry synthesis against the same fixed question-checkpoint fingerprint.
- A pending Coach Update may trigger only a bounded, backoff-based dashboard refresh keyed to its exact durable request identity. Polling remains read-only, stops when lifecycle state changes, and reaches the existing 120-second claim lease once before exhaustion; it never invokes repair or synthesis. At or beyond that lease, the read model projects an abandoned request as candidate-safe `unavailable`, enabling the existing explicit repair mutation against the unchanged source fingerprint. A request still pending after the bounded schedule yields to candidate-invoked status refresh instead of perpetual polling.
- A late or duplicate synthesis result cannot replace a newer source-session update.
- Queue mutations validate candidate ownership, prep context, eligible source question, and current version.
- Concurrent queue edits return a conflict or merge-safe response instead of silently dropping selections.
- Intent snapshot retries are idempotent. A ready intent is recoverable after navigation failure, and a consumed intent resolves to its existing session.
- No answer text, coach prose, job description, resume text, or score-like value belongs in dashboard or practice-intent query parameters.

## Implementation Runway

1. Landed: opaque prep-context identity is authoritative from setup/profile resolution through sessions, intents, dashboard reads, and canonical navigation. Historical null-profile records retain a bounded compatibility path.
2. Define and persist the versioned settled-question Coach Update artifact, including exact attempt/evaluation identity, same-question comparison inputs, and stale-result rejection.
3. Remove unpracticed questions from Coach Update detail and keep them in Coach Plan/Practice Next reads.
4. Landed: durable queue-draft and normalized item persistence with ownership, versioning, ordering, deduplication, capacity, and source-pointer validation.
5. Landed: atomic queue-to-intent snapshot creation, item clearing/version advance, immutable assembly lineage, duplicate-launch replay, and ready/consumed intent recovery.
6. Replace the scaffold dashboard with the stable shell and state-priority composition.
7. Shape Coach Update detail, Coach Plan reference, practice builder, and Practice Next interactions over the stable contracts.
