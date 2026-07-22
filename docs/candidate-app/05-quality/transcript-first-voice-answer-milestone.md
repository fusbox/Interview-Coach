# Transcript-First Voice Answer Milestone

Date: 2026-07-21
Status: Accepted for commit; conditional for release
Base: `bbf2508`
Scope: Slices 165-171

## Scope

This milestone adds one transcript-first voice-answer lifecycle shared by candidate-led and invited practice:

- explicit browser recording with truthful WebM/Opus and MP4/AAC capture;
- audience-owned, metadata-only transcription runs and recoverable transcript drafts;
- bounded idempotent transcription claims with replay, conflict, stale-work recovery, and generation limits;
- low-friction Submit Answer, Retry, and optional Review/edit paths;
- same-audience source-linked immutable voice answer attempts;
- the existing evidence-first evaluator with `voiceMarkers: null` and no delivery coaching;
- durable answer-mode recovery without stale transcript resurfacing; and
- shared composer ownership from permission request through Review and submission.

Raw audio persistence, delivery-marker extraction, photo answers, resume OCR, provider-governance approval, and deployed-environment acceptance are outside this milestone.

## Prior-Version Disposition

- **Preserve:** explicit Type/Record choice, record/stop/retry, optional local playback, complete typed fallback, transcript-as-answer behavior, and no durable application-owned raw audio.
- **Reinterpret:** use one dedicated recoverable transcription command before immutable answer append; share browser and orchestration code while keeping candidate and invited ownership adapters separate; make transcript review optional rather than mandatory.
- **Retire:** browser speech recognition as transcript authority, effect-driven microphone warmup, base64 audio inside evaluator requests, coupled transcription/evaluation, and scripted browser closing.
- **Defer:** speaking-mechanics evidence, streaming captions, cross-device untranscribed-audio recovery, persistent audio replay, broader language profiles, and photo answers.

## Audit Findings

### Fix Before Milestone

None remain.

Integrated browser validation exposed and drove correction of four cross-slice defects before acceptance:

- PostgreSQL authorization compared a JSON text source id to a UUID parameter without an explicit text cast, blocking immutable answer append;
- the selected Type/Record mode did not recover durably;
- a transcript already resolved by a submitted answer could resurface as a new draft; and
- answer-mode switching could displace unresolved local or reviewed voice work.

The final implementation separates composer ownership from unsafe-local-work warnings. Type/Record switching remains locked from permission request through recording, transcription, Review, and submission. Exit warnings remain narrower and appear only while unsaved local audio could be lost. Terminal transcription failure releases the composer into explicit retry or typed fallback.

### Accepted Deferrals

- Organizational approval of Google-side audio processing, retention, service terms, and production credentials remains a release gate.
- Deployed desktop/mobile browser, network, request-size, timeout, telemetry, and alert evidence remains a release gate.
- The first release evaluates transcript content only. Delivery coaching requires a separate versioned marker producer with provenance, confidence, privacy, and persistence rules.
- Raw audio remains transient. Later playback or cross-device recovery would require a new storage, retention, authorization, disclosure, and deletion contract.

## Verification

All current automated checks passed on 2026-07-21:

- `npm run test:voice-transcription-seam`: 22 files, 164 tests;
- `npm run test:candidate`: 97 files, 651 tests;
- `npm run test:recruiter-invites`: 56 files, 194 tests;
- `npm run typecheck`;
- `npm run lint` with zero warnings or errors;
- `npm run build` optimized production build;
- `npm run db:smoke-voice-transcription-claims`, including repeat migration apply, schema smoke, concurrent ownership, replay, conflict, and stale-generation recovery;
- `git diff --check`.

Earlier fresh-database validation applied the complete migration chain through `031_voice_transcription_claims.sql`. Rollback-only real-database checks also proved candidate and invited source authorization, immutable answer append, claim concurrency, and response-loss replay.

Credentialed Developer API evidence remains:

- WebM/Opus artifact `live_voice_transcription_1227b91ff0b2dbcb`: exact transcript in 1,806 ms;
- MP4/AAC artifact `live_voice_transcription_ae16cedb13704b2a`: exact transcript in 1,752 ms;
- accepted configuration fingerprint `9ce44b0bab357bed36b838e2d7f3788837175e22a4c201b9bc3e439d60ad8b22`.

User browser acceptance confirmed:

- invited active-round and whole-round practice-again journeys through recording, transcription, Review/edit, Retry, feedback, completion, summary recovery, typed fallback, and reload recovery;
- candidate-led parity through the same shared experience and role-scoped dashboard completion; and
- Type/Record remaining disabled after Stop and Review until the unresolved voice answer is submitted or retried.

## Verdict

**Ready for commit. Conditional for release.**

The milestone is internally coherent, ownership-safe, retryable, and locally demonstration-ready. It is not release-ready until provider governance and deployed-environment gates are satisfied.
