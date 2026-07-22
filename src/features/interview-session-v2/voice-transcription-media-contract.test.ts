import { describe, expect, it } from "vitest";

import {
    VOICE_TRANSCRIPTION_MAX_AUDIO_BYTES,
    VoiceTranscriptionMediaError,
    parseVoiceTranscriptionMediaRequest,
} from "./voice-transcription-media-contract";

function rawRequest(audio = new Uint8Array([1, 2, 3]), headers: Record<string, string> = {}) {
    return new Request("http://localhost/candidate/session/session-1/voice-transcription", {
        method: "POST",
        body: audio,
        headers: {
            "content-type": "audio/webm;codecs=opus",
            "idempotency-key": "voice-command-1",
            "x-ic-voice-intent": "submit_answer",
            "x-ic-question-slot": "slot-1",
            "x-ic-question-index": "0",
            "x-ic-audio-duration-ms": "12000",
            ...headers,
        },
    });
}

describe("voice transcription media contract", () => {
    it("reads bounded binary audio and canonicalizes metadata", async () => {
        await expect(parseVoiceTranscriptionMediaRequest(rawRequest())).resolves.toMatchObject({
            acceptedMimeType: "audio/webm",
            audioByteCount: 3,
            audioDurationMs: 12000,
            idempotencyKey: "voice-command-1",
            intent: "submit_answer",
            questionSlotId: "slot-1",
            questionIndex: 0,
        });
    });

    it("accepts the production profile's documented WAV input", async () => {
        await expect(parseVoiceTranscriptionMediaRequest(rawRequest(undefined, {
            "content-type": "audio/wav",
        }))).resolves.toMatchObject({ acceptedMimeType: "audio/wav" });
    });

    it("rejects an oversized streaming body even without a declared length", async () => {
        const request = rawRequest(new Uint8Array(VOICE_TRANSCRIPTION_MAX_AUDIO_BYTES + 1));
        await expect(parseVoiceTranscriptionMediaRequest(request)).rejects.toMatchObject({
            statusCode: 413,
            failureClass: "audio_too_large",
        } satisfies Partial<VoiceTranscriptionMediaError>);
    });

    it("rejects unsupported audio and out-of-policy duration", async () => {
        await expect(parseVoiceTranscriptionMediaRequest(rawRequest(undefined, {
            "content-type": "application/octet-stream",
        }))).rejects.toMatchObject({ statusCode: 415, failureClass: "audio_type_unsupported" });
        await expect(parseVoiceTranscriptionMediaRequest(rawRequest(undefined, {
            "x-ic-audio-duration-ms": "180001",
        }))).rejects.toMatchObject({ statusCode: 400, failureClass: "audio_duration_invalid" });
    });

    it("accepts one bounded multipart envelope and rejects undeclared multipart length", async () => {
        const data = new FormData();
        data.set("audio", new Blob([new Uint8Array([1, 2])], { type: "audio/ogg" }), "answer.ogg");
        data.set("idempotencyKey", "voice-command-2");
        data.set("intent", "review_transcript");
        data.set("questionSlotId", "slot-2");
        data.set("questionIndex", "1");
        data.set("audioDurationMs", "9000");
        const request = new Request("http://localhost/voice", { method: "POST", body: data });
        const headers = new Headers(request.headers);
        headers.set("content-length", "2048");
        const bounded = new Request(request, { headers });
        await expect(parseVoiceTranscriptionMediaRequest(bounded)).resolves.toMatchObject({
            acceptedMimeType: "audio/ogg",
            intent: "review_transcript",
            questionSlotId: "slot-2",
        });

        const undeclared = new Request("http://localhost/voice", { method: "POST", body: data });
        await expect(parseVoiceTranscriptionMediaRequest(undeclared)).rejects.toMatchObject({
            statusCode: 411,
            failureClass: "multipart_length_required",
        });
    });
});
