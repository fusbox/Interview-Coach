export const AI_GENERATION_SURFACES = [
    "question_generation",
    "answer_feedback",
    "hint",
    "strong_response",
    "session_debrief",
] as const;

export type AiGenerationSurface = (typeof AI_GENERATION_SURFACES)[number];

export const AI_GENERATION_STATUSES = ["success", "failed", "partial"] as const;

export type AiGenerationStatus = (typeof AI_GENERATION_STATUSES)[number];

export const AI_GENERATION_REDACTION_STATUSES = ["raw", "redacted", "not_applicable"] as const;

export type AiGenerationRedactionStatus = (typeof AI_GENERATION_REDACTION_STATUSES)[number];

export type AiGenerationTokenUsage = {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
};

export const AI_GENERATION_RETENTION_CLASSES = [
    "eval_redacted",
    "eval_raw_restricted",
    "operational_debug",
] as const;

export type AiGenerationRetentionClass = (typeof AI_GENERATION_RETENTION_CLASSES)[number];

export type AiGenerationRecord = {
    generationId?: string;
    appName: string;
    surface: AiGenerationSurface;
    status: AiGenerationStatus;
    inputSnapshot: unknown;
    contextArtifacts?: unknown[];
    promptSnapshot?: unknown;
    promptVersion: string;
    modelProvider: string;
    modelName: string;
    modelParams?: Record<string, unknown>;
    rawOutput?: unknown;
    parsedOutput?: unknown;
    latencyMs: number;
    tokenUsage?: AiGenerationTokenUsage;
    costEstimate?: number;
    traceId?: string;
    correlationId?: string;
    sourceRefs?: unknown[];
    createdBy?: string;
    sessionId?: string;
    inviteBatchId?: string;
    candidateId?: string;
    error?: unknown;
    privacyFlags?: string[];
    redactionStatus: AiGenerationRedactionStatus;
    retentionClass?: AiGenerationRetentionClass;
    retentionUntil?: string;
};

export type AiGenerationCaptureContext = {
    appName?: string;
    correlationId?: string;
    traceId?: string;
    sourceRefs?: unknown[];
    createdBy?: string;
    sessionId?: string;
    inviteBatchId?: string;
    candidateId?: string;
    privacyFlags?: string[];
};
