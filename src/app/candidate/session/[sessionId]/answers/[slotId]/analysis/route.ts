import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "@/features/candidate-auth-v2/host-launch-route";
import { resolveCandidateDevHostLaunchCookieIdentity } from "@/features/candidate-auth-v2/dev-host-launch-cookie-identity";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import {
    createCandidateAnswerAnalysisRequest,
    createCandidateAnswerAnalysisUnavailable,
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
};

export type CandidateAnswerAnalysisRouteDependencies = {
    now: Date;
    resolveCandidateSessionIdentity?: (request: Request) => Promise<CandidateSessionIdentity | null>;
    practiceSessionRepository?: CandidateAnswerAnalysisRepository;
    requestAnswerAnalysis?: (request: CandidateAnswerAnalysisProviderRequest) => Promise<unknown>;
};

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
        const providerResult = await requestAnswerAnalysis(providerRequest);
        const analysisSnapshot = parseCandidateAnswerAnalysisProviderResult(providerResult, analysisRequest);

        if (analysisSnapshot && practiceSessionRepository.saveAnswerAnalysisSnapshot) {
            const savedSnapshots = await practiceSessionRepository.saveAnswerAnalysisSnapshot({
                candidatePracticeSessionId: sessionId,
                candidateProfileId: identity.candidateProfileId,
                analysisSnapshot,
            });

            if (savedSnapshots?.[slotId]) {
                return Response.json({
                    status: "answer_analysis_saved",
                    analysisSnapshot: savedSnapshots[slotId],
                }, { status: 200 });
            }
        }
    }

    return Response.json(createCandidateAnswerAnalysisUnavailable({
        request: analysisRequest,
    }), { status: 503 });
}

function createDefaultCandidateAnswerAnalysisDependencies(): Pick<
    CandidateAnswerAnalysisRouteDependencies,
    "resolveCandidateSessionIdentity" | "practiceSessionRepository"
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
