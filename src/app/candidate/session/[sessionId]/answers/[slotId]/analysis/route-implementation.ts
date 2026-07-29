import { resolveCandidateOwnedRequestIdentity } from "@/features/candidate-auth-v2/candidate-route-authorization";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import {
    completeCandidateAnswerIdempotencyRecord,
    createCandidateAnswerAnalysisIdempotencyContract,
    createCandidateAnswerAnalysisRequest,
    createCandidateAnswerAnalysisUnavailable,
    createCandidateAnswerIdempotencyPendingRecord,
    resolveCandidateAnswerIdempotencyDecision,
    type CandidateAnswerIdempotencyRecord,
    type CandidateAnswerIdempotencyRecords,
    type CandidateAnswerSubmissions,
} from "@/features/candidate-session-v2/candidate-answer-lifecycle";
import {
    createCandidateAnswerEvidenceFirstEvaluationCase,
    createCandidateAnswerAnalysisProjectionFromEvaluatorRun,
    createCandidateAnswerAnalysisProviderRequest,
    parseCandidateAnswerAnalysisProviderResult,
    type CandidateAnswerAnalysisProviderResult,
    type CandidateAnswerAnalysisProviderRequest,
    type CandidateAnswerAnalysisSetupSnapshot,
} from "@/features/candidate-session-v2/candidate-answer-analysis-adapter";
import { selectCandidateAnswerAnalysisRuntime } from "@/features/candidate-session-v2/candidate-answer-analysis-runtime-selection";
import {
    CANDIDATE_ANSWER_ANALYSIS_GENERATION_LIMIT,
    createCandidateAnswerAnalysisRecovery,
} from "@/features/candidate-session-v2/candidate-answer-analysis-recovery";
import {
    EvidenceFirstEvaluatorRuntimeError,
    parseAcceptedEvidenceFirstEvaluatorRun,
} from "@/features/evaluation-v2/evidence-first-evaluator-runtime";
import type { GoogleEvidenceFirstTransport } from "@/features/evaluation-v2/google-evidence-first-evaluator";
import type { EvidenceFirstEvaluatorResolvedConfigurationManifest } from "@/features/evaluation-v2/evidence-first-evaluator-contract";
import { createCandidateAnswerHistoryRepository } from "@/features/candidate-session-v2/candidate-answer-history-repository";
import {
    createCandidateAnswerEvaluationClaimExpiresAt,
    type CandidateAnswerEvaluationRunRecord,
    type CandidateAnswerEvaluationRunWriteResult,
} from "@/features/candidate-session-v2/candidate-answer-history";
import { createCandidatePracticeSessionRepository } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import {
    candidateQuestionPlanCategoryDetails,
    type CandidateQuestionPlan,
} from "@/features/candidate-session-v2/candidate-question-plan";
import type { CandidateQuestionWordingResult } from "@/features/candidate-session-v2/candidate-question-wording";

type CandidateSessionIdentity = {
    candidateProfileId: string;
};

type CandidateAnswerAnalysisSession = {
    setupSnapshot: CandidateAnswerAnalysisSetupSnapshot;
    questionPlanSnapshot?: CandidateQuestionPlan;
    questionWordingSnapshot: CandidateQuestionWordingResult | null;
    answerSubmissions: CandidateAnswerSubmissions;
    answerIdempotencyRecords?: CandidateAnswerIdempotencyRecords;
};

type CandidateAnswerAnalysisRepository = {
    findSetupSession: (input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
    }) => Promise<CandidateAnswerAnalysisSession | null>;
    saveAnswerAnalysisSnapshot?: (input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
        analysisSnapshot: CandidateAnswerAnalysisProviderResult;
    }) => Promise<Record<string, CandidateAnswerAnalysisProviderResult> | null>;
    saveAnswerIdempotencyRecord?: (input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
        record: CandidateAnswerIdempotencyRecord;
    }) => Promise<CandidateAnswerIdempotencyRecords | null>;
    clearAnswerIdempotencyRecord?: (input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
        recordKey: string;
    }) => Promise<CandidateAnswerIdempotencyRecords | null>;
};

type CandidateAnswerEvaluationRunRepository = {
    listEvaluationRuns?: (input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
        purpose: "candidate_coaching";
    }) => Promise<CandidateAnswerEvaluationRunRecord[]>;
    claimEvaluationRun: (input: {
        candidateAnswerAttemptId: string;
        candidatePracticeSessionId: string;
        candidateProfileId: string;
        purpose: "candidate_coaching";
        provider: string;
        modelName: string;
        promptVersion: string;
        evaluatorVersion: string;
        configurationManifest: EvidenceFirstEvaluatorResolvedConfigurationManifest;
        configurationFingerprint: string;
        inputFingerprint: string;
        idempotencyKey: string;
        requestedAt: string;
        claimExpiresAt: string;
    }) => Promise<CandidateAnswerEvaluationRunWriteResult | null>;
    completeEvaluationRun: (input: {
        candidateAnswerEvaluationRunId: string;
        candidateAnswerAttemptId: string;
        completedAt: string;
        result: Record<string, unknown>;
        validation: Record<string, unknown>;
    }) => Promise<CandidateAnswerEvaluationRunRecord | null>;
    failEvaluationRun: (input: {
        candidateAnswerEvaluationRunId: string;
        candidateAnswerAttemptId: string;
        lifecycleState: "failed" | "rejected";
        completedAt: string;
        errorCode: string;
        validation?: Record<string, unknown> | null;
    }) => Promise<CandidateAnswerEvaluationRunRecord | null>;
};

type CandidateAnswerEvaluationRunConfiguration = {
    provider: string;
    modelName: string;
    promptVersion: string;
    evaluatorVersion: string;
    configurationManifest: EvidenceFirstEvaluatorResolvedConfigurationManifest;
    configurationFingerprint: string;
    createInputFingerprint: (request: CandidateAnswerAnalysisProviderRequest) => string;
};

export type CandidateAnswerAnalysisRouteDependencies = {
    now: Date;
    resolveCandidateSessionIdentity?: (request: Request) => Promise<CandidateSessionIdentity | null>;
    practiceSessionRepository?: CandidateAnswerAnalysisRepository;
    requestAnswerAnalysis?: (
        request: CandidateAnswerAnalysisProviderRequest,
        context?: { evaluationRunId: string },
    ) => Promise<unknown>;
    evaluationRunRepository?: CandidateAnswerEvaluationRunRepository;
    evaluationRunConfiguration?: CandidateAnswerEvaluationRunConfiguration;
};

export const CANDIDATE_ANSWER_ANALYSIS_PROVIDER_ENV = "CANDIDATE_ANSWER_ANALYSIS_PROVIDER";

export async function POST(
    request: Request,
    context: { params: Promise<{ sessionId: string; slotId: string }> },
) {
    const { sessionId, slotId } = await context.params;
    return handleCandidateAnswerAnalysisRequest({
        request,
        sessionId,
        slotId,
        now: new Date(),
        ...createDefaultCandidateAnswerAnalysisDependencies(),
    });
}

export async function handleCandidateAnswerAnalysisRequest({
    request,
    sessionId,
    slotId,
    now,
    resolveCandidateSessionIdentity,
    practiceSessionRepository,
    requestAnswerAnalysis,
    evaluationRunRepository,
    evaluationRunConfiguration,
}: CandidateAnswerAnalysisRouteDependencies & {
    request: Request;
    sessionId: string;
    slotId: string;
}) {
    if (!slotId.trim()) {
        return Response.json({ error: "Candidate pending answer was not found." }, { status: 404 });
    }

    const identity = resolveCandidateSessionIdentity
        ? await resolveCandidateSessionIdentity(request)
        : null;
    if (!identity || !practiceSessionRepository) {
        return Response.json({ error: "Candidate session identity is required." }, { status: 401 });
    }

    const practiceSession = await practiceSessionRepository.findSetupSession({
        candidatePracticeSessionId: sessionId,
        candidateProfileId: identity.candidateProfileId,
    });
    if (!practiceSession) {
        return Response.json({ error: "Candidate practice session was not found." }, { status: 404 });
    }

    const answerSubmission = practiceSession.answerSubmissions[slotId];
    if (!answerSubmission) {
        return Response.json({ error: "Candidate pending answer was not found." }, { status: 404 });
    }

    const analysisRequest = createCandidateAnswerAnalysisRequest({
        answerSubmission,
        requestedAt: now,
    });
    const idempotencyContract = createCandidateAnswerAnalysisIdempotencyContract({
        candidatePracticeSessionId: sessionId,
        candidateProfileId: identity.candidateProfileId,
        request: analysisRequest,
        idempotencyKey: request.headers.get("Idempotency-Key"),
    });
    const idempotencyDecision = resolveCandidateAnswerIdempotencyDecision({
        contract: idempotencyContract,
        records: practiceSession.answerIdempotencyRecords ?? {},
        requestedAt: now,
    });

    if (idempotencyDecision.kind === "replay") {
        return Response.json(idempotencyDecision.body, { status: idempotencyDecision.statusCode });
    }

    if (idempotencyDecision.kind === "pending") {
        return Response.json({
            code: "REQUEST_IN_PROGRESS",
            error: "An identical answer analysis request is already in progress.",
            retryable: true,
            analysisRecovery: createCandidateAnswerAnalysisRecovery("pending"),
        }, { status: idempotencyContract.replay.pendingHttpStatus });
    }

    if (idempotencyDecision.kind === "conflict") {
        return Response.json({
            code: "IDEMPOTENCY_MISMATCH",
            error: "Idempotency key cannot be reused with a different answer analysis payload.",
            retryable: false,
        }, { status: idempotencyContract.replay.conflictHttpStatus });
    }

    if (requestAnswerAnalysis || evaluationRunRepository) {
        const question = practiceSession.questionWordingSnapshot?.questions.find((candidateQuestion) => (
            candidateQuestion.slotId === slotId
        ));
        const plannedSlot = practiceSession.questionPlanSnapshot?.slots.find((slot) => slot.id === slotId);
        if (!question || (plannedSlot && plannedSlot.index !== question.index)) {
            return Response.json({ error: "Candidate question wording is required for answer analysis." }, { status: 409 });
        }

        const providerRequest = createCandidateAnswerAnalysisProviderRequest({
            request: analysisRequest,
            question: {
                ...question,
                plannedPurpose: plannedSlot?.purpose
                    ?? candidateQuestionPlanCategoryDetails[question.category].purpose,
            },
            setupSnapshot: practiceSession.setupSnapshot,
        });

        let completed = false;
        let preservePendingIdempotencyRecord = false;
        let requestedEvaluationRun: CandidateAnswerEvaluationRunRecord | null = null;
        let recentGenerationCount: number | null = null;
        try {
            if (practiceSessionRepository.saveAnswerIdempotencyRecord) {
                await practiceSessionRepository.saveAnswerIdempotencyRecord({
                    candidatePracticeSessionId: sessionId,
                    candidateProfileId: identity.candidateProfileId,
                    record: createCandidateAnswerIdempotencyPendingRecord({
                        contract: idempotencyContract,
                        requestedAt: now,
                    }),
                });
            }

            let analysisSnapshot: CandidateAnswerAnalysisProviderResult | null = null;
            if (evaluationRunRepository && evaluationRunConfiguration && requestAnswerAnalysis) {
                const candidateAnswerAttemptId = providerRequest.answer.answerAttemptId;
                if (!candidateAnswerAttemptId) {
                    return Response.json({
                        code: "ANSWER_ATTEMPT_REQUIRED",
                        error: "Immutable answer-attempt identity is required for coaching.",
                        retryable: false,
                    }, { status: 409 });
                }

                const inputFingerprint = evaluationRunConfiguration.createInputFingerprint(providerRequest);
                const writeResult = await evaluationRunRepository.claimEvaluationRun({
                    candidateAnswerAttemptId,
                    candidatePracticeSessionId: sessionId,
                    candidateProfileId: identity.candidateProfileId,
                    purpose: "candidate_coaching",
                    provider: evaluationRunConfiguration.provider,
                    modelName: evaluationRunConfiguration.modelName,
                    promptVersion: evaluationRunConfiguration.promptVersion,
                    evaluatorVersion: evaluationRunConfiguration.evaluatorVersion,
                    configurationManifest: evaluationRunConfiguration.configurationManifest,
                    configurationFingerprint: evaluationRunConfiguration.configurationFingerprint,
                    inputFingerprint,
                    idempotencyKey: idempotencyContract.key,
                    requestedAt: now.toISOString(),
                    claimExpiresAt: createCandidateAnswerEvaluationClaimExpiresAt(now),
                });
                if (!writeResult) {
                    return Response.json({
                        code: "ANSWER_ATTEMPT_NOT_OWNED",
                        error: "The answer attempt could not be resolved for coaching.",
                        retryable: false,
                    }, { status: 409 });
                }
                if (writeResult.outcome === "idempotency_conflict") {
                    return Response.json({
                        code: "EVALUATION_RUN_MISMATCH",
                        error: "The evaluator-run claim does not match this answer.",
                        retryable: false,
                    }, { status: 409 });
                }
                if (
                    writeResult.outcome === "generation_limit"
                    || writeResult.outcome === "generation_unavailable"
                ) {
                    return Response.json({
                        code: writeResult.outcome === "generation_limit"
                            ? "ANSWER_ANALYSIS_RECOVERY_LIMIT"
                            : "ANSWER_ANALYSIS_UNAVAILABLE",
                        error: "Candidate coaching is unavailable for this answer right now.",
                        retryable: false,
                        analysisRecovery: createCandidateAnswerAnalysisRecovery("unavailable"),
                    }, { status: writeResult.outcome === "generation_limit" ? 429 : 409 });
                }

                requestedEvaluationRun = writeResult.run;
                recentGenerationCount = writeResult.recentGenerationCount ?? null;
                if (writeResult.run.lifecycleState === "completed") {
                    const acceptedRun = parseAcceptedEvidenceFirstEvaluatorRun(writeResult.run.result);
                    analysisSnapshot = acceptedRun
                        && acceptedRun.evaluationRunId === writeResult.run.candidateAnswerEvaluationRunId
                        && acceptedRun.inputFingerprint === writeResult.run.inputFingerprint
                        ? createCandidateAnswerAnalysisProjectionFromEvaluatorRun({
                            run: acceptedRun,
                            answer: createAnalysisAnswerReference(providerRequest),
                        })
                        : parseCandidateAnswerAnalysisProviderResult(writeResult.run.result, analysisRequest);
                } else if (
                    writeResult.outcome === "replayed"
                    && writeResult.run.lifecycleState === "requested"
                ) {
                    preservePendingIdempotencyRecord = true;
                    return Response.json({
                        code: "EVALUATION_RUN_IN_PROGRESS",
                        error: "Candidate coaching is already being prepared.",
                        retryable: true,
                        analysisRecovery: createCandidateAnswerAnalysisRecovery("pending"),
                    }, { status: 409 });
                } else if (writeResult.run.lifecycleState === "requested") {
                    const providerResult = await requestAnswerAnalysis(providerRequest, {
                        evaluationRunId: writeResult.run.candidateAnswerEvaluationRunId,
                    });
                    const acceptedRun = parseAcceptedEvidenceFirstEvaluatorRun(providerResult);
                    if (
                        !acceptedRun
                        || acceptedRun.evaluationRunId !== writeResult.run.candidateAnswerEvaluationRunId
                        || acceptedRun.inputFingerprint !== inputFingerprint
                    ) {
                        await evaluationRunRepository.failEvaluationRun({
                            candidateAnswerEvaluationRunId: writeResult.run.candidateAnswerEvaluationRunId,
                            candidateAnswerAttemptId,
                            lifecycleState: "rejected",
                            completedAt: now.toISOString(),
                            errorCode: "INVALID_CANDIDATE_COACHING_RESULT",
                            validation: {
                                disposition: "rejected",
                                expectedInputFingerprint: inputFingerprint,
                            },
                        });
                        requestedEvaluationRun = null;
                        throw new EvidenceFirstEvaluatorRuntimeError({
                            disposition: "rejected",
                            errorCode: "INVALID_CANDIDATE_COACHING_RESULT",
                            stage: "runtime",
                            retryableByNewRun: false,
                            attempts: [],
                        });
                    }

                    analysisSnapshot = createCandidateAnswerAnalysisProjectionFromEvaluatorRun({
                        run: acceptedRun,
                        answer: createAnalysisAnswerReference(providerRequest),
                    });
                    const persistedRun = await evaluationRunRepository.completeEvaluationRun({
                        candidateAnswerEvaluationRunId: writeResult.run.candidateAnswerEvaluationRunId,
                        candidateAnswerAttemptId,
                        completedAt: acceptedRun.completedAt,
                        result: toJsonRecord(acceptedRun),
                        validation: {
                            disposition: "accepted",
                            contractVersion: acceptedRun.contractVersion,
                            inputFingerprint,
                            candidateSafeProjection: true,
                            internalStageArtifacts: true,
                            stageCount: acceptedRun.stages.length,
                        },
                    });
                    if (!persistedRun) {
                        throw new Error("Accepted candidate coaching could not be persisted.");
                    }
                    requestedEvaluationRun = null;
                } else {
                    throw new Error("Candidate coaching evaluator run is not available for replay.");
                }
            } else if (requestAnswerAnalysis) {
                const providerResult = await requestAnswerAnalysis(providerRequest);
                const acceptedRun = parseAcceptedEvidenceFirstEvaluatorRun(providerResult);
                analysisSnapshot = acceptedRun
                    ? createCandidateAnswerAnalysisProjectionFromEvaluatorRun({
                        run: acceptedRun,
                        answer: createAnalysisAnswerReference(providerRequest),
                    })
                    : parseCandidateAnswerAnalysisProviderResult(providerResult, analysisRequest);
            } else if (
                evaluationRunRepository?.listEvaluationRuns
                && providerRequest.answer.answerAttemptId
            ) {
                const expectedInputFingerprint = createCandidateAnswerEvidenceFirstEvaluationCase(
                    providerRequest,
                ).inputFingerprint;
                const completedRun = (await evaluationRunRepository.listEvaluationRuns({
                    candidatePracticeSessionId: sessionId,
                    candidateProfileId: identity.candidateProfileId,
                    purpose: "candidate_coaching",
                })).find((run) => (
                    run.candidateAnswerAttemptId === providerRequest.answer.answerAttemptId
                    && run.lifecycleState === "completed"
                ));
                const acceptedRun = parseAcceptedEvidenceFirstEvaluatorRun(completedRun?.result);
                analysisSnapshot = acceptedRun
                    && acceptedRun.evaluationRunId === completedRun?.candidateAnswerEvaluationRunId
                    && acceptedRun.inputFingerprint === expectedInputFingerprint
                    ? createCandidateAnswerAnalysisProjectionFromEvaluatorRun({
                        run: acceptedRun,
                        answer: createAnalysisAnswerReference(providerRequest),
                    })
                    : null;
            }

            if (analysisSnapshot && practiceSessionRepository.saveAnswerAnalysisSnapshot) {
                const savedSnapshots = await practiceSessionRepository.saveAnswerAnalysisSnapshot({
                    candidatePracticeSessionId: sessionId,
                    candidateProfileId: identity.candidateProfileId,
                    analysisSnapshot,
                });

                if (savedSnapshots?.[slotId]) {
                    const responseBody = {
                        status: "answer_analysis_saved",
                        analysisSnapshot: savedSnapshots[slotId],
                    };

                    if (practiceSessionRepository.saveAnswerIdempotencyRecord) {
                        await practiceSessionRepository.saveAnswerIdempotencyRecord({
                            candidatePracticeSessionId: sessionId,
                            candidateProfileId: identity.candidateProfileId,
                            record: completeCandidateAnswerIdempotencyRecord({
                                record: idempotencyDecision.record,
                                completedAt: now,
                                statusCode: 200,
                                body: responseBody,
                            }),
                        });
                    }

                    completed = true;
                    return Response.json(responseBody, { status: 200 });
                }
            }
        } catch (error) {
            if (
                requestedEvaluationRun?.lifecycleState === "requested"
                && evaluationRunRepository
            ) {
                await evaluationRunRepository.failEvaluationRun({
                    candidateAnswerEvaluationRunId: requestedEvaluationRun.candidateAnswerEvaluationRunId,
                    candidateAnswerAttemptId: requestedEvaluationRun.candidateAnswerAttemptId,
                    lifecycleState: error instanceof EvidenceFirstEvaluatorRuntimeError
                        ? error.disposition
                        : "failed",
                    completedAt: now.toISOString(),
                    errorCode: error instanceof EvidenceFirstEvaluatorRuntimeError
                        ? error.errorCode
                        : "CANDIDATE_COACHING_PROVIDER_FAILED",
                    ...(error instanceof EvidenceFirstEvaluatorRuntimeError ? {
                        validation: {
                            disposition: error.disposition,
                            stage: error.stage,
                            retryableByNewRun: error.retryableByNewRun,
                            attemptCount: error.attempts.length,
                            stageAttempts: error.attempts,
                        },
                    } : {}),
                }).catch(() => undefined);
            }
            const retryableByNewRun = error instanceof EvidenceFirstEvaluatorRuntimeError
                ? error.retryableByNewRun
                : true;
            const generationLimitReached = recentGenerationCount !== null
                && recentGenerationCount >= CANDIDATE_ANSWER_ANALYSIS_GENERATION_LIMIT;
            const analysisRecovery = createCandidateAnswerAnalysisRecovery(
                retryableByNewRun && !generationLimitReached ? "retryable" : "unavailable",
            );
            return Response.json({
                code: "ANSWER_ANALYSIS_FAILED",
                error: "Candidate coaching could not be prepared.",
                retryable: analysisRecovery.canRetryAnalysis,
                analysisRecovery,
            }, { status: 503 });
        } finally {
            if (
                !completed
                && !preservePendingIdempotencyRecord
                && practiceSessionRepository.clearAnswerIdempotencyRecord
            ) {
                await practiceSessionRepository.clearAnswerIdempotencyRecord({
                    candidatePracticeSessionId: sessionId,
                    candidateProfileId: identity.candidateProfileId,
                    recordKey: idempotencyDecision.record.recordKey,
                }).catch(() => undefined);
            }
        }
    }

    return Response.json({
        ...createCandidateAnswerAnalysisUnavailable({
            request: analysisRequest,
        }),
        retryable: false,
        analysisRecovery: createCandidateAnswerAnalysisRecovery("unavailable"),
    }, { status: 503 });
}

export function createDefaultCandidateAnswerAnalysisDependencies(input?: {
    env?: Record<string, string | undefined>;
    googleTransportFactory?: (apiKey: string) => GoogleEvidenceFirstTransport;
}): Pick<
    CandidateAnswerAnalysisRouteDependencies,
    | "resolveCandidateSessionIdentity"
    | "practiceSessionRepository"
    | "requestAnswerAnalysis"
    | "evaluationRunRepository"
    | "evaluationRunConfiguration"
> {
    const env = input?.env ?? process.env;
    const databaseUrl = env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return {};
    }

    const queryClient = createLazyPostgresQueryClient(databaseUrl);

    const selectedRuntime = selectCandidateAnswerAnalysisRuntime({
        env,
        googleTransportFactory: input?.googleTransportFactory,
    });
    return {
        resolveCandidateSessionIdentity: (request) =>
            resolveCandidateOwnedRequestIdentity(request, queryClient),
        practiceSessionRepository: createCandidatePracticeSessionRepository(queryClient),
        requestAnswerAnalysis: selectedRuntime?.requestAnswerAnalysis,
        evaluationRunRepository: createCandidateAnswerHistoryRepository(queryClient),
        ...(selectedRuntime ? {
            evaluationRunConfiguration: {
                ...selectedRuntime.runMetadata,
                createInputFingerprint: selectedRuntime.createInputFingerprint,
            },
        } : {}),
    };
}

type CandidateAnswerAnalysisQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

function createLazyPostgresQueryClient(databaseUrl: string): CandidateAnswerAnalysisQueryClient {
    let pool: import("pg").Pool | null = null;

    return {
        async query(sql, values) {
            const { Pool } = await import("pg");
            pool ??= new Pool({
                connectionString: databaseUrl,
                ssl: getRuntimeSslConfig(databaseUrl),
                max: 2,
                application_name: "interview-coach-candidate-answer-analysis",
            });
            return pool.query(sql, values);
        },
    };
}

function getRuntimeSslConfig(databaseUrl: string) {
    const sslMode = readUrlSslMode(databaseUrl);
    if (sslMode === "disable") {
        return false;
    }
    if (sslMode) {
        return {
            rejectUnauthorized: sslMode === "verify-ca" || sslMode === "verify-full",
        };
    }
    return undefined;
}

function readUrlSslMode(databaseUrl: string) {
    try {
        return new URL(databaseUrl).searchParams.get("sslmode")?.toLowerCase() ?? null;
    } catch {
        return null;
    }
}

function createAnalysisAnswerReference(
    request: CandidateAnswerAnalysisProviderRequest,
): CandidateAnswerAnalysisProviderResult["answer"] {
    return {
        slotId: request.answer.slotId,
        questionIndex: request.answer.questionIndex,
        ...(request.answer.answerAttemptId && request.answer.attemptNumber && request.answer.trigger ? {
            answerAttemptId: request.answer.answerAttemptId,
            attemptNumber: request.answer.attemptNumber,
            trigger: request.answer.trigger,
        } : {}),
    };
}

function toJsonRecord(value: unknown): Record<string, unknown> {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
