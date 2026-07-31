# Voice Answer And Transcription Contract

Date: 2026-07-20
Status: Ratified and locally accepted through Slice 171; conditional for release

## Purpose

This contract defines the smallest production-safe voice-answer boundary shared by candidate-led and invited practice. It keeps the transcript as the evaluation unit, preserves typed practice as a complete fallback, and separates browser recording, transcription, immutable answer submission, and evaluation into recoverable operations.

Photo answers, resume OCR, question text-to-speech, and voice-delivery analysis are separate capabilities.

## Decision Summary

Voice is a transcript-first lifecycle with a low-friction submit path and an optional review path:

1. After an explicit first-use notice and user gesture, the browser records one bounded audio response.
2. Stopping presents exactly three actions: primary **Submit Answer**, co-secondary **Retry**, and visually contrasting co-secondary **Review**.
3. **Retry** discards the local recording and starts a new recording attempt without creating durable work.
4. **Submit Answer** authorizes transcription and immutable submission as one user command. A dedicated audience-owned transcription operation creates a recoverable transcript first, then automatically appends the source-linked voice answer without requiring another confirmation.
5. **Review** invokes the same transcription operation but stops at a compact transcript confirmation. The candidate may replay the still-local recording, correct the transcript, and then explicitly submit the answer.
6. The existing evidence-first evaluator evaluates the transcript that was submitted through either path. The first voice release supplies no voice markers and therefore produces no delivery coaching.

Raw audio is transient request material. The app does not persist it to Postgres, object storage, answer history, logs, QA artifacts, or ordinary telemetry.

## Prior-Version Disposition

### Preserve

- Explicit text/voice choice rather than hidden automatic capture.
- Record, stop, retry, optional local replay/review, and explicit submission.
- Clear microphone-permission failure and a complete typed fallback.
- Transcript text as the durable answer and downstream evaluation input.
- No durable application-side raw-audio retention; browser memory may retain the recording only through the active pre-submission review interaction.
- Audience-specific disclosure: candidate-led practice remains private; invited submitted transcripts follow the existing recruiter-visibility contract.

### Reinterpret

- Browser recording becomes input to a dedicated server-owned transcription operation rather than direct evaluator input.
- A machine transcript becomes a recoverable draft before immutable submission. The quick path automatically submits it under the candidate's explicit **Submit Answer** authorization; the optional review path pauses for confirmation or correction.
- Candidate-led and invited practice share capture and transcription domain code while retaining separate ownership routes and persistence adapters.

### Retire

- Browser `SpeechRecognition` or `webkitSpeechRecognition` as transcript authority or a submission dependency.
- Effect-driven microphone warm-up merely because the candidate changed modes or the component rendered.
- Base64 audio inside a JSON answer-analysis request.
- One provider call that both transcribes and evaluates.
- Voice submission when no nonblank durable transcript exists.
- Provider rewriting that improves grammar, wording, or content instead of faithfully transcribing it.
- Same-tab raw-audio playback as a promised post-submit or recovery capability.

### Defer

- Delivery coaching, filler-word counts, pause counts, pace estimates, and other voice markers.
- Streaming transcription, live captions, and browser speech-recognition captions.
- Cross-device recovery of an untranscribed recording.
- Raw-audio persistence or replay after answer submission or later recovery.
- Additional language profiles beyond an explicitly supported first profile.
- Photo answers and resume OCR.

## Safety Invariants

- The server proves candidate or invitation ownership, session identity, and exact question slot before accepting audio or calling a provider.
- Browser-supplied transcript provenance, owner ids, session snapshots, question wording, provider ids, and evaluator settings are never trusted.
- Raw audio never enters the answer route or evaluator route.
- An immutable voice answer cannot exist without a nonblank candidate-authorized transcript and a completed, same-audience transcription run for that owner/session/slot.
- The transcription service returns faithful transcript text only. It cannot coach, score, classify answer quality, or silently improve the response.
- Typed practice remains available before, during, and after every recoverable voice failure.
- A transcription failure does not create an answer attempt or evaluator run.
- Delivery claims are absent unless a later trusted extractor supplies accepted, persisted voice markers. Content bands never change because of speaking mechanics.
- Candidate-led transcripts remain candidate-owned. Invited submitted transcripts become recruiter-visible only through the existing narrow latest-answer projection; raw audio, drafts, superseded attempts, coaching, and evaluator output remain excluded.

## Browser State Contract

The shared browser controller owns these explicit states:

```text
text idle
voice notice
permission requesting
recording
recorded locally
transcribing
transcript ready and saved
transcript review
transcription failed
answer submitting
answer accepted
```

State copy must distinguish local recording from saved progress:

- `recording` and `recorded locally` are not recoverable progress;
- transcription may claim recoverability only after the transcript transaction has committed;
- leaving while recording, holding a local recording, or transcribing requires a stay/discard decision and must not claim the answer is saved;
- from microphone permission through recording, local-recording actions, transcription, transcript review, and answer submission, that voice interaction owns the answer composer: Type/Record mode switching is disabled so unresolved voice work cannot be displaced by another input mode; a safe terminal transcription failure releases the composer into its explicit retry or typed-fallback choices;
- a recovered quick-submit transcript continues or clearly offers the already-authorized answer submission without another provider call; a recovered review transcript returns to confirmation;
- after the transcript draft is saved, normal pause, refresh, new-tab, and later-device recovery use the same session recovery contract as typed drafts.

After stop, **Submit Answer** is the only primary action. **Retry** and **Review** are equal secondary actions, with Review visually distinguished because it opens a different confirmation path. Review does not release the composer: Type/Record stays disabled while the review surface keeps local playback available and presents the transcript compactly. Editing is optional and secondary rather than a new required writing task. Local audio is discarded after answer acceptance, retry, explicit fallback/discard, pause/discard, or unmount. The product does not promise playback after submission or recovery.

The browser requests microphone permission only after an explicit gesture. Implementation may prepare the stream as a direct consequence of an accepted first-use notice, **Enable microphone**, or the first Record action; it must not warm the microphone merely because a mode-render effect ran. It stops media tracks after stop, discard, mode exit, pause, unmount, and permission failure. It negotiates only code-allowed `MediaRecorder` MIME types and enforces code-owned duration and byte limits that fit the deployed request runtime.

Browser capture uses the recorder's actual MIME type and codec result. It never relabels an audio-only WebM or MP4 container as `video/*`. The Developer API profile may admit truthful `audio/webm` or `audio/mp4` only after a credentialed synthetic acceptance run proves that exact container through the pinned provider configuration. The browser preference ladder is therefore the intersection of `MediaRecorder.isTypeSupported`, the code-owned capture allowlist, and the currently accepted provider-profile allowlist. Unsupported combinations fail locally into the complete typed-answer path without requesting microphone access.

The browser may retain the raw blob only while the component is mounted and the pre-submission or transcript-review interaction is active. Refresh before a transcription result is durably saved may require rerecording. Refresh after completion recovers the transcript draft or submitted answer, never the audio.

## Voice Command And Transcription Operation

The audience-owned voice command receives bounded binary or multipart audio, not base64 JSON. It also receives the bounded user intent `submit_answer` or `review_transcript`, resolves the immutable question and audience owner server-side, then coordinates:

1. validates content type, bytes, duration policy, and request idempotency;
2. fingerprints the audio without logging or returning the fingerprint;
3. creates or claims one audience-owned transcription run;
4. invokes one provider-neutral transcription adapter;
5. validates a nonblank faithful transcript response;
6. atomically completes the run and saves the current voice transcript draft;
7. returns the recoverable transcript draft projection for either submission path without creating an answer attempt.

The transcription provider adapter and transcription repository never create answer attempts. For quick submit, the browser command coordinator immediately invokes the existing answer route with the returned source run and the stable answer-operation identity derived from the same user command. Review pauses at the recoverable transcript draft until the candidate submits it. Both paths preserve two ordered durable boundaries: completed transcript first, immutable answer second. If answer append fails or its response is lost after transcript commit, matching replay reuses the completed transcript and retries or replays only answer append; it never repeats the provider call.

The provider envelope contains only the audio, transcription instructions, and the configured language hint. Candidate identity, role, JD, resume, question, recruiter data, coaching history, and launch/session credentials are excluded unless later quality evidence demonstrates that narrowly bounded context is necessary and this contract is amended.

Provider instructions require verbatim content preservation. Punctuation and paragraph boundaries may be added for readability, but the provider must not repair grammar, replace words, summarize, infer missing content, or evaluate the answer. The candidate remains the source of submission authorization. The optional review path lets the candidate correct material transcription errors before the answer becomes immutable.

The first provider profile is separate from the evaluator and question-audio profiles. Its provider, model, prompt, schema, language, limits, and settings form one immutable configuration fingerprint. A credentialed live gate is required before recording controls are exposed.

The accepted first profile is `google_gemini_2_5_flash_voice_transcription_v1` on stable `gemini-2.5-flash`. Its current configuration fingerprint is `9ce44b0bab357bed36b838e2d7f3788837175e22a4c201b9bc3e439d60ad8b22`; every media-allowlist, prompt, model, schema, language, limit, or setting change advances that identity. It uses temperature zero, disabled thinking, a 45-second timeout, and strict JSON containing only `transcriptText`. Its code-owned system instruction preserves repetitions, false starts, filler words, and unfinished phrases; permits punctuation only without changing words; uses `[inaudible]` instead of guessing; and forbids translation, summarization, correction, evaluation, coaching, speaker identification, and background-sound narration. The provider request contains only inline audio, the task/language hint, and these fixed configuration controls.

The Developer API audio guide documents WAV, MPEG/MP3, AIFF, AAC, OGG, and FLAC. Firebase AI Logic and Vertex AI additionally document truthful `audio/webm` and `audio/mp4`. V2 remains on the Developer API for this phase, so browser-native WebM/Opus and MP4/AAC were treated as profile-specific compatibility claims rather than inferred support. The guarded 2026-07-21 matrix accepted both truthful containers under the current profile in one provider call each and preserved the synthetic phrase exactly. A completed operation remains replayable even if its historical container is not supported by the current profile. No MIME coercion, server transcoder, Vertex dependency, or raw-audio persistence is introduced.

## Durable Model

Candidate-led and invited practice use the same domain contract with separate ownership tables and repositories. A weak polymorphic owner table is not allowed.

Each transcription run stores only:

- a generated run id;
- audience-owned candidate or invitation identity plus session and question slot;
- a hashed idempotency key;
- an audio input fingerprint;
- accepted MIME type, byte count, and bounded duration metadata when available;
- provider/profile/model/configuration identity;
- positive generation attempt and requested/claim/completed timestamps;
- lifecycle `requested`, `completed`, or `failed`;
- output fingerprint and safe error code.

It does not store raw audio or a duplicate transcript. The completed transaction writes transcript text, source run id, and bounded submission path (`quick_submit` or `transcript_review`) into the audience session's current voice-draft projection. Once submitted, the immutable answer attempt becomes the durable transcript truth and links to the source transcription run.

The answer lineage records the server-resolved submission path. The server derives whether the final submitted transcript differs from the machine transcript by comparing the submitted answer fingerprint with the completed run's output fingerprint. The browser does not assert that fact. Quick submit must produce matching fingerprints; the review path may produce either matching or edited provenance.

Rerecording creates a new run and moves the current draft projection to it. Earlier runs retain metadata-only lifecycle evidence. Draft retention follows the audience session-draft policy; submitted transcripts follow immutable answer-history retention.

## Idempotency And Recovery

- Matching completed replay returns the same saved transcript draft without another provider call.
- Completed replay and fresh pending-state recovery do not require the current provider configuration; only a new generation or stale-claim recovery does.
- If a deliberate rerecord has moved the current draft projection to another run, replay of the older completed operation returns a superseded conflict rather than restoring stale transcript text.
- Matching fresh in-flight work returns a bounded retry state and never starts a second provider call.
- A stale claim may create the next generation only when the browser still holds the same audio and supplies the same operation identity.
- Reusing one idempotency key with different audio fails closed.
- A lost HTTP response after quick-submit completion recovers the accepted answer; a loss after review-transcript completion recovers the confirmation draft. Neither repeats the provider call.
- A provider or validation failure marks only that run failed and leaves the candidate free to retry, rerecord, or use text.
- A browser refresh before server completion cannot promise recovery of the raw recording. If the completed transaction committed, the session reload recovers the transcript; otherwise the candidate rerecords or types.
- Answer submit and evaluator retry retain their existing independent idempotency and lease contracts. They never reuse the transcription operation's key.
- Quick submit derives stable child transcription and answer operation identities from one parent user command; replay resumes at the first incomplete child rather than repeating completed work.

## Evaluator Boundary

The evaluator receives the immutable candidate-authorized transcript and canonical answer mode `voice`. It does not receive raw audio or the machine transcript as a second competing answer.

For the first voice release:

- `voiceMarkers` is `null`;
- delivery coaching is absent;
- transcription uncertainty may produce a bounded usability state but must not be treated as weak answer quality;
- quick-submit and reviewed transcripts are evaluated identically as the submitted answer, while submission-path and edit provenance remain available for QA and later interpretation;
- quick submit intentionally accepts a higher risk of an unnoticed transcription error in exchange for lower friction; Review is the candidate-controlled correction path, and no transcription uncertainty may be misread as weak answer quality;
- technical accuracy still requires a trusted technical reference.

A future delivery-marker extractor is a separate versioned evidence producer. It must define marker provenance, confidence/acceptance rules, retry-safe persistence, privacy behavior, and evaluator applicability before it can populate `voiceMarkers`.

## Privacy And Observability

- No raw audio, transcript text, audio fingerprint, candidate identity, session id, question text, role/JD/resume content, provider raw output, or credentials appear in ordinary logs or metrics.
- Allowed telemetry is limited to random request id, audience type, safe outcome/error code, provider/profile/configuration identity, latency, generation attempt, and coarse byte/duration buckets.
- Provider audio processing and provider-side retention must receive organizational approval before production use.
- Candidate disclosures must state when the microphone is used, that audio is sent to create the transcript used for the answer, that Review is optional, that the transcript may be saved, that text is always available, and that Interview Coach does not retain a separate raw-audio file under this contract.
- Invited disclosure must also state that the submitted transcript may be visible to the inviting recruiter under the existing invited-practice contract. Coaching remains private.

## Implementation Runway

1. **Slice 166 - domain and schema foundation (complete).** Separate candidate/invited metadata-only run tables, current voice-draft projections, source-linked answer columns, immutable ownership and exact current-draft/fingerprint constraints, domain normalization, repositories, migration, and upgrade/fresh smokes are landed. Repository completion derives output fingerprints from normalized transcripts rather than accepting caller-declared values. No provider or UI was added.
2. **Slice 167 - bounded transcription seam (complete).** Shared orchestration now sits behind separate candidate and invitation-recipient routes. Binary bodies stream through a 4 MiB limit; multipart requires a declared bounded envelope; MIME, intent, operation key, slot, index, and positive duration metadata are code-validated. The original 180-second transport ceiling was retired when the production recording UI removed its anxiety-producing three-minute countdown and automatic stop. A generous server-only abuse ceiling remains alongside the byte limit and is not candidate pacing guidance. PostgreSQL advisory locks serialize same-operation claims, completed current drafts replay, fresh work returns pending, changed audio or intent conflicts, matching stale work advances generation, and each operation is capped at three generations. The deterministic fixture requires explicit local opt-in and is blocked in production. No recording UI or answer append was added.
3. **Slice 168 - production provider gate (complete).** The pinned Google profile, strict faithful-transcript schema, immutable configuration identity, audio-only privacy envelope, documented media allowlist, and safe provider failure map are landed. The guarded credentialed synthetic WAV gate completed in one call at 1,990 ms and preserved the expected spoken words exactly under artifact `live_voice_transcription_7bd943f9c1316f4d`.
4. **Slice 169 - shared capture and optional transcript review (complete).** Candidate-led and invited sessions share first-use disclosure, explicit permission, record/stop, the Submit Answer/Retry/Review hierarchy, local replay, optional transcript correction, truthful exit guards, recovery from a durable transcript draft, and a complete typed fallback. Browser capture negotiates truthful WebM/Opus then MP4/AAC. Credentialed Developer API artifacts `live_voice_transcription_1227b91ff0b2dbcb` and `live_voice_transcription_ae16cedb13704b2a` accepted those exact containers in 1,806 ms and 1,752 ms respectively, with one provider call and an exact transcript in each case.
5. **Slice 170 - immutable voice submission (complete).** Answer routes and the shared runtime accept only source-linked, same-audience candidate-authorized voice transcripts. Quick-submit and transcript-review provenance are server-validated; edit provenance is server-derived; immutable attempts feed the existing evaluator as `voice` with `voiceMarkers: null`; typed drafts remain independent; and focused route, repository, recovery, evaluator, and database claim tests are green.
6. **Slice 171 - integrated browser acceptance (complete).** Initial invited-path validation confirmed recording, transcription, optional Review/edit, Retry, durable transcript recovery, typed fallback, and exit warnings. It also exposed a PostgreSQL authorization query that compared the JSON text source id to a UUID parameter without an explicit text cast, so completed transcriptions could not become answers. The shared candidate/invited query is corrected, invited voice-attempt normalization is explicit, the selected answer mode is durable session view state, and transcript drafts resolved by a same-source or later submitted answer are suppressed. Corrective invited validation completed the active round and one whole-round practice-again attempt through coaching and summary recovery; candidate-led validation confirmed the same shared experience and role-scoped dashboard completion. The completed summary no longer presents an unreliable script-driven close action. Composer ownership is deliberately broader than unsafe-local-work warnings: Type/Record switching remains locked from permission request through recording, transcription, Review, and submission, while exit warnings apply only when unsaved local audio could be lost. Final browser confirmation proved that Review retains that lock. Focused, candidate, recruiter/invited, type, lint, optimized-build, repeat migration, and real-database claim checks pass. See the [milestone evidence](../05-quality/transcript-first-voice-answer-milestone.md). Provider-processing approval and deployed-environment proof remain release gates.

Recording controls remain absent unless the exact server runtime tuple is available. Local implementation and provider acceptance do not substitute for organizational approval of provider-side audio processing/retention, staging and deployed-device evidence, operational alert validation, or a senior release pass.
