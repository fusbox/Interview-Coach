import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "@/features/candidate-auth-v2/host-launch-route";
import { resolveCandidateDevHostLaunchCookieIdentity } from "@/features/candidate-auth-v2/dev-host-launch-cookie-identity";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import {
    createCandidatePracticeIntentRepository,
} from "@/features/candidate-practice-v2/candidate-practice-intent-repository";
import {
    createCandidatePracticeIntentLaunchRepository,
    type CandidatePracticeIntentLaunchResult,
    type StartCandidatePracticeIntentSessionInput,
} from "@/features/candidate-practice-v2/candidate-practice-intent-launch-repository";
import type {
    CandidatePracticeIntentRecord,
} from "@/features/candidate-practice-v2/candidate-follow-up-practice-intent";
import {
    countCandidatePriorPracticeSessionsForIntent,
    createCandidateFollowUpSessionInputFromIntent,
} from "@/features/candidate-practice-v2/candidate-follow-up-session-creation";
import {
    createCandidatePracticeSessionRepository,
    type CandidatePracticeSessionRecord,
} from "@/features/candidate-session-v2/candidate-practice-session-repository";
import {
    createCandidateBaselineAwarePracticeSessions,
    createCandidatePracticePlanBaselineRepository,
    type CandidatePracticePlanBaselineRecord,
} from "@/features/candidate-setup-v2/candidate-practice-plan-baseline-repository";

type CandidatePracticeIntentStartIdentity = {
    candidateProfileId: string;
};

type CandidatePracticeIntentStartDependencies = {
    resolveCandidatePracticeIntentStartIdentity: () => Promise<CandidatePracticeIntentStartIdentity | null>;
    practiceIntentRepository: {
        findPracticeIntent: (input: {
            candidatePracticeIntentId: string;
            candidateProfileId: string;
        }) => Promise<CandidatePracticeIntentRecord | null>;
    };
    practiceSessionRepository: {
        listAllPracticeSessionsForCandidate: (input: {
            candidateProfileId: string;
        }) => Promise<CandidatePracticeSessionRecord[]>;
    };
    practicePlanBaselineRepository?: {
        findForCandidateRoleProfile: (input: {
            candidateProfileId: string;
            roleProfileId: string;
        }) => Promise<CandidatePracticePlanBaselineRecord | null>;
    };
    practiceIntentLaunchRepository: {
        startPracticeIntentSession: (
            input: StartCandidatePracticeIntentSessionInput,
        ) => Promise<CandidatePracticeIntentLaunchResult | null>;
    };
    createFollowUpSessionInput: typeof createCandidateFollowUpSessionInputFromIntent;
};

type CandidatePracticeIntentStartRouteContext = {
    params: Promise<{ intentId: string }>;
};

export async function POST(request: Request, context: CandidatePracticeIntentStartRouteContext) {
    const { intentId } = await context.params;
    return handleCandidatePracticeIntentStartRequest({
        request,
        intentId,
        now: new Date(),
        ...createDefaultCandidatePracticeIntentStartDependencies(),
    });
}

export async function handleCandidatePracticeIntentStartRequest({
    request,
    intentId,
    now,
    resolveCandidatePracticeIntentStartIdentity,
    practiceIntentRepository,
    practiceSessionRepository,
    practicePlanBaselineRepository,
    practiceIntentLaunchRepository,
    createFollowUpSessionInput,
}: {
    request: Request;
    intentId: string;
    now: Date;
} & CandidatePracticeIntentStartDependencies) {
    try {
        const identity = await resolveCandidatePracticeIntentStartIdentity();
        if (!identity) {
            return jsonResponse({
                error: "Candidate identity could not be confirmed.",
            }, 401);
        }

        const intent = await practiceIntentRepository.findPracticeIntent({
            candidatePracticeIntentId: intentId,
            candidateProfileId: identity.candidateProfileId,
        });
        if (!intent) {
            return jsonResponse({
                error: "Practice intent could not be confirmed.",
            }, 404);
        }

        if (intent.lifecycleState === "cancelled" || intent.lifecycleState === "expired") {
            return practiceIntentStateResponse(intent.lifecycleState);
        }

        if (intent.lifecycleState === "consumed" || Date.parse(intent.expiresAt) <= now.getTime()) {
            const launchResult = await practiceIntentLaunchRepository.startPracticeIntentSession({
                candidatePracticeIntentId: intent.candidatePracticeIntentId,
                candidateProfileId: identity.candidateProfileId,
                expectedLaunchVersion: intent.launchVersion,
                expectedPriorSessionCount: 0,
                sessionInput: null,
            });
            return practiceIntentLaunchResponse(request, launchResult);
        }

        for (let attempt = 0; attempt < 2; attempt += 1) {
            const [persistedPracticeSessions, practicePlanBaseline] = await Promise.all([
                practiceSessionRepository.listAllPracticeSessionsForCandidate({
                    candidateProfileId: identity.candidateProfileId,
                }),
                intent.roleProfileId && practicePlanBaselineRepository
                    ? practicePlanBaselineRepository.findForCandidateRoleProfile({
                        candidateProfileId: identity.candidateProfileId,
                        roleProfileId: intent.roleProfileId,
                    })
                    : Promise.resolve(null),
            ]);
            const existingPracticeSessions = createCandidateBaselineAwarePracticeSessions({
                practiceSessions: persistedPracticeSessions,
                baseline: practicePlanBaseline,
            });
            const followUpSessionInput = createFollowUpSessionInput({
                candidateProfileId: identity.candidateProfileId,
                intent,
                existingPracticeSessions,
                now,
            });
            if (!followUpSessionInput) {
                return jsonResponse({
                    error: "Follow-up practice session could not be prepared from this intent.",
                    code: "PRACTICE_INTENT_INVALID_SESSION",
                    retryable: false,
                }, 409);
            }

            const launchResult = await practiceIntentLaunchRepository.startPracticeIntentSession({
                candidatePracticeIntentId: intent.candidatePracticeIntentId,
                candidateProfileId: identity.candidateProfileId,
                expectedLaunchVersion: intent.launchVersion,
                expectedPriorSessionCount: countCandidatePriorPracticeSessionsForIntent(
                    intent,
                    existingPracticeSessions,
                ),
                sessionInput: followUpSessionInput,
            });

            if (launchResult?.outcome === "stale_context" && attempt === 0) {
                continue;
            }

            return practiceIntentLaunchResponse(request, launchResult);
        }

        return jsonResponse({
            error: "Practice context changed while the round was starting. Try again.",
            code: "PRACTICE_INTENT_STALE_CONTEXT",
            retryable: true,
        }, 409);
    } catch {
        return jsonResponse({
            error: "Focused practice could not be started. Try again.",
            code: "PRACTICE_INTENT_START_UNAVAILABLE",
            retryable: true,
        }, 503);
    }
}

function practiceIntentLaunchResponse(
    request: Request,
    result: CandidatePracticeIntentLaunchResult | null,
) {
    if (result?.outcome === "created" || result?.outcome === "replayed") {
        return redirectToSession(request, result.candidatePracticeSessionId);
    }
    if (result?.outcome === "not_found") {
        return jsonResponse({
            error: "Practice intent could not be confirmed.",
            code: "PRACTICE_INTENT_NOT_FOUND",
            retryable: false,
        }, 404);
    }
    if (result?.outcome === "expired" || result?.outcome === "cancelled") {
        return practiceIntentStateResponse(result.outcome);
    }
    if (result?.outcome === "mismatched") {
        return jsonResponse({
            error: "This practice round changed before it could start. Return to your Coach Plan and try again.",
            code: "PRACTICE_INTENT_MISMATCHED",
            retryable: false,
        }, 409);
    }
    if (result?.outcome === "consumed_mismatch") {
        return jsonResponse({
            error: "This practice round could not be safely resumed.",
            code: "PRACTICE_INTENT_CONSUMED_MISMATCH",
            retryable: false,
        }, 409);
    }
    if (result?.outcome === "stale_context") {
        return jsonResponse({
            error: "Practice context changed while the round was starting. Try again.",
            code: "PRACTICE_INTENT_STALE_CONTEXT",
            retryable: true,
        }, 409);
    }

    return jsonResponse({
        error: "Focused practice could not be started. Try again.",
        code: result?.outcome === "invalid_session"
            ? "PRACTICE_INTENT_INVALID_SESSION"
            : "PRACTICE_INTENT_START_UNAVAILABLE",
        retryable: result?.outcome !== "invalid_session",
    }, 503);
}

function practiceIntentStateResponse(state: "cancelled" | "expired") {
    return jsonResponse({
        error: state === "expired"
            ? "This practice-ready link has expired. Return to your Coach Plan to set it up again."
            : "This practice round is no longer available.",
        code: state === "expired" ? "PRACTICE_INTENT_EXPIRED" : "PRACTICE_INTENT_CANCELLED",
        retryable: false,
    }, 409);
}

function createDefaultCandidatePracticeIntentStartDependencies(): CandidatePracticeIntentStartDependencies {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return {
            resolveCandidatePracticeIntentStartIdentity: async () => null,
            practiceIntentRepository: {
                findPracticeIntent: async () => null,
            },
            practiceSessionRepository: {
                listAllPracticeSessionsForCandidate: async () => [],
            },
            practiceIntentLaunchRepository: {
                startPracticeIntentSession: async () => null,
            },
            createFollowUpSessionInput: createCandidateFollowUpSessionInputFromIntent,
        };
    }

    const queryClient = createLazyPostgresQueryClient(databaseUrl);
    const practiceIntentRepository = createCandidatePracticeIntentRepository(queryClient);
    const practiceSessionRepository = createCandidatePracticeSessionRepository(queryClient);
    const practicePlanBaselineRepository = createCandidatePracticePlanBaselineRepository(queryClient);
    const practiceIntentLaunchRepository = createCandidatePracticeIntentLaunchRepository(queryClient);

    return {
        async resolveCandidatePracticeIntentStartIdentity() {
            const { headers } = await import("next/headers");
            const requestHeaders = await headers();
            const candidateProfileId = await resolveCandidateProfileIdFromRequestHeaders(
                requestHeaders.get("cookie"),
                queryClient,
            );

            return candidateProfileId ? { candidateProfileId } : null;
        },
        practiceIntentRepository,
        practiceSessionRepository,
        practicePlanBaselineRepository,
        practiceIntentLaunchRepository,
        createFollowUpSessionInput: createCandidateFollowUpSessionInputFromIntent,
    };
}

function redirectToSession(_request: Request, candidatePracticeSessionId: string) {
    return new Response(null, {
        status: 303,
        headers: {
            Location: `/candidate/session/${encodeURIComponent(candidatePracticeSessionId)}?entry=1`,
        },
    });
}

function jsonResponse(body: unknown, status: number) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "content-type": "application/json",
        },
    });
}

type CandidatePracticeIntentStartQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

function createLazyPostgresQueryClient(databaseUrl: string): CandidatePracticeIntentStartQueryClient {
    let pool: import("pg").Pool | null = null;

    return {
        async query(sql, values) {
            const { Pool } = await import("pg");
            pool ??= new Pool({
                connectionString: databaseUrl,
                ssl: getRuntimeSslConfig(databaseUrl),
                max: 2,
                application_name: "interview-coach-candidate-practice-intent-start",
            });
            return pool.query(sql, values);
        },
    };
}

async function resolveCandidateProfileIdFromRequestHeaders(
    cookieHeader: string | null,
    client: CandidatePracticeIntentStartQueryClient,
) {
    const devIdentity = resolveCandidateDevHostLaunchCookieIdentity(cookieHeader);
    if (devIdentity) {
        return devIdentity.candidateProfileId;
    }

    const candidateLaunchSessionId = readCookieValue(cookieHeader, CANDIDATE_HOST_LAUNCH_SESSION_COOKIE);
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

    return readString(result.rows[0]?.candidate_profile_id);
}

function readCookieValue(cookieHeader: string | null, name: string) {
    if (!cookieHeader) {
        return null;
    }

    const cookie = cookieHeader
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));

    return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
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
