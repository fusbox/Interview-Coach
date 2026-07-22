# ADR-0011: Transcript-First Voice Answers

Date: 2026-07-20
Status: Accepted

## Context

V0.5 and V1 recorded browser audio while using browser speech recognition for interim transcript text, then sent base64 audio directly to a provider operation that both transcribed and evaluated the answer. The answer could be accepted before a durable transcript existed, while raw audio remained only in browser memory. A provider or process failure after acceptance could therefore leave an unrecoverable voice answer. Browser speech recognition also varied by browser and provider transcription could alter wording while acting as evaluator input.

V2 already treats one immutable answer attempt as the evaluator unit, requires nonblank answer text, retains typed practice as a complete path, and separates candidate-led from invited ownership. Voice must fit those invariants rather than reopen the prior coupling.

## Decision

V2 voice answers use the [Voice Answer And Transcription Contract](../04-architecture/voice-answer-transcription-contract.md).

- Browser audio is transient input to a dedicated, audience-owned transcription operation.
- The application does not persist raw audio.
- Stopping recording presents primary **Submit Answer**, secondary **Retry**, and contrasting secondary **Review**.
- **Submit Answer** authorizes transcription followed by automatic immutable submission without a required review step.
- **Review** transcribes into a recoverable confirmation draft where playback and optional correction remain available before explicit submission.
- Submission through either path appends one immutable `voice` answer attempt linked to its completed transcription run.
- The evidence-first evaluator receives only the candidate-authorized submitted transcript and canonical answer mode.
- The first release supplies no voice markers and therefore no delivery coaching.
- Candidate-led and invited flows share domain/browser behavior but retain separate ownership routes and persistence adapters.
- Typed practice remains available through every permission, capture, transcription, and provider failure.
- Browser capture sends the recorder's truthful audio MIME type. WebM/MP4 admission is profile-specific and credentialed-live tested; V2 does not disguise audio containers as video or add default transcoding.

## Consequences

- Separate candidate-led and invited transcription-run tables, repositories, and source lineage are required.
- Transcription has its own provider profile, configuration fingerprint, idempotency key, claim/lease, failure taxonomy, observability, and credentialed gate.
- Browser speech recognition, effect-driven microphone warm-up, base64 JSON transport, direct audio evaluation, and voice submission without a durable transcript are retired. Explicit gesture-triggered microphone preparation remains allowed.
- Refresh can recover a completed transcript draft but cannot recover raw audio that had not completed transcription.
- Quick submit deliberately trades mandatory transcript confirmation for lower friction. It still commits a recoverable transcript before immutable answer creation, records the submission path, and offers Review as the correction path.
- Provider-side audio handling still requires organizational approval even though the app does not retain raw audio.
- Recording controls remain absent unless the exact accepted runtime tuple is available. Production release additionally requires provider-processing approval, deployed browser evidence, and operational acceptance.
- Photo answers, resume OCR, and voice-delivery marker extraction remain separate decisions.
