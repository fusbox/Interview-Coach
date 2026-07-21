import { describe, expect, it, vi } from "vitest";

import { SessionQuestionAudioRuntimeError } from "@/features/interview-session-v2/session-question-audio-runtime";
import { handleSessionQuestionAudioRequest } from "./route-implementation";

describe("candidate session question audio route", () => {
    it("resolves persisted owned wording from the stable question key", async () => {
        const generateQuestionAudio = vi.fn(async () => audioResult());
        const response = await handleSessionQuestionAudioRequest({
            request: request({ questionKey: "slot-1" }),
            sessionId: "session-1",
            resolveSessionIdentity: vi.fn(async () => ({ ownerId: "candidate-1" })),
            sessionRepository: repositoryWithQuestion(),
            audioRuntime: { generateQuestionAudio },
            recordDiagnostic: vi.fn(),
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("audio/wav");
        expect(generateQuestionAudio).toHaveBeenCalledWith("Persisted owned question wording");
    });

    it("rejects browser-supplied wording without invoking persistence or the provider", async () => {
        const findSetupSession = vi.fn();
        const generateQuestionAudio = vi.fn();
        const response = await handleSessionQuestionAudioRequest({
            request: request({ questionKey: "slot-1", questionText: "Untrusted replacement" }),
            sessionId: "session-1",
            resolveSessionIdentity: vi.fn(async () => ({ ownerId: "candidate-1" })),
            sessionRepository: { findSetupSession },
            audioRuntime: { generateQuestionAudio },
            recordDiagnostic: vi.fn(),
        });

        expect(response.status).toBe(400);
        expect(findSetupSession).not.toHaveBeenCalled();
        expect(generateQuestionAudio).not.toHaveBeenCalled();
    });

    it("denies missing identity before session or provider access", async () => {
        const findSetupSession = vi.fn();
        const generateQuestionAudio = vi.fn();
        const response = await handleSessionQuestionAudioRequest({
            request: request({ questionKey: "slot-1" }),
            sessionId: "session-1",
            resolveSessionIdentity: vi.fn(async () => null),
            sessionRepository: { findSetupSession },
            audioRuntime: { generateQuestionAudio },
            recordDiagnostic: vi.fn(),
        });

        expect(response.status).toBe(401);
        expect(findSetupSession).not.toHaveBeenCalled();
        expect(generateQuestionAudio).not.toHaveBeenCalled();
    });

    it("does not disclose a foreign or missing question", async () => {
        const response = await handleSessionQuestionAudioRequest({
            request: request({ questionKey: "slot-2" }),
            sessionId: "session-1",
            resolveSessionIdentity: vi.fn(async () => ({ ownerId: "candidate-1" })),
            sessionRepository: repositoryWithQuestion(),
            audioRuntime: { generateQuestionAudio: vi.fn(async () => audioResult()) },
            recordDiagnostic: vi.fn(),
        });

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({ error: "Question audio was not found." });
    });

    it("continues safely when the provider fails", async () => {
        const recordDiagnostic = vi.fn();
        const response = await handleSessionQuestionAudioRequest({
            request: request({ questionKey: "slot-1" }),
            sessionId: "session-1",
            resolveSessionIdentity: vi.fn(async () => ({ ownerId: "candidate-1" })),
            sessionRepository: repositoryWithQuestion(),
            audioRuntime: {
                generateQuestionAudio: vi.fn(async () => {
                    throw new SessionQuestionAudioRuntimeError({
                        failureClass: "timeout",
                        safeCode: "QUESTION_AUDIO_PROVIDER_TIMEOUT",
                    });
                }),
            },
            recordDiagnostic,
        });

        expect(response.status).toBe(503);
        expect(recordDiagnostic).toHaveBeenCalledWith(expect.objectContaining({
            outcome: "unavailable",
            failureClass: "timeout",
        }));
    });
});

function request(body: Record<string, unknown>) {
    return new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/question-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

function repositoryWithQuestion() {
    return {
        findSetupSession: vi.fn(async () => ({
            questionWordingSnapshot: {
                questions: [{ slotId: "slot-1", questionText: "Persisted owned question wording" }],
            },
        } as never)),
    };
}

function audioResult() {
    return {
        audioData: Buffer.from([1, 2, 3]),
        mimeType: "audio/wav" as const,
        cacheIdentity: "cache-1",
        cacheOutcome: "miss" as const,
        provider: "google_genai",
        profileId: "profile-1",
    };
}
