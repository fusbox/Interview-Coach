# Shared Question Audio Contract

Status: Ratified for V2 Slice 161

## Purpose

Candidate-led and recruiter-invited practice use one optional question-audio capability. Audio supports the shared text question; it never becomes the source of truth for wording, progress, completion, or answer evaluation.

## Reconciliation

### Preserve

- Prefetch question one while the candidate reviews the pre-session landing.
- Unlock the browser audio context from the truthful `Start practice` gesture.
- When a live question becomes current, prepare that question and the next question.
- Attempt automatic playback once after successful browser-audio unlock.
- Keep an explicit `Read aloud` control for replay and recovery.
- Continue the text practice normally when audio is unavailable.

### Reinterpret

- V0.5's reusable Web Audio engine, decoded-buffer cache, and in-flight request deduplication become an audience-neutral client controller with stale-play cancellation and a bounded cache.
- V1's browser prefetch is retained, but its arbitrary-text `/api/tts` request and candidate-token headers are replaced by audience-specific route entries over one shared implementation.
- The browser submits only the immutable question slot. The server proves candidate or invitation ownership, loads the exact persisted wording, and supplies that wording to the provider.
- Play-once memory is browser-local and session-scoped. It is written only after playback actually starts. It is not candidate progress and is not persisted to Postgres or synchronized across devices.

### Retire

- Browser-supplied question text as a trusted TTS input.
- A public or weakly authorized general-purpose TTS proxy.
- Cache keys based only on question ids without provider/profile identity.
- Console output containing question text, provider payloads, token material, or raw provider exceptions.
- Timer-only playback sequencing that can let an earlier question start after navigation.

### Defer

- Answer recording, transcription, photo notes, and resume OCR.
- Candidate voice selection or playback speed controls.
- Cross-device playback history.
- Durable audio storage or CDN distribution.
- Workarounds that manufacture or misrepresent user interaction to bypass browser autoplay policy.

## Trust And Routing

The client requests audio from the same audience-owned session boundary used for other live mutations:

- `POST /candidate/session/[sessionId]/question-audio`
- `POST /candidate/invited/session/[sessionId]/question-audio`

Before a follow-up session exists, its ready landing may warm the same provider/cache through `POST /candidate/practice/ready/[intentId]/question-audio`. That boundary independently proves candidate ownership of the immutable ready intent and resolves the selected source question. It does not manufacture a session identity. The subsequent session request reuses the same profile/text cache identity.

The JSON body contains only `questionKey`. Both session routes call one shared handler; the pre-session intent route applies the same input, ownership, persisted-wording, runtime, response, and diagnostic rules before a session exists. The boundary:

1. resolves the applicable HttpOnly app or invitation session;
2. proves that the requested practice session belongs to that actor;
3. resolves `questionKey` against the immutable persisted wording snapshot;
4. rejects missing, malformed, stale, or over-limit wording before provider execution;
5. invokes the configured provider profile; and
6. returns only bounded audio bytes and safe cache metadata.

Unknown actors and foreign sessions must not expose whether the other resource exists. A valid owner requesting a missing question receives a generic not-found response. The provider key remains server-only.

## Provider And Cache Identity

Production audio is opt-in through:

- `SESSION_QUESTION_AUDIO_PROVIDER=google_genai`
- `SESSION_QUESTION_AUDIO_PROFILE=google_gemini_2_5_flash_tts_v1`
- `GEMINI_API_KEY`

The first profile uses `gemini-2.5-flash-preview-tts`, the `Kore` voice, 24 kHz mono PCM wrapped as WAV when necessary, and a versioned exact-recitation instruction. Provider/profile/model/voice/prompt changes require a new profile id.

The server cache key is a SHA-256 fingerprint of the immutable profile descriptor and normalized persisted question text. Ownership is checked before every cache lookup. Cached entries and in-flight requests are bounded and process-local; they reduce repeat latency but are not a durability guarantee.

The browser cache key includes request boundary, session id, and question key. It stores decoded buffers only in memory. The client deduplicates fetches, stops current playback on navigation, and fences async decode/play completion so stale work cannot start after the current question changes.

## Playback And Recovery

- Landing prefetch does not mark a question played.
- `Start practice` calls `AudioContext.resume()` from the click/tap. Failure does not block navigation.
- Live entry calls play-once for the current question. The memory flag is written only after an audio source starts.
- Refresh in the same tab consults session storage and does not unexpectedly auto-play a question that already started.
- A recovered/new tab may prefetch, but browser autoplay policy remains authoritative. It does not fabricate a user gesture. The explicit `Read aloud` control can unlock and play the current question.
- Explicit replay may play an already-heard question and refreshes no practice-domain state.
- Another browser or device starts with no playback memory. Cross-device playback history is intentionally unnecessary because hearing a question is not practice progress.

## Failure And Diagnostics

Malformed input returns `400`; absent identity returns `401`; an owned session/question miss returns `404`; an unconfigured or failed provider returns `503`. All failures leave the visible question and answer workflow usable.

Diagnostics may include only event name, provider/profile id, cache outcome, duration bucket, audio byte count, HTTP status, and safe failure class. They must not include identity, role/JD/resume context, question text, answers, prompts, cookie/token values, raw provider output, or raw exceptions.

## Acceptance

- Candidate-led and invited landing surfaces prefetch the first persisted question through their own ownership boundary.
- Current and next question requests deduplicate; stale navigation cannot play prior audio.
- Successful playback is not repeated automatically after same-tab refresh.
- Explicit replay works after recovery when the browser permits audio.
- Invalid ownership, invalid slot, oversized output, timeout, provider failure, and missing configuration fail without blocking text practice.
- Candidate-led and invited routes produce the same audio/runtime behavior from the same shared implementation.
