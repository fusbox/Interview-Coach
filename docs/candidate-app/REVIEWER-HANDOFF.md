# Candidate V2 Reviewer Handoff

Date: 2026-07-21
Status: Cleanroom rebuild reviewer quick start; not a release or merge approval

## Purpose

This is the short path for a teammate who needs the current candidate V2 branch running, wants to exercise the candidate-owned practice loop, or needs to inspect the evaluator milestone. The canonical product, data, and execution truth remains in [SPEC](./SPEC.md), [DATA_CONTRACT](./DATA_CONTRACT.md), and [HANDOFF](./HANDOFF.md).

## Branch And Scope

```powershell
git fetch fusbox feature/candidate-v2-rebuild
git switch feature/candidate-v2-rebuild
git pull --ff-only fusbox feature/candidate-v2-rebuild
```

Current development pushes this branch to `fusbox` only. Do not infer Azure merge, deployment, pilot, or production readiness from this handoff. V1-created app data has no V2 migration or runtime compatibility requirement.

## Local Setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Put the local launch controls in `.env.local`:

   ```text
   CANDIDATE_HOST_LAUNCH_DEV_MODE=true
   CANDIDATE_HOST_LAUNCH_DEV_SECRET=local-only-shared-secret
   ```

3. Choose one answer-analysis provider:

   ```text
   CANDIDATE_ANSWER_ANALYSIS_PROVIDER=fixture
   ```

   For the deliberately credentialed Gemini path, follow [Local Dev Bootstrap](./09-dev/local-dev-bootstrap.md) and the [Live Evaluator Validation Runbook](./05-quality/live-evaluator-validation-runbook.md). Never commit `.env.local` or expose provider credentials through `NEXT_PUBLIC_*` variables.

4. Prepare the disposable database and start the app:

   ```powershell
   npm run db:setup
   npm run db:smoke-candidate-readiness
   npm run dev
   ```

5. Launch the primary candidate:

   ```text
   http://localhost:3000/candidate/dev/launch?candidate=primary&next=/candidate/setup
   ```

   Use `candidate=alternate` to validate ownership isolation with the alternate fixture identity.

## Automated Validation

Default candidate checks:

```powershell
npm run test:candidate
npm run test:candidate:question-audio
npm run test:candidate:evaluator-configuration
npm run test:candidate:coach-update
npm run test:candidate:next-round
npm run typecheck
npm run lint
```

The integrated chain is:

```powershell
npm run ci:candidate:with-db
```

That adds the production build, DB readiness chain, and seeded browser smoke. Do not run `next build` against the same `.next` directory while a dev server is active.

## Manual Candidate Journey

1. Launch the primary candidate and create a new prep context under `/candidate/setup`.
2. Confirm the pre-session landing and `Entering practice space` transition before the live session.
3. Submit an answer and confirm feedback or a candidate-safe unavailable/recovery state.
4. Refresh on the answer and feedback surfaces; confirm the exact question, draft, accepted answer, and feedback state recover.
5. Use a feedback-triggered retry and confirm it appends a new answer attempt instead of overwriting the prior attempt.
6. Exit to the dashboard mid-round, resume the active round, and confirm the meaningful session position recovers.
7. Finish the round and confirm return to `/candidate/dashboard?prep=<opaque-role-profile-id>`.
8. Confirm Coach Update, Coach Plan, Practice Next, and active-round content stay scoped to the selected prep context.
9. Launch one-question and multi-question follow-up practice through their ready landing, then confirm attempt/root-question lineage remains intact.

## Evaluator Milestone Evidence

The current candidate-serving baseline is the pinned `google_gemini_2_5_flash_v1` profile under evaluator contract `candidate_evidence_first_v2`, prompt bundle `candidate_evidence_first_prompts_v8`, and fingerprint `69a65121b67ec1b9745d50c6d952409ea4291e4a7d70b6ca423966eb667c980f`. Two independent `candidate_evaluator_golden_v2` artifacts accepted and passed all twelve marker/signal/five-criterion cases; offline comparison found all twelve comparable, and human review accepted both candidate-safe projections for every case. A durable candidate-route run separately proves accepted evaluator persistence plus candidate-safe projection and recovery. Earlier seven-case artifacts are historical evidence, not the current source gate. These are conformance results, not deployment approval.

Review these before changing the evaluator boundary:

- [Evidence-First Evaluator Contract](./05-quality/evidence-first-evaluator-contract.md)
- [Production Evaluator Integration Contract](./05-quality/production-evaluator-integration-contract.md)
- [Live Evaluator Validation Runbook](./05-quality/live-evaluator-validation-runbook.md)
- [Shared Audio And Evaluator Calibration Milestone](./05-quality/shared-audio-evaluator-calibration-milestone.md)
- [Transcript-First Voice Answer Milestone](./05-quality/transcript-first-voice-answer-milestone.md)

Technical correctness remains `not_assessed` when no trusted technical reference is supplied. Coaching should still be composed from other accepted evidence. Local Coach Update synthesis uses its deterministic fixture independently of whether answer analysis uses the fixture or Gemini; a live Coach Update provider is not yet wired.

## Known Non-Release Boundaries

- The IC-side TA launch verifier, exchange, bounded MSSQL identity/job lookup, and app session are implemented; real TA staging token/network/secret-rotation acceptance is still external. RW remains disabled.
- Production question wording, answer evaluation, Coach Update persistence/synthesis, candidate/invited typed practice, question TTS, and the standalone recruiter/invitation flow are locally functional. Answer recording/transcription has a ratified [transcript-first architecture](./04-architecture/voice-answer-transcription-contract.md), locally validated audience-separated persistence/routes, truthful WebM/MP4 Developer API acceptance, shared recording/review UI, immutable source-linked voice attempts, and evaluator integration with `voiceMarkers: null`. Provider-side audio processing/retention approval and deployed desktop/mobile evidence remain release gates. Trusted technical-reference retrieval remains incomplete. Resume ingestion has a ratified all-source processed-text/PII/disposal contract; Slices 173-175 implement pasted/trusted-host text processing, bounded PDF/DOCX extraction, ordered photo OCR, candidate-owned review, explicit acceptance, and exact setup resolution. Trusted-host lookup, unfinished-review cross-device recovery, complete accepted-artifact presentation, and deployed parser/OCR controls and evidence remain open.
- A second evaluator comparison profile, reviewer workflow, explicit serving-profile promotion/rollback operations, and deployed evaluator observability remain pending.
- Question TTS uses a preview Gemini model and browser-local play-once memory. It is optional and text-first; organizational approval and deployed desktop/mobile evidence remain release gates.
- Deployed telemetry/alerts, manual accessibility, real-host and deployed SMTP/network acceptance, dependency-risk disposition, and organizational approvals remain release work.
