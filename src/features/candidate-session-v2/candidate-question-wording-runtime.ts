import { createHash } from "node:crypto";

import { z } from "zod";

import { CANDIDATE_SETUP_LIMITS } from "@/features/candidate-setup-v2/candidate-setup-contract";

import {
    candidateQuestionPlanCategoryDetails,
    type CandidateQuestionPlanCategory,
} from "./candidate-question-plan";
import {
    createFixtureCandidateQuestionText,
    parseCandidateQuestionWordingResult,
    type CandidateQuestionWordingGeneration,
    type CandidateQuestionWordingRequest,
    type CandidateQuestionWordingResult,
} from "./candidate-question-wording";

export const CANDIDATE_QUESTION_WORDING_PROVIDER_ENV = "CANDIDATE_QUESTION_WORDING_PROVIDER" as const;
export const CANDIDATE_QUESTION_WORDING_FAULT_MODE_ENV = "CANDIDATE_QUESTION_WORDING_FAULT_MODE" as const;
export const CANDIDATE_QUESTION_WORDING_PROVIDER_REQUEST_VERSION = "candidate_question_wording_provider_request_v2" as const;
export const CANDIDATE_QUESTION_WORDING_PROVIDER_OUTPUT_VERSION = "candidate_question_wording_provider_output_v2" as const;
export const CANDIDATE_QUESTION_WORDING_PRODUCTION_PROMPT_VERSION = "candidate_question_wording_prompt_v2" as const;
export const CANDIDATE_QUESTION_WORDING_RUNTIME_TIMEOUT_MS = 20_000;

export type CandidateQuestionWordingRuntimeMetadata = {
    provider: string;
    modelName: string;
    promptVersion: string;
    profileId: string;
    configurationFingerprint: string;
};

export type CandidateQuestionWordingProviderRequest = {
    status: typeof CANDIDATE_QUESTION_WORDING_PROVIDER_REQUEST_VERSION;
    requestFingerprint: string;
    targetRole: string;
    jobDescription: string;
    resumeText: string | null;
    interviewStage: CandidateQuestionWordingRequest["setupSnapshot"]["interviewStage"];
    slots: Array<{
        slotId: string;
        index: number;
        category: CandidateQuestionPlanCategory;
        purpose: string;
        definition: string;
        answerShape: string[];
        watchFor: string[];
    }>;
};

export type CandidateQuestionWordingProviderTransportResult = {
    rawText: string;
    tokenUsage?: {
        inputTokens?: number;
        outputTokens?: number;
    };
};

export type CandidateQuestionWordingProviderAdapter = {
    metadata: CandidateQuestionWordingRuntimeMetadata;
    generate: (
        request: CandidateQuestionWordingProviderRequest,
        options: { signal: AbortSignal },
    ) => Promise<CandidateQuestionWordingProviderTransportResult>;
};

export type CandidateQuestionWordingRuntimeTelemetry = {
    status: "candidate_question_wording_runtime_telemetry_v1";
    requestFingerprint: string;
    interviewStage: CandidateQuestionWordingProviderRequest["interviewStage"];
    questionCount: number;
    provider: string;
    modelName: string;
    promptVersion: string;
    profileId: string;
    configurationFingerprint: string;
    outcome: "accepted" | "failed" | "rejected";
    errorCode: string | null;
    retryable: boolean;
    latencyMs: number;
    transportAttemptCount: 1;
    tokenUsage: {
        inputTokens: number | null;
        outputTokens: number | null;
    };
};

export type CandidateQuestionWordingRuntime = {
    metadata: CandidateQuestionWordingRuntimeMetadata;
    timeoutMs: number;
    wordQuestions: (request: CandidateQuestionWordingRequest) => Promise<CandidateQuestionWordingResult>;
};

export const CANDIDATE_QUESTION_WORDING_RUNTIME_ERROR_KINDS = [
    "timeout",
    "rate_limited",
    "provider_4xx",
    "provider_5xx",
    "provider_unavailable",
    "misconfigured",
    "safety_blocked",
    "empty_response",
    "invalid_json",
    "invalid_schema",
    "fingerprint_mismatch",
    "question_mapping_mismatch",
    "duplicate_question",
] as const;

export type CandidateQuestionWordingRuntimeErrorKind = typeof CANDIDATE_QUESTION_WORDING_RUNTIME_ERROR_KINDS[number];

export class CandidateQuestionWordingRuntimeError extends Error {
    readonly kind: CandidateQuestionWordingRuntimeErrorKind;
    readonly lifecycleState: "failed" | "rejected";
    readonly retryable: boolean;
    readonly errorCode: string;

    constructor(kind: CandidateQuestionWordingRuntimeErrorKind) {
        super(kind);
        this.name = "CandidateQuestionWordingRuntimeError";
        this.kind = kind;
        this.lifecycleState = isRejectedOutputKind(kind) ? "rejected" : "failed";
        this.retryable = isRetryableKind(kind);
        this.errorCode = `QUESTION_WORDING_PROVIDER_${kind.toUpperCase()}`;
    }
}

const providerOutputSchema = z.object({
    status: z.literal(CANDIDATE_QUESTION_WORDING_PROVIDER_OUTPUT_VERSION),
    requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    questions: z.array(z.object({
        slotId: z.string().trim().min(1).max(80),
        category: z.enum(["screening", "behavioral", "culture_fit", "case_scenario", "technical_role_specific"]),
        questionText: z.string().trim().min(8).max(500),
    }).strict()).min(1).max(10),
}).strict();

export function createCandidateQuestionWordingProviderRequest(
    request: CandidateQuestionWordingRequest,
): CandidateQuestionWordingProviderRequest {
    const fingerprintInput = {
        status: CANDIDATE_QUESTION_WORDING_PROVIDER_REQUEST_VERSION,
        targetRole: boundText(request.setupSnapshot.targetRole, CANDIDATE_SETUP_LIMITS.targetRole),
        jobDescription: boundText(request.setupSnapshot.jobDescription, CANDIDATE_SETUP_LIMITS.jobDescription),
        resumeText: request.setupSnapshot.resumeText
            ? boundText(request.setupSnapshot.resumeText, CANDIDATE_SETUP_LIMITS.resumeText)
            : null,
        interviewStage: request.setupSnapshot.interviewStage,
        slots: request.questionPlanSnapshot.slots.map((slot) => ({
            slotId: slot.id,
            index: slot.index,
            category: slot.category,
            purpose: slot.purpose,
            definition: candidateQuestionPlanCategoryDetails[slot.category].definition,
            answerShape: candidateQuestionPlanCategoryDetails[slot.category].answerShape,
            watchFor: candidateQuestionPlanCategoryDetails[slot.category].watchFor,
        })),
    };

    return {
        ...fingerprintInput,
        requestFingerprint: hashJson(fingerprintInput),
    };
}

export function createCandidateQuestionWordingRuntime({
    adapter,
    timeoutMs = CANDIDATE_QUESTION_WORDING_RUNTIME_TIMEOUT_MS,
    recordTelemetry = () => undefined,
    now = () => new Date(),
}: {
    adapter: CandidateQuestionWordingProviderAdapter;
    timeoutMs?: number;
    recordTelemetry?: (event: CandidateQuestionWordingRuntimeTelemetry) => void | Promise<void>;
    now?: () => Date;
}): CandidateQuestionWordingRuntime {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new Error("Question wording timeout must be positive.");
    }

    return {
        metadata: adapter.metadata,
        timeoutMs,
        async wordQuestions(request) {
            const providerRequest = createCandidateQuestionWordingProviderRequest(request);
            const controller = new AbortController();
            const startedAt = now();
            let timer: ReturnType<typeof setTimeout> | undefined;
            let transportResult: CandidateQuestionWordingProviderTransportResult | null = null;

            try {
                const timeout = new Promise<never>((_, reject) => {
                    timer = setTimeout(() => {
                        controller.abort();
                        reject(new CandidateQuestionWordingRuntimeError("timeout"));
                    }, timeoutMs);
                });
                transportResult = await Promise.race([
                    adapter.generate(providerRequest, { signal: controller.signal }),
                    timeout,
                ]);
                const parsedOutput = parseProviderOutput(transportResult.rawText, providerRequest);
                const parsedQuestions = parseCandidateQuestionWordingResult({
                    status: "questions_worded",
                    questions: parsedOutput.questions,
                }, request.questionPlanSnapshot);
                const generatedAt = now();
                const latencyMs = Math.max(0, generatedAt.getTime() - startedAt.getTime());
                const tokenUsage = normalizeTokenUsage(transportResult.tokenUsage);
                const generation: CandidateQuestionWordingGeneration = {
                    status: "candidate_question_wording_generation_v1",
                    ...adapter.metadata,
                    requestFingerprint: providerRequest.requestFingerprint,
                    generatedAt: generatedAt.toISOString(),
                    validation: {
                        providerRequestVersion: CANDIDATE_QUESTION_WORDING_PROVIDER_REQUEST_VERSION,
                        providerOutputVersion: CANDIDATE_QUESTION_WORDING_PROVIDER_OUTPUT_VERSION,
                        timeoutMs,
                        transportAttemptCount: 1,
                        latencyMs,
                        tokenUsage,
                        rawOutputStored: false,
                        promptStored: false,
                    },
                };
                await safelyRecordTelemetry(recordTelemetry, createTelemetry({
                    request: providerRequest,
                    metadata: adapter.metadata,
                    outcome: "accepted",
                    error: null,
                    latencyMs,
                    tokenUsage,
                }));
                return {
                    ...parsedQuestions,
                    generation,
                };
            } catch (error) {
                const runtimeError = normalizeRuntimeError(error);
                const endedAt = now();
                const latencyMs = Math.max(0, endedAt.getTime() - startedAt.getTime());
                await safelyRecordTelemetry(recordTelemetry, createTelemetry({
                    request: providerRequest,
                    metadata: adapter.metadata,
                    outcome: runtimeError.lifecycleState,
                    error: runtimeError,
                    latencyMs,
                    tokenUsage: normalizeTokenUsage(transportResult?.tokenUsage),
                }));
                throw runtimeError;
            } finally {
                if (timer) clearTimeout(timer);
            }
        },
    };
}

export const candidateQuestionWordingFixtureMetadata: CandidateQuestionWordingRuntimeMetadata = {
    provider: "candidate_v2_question_wording_fixture",
    modelName: "deterministic_fixture_v1",
    promptVersion: CANDIDATE_QUESTION_WORDING_PRODUCTION_PROMPT_VERSION,
    profileId: "candidate_question_wording_fixture_v1",
    configurationFingerprint: hashJson({
        provider: "candidate_v2_question_wording_fixture",
        modelName: "deterministic_fixture_v1",
        promptVersion: CANDIDATE_QUESTION_WORDING_PRODUCTION_PROMPT_VERSION,
        profileId: "candidate_question_wording_fixture_v1",
    }),
};

export function createFixtureCandidateQuestionWordingRuntime(): CandidateQuestionWordingRuntime {
    return createCandidateQuestionWordingRuntime({
        adapter: {
            metadata: candidateQuestionWordingFixtureMetadata,
            async generate(request) {
                const categoryOccurrences = createCategoryOccurrenceTracker();
                return {
                    rawText: JSON.stringify({
                        status: CANDIDATE_QUESTION_WORDING_PROVIDER_OUTPUT_VERSION,
                        requestFingerprint: request.requestFingerprint,
                        questions: request.slots.map((slot) => ({
                            slotId: slot.slotId,
                            category: slot.category,
                            questionText: createFixtureCandidateQuestionText(
                                slot.category,
                                categoryOccurrences.next(slot.category),
                                request.targetRole,
                            ),
                        })),
                    }),
                };
            },
        },
    });
}

export const CANDIDATE_QUESTION_WORDING_FAULT_MODES = [
    "timeout",
    "provider_unavailable",
    "invalid_json",
    "invalid_schema",
    "fingerprint_mismatch",
    "question_mapping_mismatch",
    "duplicate_question",
] as const;

export type CandidateQuestionWordingFaultMode = typeof CANDIDATE_QUESTION_WORDING_FAULT_MODES[number];

export function createFaultInjectionCandidateQuestionWordingRuntime(
    mode: CandidateQuestionWordingFaultMode,
): CandidateQuestionWordingRuntime {
    return createCandidateQuestionWordingRuntime({
        adapter: {
            metadata: {
                provider: "candidate_v2_question_wording_fault_injector",
                modelName: `deterministic_${mode}`,
                promptVersion: CANDIDATE_QUESTION_WORDING_PRODUCTION_PROMPT_VERSION,
                profileId: `candidate_question_wording_fault_${mode}_v1`,
                configurationFingerprint: hashJson({ mode }),
            },
            async generate(request, { signal }) {
                if (mode === "timeout") {
                    return new Promise((_, reject) => {
                        const rejectOnAbort = () => reject(new CandidateQuestionWordingRuntimeError("timeout"));
                        if (signal.aborted) rejectOnAbort();
                        else signal.addEventListener("abort", rejectOnAbort, { once: true });
                    });
                }
                if (mode === "provider_unavailable") {
                    throw new CandidateQuestionWordingRuntimeError("provider_unavailable");
                }
                if (mode === "invalid_json") return { rawText: "{not-json" };
                const categoryOccurrences = createCategoryOccurrenceTracker();
                const questions = request.slots.map((slot) => ({
                    slotId: slot.slotId,
                    category: slot.category,
                    questionText: createFixtureCandidateQuestionText(
                        slot.category,
                        categoryOccurrences.next(slot.category),
                        request.targetRole,
                    ),
                }));
                if (mode === "invalid_schema") return { rawText: JSON.stringify({ questions: "wrong" }) };
                if (mode === "fingerprint_mismatch") {
                    return { rawText: JSON.stringify({
                        status: CANDIDATE_QUESTION_WORDING_PROVIDER_OUTPUT_VERSION,
                        requestFingerprint: "0".repeat(64),
                        questions,
                    }) };
                }
                if (mode === "question_mapping_mismatch") questions[0].slotId = "wrong-slot";
                if (mode === "duplicate_question" && questions[1]) {
                    questions[1].questionText = questions[0].questionText;
                }
                return { rawText: JSON.stringify({
                    status: CANDIDATE_QUESTION_WORDING_PROVIDER_OUTPUT_VERSION,
                    requestFingerprint: request.requestFingerprint,
                    questions,
                }) };
            },
        },
        timeoutMs: mode === "timeout" ? 25 : CANDIDATE_QUESTION_WORDING_RUNTIME_TIMEOUT_MS,
    });
}

function parseProviderOutput(
    rawText: string,
    request: CandidateQuestionWordingProviderRequest,
) {
    if (typeof rawText !== "string" || !rawText.trim()) {
        throw new CandidateQuestionWordingRuntimeError("empty_response");
    }
    let value: unknown;
    try {
        value = JSON.parse(rawText);
    } catch {
        throw new CandidateQuestionWordingRuntimeError("invalid_json");
    }
    const parsed = providerOutputSchema.safeParse(value);
    if (!parsed.success) throw new CandidateQuestionWordingRuntimeError("invalid_schema");
    if (parsed.data.requestFingerprint !== request.requestFingerprint) {
        throw new CandidateQuestionWordingRuntimeError("fingerprint_mismatch");
    }
    if (
        parsed.data.questions.length !== request.slots.length
        || parsed.data.questions.some((question, index) => (
            question.slotId !== request.slots[index].slotId
            || question.category !== request.slots[index].category
        ))
    ) {
        throw new CandidateQuestionWordingRuntimeError("question_mapping_mismatch");
    }
    const normalizedQuestions = parsed.data.questions.map((question) => normalizeQuestionText(question.questionText));
    if (new Set(normalizedQuestions).size !== normalizedQuestions.length) {
        throw new CandidateQuestionWordingRuntimeError("duplicate_question");
    }
    return parsed.data;
}

function createTelemetry(input: {
    request: CandidateQuestionWordingProviderRequest;
    metadata: CandidateQuestionWordingRuntimeMetadata;
    outcome: CandidateQuestionWordingRuntimeTelemetry["outcome"];
    error: CandidateQuestionWordingRuntimeError | null;
    latencyMs: number;
    tokenUsage: CandidateQuestionWordingRuntimeTelemetry["tokenUsage"];
}): CandidateQuestionWordingRuntimeTelemetry {
    return {
        status: "candidate_question_wording_runtime_telemetry_v1",
        requestFingerprint: input.request.requestFingerprint,
        interviewStage: input.request.interviewStage,
        questionCount: input.request.slots.length,
        ...input.metadata,
        outcome: input.outcome,
        errorCode: input.error?.errorCode ?? null,
        retryable: input.error?.retryable ?? false,
        latencyMs: input.latencyMs,
        transportAttemptCount: 1,
        tokenUsage: input.tokenUsage,
    };
}

async function safelyRecordTelemetry(
    sink: (event: CandidateQuestionWordingRuntimeTelemetry) => void | Promise<void>,
    event: CandidateQuestionWordingRuntimeTelemetry,
) {
    try {
        await sink(event);
    } catch {
        // Metadata-only telemetry must not control question creation.
    }
}

function normalizeRuntimeError(error: unknown) {
    if (error instanceof CandidateQuestionWordingRuntimeError) return error;
    if (error instanceof Error && error.message.includes("distinct questions")) {
        return new CandidateQuestionWordingRuntimeError("duplicate_question");
    }
    if (error instanceof Error && error.message.includes("map exactly")) {
        return new CandidateQuestionWordingRuntimeError("question_mapping_mismatch");
    }
    return new CandidateQuestionWordingRuntimeError("provider_unavailable");
}

function normalizeTokenUsage(value?: CandidateQuestionWordingProviderTransportResult["tokenUsage"]) {
    return {
        inputTokens: readTokenCount(value?.inputTokens),
        outputTokens: readTokenCount(value?.outputTokens),
    };
}

function readTokenCount(value: unknown) {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function normalizeQuestionText(value: string) {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function boundText(value: string, maximumLength: number) {
    return value.trim().slice(0, maximumLength);
}

function createCategoryOccurrenceTracker() {
    const occurrences = new Map<CandidateQuestionPlanCategory, number>();
    return {
        next(category: CandidateQuestionPlanCategory) {
            const occurrence = occurrences.get(category) ?? 0;
            occurrences.set(category, occurrence + 1);
            return occurrence;
        },
    };
}

function isRejectedOutputKind(kind: CandidateQuestionWordingRuntimeErrorKind) {
    return [
        "safety_blocked",
        "empty_response",
        "invalid_json",
        "invalid_schema",
        "fingerprint_mismatch",
        "question_mapping_mismatch",
        "duplicate_question",
    ].includes(kind);
}

function isRetryableKind(kind: CandidateQuestionWordingRuntimeErrorKind) {
    return [
        "timeout",
        "rate_limited",
        "provider_5xx",
        "provider_unavailable",
        "empty_response",
        "invalid_json",
        "invalid_schema",
    ].includes(kind);
}

function hashJson(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
