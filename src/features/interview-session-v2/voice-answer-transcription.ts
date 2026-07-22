export type VoiceTranscriptSubmissionPath = "quick_submit" | "transcript_review";
export type VoiceTranscriptionCommandIntent = "submit_answer" | "review_transcript";
export type VoiceTranscriptionLifecycleState = "requested" | "completed" | "failed";
export type VoiceTranscriptionClaimOutcome =
    | "acquired"
    | "replayed"
    | "in_progress"
    | "idempotency_conflict"
    | "superseded"
    | "generation_limit"
    | "provider_unavailable";

export type VoiceTranscriptDraft = {
    status: "voice_transcript_draft";
    slotId: string;
    questionIndex: number;
    transcriptText: string;
    sourceTranscriptionRunId: string;
    submissionPath: VoiceTranscriptSubmissionPath;
    updatedAt: string;
};

export type VoiceTranscriptDrafts = Record<string, VoiceTranscriptDraft>;

export type VoiceTranscriptionRunRecord = {
    voiceTranscriptionRunId: string;
    practiceSessionId: string;
    audienceOwnerId: string;
    questionSlotId: string;
    questionIndex: number;
    idempotencyKeyHash: string;
    audioInputFingerprint: string;
    acceptedMimeType: string;
    audioByteCount: number;
    audioDurationMs: number | null;
    submissionPath: VoiceTranscriptSubmissionPath;
    provider: string;
    profileId: string;
    modelName: string;
    configurationFingerprint: string;
    generationAttempt: number;
    lifecycleState: VoiceTranscriptionLifecycleState;
    outputFingerprint: string | null;
    errorCode: string | null;
    requestedAt: string;
    claimExpiresAt: string;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

export type VoiceTranscriptionClaimResult = {
    outcome: VoiceTranscriptionClaimOutcome;
    run: VoiceTranscriptionRunRecord | null;
    draft: VoiceTranscriptDraft | null;
};

export type VoiceTranscriptionCompletionResult = {
    run: VoiceTranscriptionRunRecord;
    draft: VoiceTranscriptDraft;
};

export function resolveVoiceTranscriptSubmissionPath(
    intent: VoiceTranscriptionCommandIntent,
): VoiceTranscriptSubmissionPath {
    return intent === "submit_answer" ? "quick_submit" : "transcript_review";
}

export function createVoiceTranscriptDraft(input: {
    slotId: string;
    questionIndex: number;
    transcriptText: string;
    sourceTranscriptionRunId: string;
    submissionPath: VoiceTranscriptSubmissionPath;
    updatedAt: string;
}): VoiceTranscriptDraft {
    const draft = normalizeVoiceTranscriptDraft({
        status: "voice_transcript_draft",
        ...input,
    });
    if (!draft) throw new Error("Voice transcript draft input is invalid.");
    return draft;
}

export function normalizeVoiceTranscriptDrafts(value: unknown): VoiceTranscriptDrafts {
    if (!isRecord(value)) return {};
    return Object.fromEntries(
        Object.entries(value)
            .map(([slotId, draft]): [string, VoiceTranscriptDraft | null] => (
                [slotId, normalizeVoiceTranscriptDraft(draft)]
            ))
            .filter((entry): entry is [string, VoiceTranscriptDraft] => (
                Boolean(entry[1]) && entry[0] === entry[1]?.slotId
            )),
    );
}

export function normalizeVoiceTranscriptDraft(value: unknown): VoiceTranscriptDraft | null {
    if (!isRecord(value) || value.status !== "voice_transcript_draft") return null;
    const slotId = readString(value.slotId);
    const questionIndex = readNonNegativeInteger(value.questionIndex);
    const transcriptText = readString(value.transcriptText);
    const sourceTranscriptionRunId = readString(value.sourceTranscriptionRunId);
    const submissionPath = readSubmissionPath(value.submissionPath);
    const updatedAt = readTimestamp(value.updatedAt);
    if (
        !slotId
        || questionIndex === null
        || !transcriptText
        || !sourceTranscriptionRunId
        || !submissionPath
        || !updatedAt
    ) return null;
    return {
        status: "voice_transcript_draft",
        slotId,
        questionIndex,
        transcriptText,
        sourceTranscriptionRunId,
        submissionPath,
        updatedAt,
    };
}

export function isVoiceTranscriptDraftResolvedByAnswer(
    draft: VoiceTranscriptDraft | null,
    answer: {
        submittedAt: string;
        sourceVoiceTranscriptionRunId?: string | null;
    } | null,
) {
    if (!draft || !answer) return false;
    if (draft.sourceTranscriptionRunId === answer.sourceVoiceTranscriptionRunId) return true;

    const draftUpdatedAt = Date.parse(draft.updatedAt);
    const answerSubmittedAt = Date.parse(answer.submittedAt);
    return Number.isFinite(draftUpdatedAt)
        && Number.isFinite(answerSubmittedAt)
        && draftUpdatedAt <= answerSubmittedAt;
}

export function normalizeVoiceTranscriptionRunRecord(value: unknown): VoiceTranscriptionRunRecord | null {
    if (!isRecord(value)) return null;
    const voiceTranscriptionRunId = readString(value.voice_transcription_run_id ?? value.voiceTranscriptionRunId);
    const practiceSessionId = readString(value.practice_session_id ?? value.practiceSessionId);
    const audienceOwnerId = readString(value.audience_owner_id ?? value.audienceOwnerId);
    const questionSlotId = readString(value.question_slot_id ?? value.questionSlotId);
    const questionIndex = readNonNegativeInteger(value.question_index ?? value.questionIndex);
    const idempotencyKeyHash = readHash(value.idempotency_key_hash ?? value.idempotencyKeyHash);
    const audioInputFingerprint = readHash(value.audio_input_fingerprint ?? value.audioInputFingerprint);
    const acceptedMimeType = readString(value.accepted_mime_type ?? value.acceptedMimeType);
    const audioByteCount = readPositiveInteger(value.audio_byte_count ?? value.audioByteCount);
    const audioDurationMs = readNullablePositiveInteger(value.audio_duration_ms ?? value.audioDurationMs);
    const submissionPath = readSubmissionPath(value.submission_path ?? value.submissionPath);
    const provider = readString(value.provider);
    const profileId = readString(value.profile_id ?? value.profileId);
    const modelName = readString(value.model_name ?? value.modelName);
    const configurationFingerprint = readHash(value.configuration_fingerprint ?? value.configurationFingerprint);
    const generationAttempt = readPositiveInteger(value.generation_attempt ?? value.generationAttempt);
    const lifecycleState = readLifecycleState(value.lifecycle_state ?? value.lifecycleState);
    const outputFingerprint = readNullableHash(value.output_fingerprint ?? value.outputFingerprint);
    const errorCode = readNullableString(value.error_code ?? value.errorCode);
    const requestedAt = readTimestamp(value.requested_at ?? value.requestedAt);
    const claimExpiresAt = readTimestamp(value.claim_expires_at ?? value.claimExpiresAt);
    const completedAt = readNullableTimestamp(value.completed_at ?? value.completedAt);
    const createdAt = readTimestamp(value.created_at ?? value.createdAt);
    const updatedAt = readTimestamp(value.updated_at ?? value.updatedAt);
    if (
        !voiceTranscriptionRunId
        || !practiceSessionId
        || !audienceOwnerId
        || !questionSlotId
        || questionIndex === null
        || !idempotencyKeyHash
        || !audioInputFingerprint
        || !acceptedMimeType
        || audioByteCount === null
        || audioDurationMs === undefined
        || !submissionPath
        || !provider
        || !profileId
        || !modelName
        || !configurationFingerprint
        || generationAttempt === null
        || !lifecycleState
        || outputFingerprint === undefined
        || errorCode === undefined
        || !requestedAt
        || !claimExpiresAt
        || completedAt === undefined
        || !createdAt
        || !updatedAt
    ) return null;
    if (
        (lifecycleState === "requested" && (outputFingerprint !== null || errorCode !== null || completedAt !== null))
        || (lifecycleState === "completed" && (!outputFingerprint || errorCode !== null || completedAt === null))
        || (lifecycleState === "failed" && (outputFingerprint !== null || !errorCode || completedAt === null))
    ) return null;
    return {
        voiceTranscriptionRunId,
        practiceSessionId,
        audienceOwnerId,
        questionSlotId,
        questionIndex,
        idempotencyKeyHash,
        audioInputFingerprint,
        acceptedMimeType,
        audioByteCount,
        audioDurationMs,
        submissionPath,
        provider,
        profileId,
        modelName,
        configurationFingerprint,
        generationAttempt,
        lifecycleState,
        outputFingerprint,
        errorCode,
        requestedAt,
        claimExpiresAt,
        completedAt,
        createdAt,
        updatedAt,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNullableString(value: unknown) {
    return value === null || value === undefined ? null : readString(value) ?? undefined;
}

function readHash(value: unknown) {
    const text = readString(value);
    return text && /^[a-f0-9]{64}$/.test(text) ? text : null;
}

function readNullableHash(value: unknown) {
    return value === null || value === undefined ? null : readHash(value) ?? undefined;
}

function readNonNegativeInteger(value: unknown) {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function readPositiveInteger(value: unknown) {
    return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function readNullablePositiveInteger(value: unknown) {
    return value === null || value === undefined ? null : readPositiveInteger(value) ?? undefined;
}

function readTimestamp(value: unknown) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
    const text = readString(value);
    return text && !Number.isNaN(Date.parse(text)) ? text : null;
}

function readNullableTimestamp(value: unknown) {
    return value === null || value === undefined ? null : readTimestamp(value) ?? undefined;
}

function readSubmissionPath(value: unknown): VoiceTranscriptSubmissionPath | null {
    return value === "quick_submit" || value === "transcript_review" ? value : null;
}

function readLifecycleState(value: unknown): VoiceTranscriptionLifecycleState | null {
    return value === "requested" || value === "completed" || value === "failed" ? value : null;
}
