import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "@/features/candidate-auth-v2/host-launch-route";
import { resolveCandidateDevHostLaunchCookieIdentity } from "@/features/candidate-auth-v2/dev-host-launch-cookie-identity";
import {
    CANDIDATE_HOST_LAUNCH_DEV_MODE_ENV,
    CANDIDATE_HOST_LAUNCH_DEV_SECRET_ENV,
} from "@/features/candidate-auth-v2/dev-host-launch";
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
    createCandidateAnswerAnalysisProviderRequest,
    parseCandidateAnswerAnalysisProviderResult,
    type CandidateAnswerAnalysisProviderResult,
    type CandidateAnswerAnalysisProviderRequest,
    type CandidateAnswerAnalysisSetupSnapshot,
} from "@/features/candidate-session-v2/candidate-answer-analysis-adapter";
import {
    candidateAnswerAnalysisFixtureRunMetadata,
    createFixtureEvidenceFirstAnswerAnalysis,
    createFixtureEvidenceFirstEvaluationCase,
} from "@/features/candidate-session-v2/candidate-answer-analysis-fixture";
import { createCandidateAnswerHistoryRepository } from "@/features/candidate-session-v2/candidate-answer-history-repository";
import type {
    CandidateAnswerEvaluationRunRecord,
    CandidateAnswerEvaluationRunWriteResult,
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
    startEvaluationRun: (input: {
        candidateAnswerAttemptId: string;
        candidatePracticeSessionId: string;
        candidateProfileId: string;
        purpose: "candidate_coaching";
        provider: string;
        modelName: string;
        promptVersion: string;
        evaluatorVersion: string;
        inputFingerprint: string;
        idempotencyKey: string;
        requestedAt: string;
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
    createInputFingerprint: (request: CandidateAnswerAnalysisProviderRequest) => string;
};

export type CandidateAnswerAnalysisRouteDependencies = {
    now: Date;
    resolveCandidateSessionIdentity?: (request: Request) => Promise<CandidateSessionIdentity | null>;
    practiceSessionRepository?: CandidateAnswerAnalysisRepository;
    requestAnswerAnalysis?: (request: CandidateAnswerAnalysisProviderRequest) => Promise<unknown>;
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
        }, { status: idempotencyContract.replay.pendingHttpStatus });
    }

    if (idempotencyDecision.kind === "conflict") {
        return Response.json({
            code: "IDEMPOTENCY_MISMATCH",
            error: "Idempotency key cannot be reused with a different answer analysis payload.",
            retryable: false,
        }, { status: idempotencyContract.replay.conflictHttpStatus });
    }

    if (requestAnswerAnalysis) {
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
        let requestedEvaluationRun: CandidateAnswerEvaluationRunRecord | null = null;
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
            if (evaluationRunRepository && evaluationRunConfiguration) {
                const candidateAnswerAttemptId = providerRequest.answer.answerAttemptId;
                if (!candidateAnswerAttemptId) {
                    return Response.json({
                        code: "ANSWER_ATTEMPT_REQUIRED",
                        error: "Immutable answer-attempt identity is required for coaching.",
                        retryable: false,
                    }, { status: 409 });
                }

                const inputFingerprint = evaluationRunConfiguration.createInputFingerprint(providerRequest);
                const writeResult = await evaluationRunRepository.startEvaluationRun({
                    candidateAnswerAttemptId,
                    candidatePracticeSessionId: sessionId,
                    candidateProfileId: identity.candidateProfileId,
                    purpose: "candidate_coaching",
                    provider: evaluationRunConfiguration.provider,
                    modelName: evaluationRunConfiguration.modelName,
                    promptVersion: evaluationRunConfiguration.promptVersion,
                    evaluatorVersion: evaluationRunConfiguration.evaluatorVersion,
                    inputFingerprint,
                    idempotencyKey: idempotencyContract.key,
                    requestedAt: now.toISOString(),
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

                requestedEvaluationRun = writeResult.run;
                if (writeResult.run.lifecycleState === "completed") {
                    analysisSnapshot = parseCandidateAnswerAnalysisProviderResult(
                        writeResult.run.result,
                        analysisRequest,
                    );
                } else if (writeResult.run.lifecycleState === "requested") {
                    const providerResult = await requestAnswerAnalysis(providerRequest);
                    analysisSnapshot = parseCandidateAnswerAnalysisProviderResult(providerResult, analysisRequest);
                    if (!analysisSnapshot || analysisSnapshot.evidenceFirst?.inputFingerprint !== inputFingerprint) {
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
                        throw new Error("Candidate coaching result failed validation.");
                    }

                    const acceptedRun = await evaluationRunRepository.completeEvaluationRun({
                        candidateAnswerEvaluationRunId: writeResult.run.candidateAnswerEvaluationRunId,
                        candidateAnswerAttemptId,
                        completedAt: now.toISOString(),
                        result: toJsonRecord(analysisSnapshot),
                        validation: {
                            disposition: "accepted",
                            contractVersion: analysisSnapshot.evidenceFirst.contractVersion,
                            inputFingerprint,
                            candidateSafeProjection: true,
                        },
                    });
                    if (!acceptedRun) {
                        throw new Error("Accepted candidate coaching could not be persisted.");
                    }
                    requestedEvaluationRun = null;
                } else {
                    throw new Error("Candidate coaching evaluator run is not available for replay.");
                }
            } else {
                const providerResult = await requestAnswerAnalysis(providerRequest);
                analysisSnapshot = parseCandidateAnswerAnalysisProviderResult(providerResult, analysisRequest);
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
        } catch {
            if (
                requestedEvaluationRun?.lifecycleState === "requested"
                && evaluationRunRepository
            ) {
                await evaluationRunRepository.failEvaluationRun({
                    candidateAnswerEvaluationRunId: requestedEvaluationRun.candidateAnswerEvaluationRunId,
                    candidateAnswerAttemptId: requestedEvaluationRun.candidateAnswerAttemptId,
                    lifecycleState: "failed",
                    completedAt: now.toISOString(),
                    errorCode: "CANDIDATE_COACHING_PROVIDER_FAILED",
                }).catch(() => undefined);
            }
            return Response.json({
                code: "ANSWER_ANALYSIS_FAILED",
                error: "Candidate coaching could not be prepared.",
                retryable: true,
            }, { status: 503 });
        } finally {
            if (!completed && practiceSessionRepository.clearAnswerIdempotencyRecord) {
                await practiceSessionRepository.clearAnswerIdempotencyRecord({
                    candidatePracticeSessionId: sessionId,
                    candidateProfileId: identity.candidateProfileId,
                    recordKey: idempotencyDecision.record.recordKey,
                }).catch(() => undefined);
            }
        }
    }

    return Response.json(createCandidateAnswerAnalysisUnavailable({
        request: analysisRequest,
    }), { status: 503 });
}

export function createDefaultCandidateAnswerAnalysisDependencies(): Pick<
    CandidateAnswerAnalysisRouteDependencies,
    | "resolveCandidateSessionIdentity"
    | "practiceSessionRepository"
    | "requestAnswerAnalysis"
    | "evaluationRunRepository"
    | "evaluationRunConfiguration"
> {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return {};
    }

    const queryClient = createLazyPostgresQueryClient(databaseUrl);

    const requestAnswerAnalysis = createDefaultCandidateAnswerAnalysisProvider();
    return {
        resolveCandidateSessionIdentity: async (request) => {
            const devIdentity = resolveCandidateAnswerAnalysisIdentityFromDevLaunchCookie(request.headers.get("Cookie"));
            return devIdentity ?? resolveCandidateSessionIdentityFromLaunchCookie(request, queryClient);
        },
        practiceSessionRepository: createCandidatePracticeSessionRepository(queryClient),
        requestAnswerAnalysis,
        ...(requestAnswerAnalysis ? {
            evaluationRunRepository: createCandidateAnswerHistoryRepository(queryClient),
            evaluationRunConfiguration: {
                ...candidateAnswerAnalysisFixtureRunMetadata,
                createInputFingerprint: (request: CandidateAnswerAnalysisProviderRequest) => (
                    createFixtureEvidenceFirstEvaluationCase(request).inputFingerprint
                ),
            },
        } : {}),
    };
}

function createDefaultCandidateAnswerAnalysisProvider() {
    const provider = process.env[CANDIDATE_ANSWER_ANALYSIS_PROVIDER_ENV]?.trim().toLowerCase();
    if (provider !== "fixture" || !isExplicitLocalDevLaunchMode()) {
        return undefined;
    }

    return async function requestFixtureAnswerAnalysis(
        request: CandidateAnswerAnalysisProviderRequest,
    ): Promise<CandidateAnswerAnalysisProviderResult> {
        return createFixtureEvidenceFirstAnswerAnalysis(request);
    };
}

function isExplicitLocalDevLaunchMode() {
    return process.env[CANDIDATE_HOST_LAUNCH_DEV_MODE_ENV] === "true"
        && Boolean(process.env[CANDIDATE_HOST_LAUNCH_DEV_SECRET_ENV]?.trim());
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

async function resolveCandidateSessionIdentityFromLaunchCookie(
    request: Request,
    client: CandidateAnswerAnalysisQueryClient,
): Promise<CandidateSessionIdentity | null> {
    const candidateLaunchSessionId = readCookieValue(request.headers.get("Cookie"), CANDIDATE_HOST_LAUNCH_SESSION_COOKIE);
    if (!candidateLaunchSessionId) {
        return null;
    }

    const result = await client.query(`
        select candidate_profile_id
        from public.candidate_launch_sessions
        where candidate_launch_session_id = $1
          and revoked_at is null
          and expires_at > now()
        limit 1
    `, [candidateLaunchSessionId]);
    const candidateProfileId = readString(result.rows[0]?.candidate_profile_id);

    return candidateProfileId ? { candidateProfileId } : null;
}

export function resolveCandidateAnswerAnalysisIdentityFromDevLaunchCookie(cookieHeader: string | null) {
    return resolveCandidateDevHostLaunchCookieIdentity(cookieHeader);
}

function readCookieValue(cookieHeader: string | null, name: string) {
    if (!cookieHeader) {
        return null;
    }

    const cookie = cookieHeader
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));

    if (!cookie) {
        return null;
    }

    return decodeURIComponent(cookie.slice(name.length + 1));
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value : null;
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

function toJsonRecord(value: CandidateAnswerAnalysisProviderResult): Record<string, unknown> {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
