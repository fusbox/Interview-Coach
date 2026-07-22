import type { GenerateContentResponse } from "@google/genai";
import { describe, expect, it } from "vitest";

import { GOOGLE_VOICE_TRANSCRIPTION_PROFILE_ID } from "./google-voice-transcription";
import {
    VOICE_TRANSCRIPTION_LIVE_EXPECTED_TEXT,
    assertVoiceTranscriptionLiveValidationEnabled,
    findProhibitedVoiceTranscriptionArtifactKeys,
    runVoiceTranscriptionLiveValidation,
} from "./voice-transcription-live-validation";

const liveEnv = {
    NODE_ENV: "test",
    SESSION_VOICE_TRANSCRIPTION_LIVE_TEST: "true",
    SESSION_VOICE_TRANSCRIPTION_PROVIDER: "google_genai",
    SESSION_VOICE_TRANSCRIPTION_PROFILE: GOOGLE_VOICE_TRANSCRIPTION_PROFILE_ID,
    GEMINI_API_KEY: "server-only-secret",
} as NodeJS.ProcessEnv;

describe("voice transcription credentialed live gate", () => {
    it("requires every explicit guard before transport assembly", () => {
        expect(() => assertVoiceTranscriptionLiveValidationEnabled({
            env: liveEnv,
            confirmedLiveProvider: false,
        })).toThrowError(expect.objectContaining({ safeCode: "LIVE_VOICE_TRANSCRIPTION_CLI_CONFIRMATION_REQUIRED" }));
        expect(() => assertVoiceTranscriptionLiveValidationEnabled({
            env: { ...liveEnv, SESSION_VOICE_TRANSCRIPTION_LIVE_TEST: undefined },
            confirmedLiveProvider: true,
        })).toThrowError(expect.objectContaining({ safeCode: "LIVE_VOICE_TRANSCRIPTION_FLAG_REQUIRED" }));
        expect(() => assertVoiceTranscriptionLiveValidationEnabled({
            env: { ...liveEnv, GEMINI_API_KEY: undefined },
            confirmedLiveProvider: true,
        })).toThrowError(expect.objectContaining({ safeCode: "LIVE_VOICE_TRANSCRIPTION_CREDENTIAL_REQUIRED" }));
    });

    it("accepts one exact synthetic audio request and emits a privacy-safe artifact", async () => {
        const audioData = new Uint8Array([82, 73, 70, 70, 1, 2, 3]);
        const artifact = await runVoiceTranscriptionLiveValidation({
            env: liveEnv,
            confirmedLiveProvider: true,
            audioData,
            mimeType: "audio/wav",
            dependencies: {
                now: () => new Date("2026-07-21T12:00:00.000Z"),
                createTransport: () => createTransport(providerResponse({
                    transcriptText: VOICE_TRANSCRIPTION_LIVE_EXPECTED_TEXT,
                })),
            },
        });

        expect(artifact.result).toMatchObject({ outcome: "accepted" });
        expect(artifact.summary).toEqual({
            transportAttemptCount: 1,
            automatedGatePassed: true,
            humanTranscriptReview: "required",
        });
        expect(findProhibitedVoiceTranscriptionArtifactKeys(artifact)).toEqual([]);
        const serialized = JSON.stringify(artifact);
        expect(serialized).not.toContain(Buffer.from(audioData).toString("base64"));
        expect(serialized).not.toContain("server-only-secret");
    });

    it.each(["audio/webm", "audio/mp4"] as const)(
        "keeps browser container %s truthful through the guarded request",
        async (mimeType) => {
            const artifact = await runVoiceTranscriptionLiveValidation({
                env: liveEnv,
                confirmedLiveProvider: true,
                audioData: new Uint8Array([1, 2, 3]),
                mimeType,
                dependencies: {
                    createTransport: () => createTransport(providerResponse({
                        transcriptText: VOICE_TRANSCRIPTION_LIVE_EXPECTED_TEXT,
                    })),
                },
            });

            expect(artifact.syntheticCase).toMatchObject({ mimeType });
            expect(artifact.summary.automatedGatePassed).toBe(true);
        },
    );

    it("records only the safe failure class when the provider fails", async () => {
        const artifact = await runVoiceTranscriptionLiveValidation({
            env: liveEnv,
            confirmedLiveProvider: true,
            audioData: new Uint8Array([1]),
            mimeType: "audio/wav",
            dependencies: {
                createTransport: () => ({
                    async generateContent() {
                        throw { status: 503, privateDetail: "upstream body" };
                    },
                }),
            },
        });

        expect(artifact.result).toEqual({
            outcome: "failed",
            failureClass: "provider_unavailable",
        });
        expect(JSON.stringify(artifact)).not.toContain("upstream body");
        expect(artifact.summary.automatedGatePassed).toBe(false);
    });
});

function createTransport(response: GenerateContentResponse) {
    return {
        async generateContent() {
            return response;
        },
    };
}

function providerResponse(value: unknown) {
    return {
        text: JSON.stringify(value),
        candidates: [{ finishReason: "STOP" }],
    } as unknown as GenerateContentResponse;
}
