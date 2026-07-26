# Question Generation And Follow-Up Launch Milestone Runbook

Status: Passed local milestone validation
Last updated: 2026-07-18

## Purpose

This runbook validates the integrated Slice 134-138 lifecycle: candidate-owned setup, exact question wording persistence, request-safe setup creation, direct one-question or fixed-set intent creation, the ready landing, one-use intent-to-session launch, recovery, and role-scoped dashboard return.

It is a durability and journey-continuity gate. It is not a model-quality comparison, final UI acceptance, invited-flow test, media/TTS test, or production host-launch acceptance.

## Automated Gate

With the local disposable Postgres container running:

```powershell
npm run test:candidate:question-follow-up-milestone
npm run db:smoke-candidate-question-follow-up-milestone
npm run typecheck
```

The database command applies the current migration stack, runs rollback-only ownership/replay/concurrency smokes, seeds the local candidates, and performs the rolled-back question-wording reconciliation. It makes no live provider call.

## Deterministic Browser Configuration

Use deterministic local providers for this milestone so transport/model variability cannot obscure lifecycle behavior. In `.env.local`:

```text
CANDIDATE_HOST_LAUNCH_DEV_MODE=true
CANDIDATE_HOST_LAUNCH_DEV_SECRET=local-only-shared-secret
CANDIDATE_ANSWER_ANALYSIS_PROVIDER=fixture
```

Leave production question-wording and Coach Update provider overrides unset for this pass. Explicit dev host-launch mode selects their deterministic local paths. Keep `GEMINI_API_KEY` server-only if it remains in the file; this protocol does not require it.

Start the app:

```powershell
npm run dev
```

Use a private browser window and begin at:

```text
http://localhost:3000/candidate/dev/launch?candidate=primary&next=/candidate/setup
```

If port 3000 is already occupied, use the port printed by Next in every URL below.

## Case 1: New Prep Context To Dashboard

1. Create a unique role such as `Milestone Validation Specialist 0718` with a short realistic job description.
2. Choose an interview stage and one question so the validation remains short. Resume is optional.
3. Submit setup.
4. Confirm the pre-session landing shows the exact role, stage, count, and resume posture.
5. Start practice, confirm the `Entering practice space` transition, answer the question, view coaching, and finish.

Expected:

- setup creates one session and does not clear the draft until a durable destination is accepted;
- landing, live question, refresh, and completion retain the same generated wording;
- completion returns to `/candidate/dashboard?prep=<opaque-id>`;
- Current Focus and Coach Update use the new prep context.

## Case 2: One-Question Direct Practice And Consumed Replay

1. Open the latest Coach Update and choose **Practice this now**.
2. Confirm the URL is `/candidate/practice/ready/<intent-id>` and the ready landing shows exactly one expected question.
3. Duplicate that ready tab before starting.
4. Start practice in the first tab and note the resulting `/candidate/session/<session-id>`.
5. Start practice from the duplicate ready tab.

Expected:

- both tabs resolve to the same session id; the second start replays the consumed intent rather than creating another round;
- the transition appears only where the session-entry contract calls for it;
- the follow-up session preserves the same question wording and selected prep context.

Complete the one-question round and confirm dashboard return retains the same opaque `prep` context.

## Case 3: Intentional Repractice

From the newly updated Coach Update, choose **Practice this now** again for the available coached question.

Expected:

- this activation reaches a new `/candidate/practice/ready/<intent-id>`;
- starting it creates a new `/candidate/session/<session-id>` rather than replaying the prior completed round;
- question/session attempt lineage increases without overwriting either earlier answer attempt.

The action may target the newest occurrence in the canonical question lineage. It does not need to expose attempt counts in current provisional UI.

## Case 4: Fixed-Set Action When Eligible

This case is not an active-round resume test. It applies only when the selected prep context has no active round and the Coach Plan exposes **Finish planned practice** for a fixed set of planned questions that still need evidence. Activate that action when eligible.

Expected:

- one ready landing contains the complete fixed set in order;
- duplicating the ready tab and starting from both tabs resolves to one session as in Case 2;
- **Customize round** remains a separate editable-builder action and the fixed action does not mutate that queue.

If no current prep context exposes this action, record the case as not exercisable from the current fixture. The focused route/component tests and multi-item database smokes remain the deterministic acceptance evidence; do not manufacture historical candidate state only to expose the provisional card.

An active **Resume round** action follows a different recovery contract. A session that has not entered live practice still renders its existing pre-session landing. Once live practice has started, resume returns directly to the saved question and draft; it must not create a new intent, session, or redundant landing gate.

## Not A Manual Browser Requirement

Do not use DevTools offline timing to simulate response loss. It cannot reliably prove whether the server committed before the browser disconnected. Automated route and multi-connection database tests prove same-key replay, changed-fingerprint conflict, atomic rollback, cross-candidate isolation, refresh-retained client keys, and one created intent under concurrency.

## Evidence To Return

Report:

- Case 1 dashboard URL and whether all expected transitions occurred;
- Case 2 intent URL plus the session ids reached from both tabs;
- Case 3 new intent and session ids;
- whether Case 4 was available, and its intent/session ids if run;
- any unexpected status code, UI message, stale context, duplicated session, wording change, or missing transition.

Do not send answer text, resume text, job-description text, provider prompts, API keys, cookies, or launch tokens.

## Milestone Result

Local browser acceptance passed on 2026-07-18. New-context setup, exact landing/session wording, completion return with opaque prep selection, duplicate-tab consumed-intent replay, and intentional one-question repractice all behaved as specified. The supplied opaque prep, intent, and session ids reconciled to one candidate-owned prep context; both direct intents were consumed by the exact reported one-question sessions, and the later activation created a distinct session rather than replaying the completed one.

The fixture did not expose **Finish planned practice**, so Case 4 was not manually exercisable. This was expected because its visible unfinished work was an active-round recovery state, not unanswered coverage eligible for a newly assembled fixed set. Focused component/route tests, transaction smokes, and eight-connection concurrency remain the acceptance evidence for the fixed-set boundary.
