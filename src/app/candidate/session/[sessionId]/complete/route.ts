import { resolveCandidateDevHostLaunchCookieIdentity } from "@/features/candidate-auth-v2/dev-host-launch-cookie-identity";
import {
    CANDIDATE_HOST_LAUNCH_DEV_MODE_ENV,
    CANDIDATE_HOST_LAUNCH_DEV_SECRET_ENV,
} from "@/features/candidate-auth-v2/dev-host-launch";
import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "@/features/candidate-auth-v2/host-launch-route";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import { createCandidateCoachUpdateArtifactRepository } from "@/features/candidate-dashboard-v2/candidate-coach-update-artifact-repository";
import { createCandidateCoachUpdateSynthesisInput } from "@/features/candidate-dashboard-v2/candidate-coach-update-artifact";
import {
    ensureCandidateCoachUpdateArtifact,
    type CandidateCoachUpdateGenerationResult,
} from "@/features/candidate-dashboard-v2/candidate-coach-update-generation";
import { createCandidateDashboardHref } from "@/features/candidate-dashboard-v2/candidate-dashboard-route";
import type { CandidateAnswerAnalysisProviderResult } from "@/features/candidate-session-v2/candidate-answer-analysis-adapter";
import { createCandidateAnswerHistoryRepository } from "@/features/candidate-session-v2/candidate-answer-history-repository";
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
    roleProfileId?: string | null;
    setupSnapshot?: {
        targetRole?: string;
        interviewStage?: string;
        questionCount?: number;
    };
    questionWordingSnapshot?: CandidateQuestionWordingResult | null;
    progress?: SessionRuntimeProgress;
    answerSubmissions?: CandidateAnswerSubmissions;
    answerAnalysisSnapshots?: Record<string, CandidateAnswerAnalysisProviderResult>;
    status?: "planned" | "in_progress" | "completed" | "abandoned";
    completionSnapshot?: CandidateLedSessionCompletionSnapshot | null;
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
    ensureCoachUpdateArtifact?: (input: {
        candidateProfileId: string;
        sourceCandidatePracticeSessionId: string;
    }) => Promise<CandidateCoachUpdateGenerationResult>;
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
    ensureCoachUpdateArtifact,
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
    const existingCompletion = session.status === "completed" ? session.completionSnapshot : null;
    if (!existingCompletion && !session.questionWordingSnapshot?.questions?.length) {
        return Response.json({ error: "Question wording is required before completion." }, { status: 409 });
    }

    const completionSnapshot = existingCompletion ?? createCandidateLedSessionCompletion({
        facts: createSessionRuntimeFacts({
            audience: "candidate_led",
            sessionId,
            targetRole: session.setupSnapshot?.targetRole ?? "Practice session",
            interviewStage: session.setupSnapshot?.interviewStage ?? "unknown",
            questionCount: session.setupSnapshot?.questionCount ?? session.questionWordingSnapshot!.questions.length,
            currentQuestionIndex: session.progress?.currentQuestionIndex ?? 0,
            questions: session.questionWordingSnapshot!.questions.map((question) => {
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
                dashboardHref: session.roleProfileId
                    ? createCandidateDashboardHref({ roleProfileId: session.roleProfileId })
                    : createCandidateDashboardHref(session.setupSnapshot?.targetRole
                        ? { legacyTargetRole: session.setupSnapshot.targetRole }
                        : undefined),
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

    const coachUpdate = ensureCoachUpdateArtifact
        ? await ensureCoachUpdateArtifact({
            candidateProfileId: identity.candidateProfileId,
            sourceCandidatePracticeSessionId: sessionId,
        }).catch(() => ({
            status: "coach_update_unavailable" as const,
            reason: "generation_failed" as const,
        }))
        : null;

    return Response.json({
        status: "candidate_session_completed",
        completionSnapshot: completed.completionSnapshot,
        nextRoute: completed.completionSnapshot.nextRoute,
        ...(coachUpdate ? { coachUpdateStatus: coachUpdate.status } : {}),
    });
}

function createDefaultCandidateSessionCompleteDependencies(): Pick<
    CandidateSessionCompleteRouteDependencies,
    "resolveCandidateSessionIdentity" | "practiceSessionRepository" | "ensureCoachUpdateArtifact"
> {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return {};
    }

    const queryClient = createLazyPostgresQueryClient(databaseUrl);

    const practiceSessionRepository = createCandidatePracticeSessionRepository(queryClient);
    const answerHistoryRepository = createCandidateAnswerHistoryRepository(queryClient);
    const coachUpdateArtifactRepository = createCandidateCoachUpdateArtifactRepository(queryClient);

    return {
        resolveCandidateSessionIdentity: async (request) => {
            const devIdentity = resolveCandidateSessionCompleteIdentityFromDevLaunchCookie(request.headers.get("Cookie"));
            return devIdentity ?? resolveCandidateSessionIdentityFromLaunchCookie(request, queryClient);
        },
        practiceSessionRepository,
        ...(isExplicitLocalCoachUpdateFixtureMode() ? {
            ensureCoachUpdateArtifact: async ({
                candidateProfileId,
                sourceCandidatePracticeSessionId,
            }: {
                candidateProfileId: string;
                sourceCandidatePracticeSessionId: string;
            }) => ensureCandidateCoachUpdateArtifact({
                candidateProfileId,
                sourceCandidatePracticeSessionId,
                repository: coachUpdateArtifactRepository,
                loadInput: async () => {
                    const [sessions, attempts, evaluationRuns] = await Promise.all([
                        practiceSessionRepository.listPracticeSessionsForCandidate({
                            candidateProfileId,
                            limit: 100,
                        }),
                        answerHistoryRepository.listAnswerAttemptsForCandidate({ candidateProfileId }),
                        answerHistoryRepository.listEvaluationRunsForCandidate({
                            candidateProfileId,
                            purpose: "candidate_coaching",
                        }),
                    ]);
                    const sourceSession = sessions.find((candidateSession) => (
                        candidateSession.candidatePracticeSessionId === sourceCandidatePracticeSessionId
                    ));
                    if (!sourceSession) return null;
                    return createCandidateCoachUpdateSynthesisInput({
                        sourceSession,
                        sessionEvidence: sessions.map((candidateSession) => ({
                            session: candidateSession,
                            answerAttempts: attempts.filter((attempt) => (
                                attempt.candidatePracticeSessionId === candidateSession.candidatePracticeSessionId
                            )),
                            evaluationRuns: evaluationRuns.filter((run) => attempts.some((attempt) => (
                                attempt.candidatePracticeSessionId === candidateSession.candidatePracticeSessionId
                                && attempt.candidateAnswerAttemptId === run.candidateAnswerAttemptId
                            ))),
                        })),
                    });
                },
                now: new Date(),
            }),
        } : {}),
    };
}

function isExplicitLocalCoachUpdateFixtureMode() {
    return process.env.CANDIDATE_ANSWER_ANALYSIS_PROVIDER?.trim().toLowerCase() === "fixture"
        && process.env[CANDIDATE_HOST_LAUNCH_DEV_MODE_ENV] === "true"
        && Boolean(process.env[CANDIDATE_HOST_LAUNCH_DEV_SECRET_ENV]?.trim());
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
