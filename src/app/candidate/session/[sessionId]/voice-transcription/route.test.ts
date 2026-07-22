import { describe, expect, it, vi } from "vitest";

import type { VoiceTranscriptionClaimResult, VoiceTranscriptionCompletionResult } from "@/features/interview-session-v2/voice-answer-transcription";
import type {
    VoiceTranscriptionClaimInput,
    VoiceTranscriptionCompletionInput,
    VoiceTranscriptionServiceRepository,
} from "@/features/interview-session-v2/voice-transcription-service";

import { handleVoiceTranscriptionRequest, type VoiceTranscriptionRouteDiagnostic } from "./route-implementation";

const hash = "a".repeat(64);

function request(origin = "http://localhost:3000") {
    return new Request(`${origin}/candidate/session/session-1/voice-transcription`, {
        method: "POST",
        body: new Uint8Array([1, 2, 3]),
        headers: {
            origin,
            "content-type": "audio/webm",
            "idempotency-key": "command-1",
            "x-ic-voice-intent": "review_transcript",
            "x-ic-question-slot": "slot-1",
            "x-ic-question-index": "0",
            "x-ic-audio-duration-ms": "5000",
        },
    });
}

function repository(): VoiceTranscriptionServiceRepository {
    let claimed: Parameters<VoiceTranscriptionServiceRepository["claimRun"]>[0] | null = null;
    return {
        claimRun: vi.fn(async (input: VoiceTranscriptionClaimInput): Promise<VoiceTranscriptionClaimResult> => {
            claimed = input;
            return {
                outcome: "acquired",
                run: {
                    voiceTranscriptionRunId: input.voiceTranscriptionRunId,
                    practiceSessionId: input.practiceSessionId,
                    audienceOwnerId: input.audienceOwnerId,
                    questionSlotId: input.questionSlotId,
                    questionIndex: input.questionIndex,
                    idempotencyKeyHash: input.idempotencyKeyHash,
                    audioInputFingerprint: input.audioInputFingerprint,
                    acceptedMimeType: input.acceptedMimeType,
                    audioByteCount: input.audioByteCount,
                    audioDurationMs: input.audioDurationMs,
                    submissionPath: input.submissionPath,
                    provider: input.provider,
                    profileId: input.profileId,
                    modelName: input.modelName,
                    configurationFingerprint: input.configurationFingerprint,
                    generationAttempt: 1,
                    lifecycleState: "requested",
                    outputFingerprint: null,
                    errorCode: null,
                    requestedAt: input.requestedAt,
                    claimExpiresAt: input.claimExpiresAt,
                    completedAt: null,
                    createdAt: input.requestedAt,
                    updatedAt: input.requestedAt,
                },
                draft: null,
            };
        }),
        recoverRun: vi.fn(async () => null),
        completeRunAndSaveDraft: vi.fn(async (
            input: VoiceTranscriptionCompletionInput,
        ): Promise<VoiceTranscriptionCompletionResult> => ({
            run: {
                voiceTranscriptionRunId: input.voiceTranscriptionRunId,
                practiceSessionId: input.practiceSessionId,
                audienceOwnerId: input.audienceOwnerId,
                questionSlotId: input.questionSlotId,
                questionIndex: input.questionIndex,
                idempotencyKeyHash: claimed!.idempotencyKeyHash,
                audioInputFingerprint: claimed!.audioInputFingerprint,
                acceptedMimeType: claimed!.acceptedMimeType,
                audioByteCount: claimed!.audioByteCount,
                audioDurationMs: claimed!.audioDurationMs,
                submissionPath: input.submissionPath,
                provider: "fixture",
                profileId: "fixture_voice_transcription_v1",
                modelName: "fixture-model",
                configurationFingerprint: hash,
                generationAttempt: 1,
                lifecycleState: "completed",
                outputFingerprint: hash,
                errorCode: null,
                requestedAt: claimed!.requestedAt,
                claimExpiresAt: claimed!.claimExpiresAt,
                completedAt: input.completedAt,
                createdAt: claimed!.requestedAt,
                updatedAt: input.completedAt,
            },
            draft: {
                status: "voice_transcript_draft",
                slotId: input.questionSlotId,
                questionIndex: input.questionIndex,
                transcriptText: input.transcriptText,
                sourceTranscriptionRunId: input.voiceTranscriptionRunId,
                submissionPath: input.submissionPath,
                updatedAt: input.completedAt,
            },
        })),
        failRun: vi.fn(),
    };
}

describe("voice transcription route", () => {
    it("authenticates, transcribes, and emits metadata-only diagnostics", async () => {
        const diagnostics: VoiceTranscriptionRouteDiagnostic[] = [];
        const response = await handleVoiceTranscriptionRequest({
            request: request(),
            sessionId: "session-1",
            audience: "candidate",
            resolveSessionIdentity: async () => ({ ownerId: "owner-1" }),
            createRepository: () => repository(),
            runtime: {
                provider: "fixture",
                profileId: "fixture_voice_transcription_v1",
                modelName: "fixture-model",
                configurationFingerprint: hash,
                supportedMimeTypes: ["audio/webm"],
                transcribe: async () => ({ transcriptText: "Private answer transcript." }),
            },
            recordDiagnostic: (event) => diagnostics.push(event),
        });
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            status: "transcript_ready",
            transcriptDraft: {
                transcriptText: "Private answer transcript.",
                submissionPath: "transcript_review",
            },
        });
        expect(diagnostics).toHaveLength(1);
        expect(JSON.stringify(diagnostics[0])).not.toContain("Private answer transcript");
        expect(diagnostics[0]).not.toHaveProperty("sessionId");
        expect(diagnostics[0]).not.toHaveProperty("ownerId");
    });

    it("denies cross-origin and missing identity before invoking the provider", async () => {
        const transcribe = vi.fn();
        const denied = await handleVoiceTranscriptionRequest({
            request: new Request("http://localhost:3000/voice", {
                method: "POST",
                body: new Uint8Array([1]),
                headers: { origin: "https://evil.example", "content-type": "audio/webm" },
            }),
            sessionId: "session-1",
            audience: "candidate",
            resolveSessionIdentity: async () => ({ ownerId: "owner-1" }),
            createRepository: () => repository(),
            runtime: {
                provider: "fixture",
                profileId: "fixture_voice_transcription_v1",
                modelName: "fixture-model",
                configurationFingerprint: hash,
                supportedMimeTypes: ["audio/webm"],
                transcribe,
            },
        });
        expect(denied.status).toBe(403);

        const unauthenticated = await handleVoiceTranscriptionRequest({
            request: request(),
            sessionId: "session-1",
            audience: "candidate",
            resolveSessionIdentity: async () => null,
            createRepository: () => repository(),
            runtime: {
                provider: "fixture",
                profileId: "fixture_voice_transcription_v1",
                modelName: "fixture-model",
                configurationFingerprint: hash,
                supportedMimeTypes: ["audio/webm"],
                transcribe,
            },
        });
        expect(unauthenticated.status).toBe(401);
        expect(transcribe).not.toHaveBeenCalled();
    });

    it("returns a safe unsupported-format response with profile-only diagnostics", async () => {
        const diagnostics: VoiceTranscriptionRouteDiagnostic[] = [];
        const transcribe = vi.fn();
        const response = await handleVoiceTranscriptionRequest({
            request: request(),
            sessionId: "session-1",
            audience: "candidate",
            resolveSessionIdentity: async () => ({ ownerId: "owner-1" }),
            createRepository: () => repository(),
            runtime: {
                provider: "google_genai",
                profileId: "google_gemini_2_5_flash_voice_transcription_v1",
                modelName: "gemini-2.5-flash",
                configurationFingerprint: hash,
                supportedMimeTypes: ["audio/wav"],
                transcribe,
            },
            recordDiagnostic: (event) => diagnostics.push(event),
        });

        expect(response.status).toBe(415);
        await expect(response.json()).resolves.toEqual({
            error: "This recording format is not supported.",
        });
        expect(transcribe).not.toHaveBeenCalled();
        expect(diagnostics).toEqual([expect.objectContaining({
            outcome: "denied",
            statusCode: 415,
            failureClass: "unsupported_media_type",
            provider: "google_genai",
            profileId: "google_gemini_2_5_flash_voice_transcription_v1",
            configurationFingerprint: hash,
        })]);
        expect(JSON.stringify(diagnostics)).not.toContain("session-1");
    });
});
