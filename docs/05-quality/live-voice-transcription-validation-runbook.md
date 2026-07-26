# Live Voice Transcription Validation Runbook

Status: Accepted local provider gate
Last updated: 2026-07-21

## Purpose

This runbook defines the explicit credentialed gate for the first V2 voice-transcription profile. It proves that the pinned Google Gemini Developer API profile receives only synthetic audio plus transcription instructions, returns a faithful structured transcript, and emits a privacy-safe local review artifact. It does not read or write candidate or invited-practice data.

The pinned profile is:

- provider: `google_genai`;
- profile: `google_gemini_2_5_flash_voice_transcription_v1`;
- model: `gemini-2.5-flash`;
- configuration fingerprint: `9ce44b0bab357bed36b838e2d7f3788837175e22a4c201b9bc3e439d60ad8b22`.

## Execution Guard

Live execution requires all of the following:

1. `npm run qa:candidate:voice-transcription-live`;
2. CLI acknowledgement `--confirm-live-provider`;
3. a local `--audio` file containing only the fixed synthetic phrase below;
4. an explicit truthful `--mime-type` that matches the file container;
5. `SESSION_VOICE_TRANSCRIPTION_LIVE_TEST=true`;
6. `SESSION_VOICE_TRANSCRIPTION_PROVIDER=google_genai`;
7. `SESSION_VOICE_TRANSCRIPTION_PROFILE=google_gemini_2_5_flash_voice_transcription_v1`;
8. a nonblank server-only `GEMINI_API_KEY`.

The fixed synthetic phrase is:

> I checked each label, recorded the issue, and told my supervisor what I found.

On Windows, generate a local non-sensitive WAV with the installed speech synthesizer:

```powershell
Add-Type -AssemblyName System.Speech
$path = Join-Path (Resolve-Path '.untracked') 'voice-transcription-live.wav'
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $speaker.SetOutputToWaveFile($path)
  $speaker.Speak('I checked each label, recorded the issue, and told my supervisor what I found.')
} finally {
  $speaker.Dispose()
}
```

Run the guarded gate:

```powershell
$env:SESSION_VOICE_TRANSCRIPTION_LIVE_TEST="true"
$env:SESSION_VOICE_TRANSCRIPTION_PROVIDER="google_genai"
$env:SESSION_VOICE_TRANSCRIPTION_PROFILE="google_gemini_2_5_flash_voice_transcription_v1"
cmd /c npm run qa:candidate:voice-transcription-live -- --confirm-live-provider --audio .untracked\voice-transcription-live.wav --mime-type audio/wav
Remove-Item Env:SESSION_VOICE_TRANSCRIPTION_LIVE_TEST
```

To prove the exact containers emitted by Chromium, generate browser-native fixtures from that same synthetic WAV and run the two cases separately:

```powershell
cmd /c npm run qa:candidate:voice-transcription-browser-fixtures -- --input .untracked\voice-transcription-live.wav --output-dir .untracked

$env:SESSION_VOICE_TRANSCRIPTION_LIVE_TEST="true"
$env:SESSION_VOICE_TRANSCRIPTION_PROVIDER="google_genai"
$env:SESSION_VOICE_TRANSCRIPTION_PROFILE="google_gemini_2_5_flash_voice_transcription_v1"
cmd /c npm run qa:candidate:voice-transcription-live -- --confirm-live-provider --audio .untracked\voice-transcription-live.webm --mime-type audio/webm
cmd /c npm run qa:candidate:voice-transcription-live -- --confirm-live-provider --audio .untracked\voice-transcription-live.mp4 --mime-type audio/mp4
Remove-Item Env:SESSION_VOICE_TRANSCRIPTION_LIVE_TEST
```

The script loads `GEMINI_API_KEY` through the normal Next environment loader, including `.env.local`. Missing or mismatched controls fail before transport assembly. Ordinary tests, builds, startup, previews, and candidate requests never run this harness automatically.

## Provider Contract

The provider request contains exactly:

- the bounded audio bytes as inline media;
- a fixed code-owned faithful-transcription system instruction;
- the task name and English language hint;
- the pinned JSON response schema and generation settings.

It excludes candidate or recipient identity, role, JD, resume, question text, session identifiers, coaching history, and credentials. Provider output is accepted only when it is strict JSON with one nonblank bounded `transcriptText` field. Safety blocks, unsupported media, timeout, rate limit, provider 4xx/5xx, malformed output, and unknown failure are reduced to safe classes.

The [Developer API audio guide](https://ai.google.dev/gemini-api/docs/audio) documents WAV, MPEG/MP3, AIFF, AAC, OGG, and FLAC. Browser-native truthful `audio/webm` and `audio/mp4` are admitted only when this same guarded harness proves their exact container through the pinned Developer API profile. The harness requires an explicit MIME argument, verifies that the provider request preserves it without coercion, and writes one separate artifact per case. A browser format is not production-accepted merely because `MediaRecorder.isTypeSupported` returns true.

Do not relabel audio-only browser containers as `video/webm` or `video/mp4`. Do not infer Developer API support from Firebase or Vertex documentation. If a truthful browser format fails this matrix, leave it out of the profile and keep typed practice available; conversion or a Vertex profile requires a separate architecture and deployment decision.

## Artifact Contract

Accepted or safely failed runs write an ignored JSON artifact under `AI-eval/candidate-v2/voice-transcription/`. The artifact may contain the fixed synthetic expected text and returned synthetic transcript for human review. It excludes raw audio, base64 media, provider request, assembled system instruction, raw provider response, credential, candidate identity, and database identifiers. Files use exclusive creation and never overwrite earlier evidence.

## Acceptance Evidence

The first credentialed WAV run passed on 2026-07-21 under the pre-browser media fingerprint:

- artifact: `live_voice_transcription_7bd943f9c1316f4d`;
- exact profile/configuration: passed;
- one transport attempt: passed;
- audio-only privacy envelope: passed;
- expected spoken words preserved: passed;
- provider latency: 1,990 ms;
- human transcript review: accepted; the returned text matched the spoken synthetic phrase word for word.

The truthful browser-container matrix then passed on 2026-07-21 under current fingerprint `9ce44b0bab357bed36b838e2d7f3788837175e22a4c201b9bc3e439d60ad8b22`:

| Container | Artifact | Provider calls | Latency | Result |
| --- | --- | ---: | ---: | --- |
| `audio/webm` (WebM/Opus) | `live_voice_transcription_1227b91ff0b2dbcb` | 1 | 1,806 ms | Accepted; exact synthetic transcript |
| `audio/mp4` (MP4/AAC) | `live_voice_transcription_ae16cedb13704b2a` | 1 | 1,752 ms | Accepted; exact synthetic transcript |

This accepts truthful WebM and MP4 for the pinned Developer API profile and permits the exact-runtime browser implementation to proceed without MIME coercion or transcoding. It does not approve provider-side processing or retention for production, deployed network/secret behavior, or cross-device browser behavior. Those remain separate release gates.
