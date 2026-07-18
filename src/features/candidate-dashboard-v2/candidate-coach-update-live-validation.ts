import { createHash } from "node:crypto";

import type { GenerateContentParameters } from "@google/genai";
import { z } from "zod";

import type { CandidateAnswerAnalysisProviderResult } from "@/features/candidate-session-v2/candidate-answer-analysis-adapter";

import type { CandidateCoachUpdateSynthesisInput } from "./candidate-coach-update-artifact";
import {
    CandidateCoachUpdateRuntimeError,
    createCandidateCoachUpdateSynthesisRuntime,
    type CandidateCoachUpdateRuntimeTelemetry,
} from "./candidate-coach-update-runtime";
import {
    GOOGLE_CANDIDATE_COACH_UPDATE_API_KEY_ENV,
    GOOGLE_CANDIDATE_COACH_UPDATE_CONFIGURATION_FINGERPRINT,
    GOOGLE_CANDIDATE_COACH_UPDATE_CONFIGURATION_MANIFEST,
    GOOGLE_CANDIDATE_COACH_UPDATE_GENERATION_SETTINGS,
    GOOGLE_CANDIDATE_COACH_UPDATE_MODEL,
    GOOGLE_CANDIDATE_COACH_UPDATE_PROFILE_ENV,
    GOOGLE_CANDIDATE_COACH_UPDATE_PROFILE_ID,
    GOOGLE_CANDIDATE_COACH_UPDATE_PROVIDER,
    GOOGLE_CANDIDATE_COACH_UPDATE_RESPONSE_SCHEMA,
    createGoogleCandidateCoachUpdateAdapterFromEnvironment,
    createGoogleCandidateCoachUpdateTransport,
    type GoogleCandidateCoachUpdateEnvironment,
    type GoogleCandidateCoachUpdateTransport,
} from "./google-candidate-coach-update";

export const CANDIDATE_COACH_UPDATE_LIVE_TEST_ENV = "CANDIDATE_COACH_UPDATE_LIVE_TEST" as const;

const SYNTHETIC_PRIVATE_VALUES = Object.freeze({
    candidateProfileId: "qa-private-candidate-id",
    roleProfileId: "qa-private-role-profile-id",
    sourceSessionId: "qa-private-source-session-id",
    currentAnswerOne: "RAW_CURRENT_ANSWER_ONE_SENTINEL",
    currentAnswerTwo: "RAW_CURRENT_ANSWER_TWO_SENTINEL",
    priorAnswerTwo: "RAW_PRIOR_ANSWER_TWO_SENTINEL",
});

const validationSchema = z.object({
    id: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/),
    passed: z.boolean(),
}).strict();

const safeLanguageSchema = z.object({
    title: z.string().trim().min(1).max(180),
    summary: z.string().trim().min(1).max(1_200),
    primaryFocus: z.string().trim().min(1).max(600),
    questionUpdates: z.array(z.object({
        questionNumber: z.number().int().positive(),
        comparisonKind: z.enum(["first_practice", "repeat_practice"]),
        priorComparableAttemptCount: z.number().int().nonnegative(),
        comparisonMessage: z.string().trim().min(1).max(800),
    }).strict()).length(2),
}).strict();

const acceptedResultSchema = z.object({
    outcome: z.literal("accepted"),
    metrics: z.object({
        latencyMs: z.number().int().nonnegative(),
        inputTokens: z.number().int().nonnegative().nullable(),
        outputTokens: z.number().int().nonnegative().nullable(),
    }).strict(),
    language: safeLanguageSchema,
}).strict();

const failedResultSchema = z.object({
    outcome: z.enum(["failed", "rejected"]),
    failure: z.object({
        errorCode: z.string().regex(/^[A-Z][A-Z0-9_]{1,99}$/),
        retryable: z.boolean(),
    }).strict(),
}).strict();

export const candidateCoachUpdateLiveValidationArtifactSchema = z.object({
    status: z.literal("candidate_coach_update_live_validation_artifact"),
    schemaVersion: z.literal(1),
    artifactId: z.string().regex(/^live_coach_update_[a-f0-9]{16}$/),
    generatedAt: z.string().datetime(),
    profile: z.object({
        provider: z.literal(GOOGLE_CANDIDATE_COACH_UPDATE_PROVIDER),
        profileId: z.literal(GOOGLE_CANDIDATE_COACH_UPDATE_PROFILE_ID),
        model: z.literal(GOOGLE_CANDIDATE_COACH_UPDATE_MODEL),
        promptVersion: z.literal(GOOGLE_CANDIDATE_COACH_UPDATE_CONFIGURATION_MANIFEST.promptVersion),
        evaluatorVersion: z.literal(GOOGLE_CANDIDATE_COACH_UPDATE_CONFIGURATION_MANIFEST.evaluatorVersion),
        configurationFingerprint: z.literal(GOOGLE_CANDIDATE_COACH_UPDATE_CONFIGURATION_FINGERPRINT),
    }).strict(),
    privacy: z.object({
        sourceContent: z.literal("synthetic_fixed_case"),
        candidateIdentity: z.literal("not_sent_or_captured"),
        rawAnswers: z.literal("not_sent_or_captured"),
        candidateDatabase: z.literal("not_read"),
        providerRequest: z.literal("inspected_not_captured"),
        assembledPrompt: z.literal("not_captured"),
        rawProviderOutput: z.literal("not_captured"),
        credentials: z.literal("not_captured"),
    }).strict(),
    summary: z.object({
        transportAttemptCount: z.number().int().nonnegative(),
        automatedGatePassed: z.boolean(),
        humanLanguageReview: z.literal("required"),
    }).strict(),
    result: z.discriminatedUnion("outcome", [acceptedResultSchema, failedResultSchema]),
    validations: z.array(validationSchema).min(1),
    reviewChecklist: z.tuple([
        z.literal("round_summary_is_grounded_in_accepted_coaching"),
        z.literal("primary_focus_is_specific_and_actionable"),
        z.literal("first_practice_language_does_not_imply_prior_comparison"),
        z.literal("repeat_practice_language_does_not_claim_unsupported_improvement"),
        z.literal("language_does_not_score_rank_or_make_hiring_claims"),
    ]),
    retention: z.object({
        durableCandidateRows: z.literal("not_written"),
        reviewArtifact: z.literal("local_ignored_json"),
    }).strict(),
}).strict().superRefine((artifact, context) => {
    const passed = artifact.result.outcome === "accepted"
        && artifact.summary.transportAttemptCount === 1
        && artifact.validations.every((validation) => validation.passed);
    if (artifact.summary.automatedGatePassed !== passed) {
        context.addIssue({
            code: "custom",
            path: ["summary", "automatedGatePassed"],
            message: "Automated gate result must be derived from outcome and validation facts.",
        });
    }
});

export type CandidateCoachUpdateLiveValidationArtifact = z.infer<
    typeof candidateCoachUpdateLiveValidationArtifactSchema
>;

export class CandidateCoachUpdateLiveValidationGuardError extends Error {
    readonly safeCode: string;

    constructor(safeCode: string) {
        super(safeCode);
        this.name = "CandidateCoachUpdateLiveValidationGuardError";
        this.safeCode = safeCode;
    }
}

type LiveValidationEnvironment = GoogleCandidateCoachUpdateEnvironment & {
    CANDIDATE_COACH_UPDATE_LIVE_TEST?: string;
    [key: string]: string | undefined;
};

export async function runCandidateCoachUpdateLiveValidation(input: {
    env: LiveValidationEnvironment;
    confirmedLiveProvider: boolean;
    dependencies?: {
        now?: () => Date;
        createTransport?: (apiKey: string) => GoogleCandidateCoachUpdateTransport;
    };
}): Promise<CandidateCoachUpdateLiveValidationArtifact> {
    assertCandidateCoachUpdateLiveValidationEnabled(input);

    const now = input.dependencies?.now ?? (() => new Date());
    const createTransport = input.dependencies?.createTransport ?? createGoogleCandidateCoachUpdateTransport;
    const synthesisInput = createSyntheticCoachUpdateSynthesisInput();
    const credential = input.env[GOOGLE_CANDIDATE_COACH_UPDATE_API_KEY_ENV]!.trim();
    let transportAttemptCount = 0;
    let requestPrivacyValidated = false;
    let configurationValidated = false;
    const telemetry: CandidateCoachUpdateRuntimeTelemetry[] = [];

    const adapter = createGoogleCandidateCoachUpdateAdapterFromEnvironment({
        env: input.env,
        transportFactory(apiKey) {
            const upstream = createTransport(apiKey);
            return {
                async generateContent(providerRequest) {
                    assertExactProviderRequestConfiguration(providerRequest);
                    assertProviderRequestPrivacy({
                        providerRequest,
                        synthesisInput,
                        credential,
                    });
                    configurationValidated = true;
                    requestPrivacyValidated = true;
                    transportAttemptCount += 1;
                    return upstream.generateContent(providerRequest);
                },
            };
        },
    });
    if (!adapter) {
        throw new CandidateCoachUpdateLiveValidationGuardError("LIVE_COACH_UPDATE_ADAPTER_UNAVAILABLE");
    }

    const runtime = createCandidateCoachUpdateSynthesisRuntime({
        adapter,
        recordTelemetry: (event) => {
            telemetry.push(event);
        },
    });
    const generatedAt = now().toISOString();

    let result: CandidateCoachUpdateLiveValidationArtifact["result"];
    try {
        const synthesis = await runtime.synthesize(synthesisInput);
        result = {
            outcome: "accepted",
            metrics: {
                latencyMs: synthesis.validation.latencyMs,
                inputTokens: synthesis.validation.tokenUsage.inputTokens,
                outputTokens: synthesis.validation.tokenUsage.outputTokens,
            },
            language: {
                title: synthesis.content.title,
                summary: synthesis.content.summary,
                primaryFocus: synthesis.content.primaryFocus,
                questionUpdates: synthesis.content.questions.map((question) => ({
                    questionNumber: question.questionNumber,
                    comparisonKind: question.comparison.kind,
                    priorComparableAttemptCount: question.comparison.priorComparableAttemptCount,
                    comparisonMessage: question.comparison.message,
                })),
            },
        };
    } catch (error) {
        const runtimeError = error instanceof CandidateCoachUpdateRuntimeError ? error : null;
        result = {
            outcome: runtimeError?.lifecycleState ?? "failed",
            failure: {
                errorCode: runtimeError?.errorCode ?? "COACH_UPDATE_PROVIDER_UNKNOWN",
                retryable: runtimeError?.retryable ?? false,
            },
        };
    }

    const validations = [
        { id: "exact_profile_configuration", passed: configurationValidated },
        { id: "single_transport_attempt", passed: transportAttemptCount === 1 },
        { id: "provider_request_excludes_identity_and_raw_answers", passed: requestPrivacyValidated },
        { id: "one_metadata_only_telemetry_event", passed: telemetry.length === 1 && isSafeTelemetry(telemetry[0]) },
        {
            id: "structured_content_and_code_owned_mapping_accepted",
            passed: result.outcome === "accepted"
                && result.language.questionUpdates[0]?.comparisonKind === "first_practice"
                && result.language.questionUpdates[0]?.priorComparableAttemptCount === 0
                && result.language.questionUpdates[1]?.comparisonKind === "repeat_practice"
                && result.language.questionUpdates[1]?.priorComparableAttemptCount === 1,
        },
    ];
    const automatedGatePassed = result.outcome === "accepted"
        && transportAttemptCount === 1
        && validations.every((validation) => validation.passed);
    const artifactId = `live_coach_update_${hashJson({
        generatedAt,
        configurationFingerprint: GOOGLE_CANDIDATE_COACH_UPDATE_CONFIGURATION_FINGERPRINT,
        result,
    }).slice(0, 16)}`;

    const artifact = candidateCoachUpdateLiveValidationArtifactSchema.parse({
        status: "candidate_coach_update_live_validation_artifact",
        schemaVersion: 1,
        artifactId,
        generatedAt,
        profile: {
            provider: GOOGLE_CANDIDATE_COACH_UPDATE_PROVIDER,
            profileId: GOOGLE_CANDIDATE_COACH_UPDATE_PROFILE_ID,
            model: GOOGLE_CANDIDATE_COACH_UPDATE_MODEL,
            promptVersion: GOOGLE_CANDIDATE_COACH_UPDATE_CONFIGURATION_MANIFEST.promptVersion,
            evaluatorVersion: GOOGLE_CANDIDATE_COACH_UPDATE_CONFIGURATION_MANIFEST.evaluatorVersion,
            configurationFingerprint: GOOGLE_CANDIDATE_COACH_UPDATE_CONFIGURATION_FINGERPRINT,
        },
        privacy: {
            sourceContent: "synthetic_fixed_case",
            candidateIdentity: "not_sent_or_captured",
            rawAnswers: "not_sent_or_captured",
            candidateDatabase: "not_read",
            providerRequest: "inspected_not_captured",
            assembledPrompt: "not_captured",
            rawProviderOutput: "not_captured",
            credentials: "not_captured",
        },
        summary: {
            transportAttemptCount,
            automatedGatePassed,
            humanLanguageReview: "required",
        },
        result,
        validations,
        reviewChecklist: [
            "round_summary_is_grounded_in_accepted_coaching",
            "primary_focus_is_specific_and_actionable",
            "first_practice_language_does_not_imply_prior_comparison",
            "repeat_practice_language_does_not_claim_unsupported_improvement",
            "language_does_not_score_rank_or_make_hiring_claims",
        ],
        retention: {
            durableCandidateRows: "not_written",
            reviewArtifact: "local_ignored_json",
        },
    });

    const serialized = JSON.stringify(artifact);
    if (
        findProhibitedCoachUpdateLiveArtifactKeys(artifact).length > 0
        || Object.values(SYNTHETIC_PRIVATE_VALUES).some((value) => serialized.includes(value))
        || serialized.includes(credential)
    ) {
        throw new CandidateCoachUpdateLiveValidationGuardError("LIVE_COACH_UPDATE_ARTIFACT_PRIVACY_VIOLATION");
    }
    return artifact;
}

export function assertCandidateCoachUpdateLiveValidationEnabled(input: {
    env: LiveValidationEnvironment;
    confirmedLiveProvider: boolean;
}) {
    if (!input.confirmedLiveProvider) {
        throw new CandidateCoachUpdateLiveValidationGuardError("LIVE_COACH_UPDATE_CLI_CONFIRMATION_REQUIRED");
    }
    if (input.env[CANDIDATE_COACH_UPDATE_LIVE_TEST_ENV] !== "true") {
        throw new CandidateCoachUpdateLiveValidationGuardError("LIVE_COACH_UPDATE_FLAG_REQUIRED");
    }
    if (input.env.CANDIDATE_COACH_UPDATE_PROVIDER !== GOOGLE_CANDIDATE_COACH_UPDATE_PROVIDER) {
        throw new CandidateCoachUpdateLiveValidationGuardError("LIVE_COACH_UPDATE_PROVIDER_MISMATCH");
    }
    if (input.env[GOOGLE_CANDIDATE_COACH_UPDATE_PROFILE_ENV] !== GOOGLE_CANDIDATE_COACH_UPDATE_PROFILE_ID) {
        throw new CandidateCoachUpdateLiveValidationGuardError("LIVE_COACH_UPDATE_PROFILE_MISMATCH");
    }
    if (!input.env[GOOGLE_CANDIDATE_COACH_UPDATE_API_KEY_ENV]?.trim()) {
        throw new CandidateCoachUpdateLiveValidationGuardError("LIVE_COACH_UPDATE_CREDENTIAL_REQUIRED");
    }
}

export function findProhibitedCoachUpdateLiveArtifactKeys(value: unknown): string[] {
    const prohibited = new Set([
        "candidateprofileid",
        "roleprofileid",
        "sourcecandidatepracticesessionid",
        "candidateanswerattemptid",
        "candidateanswerevaluationrunid",
        "answertext",
        "questiontext",
        "providerrequestpayload",
        "rawproviderresponse",
        "assembledprompttext",
        "credentialvalue",
        "apikey",
    ]);
    const matches = new Set<string>();
    visit(value, "artifact", (key, path) => {
        if (prohibited.has(key.replace(/[^a-z0-9]/gi, "").toLowerCase())) matches.add(path);
    });
    return Array.from(matches).sort();
}

function assertExactProviderRequestConfiguration(providerRequest: GenerateContentParameters) {
    const config = providerRequest.config;
    const exact = providerRequest.model === GOOGLE_CANDIDATE_COACH_UPDATE_MODEL
        && config?.responseMimeType === GOOGLE_CANDIDATE_COACH_UPDATE_GENERATION_SETTINGS.responseMimeType
        && JSON.stringify(config.responseJsonSchema) === JSON.stringify(GOOGLE_CANDIDATE_COACH_UPDATE_RESPONSE_SCHEMA)
        && config.temperature === GOOGLE_CANDIDATE_COACH_UPDATE_GENERATION_SETTINGS.temperature
        && config.maxOutputTokens === GOOGLE_CANDIDATE_COACH_UPDATE_GENERATION_SETTINGS.maxOutputTokens
        && config.candidateCount === GOOGLE_CANDIDATE_COACH_UPDATE_GENERATION_SETTINGS.candidateCount
        && config.seed === GOOGLE_CANDIDATE_COACH_UPDATE_GENERATION_SETTINGS.seed
        && config.thinkingConfig?.thinkingBudget === GOOGLE_CANDIDATE_COACH_UPDATE_GENERATION_SETTINGS.thinkingBudget
        && config.thinkingConfig?.includeThoughts === GOOGLE_CANDIDATE_COACH_UPDATE_GENERATION_SETTINGS.includeThoughts
        && config.httpOptions?.timeout === GOOGLE_CANDIDATE_COACH_UPDATE_GENERATION_SETTINGS.timeoutMs
        && typeof config.systemInstruction === "string"
        && config.systemInstruction.includes("untrusted data");
    if (!exact) {
        throw new CandidateCoachUpdateLiveValidationGuardError("LIVE_COACH_UPDATE_CONFIGURATION_DRIFT");
    }
}

function assertProviderRequestPrivacy({
    providerRequest,
    synthesisInput,
    credential,
}: {
    providerRequest: GenerateContentParameters;
    synthesisInput: CandidateCoachUpdateSynthesisInput;
    credential: string;
}) {
    const serialized = JSON.stringify(providerRequest);
    const forbiddenValues = [
        synthesisInput.candidateProfileId,
        synthesisInput.roleProfileId,
        synthesisInput.sourceCandidatePracticeSessionId,
        synthesisInput.sourceCompletionFingerprint,
        ...synthesisInput.questions.flatMap((question) => [
            question.answerAttempt.answerText,
            question.answerAttempt.candidateAnswerAttemptId,
            question.acceptedEvaluationRun.candidateAnswerEvaluationRunId,
            question.source.candidatePracticeSessionId,
            ...question.priorComparableAttempts.flatMap((prior) => [
                prior.answerAttempt.answerText,
                prior.answerAttempt.candidateAnswerAttemptId,
                prior.acceptedEvaluationRun.candidateAnswerEvaluationRunId,
            ]),
        ]),
        credential,
    ];
    if (forbiddenValues.some((value) => value && serialized.includes(value))) {
        throw new CandidateCoachUpdateLiveValidationGuardError("LIVE_COACH_UPDATE_PROVIDER_REQUEST_PRIVACY_VIOLATION");
    }
}

function createSyntheticCoachUpdateSynthesisInput(): CandidateCoachUpdateSynthesisInput {
    return {
        status: "candidate_coach_update_synthesis_input_v1",
        candidateProfileId: SYNTHETIC_PRIVATE_VALUES.candidateProfileId,
        roleProfileId: SYNTHETIC_PRIVATE_VALUES.roleProfileId,
        sourceCandidatePracticeSessionId: SYNTHETIC_PRIVATE_VALUES.sourceSessionId,
        targetRole: "Distribution Team Lead",
        completedAt: "2026-07-17T18:05:00.000Z",
        questionCount: 2,
        answeredCount: 2,
        sourceCompletionFingerprint: "qa-private-completion-fingerprint",
        synthesisInputFingerprint: "qa-safe-synthesis-fingerprint",
        questions: [
            createSyntheticQuestion({
                slotId: "slot-1",
                questionNumber: 1,
                category: "Behavioral",
                questionText: "Tell me about a time you coordinated urgent work with a team.",
                answerText: SYNTHETIC_PRIVATE_VALUES.currentAnswerOne,
                acknowledgement: "You described a relevant team example.",
                observation: "Your action is clear, while the result is still general.",
                nextPracticeFocus: "Name the concrete result your coordination produced.",
                priorComparableAttempts: [],
            }),
            createSyntheticQuestion({
                slotId: "slot-2",
                questionNumber: 2,
                category: "Scenario",
                questionText: "How would you respond when two urgent priorities compete for the same resources?",
                answerText: SYNTHETIC_PRIVATE_VALUES.currentAnswerTwo,
                acknowledgement: "You identified a practical way to compare priorities.",
                observation: "This response explains the decision criteria more clearly than the accepted earlier coaching described.",
                nextPracticeFocus: "Add how you would communicate the tradeoff to affected teammates.",
                priorComparableAttempts: [{
                    answerAttempt: createAnswerAttempt("prior-slot-2", SYNTHETIC_PRIVATE_VALUES.priorAnswerTwo, 1),
                    acceptedEvaluationRun: createAcceptedEvaluationRun("qa-private-run-prior-2"),
                    acceptedAnalysis: createAcceptedAnalysis({
                        slotId: "slot-2",
                        acknowledgement: "You recognized that the priorities compete.",
                        observation: "The earlier response did not yet explain how you would choose between them.",
                        nextPracticeFocus: "Name the criteria you would use to decide which priority comes first.",
                        score: 2,
                    }),
                }],
            }),
        ],
    };
}

function createSyntheticQuestion(input: {
    slotId: string;
    questionNumber: number;
    category: string;
    questionText: string;
    answerText: string;
    acknowledgement: string;
    observation: string;
    nextPracticeFocus: string;
    priorComparableAttempts: CandidateCoachUpdateSynthesisInput["questions"][number]["priorComparableAttempts"];
}): CandidateCoachUpdateSynthesisInput["questions"][number] {
    return {
        questionKey: input.slotId,
        questionNumber: input.questionNumber,
        category: input.category,
        questionText: input.questionText,
        answerAttempt: createAnswerAttempt(input.slotId, input.answerText, 2),
        acceptedEvaluationRun: createAcceptedEvaluationRun(`qa-private-run-${input.slotId}`),
        acceptedAnalysis: createAcceptedAnalysis({
            slotId: input.slotId,
            acknowledgement: input.acknowledgement,
            observation: input.observation,
            nextPracticeFocus: input.nextPracticeFocus,
            score: 3,
        }),
        source: {
            candidatePracticeSessionId: `qa-private-source-${input.slotId}`,
            questionKey: `source-${input.slotId}`,
        },
        priorComparableAttempts: input.priorComparableAttempts,
    } as CandidateCoachUpdateSynthesisInput["questions"][number];
}

function createAnswerAttempt(slotId: string, answerText: string, attemptNumber: number) {
    return {
        candidateAnswerAttemptId: `qa-private-attempt-${slotId}-${attemptNumber}`,
        mode: "text" as const,
        answerText,
        submittedAt: `2026-07-17T18:0${attemptNumber}:00.000Z`,
    } as CandidateCoachUpdateSynthesisInput["questions"][number]["answerAttempt"];
}

function createAcceptedEvaluationRun(candidateAnswerEvaluationRunId: string) {
    return {
        candidateAnswerEvaluationRunId,
    } as CandidateCoachUpdateSynthesisInput["questions"][number]["acceptedEvaluationRun"];
}

function createAcceptedAnalysis(input: {
    slotId: string;
    acknowledgement: string;
    observation: string;
    nextPracticeFocus: string;
    score: number;
}) {
    return {
        status: "answer_analysis_provider_result",
        provider: "candidate_v2_answer_evaluator",
        analyzedAt: "2026-07-17T18:04:00.000Z",
        answer: { slotId: input.slotId, questionIndex: input.slotId === "slot-1" ? 0 : 1 },
        coachFeedback: {
            acknowledgement: input.acknowledgement,
            observation: input.observation,
            nextPracticeFocus: input.nextPracticeFocus,
        },
        evidence: [
            { criterionId: "answer_focus", applicability: "observed", score: input.score },
            { criterionId: "impact", applicability: "not_elicited" },
        ],
    } as CandidateAnswerAnalysisProviderResult;
}

function isSafeTelemetry(event: CandidateCoachUpdateRuntimeTelemetry | undefined) {
    if (!event) return false;
    const serialized = JSON.stringify(event);
    return event.synthesisInputFingerprint === "qa-safe-synthesis-fingerprint"
        && !Object.values(SYNTHETIC_PRIVATE_VALUES).some((value) => serialized.includes(value));
}

function visit(
    value: unknown,
    path: string,
    visitKey: (key: string, path: string) => void,
) {
    if (Array.isArray(value)) {
        value.forEach((item, index) => visit(item, `${path}[${index}]`, visitKey));
        return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
        const childPath = `${path}.${key}`;
        visitKey(key, childPath);
        visit(child, childPath, visitKey);
    }
}

function hashJson(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
