import { createHash } from "node:crypto";

import type { GenerateContentParameters } from "@google/genai";
import { z } from "zod";

import { createCandidateQuestionPlan } from "./candidate-question-plan";
import { createCandidateQuestionWordingRequest } from "./candidate-question-wording";
import {
    CandidateQuestionWordingRuntimeError,
    createCandidateQuestionWordingRuntime,
    type CandidateQuestionWordingRuntimeTelemetry,
} from "./candidate-question-wording-runtime";
import {
    GOOGLE_CANDIDATE_QUESTION_WORDING_API_KEY_ENV,
    GOOGLE_CANDIDATE_QUESTION_WORDING_CONFIGURATION_FINGERPRINT,
    GOOGLE_CANDIDATE_QUESTION_WORDING_CONFIGURATION_MANIFEST,
    GOOGLE_CANDIDATE_QUESTION_WORDING_GENERATION_SETTINGS,
    GOOGLE_CANDIDATE_QUESTION_WORDING_MODEL,
    GOOGLE_CANDIDATE_QUESTION_WORDING_PROFILE_ENV,
    GOOGLE_CANDIDATE_QUESTION_WORDING_PROFILE_ID,
    GOOGLE_CANDIDATE_QUESTION_WORDING_PROVIDER,
    GOOGLE_CANDIDATE_QUESTION_WORDING_RESPONSE_SCHEMA,
    GOOGLE_CANDIDATE_QUESTION_WORDING_SYSTEM_INSTRUCTION,
    createGoogleCandidateQuestionWordingAdapterFromEnvironment,
    createGoogleCandidateQuestionWordingTransport,
    type GoogleCandidateQuestionWordingEnvironment,
    type GoogleCandidateQuestionWordingTransport,
} from "./google-candidate-question-wording";

export const CANDIDATE_QUESTION_WORDING_LIVE_TEST_ENV = "CANDIDATE_QUESTION_WORDING_LIVE_TEST" as const;

const SYNTHETIC_SETUP = Object.freeze({
    targetRole: "Warehouse Quality Inspector",
    jobDescription: "Inspect incoming products, record defects, follow safety procedures, and communicate findings to warehouse leads.",
    resumeText: "Checked outbound orders, documented labeling errors, and worked with team leads to correct shipment issues.",
    interviewStage: "first_interview" as const,
    questionCount: 5,
    resumeCaptureMode: "pasted_text" as const,
    createdAt: "2026-07-18T12:00:00.000Z",
});

const validationSchema = z.object({
    id: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/),
    passed: z.boolean(),
}).strict();

const acceptedResultSchema = z.object({
    outcome: z.literal("accepted"),
    metrics: z.object({
        latencyMs: z.number().int().nonnegative(),
        inputTokens: z.number().int().nonnegative().nullable(),
        outputTokens: z.number().int().nonnegative().nullable(),
    }).strict(),
    questions: z.array(z.object({
        slotId: z.string().trim().min(1).max(80),
        index: z.number().int().nonnegative(),
        category: z.enum(["screening", "behavioral", "culture_fit", "case_scenario", "technical_role_specific"]),
        questionText: z.string().trim().min(8).max(500),
    }).strict()).length(SYNTHETIC_SETUP.questionCount),
}).strict();

const failedResultSchema = z.object({
    outcome: z.enum(["failed", "rejected"]),
    failure: z.object({
        errorCode: z.string().regex(/^[A-Z][A-Z0-9_]{1,119}$/),
        retryable: z.boolean(),
    }).strict(),
}).strict();

export const candidateQuestionWordingLiveValidationArtifactSchema = z.object({
    status: z.literal("candidate_question_wording_live_validation_artifact"),
    schemaVersion: z.literal(1),
    artifactId: z.string().regex(/^live_question_wording_[a-f0-9]{16}$/),
    generatedAt: z.string().datetime(),
    syntheticCase: z.object({
        id: z.literal("warehouse_quality_inspector_first_interview_v1"),
        targetRole: z.literal(SYNTHETIC_SETUP.targetRole),
        interviewStage: z.literal(SYNTHETIC_SETUP.interviewStage),
        questionCount: z.literal(SYNTHETIC_SETUP.questionCount),
        resumeContext: z.literal("included"),
    }).strict(),
    profile: z.object({
        provider: z.literal(GOOGLE_CANDIDATE_QUESTION_WORDING_PROVIDER),
        profileId: z.literal(GOOGLE_CANDIDATE_QUESTION_WORDING_PROFILE_ID),
        model: z.literal(GOOGLE_CANDIDATE_QUESTION_WORDING_MODEL),
        promptVersion: z.literal(GOOGLE_CANDIDATE_QUESTION_WORDING_CONFIGURATION_MANIFEST.promptVersion),
        configurationFingerprint: z.literal(GOOGLE_CANDIDATE_QUESTION_WORDING_CONFIGURATION_FINGERPRINT),
    }).strict(),
    privacy: z.object({
        sourceContent: z.literal("synthetic_fixed_case"),
        candidateIdentity: z.literal("not_used"),
        candidateDatabase: z.literal("not_read_or_written"),
        providerRequest: z.literal("inspected_not_captured"),
        assembledPrompt: z.literal("not_captured"),
        rawProviderOutput: z.literal("not_captured"),
        credentials: z.literal("not_captured"),
    }).strict(),
    summary: z.object({
        transportAttemptCount: z.number().int().nonnegative(),
        automatedGatePassed: z.boolean(),
        humanQuestionReview: z.literal("required"),
    }).strict(),
    result: z.discriminatedUnion("outcome", [acceptedResultSchema, failedResultSchema]),
    validations: z.array(validationSchema).min(1),
    reviewChecklist: z.tuple([
        z.literal("questions_are_relevant_to_the_role_and_job_context"),
        z.literal("questions_match_their_planned_categories"),
        z.literal("questions_are_clear_focused_and_distinct"),
        z.literal("resume_context_is_used_only_when_helpful_and_not_exposed"),
        z.literal("questions_do_not_score_rank_or_make_hiring_claims"),
    ]),
    retention: z.object({
        durableCandidateRows: z.literal("not_written"),
        reviewArtifact: z.literal("local_ignored_json"),
    }).strict(),
}).strict().superRefine((artifact, context) => {
    const expected = artifact.result.outcome === "accepted"
        && artifact.summary.transportAttemptCount === 1
        && artifact.validations.every((validation) => validation.passed);
    if (artifact.summary.automatedGatePassed !== expected) {
        context.addIssue({
            code: "custom",
            path: ["summary", "automatedGatePassed"],
            message: "Automated gate must be derived from accepted output and validation facts.",
        });
    }
});

export type CandidateQuestionWordingLiveValidationArtifact = z.infer<
    typeof candidateQuestionWordingLiveValidationArtifactSchema
>;

export class CandidateQuestionWordingLiveValidationGuardError extends Error {
    readonly safeCode: string;

    constructor(safeCode: string) {
        super(safeCode);
        this.name = "CandidateQuestionWordingLiveValidationGuardError";
        this.safeCode = safeCode;
    }
}

type LiveValidationEnvironment = GoogleCandidateQuestionWordingEnvironment & {
    CANDIDATE_QUESTION_WORDING_LIVE_TEST?: string;
    [key: string]: string | undefined;
};

export async function runCandidateQuestionWordingLiveValidation(input: {
    env: LiveValidationEnvironment;
    confirmedLiveProvider: boolean;
    dependencies?: {
        now?: () => Date;
        createTransport?: (apiKey: string) => GoogleCandidateQuestionWordingTransport;
    };
}): Promise<CandidateQuestionWordingLiveValidationArtifact> {
    assertCandidateQuestionWordingLiveValidationEnabled(input);

    const now = input.dependencies?.now ?? (() => new Date());
    const createTransport = input.dependencies?.createTransport ?? createGoogleCandidateQuestionWordingTransport;
    const questionPlanSnapshot = createCandidateQuestionPlan({
        interviewStage: SYNTHETIC_SETUP.interviewStage,
        questionCount: SYNTHETIC_SETUP.questionCount,
    });
    const request = createCandidateQuestionWordingRequest({
        setupSnapshot: SYNTHETIC_SETUP,
        questionPlanSnapshot,
        now: new Date("2026-07-18T12:01:00.000Z"),
    });
    const credential = input.env[GOOGLE_CANDIDATE_QUESTION_WORDING_API_KEY_ENV]!.trim();
    let transportAttemptCount = 0;
    let exactConfigurationValidated = false;
    let syntheticContextValidated = false;
    const telemetry: CandidateQuestionWordingRuntimeTelemetry[] = [];

    const adapter = createGoogleCandidateQuestionWordingAdapterFromEnvironment({
        env: input.env,
        transportFactory(apiKey) {
            const upstream = createTransport(apiKey);
            return {
                async generateContent(providerRequest) {
                    assertExactProviderRequestConfiguration(providerRequest);
                    assertSyntheticProviderRequest(providerRequest, credential);
                    exactConfigurationValidated = true;
                    syntheticContextValidated = true;
                    transportAttemptCount += 1;
                    return upstream.generateContent(providerRequest);
                },
            };
        },
    });
    if (!adapter) {
        throw new CandidateQuestionWordingLiveValidationGuardError("LIVE_QUESTION_WORDING_ADAPTER_UNAVAILABLE");
    }

    const runtime = createCandidateQuestionWordingRuntime({
        adapter,
        recordTelemetry: (event) => {
            telemetry.push(event);
        },
    });
    const generatedAt = now().toISOString();
    let result: CandidateQuestionWordingLiveValidationArtifact["result"];
    try {
        const wording = await runtime.wordQuestions(request);
        result = {
            outcome: "accepted",
            metrics: {
                latencyMs: wording.generation!.validation.latencyMs,
                inputTokens: wording.generation!.validation.tokenUsage.inputTokens,
                outputTokens: wording.generation!.validation.tokenUsage.outputTokens,
            },
            questions: wording.questions,
        };
    } catch (error) {
        const runtimeError = error instanceof CandidateQuestionWordingRuntimeError ? error : null;
        result = {
            outcome: runtimeError?.lifecycleState ?? "failed",
            failure: {
                errorCode: runtimeError?.errorCode ?? "QUESTION_WORDING_PROVIDER_UNKNOWN",
                retryable: runtimeError?.retryable ?? false,
            },
        };
    }

    const validations = [
        { id: "exact_profile_configuration", passed: exactConfigurationValidated },
        { id: "single_transport_attempt", passed: transportAttemptCount === 1 },
        { id: "synthetic_context_only", passed: syntheticContextValidated },
        { id: "one_metadata_only_telemetry_event", passed: telemetry.length === 1 && isSafeTelemetry(telemetry[0]) },
        {
            id: "exact_plan_mapping_and_distinct_questions",
            passed: result.outcome === "accepted"
                && result.questions.every((question, index) => (
                    question.slotId === questionPlanSnapshot.slots[index]?.id
                    && question.category === questionPlanSnapshot.slots[index]?.category
                ))
                && new Set(result.questions.map((question) => normalizeText(question.questionText))).size
                    === result.questions.length,
        },
    ];
    const automatedGatePassed = result.outcome === "accepted"
        && transportAttemptCount === 1
        && validations.every((validation) => validation.passed);
    const artifactId = `live_question_wording_${hashJson({
        generatedAt,
        configurationFingerprint: GOOGLE_CANDIDATE_QUESTION_WORDING_CONFIGURATION_FINGERPRINT,
        result,
    }).slice(0, 16)}`;
    const artifact = candidateQuestionWordingLiveValidationArtifactSchema.parse({
        status: "candidate_question_wording_live_validation_artifact",
        schemaVersion: 1,
        artifactId,
        generatedAt,
        syntheticCase: {
            id: "warehouse_quality_inspector_first_interview_v1",
            targetRole: SYNTHETIC_SETUP.targetRole,
            interviewStage: SYNTHETIC_SETUP.interviewStage,
            questionCount: SYNTHETIC_SETUP.questionCount,
            resumeContext: "included",
        },
        profile: {
            provider: GOOGLE_CANDIDATE_QUESTION_WORDING_PROVIDER,
            profileId: GOOGLE_CANDIDATE_QUESTION_WORDING_PROFILE_ID,
            model: GOOGLE_CANDIDATE_QUESTION_WORDING_MODEL,
            promptVersion: GOOGLE_CANDIDATE_QUESTION_WORDING_CONFIGURATION_MANIFEST.promptVersion,
            configurationFingerprint: GOOGLE_CANDIDATE_QUESTION_WORDING_CONFIGURATION_FINGERPRINT,
        },
        privacy: {
            sourceContent: "synthetic_fixed_case",
            candidateIdentity: "not_used",
            candidateDatabase: "not_read_or_written",
            providerRequest: "inspected_not_captured",
            assembledPrompt: "not_captured",
            rawProviderOutput: "not_captured",
            credentials: "not_captured",
        },
        summary: {
            transportAttemptCount,
            automatedGatePassed,
            humanQuestionReview: "required",
        },
        result,
        validations,
        reviewChecklist: [
            "questions_are_relevant_to_the_role_and_job_context",
            "questions_match_their_planned_categories",
            "questions_are_clear_focused_and_distinct",
            "resume_context_is_used_only_when_helpful_and_not_exposed",
            "questions_do_not_score_rank_or_make_hiring_claims",
        ],
        retention: {
            durableCandidateRows: "not_written",
            reviewArtifact: "local_ignored_json",
        },
    });

    const serialized = JSON.stringify(artifact);
    if (serialized.includes(credential) || findProhibitedQuestionWordingLiveArtifactKeys(artifact).length > 0) {
        throw new CandidateQuestionWordingLiveValidationGuardError("LIVE_QUESTION_WORDING_ARTIFACT_PRIVACY_VIOLATION");
    }
    return artifact;
}

export function assertCandidateQuestionWordingLiveValidationEnabled(input: {
    env: LiveValidationEnvironment;
    confirmedLiveProvider: boolean;
}) {
    if (!input.confirmedLiveProvider) {
        throw new CandidateQuestionWordingLiveValidationGuardError("LIVE_QUESTION_WORDING_CLI_CONFIRMATION_REQUIRED");
    }
    if (input.env[CANDIDATE_QUESTION_WORDING_LIVE_TEST_ENV] !== "true") {
        throw new CandidateQuestionWordingLiveValidationGuardError("LIVE_QUESTION_WORDING_FLAG_REQUIRED");
    }
    if (input.env.CANDIDATE_QUESTION_WORDING_PROVIDER !== GOOGLE_CANDIDATE_QUESTION_WORDING_PROVIDER) {
        throw new CandidateQuestionWordingLiveValidationGuardError("LIVE_QUESTION_WORDING_PROVIDER_MISMATCH");
    }
    if (input.env[GOOGLE_CANDIDATE_QUESTION_WORDING_PROFILE_ENV] !== GOOGLE_CANDIDATE_QUESTION_WORDING_PROFILE_ID) {
        throw new CandidateQuestionWordingLiveValidationGuardError("LIVE_QUESTION_WORDING_PROFILE_MISMATCH");
    }
    if (!input.env[GOOGLE_CANDIDATE_QUESTION_WORDING_API_KEY_ENV]?.trim()) {
        throw new CandidateQuestionWordingLiveValidationGuardError("LIVE_QUESTION_WORDING_CREDENTIAL_REQUIRED");
    }
}

export function findProhibitedQuestionWordingLiveArtifactKeys(value: unknown): string[] {
    const prohibited = new Set([
        "candidateprofileid",
        "roleprofileid",
        "candidatepracticesessionid",
        "jobdescription",
        "resumetext",
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
    const exact = providerRequest.model === GOOGLE_CANDIDATE_QUESTION_WORDING_MODEL
        && config?.responseMimeType === GOOGLE_CANDIDATE_QUESTION_WORDING_GENERATION_SETTINGS.responseMimeType
        && JSON.stringify(config.responseJsonSchema) === JSON.stringify(GOOGLE_CANDIDATE_QUESTION_WORDING_RESPONSE_SCHEMA)
        && config.temperature === GOOGLE_CANDIDATE_QUESTION_WORDING_GENERATION_SETTINGS.temperature
        && config.maxOutputTokens === GOOGLE_CANDIDATE_QUESTION_WORDING_GENERATION_SETTINGS.maxOutputTokens
        && config.candidateCount === GOOGLE_CANDIDATE_QUESTION_WORDING_GENERATION_SETTINGS.candidateCount
        && config.seed === GOOGLE_CANDIDATE_QUESTION_WORDING_GENERATION_SETTINGS.seed
        && config.thinkingConfig?.thinkingBudget === GOOGLE_CANDIDATE_QUESTION_WORDING_GENERATION_SETTINGS.thinkingBudget
        && config.thinkingConfig?.includeThoughts === GOOGLE_CANDIDATE_QUESTION_WORDING_GENERATION_SETTINGS.includeThoughts
        && config.httpOptions?.timeout === GOOGLE_CANDIDATE_QUESTION_WORDING_GENERATION_SETTINGS.timeoutMs
        && config.systemInstruction === GOOGLE_CANDIDATE_QUESTION_WORDING_SYSTEM_INSTRUCTION.join("\n");
    if (!exact) {
        throw new CandidateQuestionWordingLiveValidationGuardError("LIVE_QUESTION_WORDING_CONFIGURATION_DRIFT");
    }
}

function assertSyntheticProviderRequest(providerRequest: GenerateContentParameters, credential: string) {
    const text = readUserText(providerRequest);
    let envelope: unknown;
    try {
        envelope = JSON.parse(text);
    } catch {
        throw new CandidateQuestionWordingLiveValidationGuardError("LIVE_QUESTION_WORDING_REQUEST_INVALID");
    }
    const serialized = JSON.stringify(providerRequest);
    const envelopeRecord = isRecord(envelope) ? envelope : null;
    const record = envelopeRecord && isRecord(envelopeRecord.data) ? envelopeRecord.data : null;
    if (
        !envelopeRecord
        || !record
        || envelopeRecord.payloadClassification !== "untrusted_candidate_practice_context"
        || record.targetRole !== SYNTHETIC_SETUP.targetRole
        || record.jobDescription !== SYNTHETIC_SETUP.jobDescription
        || record.resumeText !== SYNTHETIC_SETUP.resumeText
        || record.interviewStage !== SYNTHETIC_SETUP.interviewStage
        || !Array.isArray(record.slots)
        || record.slots.length !== SYNTHETIC_SETUP.questionCount
        || serialized.includes(credential)
    ) {
        throw new CandidateQuestionWordingLiveValidationGuardError("LIVE_QUESTION_WORDING_REQUEST_BOUNDARY_VIOLATION");
    }
}

function isSafeTelemetry(event: CandidateQuestionWordingRuntimeTelemetry | undefined) {
    if (!event) return false;
    const serialized = JSON.stringify(event);
    return event.status === "candidate_question_wording_runtime_telemetry_v1"
        && event.configurationFingerprint === GOOGLE_CANDIDATE_QUESTION_WORDING_CONFIGURATION_FINGERPRINT
        && !serialized.includes(SYNTHETIC_SETUP.targetRole)
        && !serialized.includes(SYNTHETIC_SETUP.jobDescription)
        && !serialized.includes(SYNTHETIC_SETUP.resumeText);
}

function readUserText(input: GenerateContentParameters) {
    const contents = Array.isArray(input.contents) ? input.contents : [];
    const content = contents[0];
    if (!content || typeof content === "string" || !("parts" in content) || !Array.isArray(content.parts)) return "";
    const part = content.parts[0];
    return part && "text" in part && typeof part.text === "string" ? part.text : "";
}

function visit(value: unknown, path: string, callback: (key: string, path: string) => void) {
    if (Array.isArray(value)) {
        value.forEach((item, index) => visit(item, `${path}[${index}]`, callback));
        return;
    }
    if (!isRecord(value)) return;
    Object.entries(value).forEach(([key, nested]) => {
        const nestedPath = `${path}.${key}`;
        callback(key, nestedPath);
        visit(nested, nestedPath, callback);
    });
}

function normalizeText(value: string) {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hashJson(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
