import { resolveCandidateDevHostLaunchCookieIdentity } from "@/features/candidate-auth-v2/dev-host-launch-cookie-identity";
import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "@/features/candidate-auth-v2/host-launch-route";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import type { CandidateAnswerAnalysisProviderResult } from "@/features/candidate-session-v2/candidate-answer-analysis-adapter";
import type { CandidateAnswerSubmissions } from "@/features/candidate-session-v2/candidate-answer-lifecycle";
import { createCandidateAnswerCoachingFacts } from "@/features/candidate-session-v2/candidate-coaching-facts";
import { createCandidatePracticeSessionRepository } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import type { CandidateQuestionWordingResult } from "@/features/candidate-session-v2/candidate-question-wording";
import {
    createCandidateLedSessionCompletion,
    type CandidateLedSessionCompletionSnapshot,
} from "@/features/interview-session-v2/session-completion-contract";
import type { SessionRuntimeProgress } from "@/features/interview-session-v2/session-runtime-contract";
import { createSessionRuntimeFacts } from "@/features/interview-session-v2/session-runtime-facts";

type CandidateSessionIdentity = {
    candidateProfileId: string;
};

type CandidateSessionCompleteRecord = {
    candidatePracticeSessionId?: string;
    candidateProfileId?: string;
    setupSnapshot?: {
        targetRole?: string;
        interviewStage?: string;
        questionCount?: number;
    };
    questionWordingSnapshot?: CandidateQuestionWordingResult | null;
    progress?: SessionRuntimeProgress;
    answerSubmissions?: CandidateAnswerSubmissions;
    answerAnalysisSnapshots?: Record<string, CandidateAnswerAnalysisProviderResult>;
};

type CandidateSessionCompleteRepository = {
    findSetupSession: (input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
    }) => Promise<CandidateSessionCompleteRecord | null>;
    completeSession: (input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
        completionSnapshot: CandidateLedSessionCompletionSnapshot;
    }) => Promise<{
        completionSnapshot: CandidateLedSessionCompletionSnapshot | null;
        progress: SessionRuntimeProgress;
    } | null>;
};

export type CandidateSessionCompleteRouteDependencies = {
    now: Date;
    resolveCandidateSessionIdentity?: (request: Request) => Promise<CandidateSessionIdentity | null>;
    practiceSessionRepository?: CandidateSessionCompleteRepository;
};

export async function POST(
    request: Request,
    context: { params: Promise<{ sessionId: string }> },
) {
    const { sessionId } = await context.params;
    return handleCandidateSessionCompleteRequest({
        request,
        sessionId,
        now: new Date(),
        ...createDefaultCandidateSessionCompleteDependencies(),
    });
}

export async function handleCandidateSessionCompleteRequest({
    request,
    sessionId,
    now,
    resolveCandidateSessionIdentity,
    practiceSessionRepository,
}: CandidateSessionCompleteRouteDependencies & {
    request: Request;
    sessionId: string;
}) {
    const identity = resolveCandidateSessionIdentity
        ? await resolveCandidateSessionIdentity(request)
        : null;
    if (!identity || !practiceSessionRepository) {
        return Response.json({ error: "Candidate session identity is required." }, { status: 401 });
    }

    const session = await practiceSessionRepository.findSetupSession({
        candidatePracticeSessionId: sessionId,
        candidateProfileId: identity.candidateProfileId,
    });
    if (!session) {
        return Response.json({ error: "Candidate practice session was not found." }, { status: 404 });
    }
    if (!session.questionWordingSnapshot?.questions?.length) {
        return Response.json({ error: "Question wording is required before completion." }, { status: 409 });
    }

    const completionSnapshot = createCandidateLedSessionCompletion({
        facts: createSessionRuntimeFacts({
            audience: "candidate_led",
            sessionId,
            targetRole: session.setupSnapshot?.targetRole ?? "Practice session",
            interviewStage: session.setupSnapshot?.interviewStage ?? "unknown",
            questionCount: session.setupSnapshot?.questionCount ?? session.questionWordingSnapshot.questions.length,
            currentQuestionIndex: session.progress?.currentQuestionIndex ?? 0,
            questions: session.questionWordingSnapshot.questions.map((question) => {
                const answerSubmission = session.answerSubmissions?.[question.slotId];
                const analysisSnapshot = session.answerAnalysisSnapshots?.[question.slotId];

                return {
                    questionKey: question.slotId,
                    questionIndex: question.index,
                    category: question.category,
                    questionText: question.questionText,
                    ...(answerSubmission
                        ? {
                            answer: {
                                mode: answerSubmission.mode,
                                text: answerSubmission.text,
                                submittedAt: answerSubmission.submittedAt,
                                lifecycleStatus: analysisSnapshot ? "analysis_saved" as const : answerSubmission.status,
                            },
                        }
                        : {}),
                    ...(analysisSnapshot
                        ? { coachingFacts: createCandidateAnswerCoachingFacts(analysisSnapshot) }
                        : {}),
                };
            }),
            completionBehavior: {
                kind: "candidate_dashboard",
                dashboardHref: "/candidate/dashboard",
            },
        }),
        completedAt: now.toISOString(),
    });

    if (!completionSnapshot) {
        return Response.json({ error: "Candidate-led completion could not be created." }, { status: 409 });
    }

    const completed = await practiceSessionRepository.completeSession({
        candidatePracticeSessionId: sessionId,
        candidateProfileId: identity.candidateProfileId,
        completionSnapshot,
    });
    if (!completed?.completionSnapshot) {
        return Response.json({ error: "Candidate session completion could not be saved." }, { status: 404 });
    }

    return Response.json({
        status: "candidate_session_completed",
        completionSnapshot: completed.completionSnapshot,
        nextRoute: completed.completionSnapshot.nextRoute,
    });
}

function createDefaultCandidateSessionCompleteDependencies(): Pick<
    CandidateSessionCompleteRouteDependencies,
    "resolveCandidateSessionIdentity" | "practiceSessionRepository"
> {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return {};
    }

    const queryClient = createLazyPostgresQueryClient(databaseUrl);

    return {
        resolveCandidateSessionIdentity: async (request) => {
            const devIdentity = resolveCandidateSessionCompleteIdentityFromDevLaunchCookie(request.headers.get("Cookie"));
            return devIdentity ?? resolveCandidateSessionIdentityFromLaunchCookie(request, queryClient);
        },
        practiceSessionRepository: createCandidatePracticeSessionRepository(queryClient),
    };
}

type CandidateSessionCompleteQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

function createLazyPostgresQueryClient(databaseUrl: string): CandidateSessionCompleteQueryClient {
    let pool: import("pg").Pool | null = null;

    return {
        async query(sql, values) {
            const { Pool } = await import("pg");
            pool ??= new Pool({
                connectionString: databaseUrl,
                ssl: getRuntimeSslConfig(databaseUrl),
                max: 2,
                application_name: "interview-coach-candidate-session-complete",
            });
            return pool.query(sql, values);
        },
    };
}

async function resolveCandidateSessionIdentityFromLaunchCookie(
    request: Request,
    client: CandidateSessionCompleteQueryClient,
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

export function resolveCandidateSessionCompleteIdentityFromDevLaunchCookie(cookieHeader: string | null) {
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
