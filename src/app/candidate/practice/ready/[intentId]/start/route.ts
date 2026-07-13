import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "@/features/candidate-auth-v2/host-launch-route";
import { resolveCandidateDevHostLaunchCookieIdentity } from "@/features/candidate-auth-v2/dev-host-launch-cookie-identity";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import {
    createCandidatePracticeIntentRepository,
} from "@/features/candidate-practice-v2/candidate-practice-intent-repository";
import type {
    CandidatePracticeIntentRecord,
} from "@/features/candidate-practice-v2/candidate-follow-up-practice-intent";
import {
    createCandidateFollowUpSessionInputFromIntent,
} from "@/features/candidate-practice-v2/candidate-follow-up-session-creation";
import {
    createCandidatePracticeSessionRepository,
    type CreateCandidatePracticeSessionInput,
    type CandidatePracticeSessionRecord,
} from "@/features/candidate-session-v2/candidate-practice-session-repository";

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
        markPracticeIntentConsumed: (input: {
            candidatePracticeIntentId: string;
            candidateProfileId: string;
            consumedCandidatePracticeSessionId: string;
        }) => Promise<{
            candidatePracticeIntentId: string;
            lifecycleState: "consumed";
            consumedCandidatePracticeSessionId: string;
        } | null>;
    };
    practiceSessionRepository: {
        listPracticeSessionsForCandidate: (input: {
            candidateProfileId: string;
            limit?: number;
        }) => Promise<CandidatePracticeSessionRecord[]>;
        createSetupSession: (input: CreateCandidatePracticeSessionInput) => Promise<{
            candidatePracticeSessionId: string;
        } | null>;
    };
    createFollowUpSessionInput: typeof createCandidateFollowUpSessionInputFromIntent;
};

type CandidatePracticeIntentStartRouteContext = {
    params: Promise<{ intentId: string }> | { intentId: string };
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
    createFollowUpSessionInput,
}: {
    request: Request;
    intentId: string;
    now: Date;
} & CandidatePracticeIntentStartDependencies) {
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
    if (intent.lifecycleState === "consumed" && intent.consumedCandidatePracticeSessionId) {
        return redirectToSession(request, intent.consumedCandidatePracticeSessionId);
    }
    if (intent.lifecycleState !== "ready") {
        return jsonResponse({
            error: "Practice intent is not ready.",
        }, 409);
    }

    const existingPracticeSessions = await practiceSessionRepository.listPracticeSessionsForCandidate({
        candidateProfileId: identity.candidateProfileId,
        limit: 100,
    });
    const followUpSessionInput = createFollowUpSessionInput({
        candidateProfileId: identity.candidateProfileId,
        intent,
        existingPracticeSessions,
        now,
    });
    if (!followUpSessionInput) {
        return jsonResponse({
            error: "Follow-up practice session could not be created.",
        }, 422);
    }

    const createdSession = await practiceSessionRepository.createSetupSession(followUpSessionInput);
    if (!createdSession) {
        return jsonResponse({
            error: "Follow-up practice session could not be saved.",
        }, 503);
    }

    const consumedIntent = await practiceIntentRepository.markPracticeIntentConsumed({
        candidatePracticeIntentId: intent.candidatePracticeIntentId,
        candidateProfileId: identity.candidateProfileId,
        consumedCandidatePracticeSessionId: createdSession.candidatePracticeSessionId,
    });
    if (!consumedIntent) {
        return jsonResponse({
            error: "Practice intent could not be marked consumed.",
        }, 503);
    }

    return redirectToSession(request, createdSession.candidatePracticeSessionId);
}

function createDefaultCandidatePracticeIntentStartDependencies(): CandidatePracticeIntentStartDependencies {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return {
            resolveCandidatePracticeIntentStartIdentity: async () => null,
            practiceIntentRepository: {
                findPracticeIntent: async () => null,
                markPracticeIntentConsumed: async () => null,
            },
            practiceSessionRepository: {
                listPracticeSessionsForCandidate: async () => [],
                createSetupSession: async () => null,
            },
            createFollowUpSessionInput: createCandidateFollowUpSessionInputFromIntent,
        };
    }

    const queryClient = createLazyPostgresQueryClient(databaseUrl);
    const practiceIntentRepository = createCandidatePracticeIntentRepository(queryClient);
    const practiceSessionRepository = createCandidatePracticeSessionRepository(queryClient);

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
        createFollowUpSessionInput: createCandidateFollowUpSessionInputFromIntent,
    };
}

function redirectToSession(request: Request, candidatePracticeSessionId: string) {
    return Response.redirect(new URL(`/candidate/session/${candidatePracticeSessionId}`, request.url), 303);
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
