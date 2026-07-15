# ADR-0010: Evidence-First Dashboard And Practice Assembly

Date: 2026-07-14
Status: Accepted

## Context

ADR-0008 established Coach Plan as the candidate dashboard home base, but it predated the clean V2 evaluator, immutable answer-attempt lineage, executable follow-up intents, and the rebuild's stronger identity and evidence boundaries. V1 and the first V2 dashboard scaffold also grouped preparation contexts by normalized role title, duplicated post-round review surfaces, mixed unanswered plan questions into Coach Update detail, and treated the next-round queue as local UI state.

The candidate experience requires a stable practice loop without turning dashboard interpretations into a second source of truth.

## Decision

The dashboard will follow the ratified [Evidence-First Dashboard Information Architecture](../04-architecture/evidence-first-dashboard-information-architecture.md).

In particular:

- an opaque candidate-owned prep-context id is authoritative; role title is display text only;
- immediate in-session feedback and synthesized post-session Coach Update are distinct contracts;
- Coach Update includes only practiced questions from its source session;
- unanswered plan coverage remains in Coach Plan and Practice Next;
- repeat-practice observations compare accepted evidence for the same prep context and source question without inferring improvement from repetition or hidden scores;
- the exact Coach Update is a versioned, source-linked coaching artifact, while opened/seen state is noncritical presentation state unless later requirements justify durable tracking;
- a mutable candidate queue is a durable prep-context draft with normalized items;
- launching a custom round atomically snapshots the queue into an immutable practice intent;
- one-question fast paths and fixed coach bundles may create immutable intents directly, but every newly assembled follow-up round still passes through the durable pre-session landing before live practice;
- the final dashboard uses one stable shell whose regions change emphasis according to active-round, new-update, and next-practice state.

## Relationship To ADR-0008

This ADR supersedes ADR-0008 where that decision relies on score-driven aggregate preparedness, title-based context grouping, or a Coach Update that acts as a general debrief container. It preserves Coach Plan as the stable teaching/reference object, qualitative evidence-first progress, question-first review, and flexible Practice Next behavior.

## Consequences

- Existing V2 `candidate_practice_intents` remain the immutable launch boundary, not an editable queue.
- New persistence is required for prep-context queue drafts/items and source-linked Coach Update artifacts.
- New sessions and intents carry authoritative `role_profile_id`, and canonical dashboard/follow-up reads use candidate-owned opaque identity. Historical null-profile records retain an isolated compatibility path and cannot select or merge profile-backed contexts.
- Dashboard read models must stop including skipped/unanswered questions in Coach Update detail.
- The final UI should not be implemented ahead of the identity, synthesis, queue, and source/claim contracts it depends on.
- Durable Coach Update artifacts support stable replay and QA, but do not become permanent preparedness conclusions.
