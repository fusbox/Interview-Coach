import { describe, expect, it, vi } from "vitest";

import type { CandidatePracticeIntentRecord } from "@/features/candidate-practice-v2/candidate-follow-up-practice-intent";
import { handleCandidatePracticeIntentQuestionAudioRequest } from "./route-implementation";

describe("candidate practice-intent question audio route", () => {
    it("warms persisted audio from a launchable owned intent", async () => {
        const generateQuestionAudio = vi.fn(async () => audioResult());
        const response = await handleCandidatePracticeIntentQuestionAudioRequest({
            request: request({ questionKey: "slot-1" }),
            intentId: "intent-1",
            resolveIdentity: vi.fn(async () => ({ candidateProfileId: "candidate-1" })),
            intentRepository: repositoryWithIntent(),
            audioRuntime: { generateQuestionAudio },
            now: () => new Date("2026-07-20T12:00:00.000Z"),
            recordDiagnostic: vi.fn(),
        });

        expect(response.status).toBe(200);
        expect(generateQuestionAudio).toHaveBeenCalledWith("Persisted intent question wording");
    });

    it("rejects browser-supplied wording before identity or provider work", async () => {
        const resolveIdentity = vi.fn();
        const generateQuestionAudio = vi.fn();
        const response = await handleCandidatePracticeIntentQuestionAudioRequest({
            request: request({ questionKey: "slot-1", questionText: "Untrusted replacement" }),
            intentId: "intent-1",
            resolveIdentity,
            intentRepository: repositoryWithIntent(),
            audioRuntime: { generateQuestionAudio },
            recordDiagnostic: vi.fn(),
        });

        expect(response.status).toBe(400);
        expect(resolveIdentity).not.toHaveBeenCalled();
        expect(generateQuestionAudio).not.toHaveBeenCalled();
    });

    it("denies an expired intent without calling the provider", async () => {
        const generateQuestionAudio = vi.fn();
        const response = await handleCandidatePracticeIntentQuestionAudioRequest({
            request: request({ questionKey: "slot-1" }),
            intentId: "intent-1",
            resolveIdentity: vi.fn(async () => ({ candidateProfileId: "candidate-1" })),
            intentRepository: repositoryWithIntent(),
            audioRuntime: { generateQuestionAudio },
            now: () => new Date("2026-07-22T12:00:00.000Z"),
            recordDiagnostic: vi.fn(),
        });

        expect(response.status).toBe(404);
        expect(generateQuestionAudio).not.toHaveBeenCalled();
    });

    it("requires candidate identity before reading the intent", async () => {
        const findPracticeIntent = vi.fn();
        const response = await handleCandidatePracticeIntentQuestionAudioRequest({
            request: request({ questionKey: "slot-1" }),
            intentId: "intent-1",
            resolveIdentity: vi.fn(async () => null),
            intentRepository: { findPracticeIntent },
            audioRuntime: { generateQuestionAudio: vi.fn(async () => audioResult()) },
            recordDiagnostic: vi.fn(),
        });

        expect(response.status).toBe(401);
        expect(findPracticeIntent).not.toHaveBeenCalled();
    });
});

function request(body: Record<string, unknown>) {
    return new Request("https://interviewcoach.talentarbor.com/candidate/practice/ready/intent-1/question-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

function repositoryWithIntent() {
    return {
        findPracticeIntent: vi.fn(async () => ({
            lifecycleState: "ready",
            expiresAt: "2026-07-21T12:00:00.000Z",
            items: [{ source: { questionKey: "slot-1", questionText: "Persisted intent question wording" } }],
        } as CandidatePracticeIntentRecord)),
    };
}

function audioResult() {
    return {
        audioData: Buffer.from([1, 2, 3]),
        mimeType: "audio/wav" as const,
        cacheIdentity: "cache-1",
        cacheOutcome: "hit" as const,
        provider: "google_genai",
        profileId: "profile-1",
    };
}
