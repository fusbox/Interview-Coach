import { describe, expect, it, vi } from "vitest";

import {
    SessionVoiceAnswerBrowserError,
    assertSessionVoiceRecordingBounds,
    createSessionVoiceOperationKeys,
    normalizeSessionVoiceCaptureMimeType,
    requestSessionVoiceTranscript,
    selectSessionVoiceCaptureMimeType,
} from "./session-voice-answer-browser";
import { VOICE_TRANSCRIPTION_MAX_DURATION_MS } from "./voice-transcription-media-contract";

const transcriptDraft = {
    status: "voice_transcript_draft",
    slotId: "slot-1",
    questionIndex: 0,
    transcriptText: "I checked the work before I moved it.",
    sourceTranscriptionRunId: "run-1",
    submissionPath: "transcript_review",
    updatedAt: "2026-07-21T12:00:00.000Z",
};

describe("session voice answer browser contract", () => {
    it("negotiates truthful WebM first and MP4 when WebM is unavailable", () => {
        expect(selectSessionVoiceCaptureMimeType((value) => (
            value === "audio/webm;codecs=opus" || value === "audio/mp4;codecs=mp4a.40.2"
        ))).toBe("audio/webm;codecs=opus");
        expect(selectSessionVoiceCaptureMimeType((value) => value === "audio/mp4;codecs=mp4a.40.2"))
            .toBe("audio/mp4;codecs=mp4a.40.2");
        expect(selectSessionVoiceCaptureMimeType(() => false)).toBeNull();
        expect(normalizeSessionVoiceCaptureMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
        expect(normalizeSessionVoiceCaptureMimeType("audio/mp4;codecs=mp4a.40.2")).toBe("audio/mp4");
        expect(normalizeSessionVoiceCaptureMimeType("video/webm")).toBeNull();
    });

    it("keeps separate operation identity for quick submit and review", () => {
        const values = ["submit-id", "review-id"];
        const keys = createSessionVoiceOperationKeys(() => values.shift()!);
        expect(keys).toEqual({
            submit_answer: "voice-submit:submit-id",
            review_transcript: "voice-review:review-id",
        });
    });

    it("polls one pending claim with the same audio, truthful MIME, and operation key", async () => {
        const fetcher = vi.fn()
            .mockResolvedValueOnce(Response.json({ status: "transcription_pending", transcriptDraft: null }, { status: 202 }))
            .mockResolvedValueOnce(Response.json({ status: "transcript_ready", transcriptDraft }));
        const recording = {
            blob: new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm;codecs=opus" }),
            durationMs: 1_250,
            operationKeys: {
                submit_answer: "voice-submit:one",
                review_transcript: "voice-review:one",
            },
        };

        await expect(requestSessionVoiceTranscript({
            mutationBasePath: "/candidate/session/session-1",
            questionSlotId: "slot-1",
            questionIndex: 0,
            recording,
            intent: "review_transcript",
            fetcher,
            wait: vi.fn(async () => undefined),
        })).resolves.toEqual(transcriptDraft);

        expect(fetcher).toHaveBeenCalledTimes(2);
        for (const call of fetcher.mock.calls) {
            const request = call[1] as RequestInit;
            expect(request.body).toBe(recording.blob);
            expect(request.headers).toMatchObject({
                "Content-Type": "audio/webm;codecs=opus",
                "Idempotency-Key": "voice-review:one",
                "X-IC-Voice-Intent": "review_transcript",
                "X-IC-Question-Slot": "slot-1",
                "X-IC-Question-Index": "0",
                "X-IC-Audio-Duration-Ms": "1250",
            });
        }
    });

    it("maps unsupported media to typed fallback guidance", async () => {
        await expect(requestSessionVoiceTranscript({
            mutationBasePath: "/candidate/session/session-1",
            questionSlotId: "slot-1",
            questionIndex: 0,
            recording: {
                blob: new Blob([new Uint8Array([1])], { type: "audio/webm" }),
                durationMs: 1,
                operationKeys: {
                    submit_answer: "voice-submit:one",
                    review_transcript: "voice-review:one",
                },
            },
            intent: "review_transcript",
            fetcher: vi.fn(async () => Response.json({}, { status: 415 })),
        })).rejects.toMatchObject({
            code: "transcription_format_unsupported",
            retryable: false,
        });
    });

    it("fails locally before transport when the recording is empty or unbounded", () => {
        expect(() => assertSessionVoiceRecordingBounds({
            blob: new Blob([], { type: "audio/webm" }),
            durationMs: 1,
        })).toThrowError(expect.objectContaining({ code: "recording_empty" }));
        expect(() => assertSessionVoiceRecordingBounds({
            blob: new Blob([new Uint8Array([1])], { type: "audio/webm" }),
            durationMs: VOICE_TRANSCRIPTION_MAX_DURATION_MS + 1,
        })).toThrowError(SessionVoiceAnswerBrowserError);
    });
});
