import type { VoiceTranscriptSubmissionPath } from "@/features/interview-session-v2/voice-answer-transcription";

export type CandidateAnswerMode = "text" | "voice";

export type CandidateAnswerDraft = {
    slotId: string;
    questionIndex: number;
    mode: CandidateAnswerMode;
    text: string;
    updatedAt: string;
};

export type CandidateAnswerDrafts = Record<string, CandidateAnswerDraft>;

export type CandidateAnswerSubmissionStatus = "pending_analysis";

export type CandidateAnswerSubmission = {
    slotId: string;
    questionIndex: number;
    mode: CandidateAnswerMode;
    text: string;
    submittedAt: string;
    status: CandidateAnswerSubmissionStatus;
    answerAttemptId?: string;
    attemptNumber?: number;
    trigger?: "initial_submit" | "feedback_retry";
    supersedesAnswerAttemptId?: string | null;
    sourceVoiceTranscriptionRunId?: string | null;
    voiceSubmissionPath?: VoiceTranscriptSubmissionPath | null;
    voiceTranscriptEdited?: boolean | null;
};

export type CandidateAnswerSubmissions = Record<string, CandidateAnswerSubmission>;

export type CandidateAnswerIdempotencyReplayContract = {
    completedStatus: "answer_submit_saved" | "answer_analysis_saved";
    pendingHttpStatus: 409;
    pendingRetryable: true;
    conflictHttpStatus: 409;
    conflictRetryable: false;
};

export type CandidateAnswerSubmitIdempotencyPayload = {
    candidatePracticeSessionId: string;
    slotId: string;
    questionIndex: number;
    mode: CandidateAnswerMode;
    text: string;
    trigger?: "initial_submit" | "feedback_retry";
    supersedesAnswerAttemptId?: string | null;
    sourceVoiceTranscriptionRunId?: string | null;
    voiceSubmissionPath?: VoiceTranscriptSubmissionPath | null;
};

export type CandidateAnswerAnalysisIdempotencyPayload = CandidateAnswerSubmitIdempotencyPayload & {
    submittedAt: string;
    answerAttemptId?: string | null;
};

export type CandidateAnswerSubmitIdempotencyContract = {
    operation: "answer_submit";
    scope: string;
    actorId: string;
    key: string;
    payload: CandidateAnswerSubmitIdempotencyPayload;
    replay: CandidateAnswerIdempotencyReplayContract;
};

export type CandidateAnswerAnalysisIdempotencyContract = {
    operation: "answer_analysis";
    scope: string;
    actorId: string;
    key: string;
    payload: CandidateAnswerAnalysisIdempotencyPayload;
    replay: CandidateAnswerIdempotencyReplayContract;
};

export type CandidateAnswerIdempotencyRecordStatus = "pending" | "completed";

export type CandidateAnswerIdempotencyRecord = {
    recordKey: string;
    operation: CandidateAnswerSubmitIdempotencyContract["operation"] | CandidateAnswerAnalysisIdempotencyContract["operation"];
    scope: string;
    actorId: string;
    key: string;
    payload: CandidateAnswerSubmitIdempotencyPayload | CandidateAnswerAnalysisIdempotencyPayload;
    status: CandidateAnswerIdempotencyRecordStatus;
    requestedAt: string;
    completedAt?: string;
    response?: {
        statusCode: number;
        body: unknown;
    };
};

export type CandidateAnswerIdempotencyRecords = Record<string, CandidateAnswerIdempotencyRecord>;

export type CandidateAnswerIdempotencyDecision =
    | { kind: "start"; record: CandidateAnswerIdempotencyRecord }
    | { kind: "replay"; record: CandidateAnswerIdempotencyRecord; statusCode: number; body: unknown }
    | { kind: "pending"; record: CandidateAnswerIdempotencyRecord }
    | { kind: "conflict"; record: CandidateAnswerIdempotencyRecord };

export const CANDIDATE_ANSWER_PENDING_REQUEST_TTL_MS = 2 * 60 * 1000;

export type CandidateAnswerDraftChanged = {
    status: "answer_draft_changed";
    draft: CandidateAnswerDraft;
};

export type CandidateAnswerSubmitRequest = {
    status: "answer_submit_requested";
    draft: CandidateAnswerDraft;
    requestedAt: string;
    trigger?: "initial_submit" | "feedback_retry";
    supersedesAnswerAttemptId?: string | null;
    sourceVoiceTranscriptionRunId?: string | null;
    voiceSubmissionPath?: VoiceTranscriptSubmissionPath | null;
};

export type CandidateAnswerSubmitUnavailable = {
    status: "answer_submit_unavailable";
    reason: "answer_lifecycle_not_connected";
    request: CandidateAnswerSubmitRequest;
};

export type CandidateAnswerAnalysisRequest = {
    status: "answer_analysis_requested";
    answerSubmission: CandidateAnswerSubmission;
    requestedAt: string;
};

export type CandidateAnswerAnalysisUnavailable = {
    status: "answer_analysis_unavailable";
    reason: "provider_not_configured";
    request: CandidateAnswerAnalysisRequest;
};

export function createCandidateAnswerDraftChange({
    slotId,
    questionIndex,
    mode,
    text,
    now,
}: {
    slotId: string;
    questionIndex: number;
    mode: CandidateAnswerMode;
    text: string;
    now: Date;
}): CandidateAnswerDraftChanged {
    return {
        status: "answer_draft_changed",
        draft: {
            slotId,
            questionIndex,
            mode,
            text: text.trim(),
            updatedAt: now.toISOString(),
        },
    };
}

export function createCandidateAnswerSubmitRequest({
    draft,
    requestedAt,
    trigger = "initial_submit",
    supersedesAnswerAttemptId = null,
    sourceVoiceTranscriptionRunId = null,
    voiceSubmissionPath = null,
}: {
    draft: CandidateAnswerDraft;
    requestedAt: Date;
    trigger?: "initial_submit" | "feedback_retry";
    supersedesAnswerAttemptId?: string | null;
    sourceVoiceTranscriptionRunId?: string | null;
    voiceSubmissionPath?: VoiceTranscriptSubmissionPath | null;
}): CandidateAnswerSubmitRequest {
    if (
        (trigger === "initial_submit" && supersedesAnswerAttemptId)
        || (trigger === "feedback_retry" && !readTrimmedString(supersedesAnswerAttemptId))
    ) {
        throw new Error("Answer submit trigger does not match its source attempt.");
    }
    const normalizedVoiceSource = readTrimmedString(sourceVoiceTranscriptionRunId);
    if (
        (draft.mode === "voice" && (!normalizedVoiceSource || !voiceSubmissionPath))
        || (draft.mode === "text" && (normalizedVoiceSource || voiceSubmissionPath))
    ) {
        throw new Error("Answer mode does not match its voice transcription source.");
    }

    return {
        status: "answer_submit_requested",
        draft,
        requestedAt: requestedAt.toISOString(),
        ...(trigger === "feedback_retry" ? {
            trigger,
            supersedesAnswerAttemptId: readTrimmedString(supersedesAnswerAttemptId)!,
        } : {}),
        ...(draft.mode === "voice" ? {
            sourceVoiceTranscriptionRunId: normalizedVoiceSource!,
            voiceSubmissionPath: voiceSubmissionPath!,
        } : {}),
    };
}

export function createCandidateAnswerSubmitUnavailable({
    request,
}: {
    request: CandidateAnswerSubmitRequest;
}): CandidateAnswerSubmitUnavailable {
    return {
        status: "answer_submit_unavailable",
        reason: "answer_lifecycle_not_connected",
        request,
    };
}

export function createCandidateAnswerAnalysisRequest({
    answerSubmission,
    requestedAt,
}: {
    answerSubmission: CandidateAnswerSubmission;
    requestedAt: Date;
}): CandidateAnswerAnalysisRequest {
    return {
        status: "answer_analysis_requested",
        answerSubmission,
        requestedAt: requestedAt.toISOString(),
    };
}

export function createCandidateAnswerAnalysisUnavailable({
    request,
}: {
    request: CandidateAnswerAnalysisRequest;
}): CandidateAnswerAnalysisUnavailable {
    return {
        status: "answer_analysis_unavailable",
        reason: "provider_not_configured",
        request,
    };
}

export function createCandidateAnswerSubmission({
    request,
    attempt,
}: {
    request: CandidateAnswerSubmitRequest;
    attempt?: Pick<
        CandidateAnswerSubmission,
        "answerAttemptId" | "attemptNumber" | "trigger" | "supersedesAnswerAttemptId"
    >;
}): CandidateAnswerSubmission {
    return {
        slotId: request.draft.slotId,
        questionIndex: request.draft.questionIndex,
        mode: request.draft.mode,
        text: request.draft.text,
        submittedAt: request.requestedAt,
        status: "pending_analysis",
        ...(attempt ?? {}),
    };
}

export function createCandidateAnswerSubmitIdempotencyContract({
    candidatePracticeSessionId,
    candidateProfileId,
    request,
    idempotencyKey,
}: {
    candidatePracticeSessionId: string;
    candidateProfileId: string;
    request: CandidateAnswerSubmitRequest;
    idempotencyKey?: string | null;
}): CandidateAnswerSubmitIdempotencyContract {
    const trigger = request.trigger ?? "initial_submit";
    const payload = {
        candidatePracticeSessionId,
        slotId: request.draft.slotId,
        questionIndex: request.draft.questionIndex,
        mode: request.draft.mode,
        text: request.draft.text,
        ...(trigger === "feedback_retry" ? {
            trigger,
            supersedesAnswerAttemptId: request.supersedesAnswerAttemptId!,
        } : {}),
        ...(request.draft.mode === "voice" ? {
            sourceVoiceTranscriptionRunId: request.sourceVoiceTranscriptionRunId!,
            voiceSubmissionPath: request.voiceSubmissionPath!,
        } : {}),
    };

    return {
        operation: "answer_submit",
        scope: `candidate_answer_submit:${candidatePracticeSessionId}:${request.draft.slotId}`,
        actorId: candidateProfileId,
        key: readTrimmedString(idempotencyKey) ?? buildCandidateAnswerIdempotencyKey({
            prefix: "submit",
            candidatePracticeSessionId,
            slotId: request.draft.slotId,
            payload,
        }),
        payload,
        replay: {
            completedStatus: "answer_submit_saved",
            pendingHttpStatus: 409,
            pendingRetryable: true,
            conflictHttpStatus: 409,
            conflictRetryable: false,
        },
    };
}

export function createCandidateAnswerAnalysisIdempotencyContract({
    candidatePracticeSessionId,
    candidateProfileId,
    request,
    idempotencyKey,
}: {
    candidatePracticeSessionId: string;
    candidateProfileId: string;
    request: CandidateAnswerAnalysisRequest;
    idempotencyKey?: string | null;
}): CandidateAnswerAnalysisIdempotencyContract {
    const payload = {
        candidatePracticeSessionId,
        slotId: request.answerSubmission.slotId,
        questionIndex: request.answerSubmission.questionIndex,
        mode: request.answerSubmission.mode,
        text: request.answerSubmission.text,
        submittedAt: request.answerSubmission.submittedAt,
        ...(request.answerSubmission.answerAttemptId ? {
            trigger: request.answerSubmission.trigger ?? "initial_submit",
            supersedesAnswerAttemptId: request.answerSubmission.supersedesAnswerAttemptId ?? null,
            answerAttemptId: request.answerSubmission.answerAttemptId,
        } : {}),
    };

    return {
        operation: "answer_analysis",
        scope: `candidate_answer_analysis:${candidatePracticeSessionId}:${request.answerSubmission.slotId}`,
        actorId: candidateProfileId,
        key: readTrimmedString(idempotencyKey) ?? buildCandidateAnswerIdempotencyKey({
            prefix: "analysis",
            candidatePracticeSessionId,
            slotId: request.answerSubmission.slotId,
            payload,
        }),
        payload,
        replay: {
            completedStatus: "answer_analysis_saved",
            pendingHttpStatus: 409,
            pendingRetryable: true,
            conflictHttpStatus: 409,
            conflictRetryable: false,
        },
    };
}

export function createCandidateAnswerIdempotencyPendingRecord({
    contract,
    requestedAt,
}: {
    contract: CandidateAnswerSubmitIdempotencyContract | CandidateAnswerAnalysisIdempotencyContract;
    requestedAt: Date;
}): CandidateAnswerIdempotencyRecord {
    return {
        recordKey: createCandidateAnswerIdempotencyRecordKey(contract),
        operation: contract.operation,
        scope: contract.scope,
        actorId: contract.actorId,
        key: contract.key,
        payload: contract.payload,
        status: "pending",
        requestedAt: requestedAt.toISOString(),
    };
}

export function completeCandidateAnswerIdempotencyRecord({
    record,
    completedAt,
    statusCode,
    body,
}: {
    record: CandidateAnswerIdempotencyRecord;
    completedAt: Date;
    statusCode: number;
    body: unknown;
}): CandidateAnswerIdempotencyRecord {
    return {
        ...record,
        status: "completed",
        completedAt: completedAt.toISOString(),
        response: {
            statusCode,
            body,
        },
    };
}

export function resolveCandidateAnswerIdempotencyDecision({
    contract,
    records,
    requestedAt,
}: {
    contract: CandidateAnswerSubmitIdempotencyContract | CandidateAnswerAnalysisIdempotencyContract;
    records: CandidateAnswerIdempotencyRecords;
    requestedAt: Date;
}): CandidateAnswerIdempotencyDecision {
    const recordKey = createCandidateAnswerIdempotencyRecordKey(contract);
    const existingRecord = records[recordKey];

    if (!existingRecord) {
        return {
            kind: "start",
            record: createCandidateAnswerIdempotencyPendingRecord({ contract, requestedAt }),
        };
    }

    if (!areIdempotencyPayloadsEqual(existingRecord.payload, contract.payload)) {
        return {
            kind: "conflict",
            record: existingRecord,
        };
    }

    if (existingRecord.status === "completed" && existingRecord.response) {
        return {
            kind: "replay",
            record: existingRecord,
            statusCode: existingRecord.response.statusCode,
            body: existingRecord.response.body,
        };
    }

    if (isPendingAnswerRequestStale(existingRecord, requestedAt)) {
        return {
            kind: "start",
            record: createCandidateAnswerIdempotencyPendingRecord({ contract, requestedAt }),
        };
    }

    return {
        kind: "pending",
        record: existingRecord,
    };
}

function isPendingAnswerRequestStale(record: CandidateAnswerIdempotencyRecord, requestedAt: Date) {
    if (record.status !== "pending") {
        return false;
    }

    const pendingSince = Date.parse(record.requestedAt);
    return Number.isFinite(pendingSince)
        && requestedAt.getTime() - pendingSince >= CANDIDATE_ANSWER_PENDING_REQUEST_TTL_MS;
}

export function normalizeCandidateAnswerIdempotencyRecords(value: unknown): CandidateAnswerIdempotencyRecords {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .map(([recordKey, record]) => [recordKey, normalizeCandidateAnswerIdempotencyRecord(record)])
            .filter((entry): entry is [string, CandidateAnswerIdempotencyRecord] => Boolean(entry[1])),
    );
}

export function normalizeCandidateAnswerDrafts(value: unknown): CandidateAnswerDrafts {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .map(([slotId, draft]) => [slotId, normalizeCandidateAnswerDraft(draft)])
            .filter((entry): entry is [string, CandidateAnswerDraft] => Boolean(entry[1])),
    );
}

export function normalizeCandidateAnswerSubmissions(value: unknown): CandidateAnswerSubmissions {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .map(([slotId, answerSubmission]) => [slotId, normalizeCandidateAnswerSubmission(answerSubmission)])
            .filter((entry): entry is [string, CandidateAnswerSubmission] => Boolean(entry[1])),
    );
}

function normalizeCandidateAnswerDraft(value: unknown): CandidateAnswerDraft | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const draft = value as Partial<CandidateAnswerDraft>;
    const slotId = readNonEmptyString(draft.slotId);
    const updatedAt = readNonEmptyString(draft.updatedAt);
    if (
        !slotId
        || draft.mode !== "text"
        || typeof draft.text !== "string"
        || !updatedAt
        || typeof draft.questionIndex !== "number"
        || !Number.isInteger(draft.questionIndex)
        || draft.questionIndex < 0
    ) {
        return null;
    }

    return {
        slotId,
        questionIndex: draft.questionIndex,
        mode: "text",
        text: draft.text,
        updatedAt,
    };
}

function normalizeCandidateAnswerSubmission(value: unknown): CandidateAnswerSubmission | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const answerSubmission = value as Partial<CandidateAnswerSubmission>;
    const slotId = readNonEmptyString(answerSubmission.slotId);
    const submittedAt = readNonEmptyString(answerSubmission.submittedAt);
    if (
        !slotId
        || (answerSubmission.mode !== "text" && answerSubmission.mode !== "voice")
        || typeof answerSubmission.text !== "string"
        || !submittedAt
        || answerSubmission.status !== "pending_analysis"
        || typeof answerSubmission.questionIndex !== "number"
        || !Number.isInteger(answerSubmission.questionIndex)
        || answerSubmission.questionIndex < 0
    ) {
        return null;
    }

    const sourceVoiceTranscriptionRunId = readNonEmptyString(answerSubmission.sourceVoiceTranscriptionRunId);
    const voiceSubmissionPath = answerSubmission.voiceSubmissionPath === "quick_submit"
        || answerSubmission.voiceSubmissionPath === "transcript_review"
        ? answerSubmission.voiceSubmissionPath
        : null;
    const hasValidVoiceProvenance = answerSubmission.mode === "voice"
        ? Boolean(
            sourceVoiceTranscriptionRunId
            && voiceSubmissionPath
            && typeof answerSubmission.voiceTranscriptEdited === "boolean"
        )
        : !sourceVoiceTranscriptionRunId
            && !voiceSubmissionPath
            && (answerSubmission.voiceTranscriptEdited === null
                || typeof answerSubmission.voiceTranscriptEdited === "undefined");
    if (!hasValidVoiceProvenance) return null;

    const answerAttemptId = readNonEmptyString(answerSubmission.answerAttemptId);
    const hasAttemptMetadata = Boolean(
        answerAttemptId
        || answerSubmission.attemptNumber
        || answerSubmission.trigger
        || typeof answerSubmission.supersedesAnswerAttemptId !== "undefined"
    );
    const hasValidAttemptMetadata = Boolean(
        answerAttemptId
        && typeof answerSubmission.attemptNumber === "number"
        && Number.isInteger(answerSubmission.attemptNumber)
        && answerSubmission.attemptNumber > 0
        && (answerSubmission.trigger === "initial_submit" || answerSubmission.trigger === "feedback_retry")
        && (
            (answerSubmission.attemptNumber === 1
                && answerSubmission.trigger === "initial_submit"
                && (answerSubmission.supersedesAnswerAttemptId === null
                    || typeof answerSubmission.supersedesAnswerAttemptId === "undefined"))
            ||
            (answerSubmission.attemptNumber > 1
                && answerSubmission.trigger === "feedback_retry"
                && Boolean(readNonEmptyString(answerSubmission.supersedesAnswerAttemptId)))
        )
    );

    if (hasAttemptMetadata && !hasValidAttemptMetadata) {
        return null;
    }

    return {
        slotId,
        questionIndex: answerSubmission.questionIndex,
        mode: answerSubmission.mode,
        text: answerSubmission.text,
        submittedAt,
        status: "pending_analysis",
        ...(hasValidAttemptMetadata ? {
            answerAttemptId: answerAttemptId!,
            attemptNumber: answerSubmission.attemptNumber!,
            trigger: answerSubmission.trigger!,
            supersedesAnswerAttemptId: answerSubmission.supersedesAnswerAttemptId ?? null,
        } : {}),
        ...(answerSubmission.mode === "voice" ? {
            sourceVoiceTranscriptionRunId,
            voiceSubmissionPath,
            voiceTranscriptEdited: answerSubmission.voiceTranscriptEdited!,
        } : {}),
    };
}

function readNonEmptyString(value: unknown) {
    return typeof value === "string" && value.trim() ? value : null;
}

function readTrimmedString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function createCandidateAnswerIdempotencyRecordKey(
    contract: CandidateAnswerSubmitIdempotencyContract | CandidateAnswerAnalysisIdempotencyContract,
) {
    return `${contract.operation}:${contract.scope}:${contract.key}`;
}

function normalizeCandidateAnswerIdempotencyRecord(value: unknown): CandidateAnswerIdempotencyRecord | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const record = value as Partial<CandidateAnswerIdempotencyRecord>;
    const recordKey = readNonEmptyString(record.recordKey);
    const scope = readNonEmptyString(record.scope);
    const actorId = readNonEmptyString(record.actorId);
    const key = readNonEmptyString(record.key);
    const requestedAt = readNonEmptyString(record.requestedAt);
    if (
        !recordKey
        || !scope
        || !actorId
        || !key
        || !requestedAt
        || (record.operation !== "answer_submit" && record.operation !== "answer_analysis")
        || (record.status !== "pending" && record.status !== "completed")
        || !record.payload
        || typeof record.payload !== "object"
        || Array.isArray(record.payload)
    ) {
        return null;
    }

    return {
        recordKey,
        operation: record.operation,
        scope,
        actorId,
        key,
        payload: record.payload as CandidateAnswerSubmitIdempotencyPayload | CandidateAnswerAnalysisIdempotencyPayload,
        status: record.status,
        requestedAt,
        completedAt: readNonEmptyString(record.completedAt) ?? undefined,
        response: normalizeIdempotencyResponse(record.response),
    };
}

function normalizeIdempotencyResponse(value: unknown): CandidateAnswerIdempotencyRecord["response"] {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return undefined;
    }

    const response = value as Partial<NonNullable<CandidateAnswerIdempotencyRecord["response"]>>;
    if (typeof response.statusCode !== "number" || !Number.isInteger(response.statusCode)) {
        return undefined;
    }

    return {
        statusCode: response.statusCode,
        body: response.body,
    };
}

function areIdempotencyPayloadsEqual(
    left: CandidateAnswerSubmitIdempotencyPayload | CandidateAnswerAnalysisIdempotencyPayload,
    right: CandidateAnswerSubmitIdempotencyPayload | CandidateAnswerAnalysisIdempotencyPayload,
) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function buildCandidateAnswerIdempotencyKey({
    prefix,
    candidatePracticeSessionId,
    slotId,
    payload,
}: {
    prefix: "submit" | "analysis";
    candidatePracticeSessionId: string;
    slotId: string;
    payload: CandidateAnswerSubmitIdempotencyPayload | CandidateAnswerAnalysisIdempotencyPayload;
}) {
    return `${prefix}:${candidatePracticeSessionId}:${slotId}:${stableHash(JSON.stringify(payload))}`;
}

function stableHash(input: string): number {
    let hash = 0;

    for (let index = 0; index < input.length; index += 1) {
        hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
    }

    return Math.abs(hash);
}
