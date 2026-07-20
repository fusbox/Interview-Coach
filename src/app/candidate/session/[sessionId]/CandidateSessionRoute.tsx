import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "@/features/candidate-auth-v2/host-launch-route";
import { resolveCandidateDevHostLaunchCookieIdentity } from "@/features/candidate-auth-v2/dev-host-launch-cookie-identity";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import { createCandidateDashboardHref } from "@/features/candidate-dashboard-v2/candidate-dashboard-route";
import { CandidatePlannedSessionExperience } from "@/features/candidate-session-v2/CandidatePlannedSessionExperience";
import type { CandidateProvisionalSessionRecord } from "@/features/candidate-session-v2/candidate-provisional-session-store";
import {
    createCandidatePracticeSessionRepository,
    type CandidatePracticeSessionRecord,
} from "@/features/candidate-session-v2/candidate-practice-session-repository";
import { createCandidateAnswerHistoryRepository } from "@/features/candidate-session-v2/candidate-answer-history-repository";
import type { CandidateAnswerEvaluationRunRecord } from "@/features/candidate-session-v2/candidate-answer-history";
import { createSessionAnswerAnalysisRecoveries } from "@/features/interview-session-v2/session-answer-analysis-recovery";
import { isCandidateAnswerAnalysisRuntimeAvailable } from "@/features/candidate-session-v2/candidate-answer-analysis-runtime-selection";
import {
    createCandidateSessionCompletionLinks,
    createSharedSessionContext,
    parseSessionId,
    resolveSessionCompletionTarget,
} from "@/features/session-v2/session-domain";

type CandidateSessionPageSearchParams = {
    entry?: string | string[];
};

export default async function CandidateSessionPage({
    params,
    searchParams,
}: {
    params: Promise<{ sessionId: string }>;
    searchParams?: Promise<CandidateSessionPageSearchParams>;
}) {
    return renderCandidateSessionPage({
        params,
        searchParams,
        dependencies: createDefaultCandidateSessionPageDependencies(),
    });
}

type CandidateSessionPageDependencies = {
    resolveDurableSession?: (input: {
        sessionId: string;
    }) => Promise<CandidateProvisionalSessionRecord | null>;
};

export async function renderCandidateSessionPage({
    params,
    searchParams,
    dependencies = {},
}: {
    params: Promise<{ sessionId: string }>;
    searchParams?: Promise<CandidateSessionPageSearchParams> | CandidateSessionPageSearchParams;
    dependencies?: CandidateSessionPageDependencies;
}) {
    const { sessionId } = await params;
    const resolvedSearchParams = await searchParams;
    const parsedSessionId = parseSessionId(sessionId);
    const initialSession = dependencies.resolveDurableSession
        ? await dependencies.resolveDurableSession({ sessionId: parsedSessionId })
        : null;
    const sessionContext = createSharedSessionContext({
        sessionId: parsedSessionId,
        audience: "candidate_owned",
        candidateCompletionLinks: createCandidateSessionCompletionLinks(parsedSessionId, {
            dashboardHref: initialSession?.roleProfileId
                ? createCandidateDashboardHref({ roleProfileId: initialSession.roleProfileId })
                : createCandidateDashboardHref(initialSession?.setupSnapshot.targetRole
                    ? { legacyTargetRole: initialSession.setupSnapshot.targetRole }
                    : undefined),
        }),
    });
    const completionTarget = resolveSessionCompletionTarget(sessionContext);

    return (
        <CandidatePlannedSessionExperience
            sessionId={parsedSessionId}
            dashboardHref={completionTarget.href}
            initialSession={initialSession}
            entryTransitionRequested={readSingleSearchParam(resolvedSearchParams?.entry) === "1"}
        />
    );
}

function readSingleSearchParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

function createDefaultCandidateSessionPageDependencies(): CandidateSessionPageDependencies {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return {};
    }

    const queryClient = createLazyPostgresQueryClient(databaseUrl);
    const practiceSessionRepository = createCandidatePracticeSessionRepository(queryClient);
    const answerHistoryRepository = createCandidateAnswerHistoryRepository(queryClient);
    const answerAnalysisRuntimeAvailable = isCandidateAnswerAnalysisRuntimeAvailable(process.env);

    return {
        async resolveDurableSession({ sessionId }) {
            try {
                const { headers } = await import("next/headers");
                const requestHeaders = await headers();
                const candidateLaunchSessionId = readCookieValue(
                    requestHeaders.get("cookie"),
                    CANDIDATE_HOST_LAUNCH_SESSION_COOKIE,
                );
                const devIdentity = resolveCandidateSessionIdentityFromDevLaunchCookie(requestHeaders.get("cookie"));
                if (devIdentity) {
                    const durableSession = await practiceSessionRepository.findSetupSession({
                        candidatePracticeSessionId: sessionId,
                        candidateProfileId: devIdentity.candidateProfileId,
                    });

                    return durableSession ? toCandidateProvisionalSession(durableSession, {
                        evaluationRuns: await answerHistoryRepository.listEvaluationRuns({
                            candidatePracticeSessionId: sessionId,
                            candidateProfileId: devIdentity.candidateProfileId,
                            purpose: "candidate_coaching",
                        }),
                        now: new Date(),
                        runtimeAvailable: answerAnalysisRuntimeAvailable,
                    }) : null;
                }

                if (!candidateLaunchSessionId) {
                    return null;
                }

                const identity = await resolveCandidateProfileIdFromLaunchSession(
                    queryClient,
                    candidateLaunchSessionId,
                );
                if (!identity) {
                    return null;
                }

                const durableSession = await practiceSessionRepository.findSetupSession({
                    candidatePracticeSessionId: sessionId,
                    candidateProfileId: identity.candidateProfileId,
                });

                return durableSession ? toCandidateProvisionalSession(durableSession, {
                    evaluationRuns: await answerHistoryRepository.listEvaluationRuns({
                        candidatePracticeSessionId: sessionId,
                        candidateProfileId: identity.candidateProfileId,
                        purpose: "candidate_coaching",
                    }),
                    now: new Date(),
                    runtimeAvailable: answerAnalysisRuntimeAvailable,
                }) : null;
            } catch {
                return null;
            }
        },
    };
}

export function resolveCandidateSessionIdentityFromDevLaunchCookie(cookieHeader: string | null) {
    return resolveCandidateDevHostLaunchCookieIdentity(cookieHeader);
}

type CandidateSessionQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

function createLazyPostgresQueryClient(databaseUrl: string): CandidateSessionQueryClient {
    let pool: import("pg").Pool | null = null;

    return {
        async query(sql, values) {
            const { Pool } = await import("pg");
            pool ??= new Pool({
                connectionString: databaseUrl,
                ssl: getRuntimeSslConfig(databaseUrl),
                max: 2,
                application_name: "interview-coach-candidate-session-recovery",
            });
            return pool.query(sql, values);
        },
    };
}

async function resolveCandidateProfileIdFromLaunchSession(
    client: CandidateSessionQueryClient,
    candidateLaunchSessionId: string,
) {
    const result = await client.query(`
        select candidate_profile_id
        from public.candidate_launch_sessions
        where candidate_launch_session_id = $1
          and revoked_at is null
          and expires_at > now()
        limit 1
    `, [candidateLaunchSessionId]);
    const candidateProfileId = readString(result.rows[0]?.candidate_profile_id);

    return candidateProfileId
        ? { candidateProfileId }
        : null;
}

export function toCandidateProvisionalSession(
    durableSession: CandidatePracticeSessionRecord,
    recoveryInput?: {
        evaluationRuns: CandidateAnswerEvaluationRunRecord[];
        now: Date;
        runtimeAvailable?: boolean;
    },
): CandidateProvisionalSessionRecord {
    return {
        status: "session_created",
        sessionId: durableSession.candidatePracticeSessionId,
        nextRoute: `/candidate/session/${encodeURIComponent(durableSession.candidatePracticeSessionId)}`,
        roleProfileId: durableSession.roleProfileId,
        setupSnapshot: durableSession.setupSnapshot,
        questionPlanSnapshot: durableSession.questionPlanSnapshot,
        ...(durableSession.questionWordingSnapshot
            ? { questionWordingSnapshot: durableSession.questionWordingSnapshot }
            : {}),
        progress: durableSession.progress,
        answerDrafts: durableSession.answerDrafts,
        answerSubmissions: durableSession.answerSubmissions,
        answerAnalysisSnapshots: durableSession.answerAnalysisSnapshots,
        ...(recoveryInput ? {
            answerAnalysisRecoveries: createSessionAnswerAnalysisRecoveries({
                session: durableSession,
                ...recoveryInput,
            }),
        } : {}),
        feedbackActionEvents: durableSession.feedbackActionEvents,
    };
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
