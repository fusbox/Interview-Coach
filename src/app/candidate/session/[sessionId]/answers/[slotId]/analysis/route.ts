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
import { createCandidatePracticeSessionRepository } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import type { CandidateQuestionWordingResult } from "@/features/candidate-session-v2/candidate-question-wording";

type CandidateSessionIdentity = {
    candidateProfileId: string;
};

type CandidateAnswerAnalysisSession = {
    setupSnapshot: CandidateAnswerAnalysisSetupSnapshot;
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

export type CandidateAnswerAnalysisRouteDependencies = {
    now: Date;
    resolveCandidateSessionIdentity?: (request: Request) => Promise<CandidateSessionIdentity | null>;
    practiceSessionRepository?: CandidateAnswerAnalysisRepository;
    requestAnswerAnalysis?: (request: CandidateAnswerAnalysisProviderRequest) => Promise<unknown>;
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
        if (!question) {
            return Response.json({ error: "Candidate question wording is required for answer analysis." }, { status: 409 });
        }

        const providerRequest = createCandidateAnswerAnalysisProviderRequest({
            request: analysisRequest,
            question,
            setupSnapshot: practiceSession.setupSnapshot,
        });

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

        const providerResult = await requestAnswerAnalysis(providerRequest);
        const analysisSnapshot = parseCandidateAnswerAnalysisProviderResult(providerResult, analysisRequest);

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

                return Response.json(responseBody, { status: 200 });
            }
        }

        if (practiceSessionRepository.clearAnswerIdempotencyRecord) {
            await practiceSessionRepository.clearAnswerIdempotencyRecord({
                candidatePracticeSessionId: sessionId,
                candidateProfileId: identity.candidateProfileId,
                recordKey: idempotencyDecision.record.recordKey,
            });
        }
    }

    return Response.json(createCandidateAnswerAnalysisUnavailable({
        request: analysisRequest,
    }), { status: 503 });
}

export function createDefaultCandidateAnswerAnalysisDependencies(): Pick<
    CandidateAnswerAnalysisRouteDependencies,
    "resolveCandidateSessionIdentity" | "practiceSessionRepository" | "requestAnswerAnalysis"
> {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return {};
    }

    const queryClient = createLazyPostgresQueryClient(databaseUrl);

    return {
        resolveCandidateSessionIdentity: async (request) => {
            const devIdentity = resolveCandidateAnswerAnalysisIdentityFromDevLaunchCookie(request.headers.get("Cookie"));
            return devIdentity ?? resolveCandidateSessionIdentityFromLaunchCookie(request, queryClient);
        },
        practiceSessionRepository: createCandidatePracticeSessionRepository(queryClient),
        requestAnswerAnalysis: createDefaultCandidateAnswerAnalysisProvider(),
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
        return {
            status: "answer_analysis_provider_result",
            provider: "candidate_v2_answer_evaluator",
            analyzedAt: request.requestedAt,
            answer: {
                slotId: request.answer.slotId,
                questionIndex: request.answer.questionIndex,
            },
            coachFeedback: {
                acknowledgement: "You have a workable starting point for this answer.",
                observation: "Your response connects to the question, but it will be stronger with a clearer example, action, and result.",
                nextPracticeFocus: "Practice adding one concrete detail from your work history and the outcome it led to.",
            },
            evidence: [
                {
                    criterionId: "answer_relevance",
                    applicability: "observed",
                    score: 3,
                },
                {
                    criterionId: "specific_example",
                    applicability: "insufficient_data",
                },
            ],
        };
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
