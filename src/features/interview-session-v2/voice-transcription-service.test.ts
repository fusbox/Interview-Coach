import { describe, expect, it, vi } from "vitest";

import type {
    VoiceTranscriptDraft,
    VoiceTranscriptionClaimResult,
    VoiceTranscriptionRunRecord,
} from "./voice-answer-transcription";
import {
    VoiceTranscriptionServiceError,
    executeVoiceTranscription,
    type VoiceTranscriptionClaimInput,
    type VoiceTranscriptionCompletionInput,
    type VoiceTranscriptionServiceRepository,
} from "./voice-transcription-service";
import type { VoiceTranscriptionProviderRuntime } from "./voice-transcription-runtime";

const hash = "a".repeat(64);
const fixedNow = () => new Date("2026-07-21T12:00:00.000Z");

function createRun(input: Parameters<VoiceTranscriptionServiceRepository["claimRun"]>[0]): VoiceTranscriptionRunRecord {
    return {
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
    };
}

function createRuntime(transcribe = vi.fn(async () => ({ transcriptText: "I checked the finished work." }))): VoiceTranscriptionProviderRuntime {
    return {
        provider: "fixture",
        profileId: "fixture_voice_transcription_v1",
        modelName: "fixture-model",
        configurationFingerprint: hash,
        supportedMimeTypes: ["audio/webm"],
        transcribe,
    };
}

function command(repository: VoiceTranscriptionServiceRepository, runtime: VoiceTranscriptionProviderRuntime | null) {
    return executeVoiceTranscription({
        practiceSessionId: "session-1",
        audienceOwnerId: "owner-1",
        questionSlotId: "slot-1",
        questionIndex: 0,
        idempotencyKey: "command-1",
        intent: "submit_answer",
        audioData: new Uint8Array([1, 2, 3]),
        acceptedMimeType: "audio/webm",
        audioByteCount: 3,
        audioDurationMs: 5000,
        repository,
        runtime,
        now: fixedNow,
    });
}

describe("voice transcription service", () => {
    it("claims once, invokes the provider, and commits a recoverable transcript", async () => {
        let claimedRun: VoiceTranscriptionRunRecord | null = null;
        const claimRun = vi.fn(async (input: VoiceTranscriptionClaimInput): Promise<VoiceTranscriptionClaimResult> => {
            claimedRun = createRun(input);
            return { outcome: "acquired", run: claimedRun, draft: null };
        });
        const completeRunAndSaveDraft = vi.fn(async (
            input: VoiceTranscriptionCompletionInput,
        ): Promise<{ run: VoiceTranscriptionRunRecord; draft: VoiceTranscriptDraft }> => {
            const draft: VoiceTranscriptDraft = {
                status: "voice_transcript_draft",
                slotId: input.questionSlotId,
                questionIndex: input.questionIndex,
                transcriptText: input.transcriptText,
                sourceTranscriptionRunId: input.voiceTranscriptionRunId,
                submissionPath: input.submissionPath,
                updatedAt: input.completedAt,
            };
            return {
                run: {
                    ...claimedRun!,
                    lifecycleState: "completed",
                    outputFingerprint: hash,
                    completedAt: input.completedAt,
                },
                draft,
            };
        });
        const repository: VoiceTranscriptionServiceRepository = {
            claimRun,
            recoverRun: vi.fn(),
            completeRunAndSaveDraft,
            failRun: vi.fn(),
        };
        const runtime = createRuntime();
        await expect(command(repository, runtime)).resolves.toMatchObject({
            disposition: "transcript_ready",
            replayed: false,
            draft: { transcriptText: "I checked the finished work.", submissionPath: "quick_submit" },
        });
        expect(runtime.transcribe).toHaveBeenCalledOnce();
        expect(completeRunAndSaveDraft).toHaveBeenCalledOnce();
    });

    it("replays a completed current draft without another provider call", async () => {
        const transcribe = vi.fn(async () => ({ transcriptText: "must not run" }));
        const runtime = createRuntime(transcribe);
        const repository = createClaimOnlyRepository((input) => {
            const run = { ...createRun(input), lifecycleState: "completed" as const, outputFingerprint: hash, completedAt: input.requestedAt };
            return {
                outcome: "replayed",
                run,
                draft: {
                    status: "voice_transcript_draft",
                    slotId: "slot-1",
                    questionIndex: 0,
                    transcriptText: "Saved transcript.",
                    sourceTranscriptionRunId: run.voiceTranscriptionRunId,
                    submissionPath: "quick_submit",
                    updatedAt: input.requestedAt,
                },
            };
        });
        await expect(command(repository, runtime)).resolves.toMatchObject({
            replayed: true,
            draft: { transcriptText: "Saved transcript." },
        });
        expect(transcribe).not.toHaveBeenCalled();
    });

    it("recovers a completed transcript while the provider is unavailable", async () => {
        const repository = createClaimOnlyRepository((input) => {
            const claimInput = {
                ...input,
                voiceTranscriptionRunId: "run-1",
            };
            const run = {
                ...createRun(claimInput),
                lifecycleState: "completed" as const,
                outputFingerprint: hash,
                completedAt: claimInput.requestedAt,
            };
            return {
                outcome: "replayed",
                run,
                draft: {
                    status: "voice_transcript_draft",
                    slotId: input.questionSlotId,
                    questionIndex: input.questionIndex,
                    transcriptText: "Recovered transcript.",
                    sourceTranscriptionRunId: run.voiceTranscriptionRunId,
                    submissionPath: input.submissionPath,
                    updatedAt: claimInput.requestedAt,
                },
            };
        });
        await expect(command(repository, null)).resolves.toMatchObject({
            replayed: true,
            draft: { transcriptText: "Recovered transcript." },
        });
        expect(repository.claimRun).not.toHaveBeenCalled();
        expect(repository.recoverRun).toHaveBeenCalledOnce();
    });

    it("maps active, conflicting, and exhausted claims without provider duplication", async () => {
        for (const [outcome, expected] of [
            ["in_progress", "transcription_pending"],
            ["idempotency_conflict", "idempotency_conflict"],
            ["generation_limit", "generation_limit"],
        ] as const) {
            const runtime = createRuntime();
            const repository = createClaimOnlyRepository((input) => ({
                outcome,
                run: createRun(input),
                draft: null,
            }));
            if (outcome === "in_progress") {
                await expect(command(repository, runtime)).resolves.toMatchObject({ disposition: expected });
            } else {
                await expect(command(repository, runtime)).rejects.toMatchObject({
                    failureClass: expected,
                } satisfies Partial<VoiceTranscriptionServiceError>);
            }
            expect(runtime.transcribe).not.toHaveBeenCalled();
        }
    });

    it("rejects a new unsupported container before claim or provider work", async () => {
        const runtime = {
            ...createRuntime(),
            supportedMimeTypes: ["audio/wav"],
        };
        const repository: VoiceTranscriptionServiceRepository = {
            claimRun: vi.fn(),
            recoverRun: vi.fn(async () => null),
            completeRunAndSaveDraft: vi.fn(),
            failRun: vi.fn(),
        };

        await expect(command(repository, runtime)).rejects.toMatchObject({
            statusCode: 415,
            failureClass: "unsupported_media_type",
        });
        expect(repository.recoverRun).toHaveBeenCalledOnce();
        expect(repository.claimRun).not.toHaveBeenCalled();
        expect(runtime.transcribe).not.toHaveBeenCalled();
    });

    it("still recovers a completed operation when the current provider no longer supports its container", async () => {
        const runtime = {
            ...createRuntime(),
            supportedMimeTypes: ["audio/wav"],
        };
        const repository = createClaimOnlyRepository((input) => {
            const run = {
                ...createRun(input),
                lifecycleState: "completed" as const,
                outputFingerprint: hash,
                completedAt: input.requestedAt,
            };
            return {
                outcome: "replayed",
                run,
                draft: {
                    status: "voice_transcript_draft",
                    slotId: input.questionSlotId,
                    questionIndex: input.questionIndex,
                    transcriptText: "Recovered old-container transcript.",
                    sourceTranscriptionRunId: run.voiceTranscriptionRunId,
                    submissionPath: input.submissionPath,
                    updatedAt: input.requestedAt,
                },
            };
        });

        await expect(command(repository, runtime)).resolves.toMatchObject({
            replayed: true,
            draft: { transcriptText: "Recovered old-container transcript." },
        });
        expect(runtime.transcribe).not.toHaveBeenCalled();
    });

    it("terminalizes provider failure without creating a draft", async () => {
        const repository = createClaimOnlyRepository((input) => ({
            outcome: "acquired",
            run: createRun(input),
            draft: null,
        }));
        const runtime = createRuntime(vi.fn(async () => {
            throw new Error("private provider detail");
        }));
        await expect(command(repository, runtime)).rejects.toMatchObject({
            statusCode: 503,
            failureClass: "provider_failed",
        });
        expect(repository.failRun).toHaveBeenCalledWith(expect.objectContaining({ errorCode: "PROVIDER_FAILED" }));
        expect(repository.completeRunAndSaveDraft).not.toHaveBeenCalled();
    });
});

function createClaimOnlyRepository(
    claim: (input: Parameters<VoiceTranscriptionServiceRepository["claimRun"]>[0]) => VoiceTranscriptionClaimResult,
): VoiceTranscriptionServiceRepository {
    return {
        claimRun: vi.fn(async (input) => claim(input)),
        recoverRun: vi.fn(async (input) => claim({
            voiceTranscriptionRunId: "recovered-run",
            acceptedMimeType: "audio/webm",
            audioByteCount: 3,
            audioDurationMs: 5000,
            provider: "fixture",
            profileId: "fixture-v1",
            modelName: "fixture-model",
            configurationFingerprint: hash,
            requestedAt: "2026-07-21T12:00:00.000Z",
            claimExpiresAt: "2026-07-21T12:02:00.000Z",
            ...input,
        })),
        completeRunAndSaveDraft: vi.fn(),
        failRun: vi.fn(async () => null),
    };
}
