import { createHash, randomUUID } from "node:crypto";

import {
    resolveVoiceTranscriptSubmissionPath,
    type VoiceTranscriptDraft,
    type VoiceTranscriptSubmissionPath,
    type VoiceTranscriptionClaimResult,
    type VoiceTranscriptionCommandIntent,
    type VoiceTranscriptionCompletionResult,
    type VoiceTranscriptionRunRecord,
} from "./voice-answer-transcription";
import { createVoiceOperationKeyHash } from "./voice-answer-transcription-server";
import {
    normalizeProviderTranscript,
    VoiceTranscriptionRuntimeError,
    type VoiceTranscriptionProviderRuntime,
} from "./voice-transcription-runtime";

const CLAIM_TTL_MS = 120_000;

export type VoiceTranscriptionServiceRepository = {
    claimRun: (input: VoiceTranscriptionClaimInput) => Promise<VoiceTranscriptionClaimResult | null>;
    recoverRun: (input: VoiceTranscriptionRecoveryInput) => Promise<VoiceTranscriptionClaimResult | null>;
    completeRunAndSaveDraft: (input: VoiceTranscriptionCompletionInput) => Promise<VoiceTranscriptionCompletionResult | null>;
    failRun: (input: VoiceTranscriptionFailureInput) => Promise<VoiceTranscriptionRunRecord | null>;
};

export type VoiceTranscriptionRecoveryInput = Pick<
    VoiceTranscriptionClaimInput,
    | "practiceSessionId"
    | "audienceOwnerId"
    | "questionSlotId"
    | "questionIndex"
    | "idempotencyKeyHash"
    | "audioInputFingerprint"
    | "submissionPath"
>;

export type VoiceTranscriptionClaimInput = {
    voiceTranscriptionRunId: string;
    practiceSessionId: string;
    audienceOwnerId: string;
    questionSlotId: string;
    questionIndex: number;
    idempotencyKeyHash: string;
    audioInputFingerprint: string;
    acceptedMimeType: string;
    audioByteCount: number;
    audioDurationMs: number;
    submissionPath: VoiceTranscriptSubmissionPath;
    provider: string;
    profileId: string;
    modelName: string;
    configurationFingerprint: string;
    requestedAt: string;
    claimExpiresAt: string;
};

export type VoiceTranscriptionCompletionInput = {
    voiceTranscriptionRunId: string;
    practiceSessionId: string;
    audienceOwnerId: string;
    questionSlotId: string;
    questionIndex: number;
    transcriptText: string;
    submissionPath: VoiceTranscriptSubmissionPath;
    completedAt: string;
};

export type VoiceTranscriptionFailureInput = {
    voiceTranscriptionRunId: string;
    practiceSessionId: string;
    audienceOwnerId: string;
    errorCode: string;
    completedAt: string;
};

export type VoiceTranscriptionServiceResult = {
    disposition: "transcript_ready" | "transcription_pending";
    replayed: boolean;
    run: VoiceTranscriptionRunRecord;
    draft: VoiceTranscriptDraft | null;
};

export class VoiceTranscriptionServiceError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly failureClass: string,
    ) {
        super("Voice transcription could not be completed.");
        this.name = "VoiceTranscriptionServiceError";
    }
}

export async function executeVoiceTranscription(input: {
    practiceSessionId: string;
    audienceOwnerId: string;
    questionSlotId: string;
    questionIndex: number;
    idempotencyKey: string;
    intent: VoiceTranscriptionCommandIntent;
    audioData: Uint8Array;
    acceptedMimeType: string;
    audioByteCount: number;
    audioDurationMs: number;
    repository: VoiceTranscriptionServiceRepository;
    runtime: VoiceTranscriptionProviderRuntime | null;
    now?: () => Date;
}): Promise<VoiceTranscriptionServiceResult> {
    const now = input.now ?? (() => new Date());
    const requestedAt = now();
    const submissionPath = resolveVoiceTranscriptSubmissionPath(input.intent);
    const operationIdentity = {
        practiceSessionId: input.practiceSessionId,
        audienceOwnerId: input.audienceOwnerId,
        questionSlotId: input.questionSlotId,
        questionIndex: input.questionIndex,
        idempotencyKeyHash: createVoiceOperationKeyHash(input.idempotencyKey),
        audioInputFingerprint: createHash("sha256").update(input.audioData).digest("hex"),
        submissionPath,
    };
    if (
        input.runtime
        && !input.runtime.supportedMimeTypes.includes(input.acceptedMimeType)
    ) {
        const recovery = await input.repository.recoverRun(operationIdentity);
        if (recovery) return resolveNonAcquiredClaim(recovery, "unsupported_media_type");
        throw new VoiceTranscriptionServiceError(415, "unsupported_media_type");
    }
    if (!input.runtime) {
        const recovery = await input.repository.recoverRun(operationIdentity);
        return resolveNonAcquiredClaim(recovery, "provider_not_configured");
    }
    const claimInput: VoiceTranscriptionClaimInput = {
        voiceTranscriptionRunId: randomUUID(),
        ...operationIdentity,
        acceptedMimeType: input.acceptedMimeType,
        audioByteCount: input.audioByteCount,
        audioDurationMs: input.audioDurationMs,
        provider: input.runtime.provider,
        profileId: input.runtime.profileId,
        modelName: input.runtime.modelName,
        configurationFingerprint: input.runtime.configurationFingerprint,
        requestedAt: requestedAt.toISOString(),
        claimExpiresAt: new Date(requestedAt.getTime() + CLAIM_TTL_MS).toISOString(),
    };

    const claim = await input.repository.claimRun(claimInput);
    if (claim?.outcome !== "acquired") return resolveNonAcquiredClaim(claim, "owned_question_not_found");
    if (!claim.run) throw new VoiceTranscriptionServiceError(404, "owned_question_not_found");

    try {
        const providerResult = await input.runtime.transcribe({
            audioData: input.audioData,
            mimeType: input.acceptedMimeType,
            languageHint: "en",
        });
        const transcriptText = normalizeProviderTranscript(providerResult.transcriptText);
        const completedAt = now().toISOString();
        const completion = await input.repository.completeRunAndSaveDraft({
            voiceTranscriptionRunId: claim.run.voiceTranscriptionRunId,
            practiceSessionId: input.practiceSessionId,
            audienceOwnerId: input.audienceOwnerId,
            questionSlotId: input.questionSlotId,
            questionIndex: input.questionIndex,
            transcriptText,
            submissionPath,
            completedAt,
        });
        if (!completion) {
            await failClaim(input.repository, claim.run, input, "TRANSCRIPTION_COMPLETION_LOST", completedAt);
            throw new VoiceTranscriptionServiceError(409, "transcription_completion_lost");
        }
        return {
            disposition: "transcript_ready",
            replayed: false,
            run: completion.run,
            draft: completion.draft,
        };
    } catch (error) {
        if (error instanceof VoiceTranscriptionServiceError) throw error;
        const failureClass = error instanceof VoiceTranscriptionRuntimeError
            ? error.failureClass
            : "provider_failed";
        const completedAt = now().toISOString();
        await failClaim(
            input.repository,
            claim.run,
            input,
            toSafeErrorCode(failureClass),
            completedAt,
        );
        throw new VoiceTranscriptionServiceError(503, failureClass);
    }
}

function resolveNonAcquiredClaim(
    claim: VoiceTranscriptionClaimResult | null,
    missingFailureClass: string,
): VoiceTranscriptionServiceResult {
    if (!claim?.run) throw new VoiceTranscriptionServiceError(
        missingFailureClass === "provider_not_configured" ? 503 : 404,
        missingFailureClass,
    );
    if (claim.outcome === "replayed") {
        if (!claim.draft) throw new VoiceTranscriptionServiceError(409, "transcript_superseded");
        return { disposition: "transcript_ready", replayed: true, run: claim.run, draft: claim.draft };
    }
    if (claim.outcome === "in_progress") {
        return { disposition: "transcription_pending", replayed: true, run: claim.run, draft: null };
    }
    if (claim.outcome === "idempotency_conflict") {
        throw new VoiceTranscriptionServiceError(409, "idempotency_conflict");
    }
    if (claim.outcome === "superseded") {
        throw new VoiceTranscriptionServiceError(409, "transcript_superseded");
    }
    throw new VoiceTranscriptionServiceError(
        503,
        claim.outcome === "generation_limit" ? "generation_limit" : "provider_not_configured",
    );
}

async function failClaim(
    repository: VoiceTranscriptionServiceRepository,
    run: VoiceTranscriptionRunRecord,
    input: { practiceSessionId: string; audienceOwnerId: string },
    errorCode: string,
    completedAt: string,
) {
    await repository.failRun({
        voiceTranscriptionRunId: run.voiceTranscriptionRunId,
        practiceSessionId: input.practiceSessionId,
        audienceOwnerId: input.audienceOwnerId,
        errorCode,
        completedAt,
    });
}

function toSafeErrorCode(value: string) {
    const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return normalized && normalized.length <= 64 ? normalized : "PROVIDER_FAILED";
}
