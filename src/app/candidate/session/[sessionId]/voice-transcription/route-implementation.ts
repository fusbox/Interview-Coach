import { resolveCandidateOwnedRequestIdentity } from "@/features/candidate-auth-v2/candidate-route-authorization";
import { createCandidatePostgresQueryClient } from "@/features/candidate-auth-v2/candidate-postgres-runtime";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import { createCandidateVoiceTranscriptionRepository } from "@/features/candidate-session-v2/candidate-voice-transcription-repository";
import {
    executeVoiceTranscription,
    VoiceTranscriptionServiceError,
    type VoiceTranscriptionServiceRepository,
} from "@/features/interview-session-v2/voice-transcription-service";
import {
    parseVoiceTranscriptionMediaRequest,
    VoiceTranscriptionMediaError,
} from "@/features/interview-session-v2/voice-transcription-media-contract";
import {
    createVoiceTranscriptionRuntimeFromEnvironment,
    type VoiceTranscriptionProviderRuntime,
} from "@/features/interview-session-v2/voice-transcription-runtime";
import { isTrustedSameOriginMutationRequest } from "@/lib/server/trusted-mutation-request";

export type VoiceTranscriptionAudience = "candidate" | "invited";

export type VoiceTranscriptionRouteDiagnostic = {
    event: "voice_transcription";
    requestId: string;
    audience: VoiceTranscriptionAudience;
    outcome: "accepted" | "pending" | "denied" | "unavailable";
    statusCode: number;
    failureClass?: string;
    provider?: string;
    profileId?: string;
    configurationFingerprint?: string;
    generationAttempt?: number;
    audioSizeBucket?: "under_256kb" | "under_1mb" | "under_4mb";
    durationBucket?: "under_30s" | "under_90s" | "under_180s";
    durationMs: number;
};

export type VoiceTranscriptionRouteDependencies = {
    audience: VoiceTranscriptionAudience;
    resolveSessionIdentity: (request: Request) => Promise<{ ownerId: string } | null>;
    createRepository: (ownerId: string) => VoiceTranscriptionServiceRepository;
    runtime: VoiceTranscriptionProviderRuntime | null;
    recordDiagnostic?: (event: VoiceTranscriptionRouteDiagnostic) => void;
};

export async function handleVoiceTranscriptionRequest(input: {
    request: Request;
    sessionId: string;
} & VoiceTranscriptionRouteDependencies) {
    const startedAt = Date.now();
    const requestId = crypto.randomUUID();
    const diagnostic = input.recordDiagnostic ?? recordDefaultDiagnostic;
    if (!isTrustedSameOriginMutationRequest(input.request)) {
        return finishJson(403, "Voice transcription request was denied.", "cross_origin_denied");
    }

    let identity: { ownerId: string } | null;
    try {
        identity = await input.resolveSessionIdentity(input.request);
    } catch {
        return finishJson(503, "Voice transcription is unavailable.", "identity_lookup_failed");
    }
    if (!identity) return finishJson(401, "Practice access is required.", "identity_missing");
    let media;
    try {
        media = await parseVoiceTranscriptionMediaRequest(input.request);
    } catch (error) {
        if (error instanceof VoiceTranscriptionMediaError) {
            return finishJson(error.statusCode, "Invalid voice recording request.", error.failureClass);
        }
        return finishJson(400, "Invalid voice recording request.", "media_invalid");
    }

    try {
        const result = await executeVoiceTranscription({
            practiceSessionId: input.sessionId,
            audienceOwnerId: identity.ownerId,
            questionSlotId: media.questionSlotId,
            questionIndex: media.questionIndex,
            idempotencyKey: media.idempotencyKey,
            intent: media.intent,
            audioData: media.audioData,
            acceptedMimeType: media.acceptedMimeType,
            audioByteCount: media.audioByteCount,
            audioDurationMs: media.audioDurationMs,
            repository: input.createRepository(identity.ownerId),
            runtime: input.runtime,
        });
        const statusCode = result.disposition === "transcription_pending" ? 202 : 200;
        diagnostic({
            event: "voice_transcription",
            requestId,
            audience: input.audience,
            outcome: statusCode === 202 ? "pending" : "accepted",
            statusCode,
            provider: result.run.provider,
            profileId: result.run.profileId,
            configurationFingerprint: result.run.configurationFingerprint,
            generationAttempt: result.run.generationAttempt,
            audioSizeBucket: bucketAudioSize(media.audioByteCount),
            durationBucket: bucketDuration(media.audioDurationMs),
            durationMs: Date.now() - startedAt,
        });
        return Response.json({
            status: result.disposition,
            replayed: result.replayed,
            transcriptDraft: result.draft,
        }, {
            status: statusCode,
            headers: { "Cache-Control": "no-store" },
        });
    } catch (error) {
        if (error instanceof VoiceTranscriptionServiceError) {
            return finishJson(error.statusCode, publicMessage(error.statusCode), error.failureClass, media);
        }
        return finishJson(503, "Voice transcription is unavailable.", "transcription_failed", media);
    }

    function finishJson(
        statusCode: number,
        message: string,
        failureClass: string,
        media?: { audioByteCount: number; audioDurationMs: number },
    ) {
        diagnostic({
            event: "voice_transcription",
            requestId,
            audience: input.audience,
            outcome: statusCode === 503 ? "unavailable" : "denied",
            statusCode,
            failureClass,
            ...(media && input.runtime ? {
                provider: input.runtime.provider,
                profileId: input.runtime.profileId,
                configurationFingerprint: input.runtime.configurationFingerprint,
            } : {}),
            ...(media ? {
                audioSizeBucket: bucketAudioSize(media.audioByteCount),
                durationBucket: bucketDuration(media.audioDurationMs),
            } : {}),
            durationMs: Date.now() - startedAt,
        });
        return Response.json({ error: message }, {
            status: statusCode,
            headers: { "Cache-Control": "no-store" },
        });
    }
}

export function createDefaultCandidateVoiceTranscriptionDependencies(): VoiceTranscriptionRouteDependencies {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    let runtime: VoiceTranscriptionProviderRuntime | null = null;
    try {
        runtime = createVoiceTranscriptionRuntimeFromEnvironment({ env: process.env });
    } catch {
        runtime = null;
    }
    if (!databaseUrl) {
        return {
            audience: "candidate",
            resolveSessionIdentity: async () => null,
            createRepository: () => unavailableRepository(),
            runtime,
        };
    }
    const queryClient = createCandidatePostgresQueryClient(databaseUrl);
    return {
        audience: "candidate",
        resolveSessionIdentity: async (request) => {
            const identity = await resolveCandidateOwnedRequestIdentity(request, queryClient);
            return identity ? { ownerId: identity.candidateProfileId } : null;
        },
        createRepository: () => createCandidateServiceRepository(
            createCandidateVoiceTranscriptionRepository(queryClient),
        ),
        runtime,
    };
}

export function createCandidateServiceRepository(
    repository: ReturnType<typeof createCandidateVoiceTranscriptionRepository>,
): VoiceTranscriptionServiceRepository {
    return {
        claimRun: (value) => repository.claimRun({
            candidateVoiceTranscriptionRunId: value.voiceTranscriptionRunId,
            candidatePracticeSessionId: value.practiceSessionId,
            candidateProfileId: value.audienceOwnerId,
            ...copyClaimFields(value),
        }),
        recoverRun: (value) => repository.recoverRun({
            candidatePracticeSessionId: value.practiceSessionId,
            candidateProfileId: value.audienceOwnerId,
            questionSlotId: value.questionSlotId,
            questionIndex: value.questionIndex,
            idempotencyKeyHash: value.idempotencyKeyHash,
            audioInputFingerprint: value.audioInputFingerprint,
            submissionPath: value.submissionPath,
        }),
        completeRunAndSaveDraft: (value) => repository.completeRunAndSaveDraft({
            candidateVoiceTranscriptionRunId: value.voiceTranscriptionRunId,
            candidatePracticeSessionId: value.practiceSessionId,
            candidateProfileId: value.audienceOwnerId,
            questionSlotId: value.questionSlotId,
            questionIndex: value.questionIndex,
            transcriptText: value.transcriptText,
            submissionPath: value.submissionPath,
            completedAt: value.completedAt,
        }),
        failRun: (value) => repository.failRun({
            candidateVoiceTranscriptionRunId: value.voiceTranscriptionRunId,
            candidatePracticeSessionId: value.practiceSessionId,
            candidateProfileId: value.audienceOwnerId,
            errorCode: value.errorCode,
            completedAt: value.completedAt,
        }),
    };
}

function copyClaimFields(value: Parameters<VoiceTranscriptionServiceRepository["claimRun"]>[0]) {
    return {
        questionSlotId: value.questionSlotId,
        questionIndex: value.questionIndex,
        idempotencyKeyHash: value.idempotencyKeyHash,
        audioInputFingerprint: value.audioInputFingerprint,
        acceptedMimeType: value.acceptedMimeType,
        audioByteCount: value.audioByteCount,
        audioDurationMs: value.audioDurationMs,
        submissionPath: value.submissionPath,
        provider: value.provider,
        profileId: value.profileId,
        modelName: value.modelName,
        configurationFingerprint: value.configurationFingerprint,
        requestedAt: value.requestedAt,
        claimExpiresAt: value.claimExpiresAt,
    };
}

function unavailableRepository(): VoiceTranscriptionServiceRepository {
    const fail = async () => {
        throw new Error("Voice transcription database is unavailable.");
    };
    return { claimRun: fail, recoverRun: fail, completeRunAndSaveDraft: fail, failRun: fail };
}

function publicMessage(statusCode: number) {
    if (statusCode === 404) return "That practice question is not available.";
    if (statusCode === 409) return "This recording request can no longer be used.";
    if (statusCode === 415) return "This recording format is not supported.";
    return "Voice transcription is unavailable.";
}

function bucketAudioSize(value: number): VoiceTranscriptionRouteDiagnostic["audioSizeBucket"] {
    if (value <= 256 * 1_024) return "under_256kb";
    if (value <= 1_024 * 1_024) return "under_1mb";
    return "under_4mb";
}

function bucketDuration(value: number): VoiceTranscriptionRouteDiagnostic["durationBucket"] {
    if (value <= 30_000) return "under_30s";
    if (value <= 90_000) return "under_90s";
    return "under_180s";
}

function recordDefaultDiagnostic(event: VoiceTranscriptionRouteDiagnostic) {
    console.info("voice_transcription", event);
}
