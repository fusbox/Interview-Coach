import { createHash } from "node:crypto";

import { z } from "zod";

import { createCandidateAnswerCoachingFacts } from "@/features/candidate-session-v2/candidate-coaching-facts";

import {
    candidateCoachUpdateFixtureMetadata,
    validateCandidateCoachUpdateContent,
    type CandidateCoachUpdateContent,
    type CandidateCoachUpdateSynthesisInput,
} from "./candidate-coach-update-artifact";

export const CANDIDATE_COACH_UPDATE_PROVIDER_ENV = "CANDIDATE_COACH_UPDATE_PROVIDER";
export const CANDIDATE_COACH_UPDATE_FAULT_MODE_ENV = "CANDIDATE_COACH_UPDATE_FAULT_MODE";
export const CANDIDATE_COACH_UPDATE_RUNTIME_TIMEOUT_MS = 12_000;
export const CANDIDATE_COACH_UPDATE_CLAIM_LEASE_MS = 120_000;
export const CANDIDATE_COACH_UPDATE_PROVIDER_REQUEST_VERSION = "candidate_coach_update_provider_request_v1";
export const CANDIDATE_COACH_UPDATE_PROVIDER_OUTPUT_VERSION = "candidate_coach_update_provider_output_v1";
export const CANDIDATE_COACH_UPDATE_PRODUCTION_PROMPT_VERSION = "candidate_coach_update_synthesis_prompt_v1";

const MAX_COMPARABLE_ATTEMPTS_PER_QUESTION = 3;

export type CandidateCoachUpdateRuntimeMetadata = {
    provider: string;
    modelName: string;
    promptVersion: string;
    evaluatorVersion: string;
    profileId: string;
    configurationFingerprint: string;
};

export type CandidateCoachUpdateProviderRequest = {
    status: typeof CANDIDATE_COACH_UPDATE_PROVIDER_REQUEST_VERSION;
    synthesisInputFingerprint: string;
    targetRole: string;
    answeredCount: number;
    questions: Array<{
        questionNumber: number;
        category: string;
        questionText: string;
        answer: {
            mode: "text" | "voice" | "photo";
        };
        acceptedCoaching: CandidateCoachUpdateProviderCoaching;
        comparison: {
            kind: "first_practice" | "repeat_practice";
            priorComparableAttemptCount: number;
            recentComparableAttempts: Array<{
                answer: {
                    mode: "text" | "voice" | "photo";
                };
                acceptedCoaching: CandidateCoachUpdateProviderCoaching;
            }>;
        };
    }>;
};

type CandidateCoachUpdateProviderCoaching = {
    acknowledgement: string;
    observation: string;
    nextPracticeFocus: string;
    overallBand: "not_enough_evidence" | "emerging" | "clear" | "strong";
    observedCriteriaCount: number;
    excludedCriteriaCount: number;
};

export type CandidateCoachUpdateProviderTransportResult = {
    rawText: string;
    tokenUsage?: {
        inputTokens?: number;
        outputTokens?: number;
    };
};

export type CandidateCoachUpdateProviderAdapter = {
    metadata: CandidateCoachUpdateRuntimeMetadata;
    generate: (
        request: CandidateCoachUpdateProviderRequest,
        context: { signal: AbortSignal },
    ) => Promise<CandidateCoachUpdateProviderTransportResult>;
};

export type CandidateCoachUpdateRuntimeTelemetry = {
    status: "candidate_coach_update_runtime_telemetry_v1";
    synthesisInputFingerprint: string;
    provider: string;
    modelName: string;
    promptVersion: string;
    evaluatorVersion: string;
    profileId?: string;
    configurationFingerprint?: string;
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

export type CandidateCoachUpdateSynthesisRuntimeResult = {
    content: CandidateCoachUpdateContent;
    validation: {
        providerRequestVersion: typeof CANDIDATE_COACH_UPDATE_PROVIDER_REQUEST_VERSION;
        providerOutputVersion: typeof CANDIDATE_COACH_UPDATE_PROVIDER_OUTPUT_VERSION;
        timeoutMs: number;
        transportAttemptCount: 1;
        latencyMs: number;
        tokenUsage: {
            inputTokens: number | null;
            outputTokens: number | null;
        };
        rawOutputStored: false;
        promptStored: false;
    };
};

export type CandidateCoachUpdateSynthesisRuntime = {
    metadata: CandidateCoachUpdateRuntimeMetadata;
    timeoutMs: number;
    synthesize: (input: CandidateCoachUpdateSynthesisInput) => Promise<CandidateCoachUpdateSynthesisRuntimeResult>;
};

export type CandidateCoachUpdateRuntimeErrorKind =
    | "timeout"
    | "rate_limited"
    | "provider_4xx"
    | "provider_5xx"
    | "provider_unavailable"
    | "misconfigured"
    | "safety_blocked"
    | "empty_response"
    | "invalid_json"
    | "invalid_schema"
    | "fingerprint_mismatch"
    | "question_mapping_mismatch"
    | "unsafe_candidate_language";

export class CandidateCoachUpdateRuntimeError extends Error {
    readonly kind: CandidateCoachUpdateRuntimeErrorKind;
    readonly errorCode: string;
    readonly lifecycleState: "failed" | "rejected";
    readonly retryable: boolean;

    constructor(kind: CandidateCoachUpdateRuntimeErrorKind) {
        super("Coach Update synthesis was unavailable.");
        this.name = "CandidateCoachUpdateRuntimeError";
        this.kind = kind;
        this.errorCode = errorCodeForKind(kind);
        this.lifecycleState = isRejectedOutputKind(kind) ? "rejected" : "failed";
        this.retryable = isRetryableKind(kind);
    }
}

const providerOutputSchema = z.object({
    status: z.literal(CANDIDATE_COACH_UPDATE_PROVIDER_OUTPUT_VERSION),
    synthesisInputFingerprint: z.string().trim().min(1).max(128),
    title: z.string().trim().min(1).max(180),
    summary: z.string().trim().min(1).max(1_200),
    primaryFocus: z.string().trim().min(1).max(600),
    questionUpdates: z.array(z.object({
        questionNumber: z.number().int().positive(),
        comparisonMessage: z.string().trim().min(1).max(800),
    }).strict()).min(1).max(20),
}).strict();

type CandidateCoachUpdateProviderOutput = z.infer<typeof providerOutputSchema>;

export function createCandidateCoachUpdateProviderRequest(
    input: CandidateCoachUpdateSynthesisInput,
): CandidateCoachUpdateProviderRequest {
    return {
        status: CANDIDATE_COACH_UPDATE_PROVIDER_REQUEST_VERSION,
        synthesisInputFingerprint: input.synthesisInputFingerprint,
        targetRole: boundText(input.targetRole, 120),
        answeredCount: input.answeredCount,
        questions: input.questions.map((question) => {
            const currentCoaching = createCandidateAnswerCoachingFacts(question.acceptedAnalysis);
            const recentPrior = question.priorComparableAttempts.slice(-MAX_COMPARABLE_ATTEMPTS_PER_QUESTION);
            return {
                questionNumber: question.questionNumber,
                category: boundText(question.category, 120),
                questionText: boundText(question.questionText, 4_000),
                answer: {
                    mode: question.answerAttempt.mode,
                },
                acceptedCoaching: toProviderCoaching(currentCoaching),
                comparison: {
                    kind: question.priorComparableAttempts.length > 0 ? "repeat_practice" : "first_practice",
                    priorComparableAttemptCount: question.priorComparableAttempts.length,
                    recentComparableAttempts: recentPrior.map((prior) => ({
                        answer: {
                            mode: prior.answerAttempt.mode,
                        },
                        acceptedCoaching: toProviderCoaching(
                            createCandidateAnswerCoachingFacts(prior.acceptedAnalysis),
                        ),
                    })),
                },
            };
        }),
    };
}

export function createCandidateCoachUpdateSynthesisRuntime({
    adapter,
    timeoutMs = CANDIDATE_COACH_UPDATE_RUNTIME_TIMEOUT_MS,
    recordTelemetry = () => undefined,
    now = () => Date.now(),
}: {
    adapter: CandidateCoachUpdateProviderAdapter;
    timeoutMs?: number;
    recordTelemetry?: (event: CandidateCoachUpdateRuntimeTelemetry) => void | Promise<void>;
    now?: () => number;
}): CandidateCoachUpdateSynthesisRuntime {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs >= CANDIDATE_COACH_UPDATE_CLAIM_LEASE_MS) {
        throw new Error("Coach Update timeout must be positive and shorter than the artifact claim lease.");
    }

    return {
        metadata: adapter.metadata,
        timeoutMs,
        async synthesize(input) {
            const request = createCandidateCoachUpdateProviderRequest(input);
            const controller = new AbortController();
            const startedAt = now();
            let timer: ReturnType<typeof setTimeout> | undefined;
            let transportResult: CandidateCoachUpdateProviderTransportResult | null = null;

            try {
                const timeout = new Promise<never>((_, reject) => {
                    timer = setTimeout(() => {
                        controller.abort();
                        reject(new CandidateCoachUpdateRuntimeError("timeout"));
                    }, timeoutMs);
                });
                transportResult = await Promise.race([
                    adapter.generate(request, { signal: controller.signal }),
                    timeout,
                ]);
                const output = parseProviderOutput(transportResult.rawText, request);
                const content = composeCandidateCoachUpdateContent(input, output);
                if (!validateCandidateCoachUpdateContent({ input, content })) {
                    throw new CandidateCoachUpdateRuntimeError("unsafe_candidate_language");
                }

                const latencyMs = Math.max(0, now() - startedAt);
                const tokenUsage = normalizeTokenUsage(transportResult.tokenUsage);
                await safelyRecordTelemetry(recordTelemetry, createTelemetry({
                    input,
                    metadata: adapter.metadata,
                    outcome: "accepted",
                    error: null,
                    latencyMs,
                    tokenUsage,
                }));
                return {
                    content,
                    validation: {
                        providerRequestVersion: CANDIDATE_COACH_UPDATE_PROVIDER_REQUEST_VERSION,
                        providerOutputVersion: CANDIDATE_COACH_UPDATE_PROVIDER_OUTPUT_VERSION,
                        timeoutMs,
                        transportAttemptCount: 1,
                        latencyMs,
                        tokenUsage,
                        rawOutputStored: false,
                        promptStored: false,
                    },
                };
            } catch (error) {
                const runtimeError = normalizeRuntimeError(error);
                const latencyMs = Math.max(0, now() - startedAt);
                await safelyRecordTelemetry(recordTelemetry, createTelemetry({
                    input,
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

export function createFixtureCandidateCoachUpdateRuntime(
    options: { timeoutMs?: number } = {},
): CandidateCoachUpdateSynthesisRuntime {
    return createCandidateCoachUpdateSynthesisRuntime({
        adapter: {
            metadata: candidateCoachUpdateFixtureMetadata,
            async generate(request) {
                return {
                    rawText: JSON.stringify(createFixtureProviderOutput(request)),
                };
            },
        },
        timeoutMs: options.timeoutMs,
    });
}

export const CANDIDATE_COACH_UPDATE_FAULT_MODES = [
    "success",
    "timeout",
    "rate_limited",
    "provider_5xx",
    "provider_unavailable",
    "misconfigured",
    "invalid_json",
    "invalid_schema",
    "fingerprint_mismatch",
    "question_mapping_mismatch",
    "unsafe_candidate_language",
] as const;

export type CandidateCoachUpdateFaultMode = typeof CANDIDATE_COACH_UPDATE_FAULT_MODES[number];

export function createFaultInjectionCandidateCoachUpdateRuntime(
    mode: CandidateCoachUpdateFaultMode,
): CandidateCoachUpdateSynthesisRuntime {
    return createCandidateCoachUpdateSynthesisRuntime({
        adapter: {
            metadata: {
                provider: "candidate_v2_coach_update_fault_injector",
                modelName: `deterministic_${mode}`,
                promptVersion: CANDIDATE_COACH_UPDATE_PRODUCTION_PROMPT_VERSION,
                evaluatorVersion: "evidence_first_v1",
                profileId: `candidate_coach_update_fault_${mode}_v1`,
                configurationFingerprint: createHash("sha256").update(JSON.stringify({
                    provider: "candidate_v2_coach_update_fault_injector",
                    modelName: `deterministic_${mode}`,
                    promptVersion: CANDIDATE_COACH_UPDATE_PRODUCTION_PROMPT_VERSION,
                    evaluatorVersion: "evidence_first_v1",
                    mode,
                })).digest("hex"),
            },
            async generate(request, { signal }) {
                if (mode === "timeout") {
                    return new Promise((_, reject) => {
                        const rejectOnAbort = () => reject(new CandidateCoachUpdateRuntimeError("timeout"));
                        if (signal.aborted) rejectOnAbort();
                        else signal.addEventListener("abort", rejectOnAbort, { once: true });
                    });
                }
                if (
                    mode === "rate_limited"
                    || mode === "provider_5xx"
                    || mode === "provider_unavailable"
                    || mode === "misconfigured"
                ) {
                    throw new CandidateCoachUpdateRuntimeError(mode);
                }
                if (mode === "invalid_json") return { rawText: "{not-json" };
                if (mode === "invalid_schema") return { rawText: JSON.stringify({ status: "wrong" }) };

                const output = createFixtureProviderOutput(request);
                if (mode === "fingerprint_mismatch") {
                    output.synthesisInputFingerprint = "fault-injected-mismatch";
                }
                if (mode === "question_mapping_mismatch") {
                    output.questionUpdates[0].questionNumber += 1;
                }
                if (mode === "unsafe_candidate_language") {
                    output.summary = "You scored 100% in this practice.";
                }
                return { rawText: JSON.stringify(output) };
            },
        },
        timeoutMs: mode === "timeout" ? 25 : CANDIDATE_COACH_UPDATE_RUNTIME_TIMEOUT_MS,
    });
}

function composeCandidateCoachUpdateContent(
    input: CandidateCoachUpdateSynthesisInput,
    output: CandidateCoachUpdateProviderOutput,
): CandidateCoachUpdateContent {
    return {
        status: "candidate_coach_update_content_v1",
        targetRole: input.targetRole,
        title: output.title,
        summary: output.summary,
        primaryFocus: output.primaryFocus,
        questions: input.questions.map((question, index) => {
            const coaching = createCandidateAnswerCoachingFacts(question.acceptedAnalysis);
            return {
                questionKey: question.questionKey,
                questionNumber: question.questionNumber,
                category: question.category,
                questionText: question.questionText,
                answer: {
                    candidateAnswerAttemptId: question.answerAttempt.candidateAnswerAttemptId,
                    mode: question.answerAttempt.mode,
                    text: question.answerAttempt.answerText,
                    submittedAt: question.answerAttempt.submittedAt,
                },
                coaching: {
                    acknowledgement: coaching.coachFeedback.acknowledgement,
                    observation: coaching.coachFeedback.observation,
                    nextPracticeFocus: coaching.coachFeedback.nextPracticeFocus,
                    overallBand: coaching.overallRead.band,
                },
                comparison: {
                    kind: question.priorComparableAttempts.length > 0 ? "repeat_practice" : "first_practice",
                    priorComparableAttemptCount: question.priorComparableAttempts.length,
                    message: output.questionUpdates[index].comparisonMessage,
                },
                source: question.source,
            };
        }),
    };
}

function parseProviderOutput(
    rawText: string,
    request: CandidateCoachUpdateProviderRequest,
): CandidateCoachUpdateProviderOutput {
    if (typeof rawText !== "string" || !rawText.trim()) {
        throw new CandidateCoachUpdateRuntimeError("empty_response");
    }

    let value: unknown;
    try {
        value = JSON.parse(rawText);
    } catch {
        throw new CandidateCoachUpdateRuntimeError("invalid_json");
    }
    const parsed = providerOutputSchema.safeParse(value);
    if (!parsed.success) throw new CandidateCoachUpdateRuntimeError("invalid_schema");
    if (parsed.data.synthesisInputFingerprint !== request.synthesisInputFingerprint) {
        throw new CandidateCoachUpdateRuntimeError("fingerprint_mismatch");
    }
    if (
        parsed.data.questionUpdates.length !== request.questions.length
        || parsed.data.questionUpdates.some((question, index) => (
            question.questionNumber !== request.questions[index].questionNumber
        ))
    ) {
        throw new CandidateCoachUpdateRuntimeError("question_mapping_mismatch");
    }
    if (containsProhibitedGeneratedLanguage([
        parsed.data.title,
        parsed.data.summary,
        parsed.data.primaryFocus,
        ...parsed.data.questionUpdates.map((question) => question.comparisonMessage),
    ])) {
        throw new CandidateCoachUpdateRuntimeError("unsafe_candidate_language");
    }
    return parsed.data;
}

function createFixtureProviderOutput(
    request: CandidateCoachUpdateProviderRequest,
): CandidateCoachUpdateProviderOutput {
    const questionNoun = request.answeredCount === 1 ? "question" : "questions";
    return {
        status: CANDIDATE_COACH_UPDATE_PROVIDER_OUTPUT_VERSION,
        synthesisInputFingerprint: request.synthesisInputFingerprint,
        title: `${request.targetRole} practice update`,
        summary: `I reviewed your ${request.answeredCount} practiced ${questionNoun} and connected each update to accepted coaching evidence.`,
        primaryFocus: request.questions[0]?.acceptedCoaching.nextPracticeFocus
            ?? "Keep building practice evidence one answer at a time.",
        questionUpdates: request.questions.map((question) => ({
            questionNumber: question.questionNumber,
            comparisonMessage: question.comparison.priorComparableAttemptCount > 0
                ? "You returned to this question. I compared this response with your earlier practice and kept this update grounded in what you said this time."
                : "This is the first accepted practice evidence for this question in this prep context.",
        })),
    };
}

function toProviderCoaching(
    facts: ReturnType<typeof createCandidateAnswerCoachingFacts>,
): CandidateCoachUpdateProviderCoaching {
    return {
        acknowledgement: facts.coachFeedback.acknowledgement,
        observation: facts.coachFeedback.observation,
        nextPracticeFocus: facts.coachFeedback.nextPracticeFocus,
        overallBand: facts.overallRead.band,
        observedCriteriaCount: facts.overallRead.observedCount,
        excludedCriteriaCount: facts.overallRead.excludedCount,
    };
}

function createTelemetry({
    input,
    metadata,
    outcome,
    error,
    latencyMs,
    tokenUsage,
}: {
    input: CandidateCoachUpdateSynthesisInput;
    metadata: CandidateCoachUpdateRuntimeMetadata;
    outcome: CandidateCoachUpdateRuntimeTelemetry["outcome"];
    error: CandidateCoachUpdateRuntimeError | null;
    latencyMs: number;
    tokenUsage: CandidateCoachUpdateRuntimeTelemetry["tokenUsage"];
}): CandidateCoachUpdateRuntimeTelemetry {
    return {
        status: "candidate_coach_update_runtime_telemetry_v1",
        synthesisInputFingerprint: input.synthesisInputFingerprint,
        ...metadata,
        outcome,
        errorCode: error?.errorCode ?? null,
        retryable: error?.retryable ?? false,
        latencyMs,
        transportAttemptCount: 1,
        tokenUsage,
    };
}

async function safelyRecordTelemetry(
    sink: (event: CandidateCoachUpdateRuntimeTelemetry) => void | Promise<void>,
    event: CandidateCoachUpdateRuntimeTelemetry,
) {
    try {
        await sink(event);
    } catch {
        // Telemetry is metadata-only and must never control the coaching lifecycle.
    }
}

function normalizeRuntimeError(error: unknown) {
    return error instanceof CandidateCoachUpdateRuntimeError
        ? error
        : new CandidateCoachUpdateRuntimeError("provider_unavailable");
}

function normalizeTokenUsage(value?: CandidateCoachUpdateProviderTransportResult["tokenUsage"]) {
    return {
        inputTokens: readTokenCount(value?.inputTokens),
        outputTokens: readTokenCount(value?.outputTokens),
    };
}

function readTokenCount(value: unknown) {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function boundText(value: string, maximumLength: number) {
    return value.trim().slice(0, maximumLength);
}

function containsProhibitedGeneratedLanguage(values: string[]) {
    return values.some((value) => (
        /\b(score|scored|scoring|grade|graded|grading|percentile|rank|ranked|ranking|pass|passed|passing|fail|failed|failing)\b/i.test(value)
        || /\b\d{1,3}\s*%\b/.test(value)
    ));
}

function errorCodeForKind(kind: CandidateCoachUpdateRuntimeErrorKind) {
    return `COACH_UPDATE_PROVIDER_${kind.toUpperCase()}`;
}

function isRejectedOutputKind(kind: CandidateCoachUpdateRuntimeErrorKind) {
    return [
        "empty_response",
        "invalid_json",
        "invalid_schema",
        "fingerprint_mismatch",
        "question_mapping_mismatch",
        "safety_blocked",
        "unsafe_candidate_language",
    ].includes(kind);
}

function isRetryableKind(kind: CandidateCoachUpdateRuntimeErrorKind) {
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
