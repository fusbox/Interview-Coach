import { randomUUID } from "crypto";

import { createCandidateSetupSessionTransition } from "@/features/candidate-setup-v2/candidate-setup-session-creation";
import type { CandidateProvisionalSessionProgress } from "@/features/candidate-session-v2/candidate-provisional-session-store";
import {
    createCandidatePracticeSessionRepository,
    type CreateCandidatePracticeSessionInput,
} from "@/features/candidate-session-v2/candidate-practice-session-repository";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "@/features/candidate-auth-v2/host-launch-route";

export async function POST(request: Request) {
    return handleCandidateSetupStartRequest({
        request,
        now: new Date(),
        createSessionId: () => randomUUID(),
        ...createDefaultCandidateSetupStartDependencies(),
    });
}

type CandidateSetupIdentity = {
    candidateProfileId: string;
    roleProfileId?: string | null;
    candidateLaunchSessionId?: string | null;
};

type CandidateSetupStartPracticeSessionRepository = {
    createSetupSession: (input: CreateCandidatePracticeSessionInput) => Promise<{
        candidatePracticeSessionId: string;
    } | null>;
};

export type CandidateSetupStartDependencies = {
    now: Date;
    createSessionId: () => string;
    resolveCandidateSetupIdentity?: (request: Request) => Promise<CandidateSetupIdentity | null>;
    practiceSessionRepository?: CandidateSetupStartPracticeSessionRepository;
};

export async function handleCandidateSetupStartRequest({
    request,
    now,
    createSessionId,
    resolveCandidateSetupIdentity,
    practiceSessionRepository,
}: CandidateSetupStartDependencies & {
    request: Request;
}) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid setup request." }, { status: 400 });
    }

    try {
        const result = createCandidateSetupSessionTransition({
            payload: body,
            now,
            createSessionId,
        });
        const identity = resolveCandidateSetupIdentity
            ? await resolveCandidateSetupIdentity(request)
            : null;

        if (identity && practiceSessionRepository) {
            const progress: CandidateProvisionalSessionProgress = {
                status: "planned",
                currentQuestionIndex: 0,
            };
            const durableSession = await practiceSessionRepository.createSetupSession({
                candidateProfileId: identity.candidateProfileId,
                roleProfileId: identity.roleProfileId ?? null,
                candidateLaunchSessionId: identity.candidateLaunchSessionId ?? null,
                setupSnapshot: result.setupSnapshot,
                questionPlanSnapshot: result.questionPlanSnapshot,
                questionWordingSnapshot: result.questionWordingSnapshot,
                progress,
            });

            if (durableSession) {
                return Response.json({
                    ...result,
                    sessionId: durableSession.candidatePracticeSessionId,
                    nextRoute: `/candidate/session/${encodeURIComponent(durableSession.candidatePracticeSessionId)}`,
                }, { status: 201 });
            }

            return Response.json({
                error: "Candidate practice session could not be saved.",
            }, { status: 503 });
        }

        return Response.json(result, { status: 201 });
    } catch {
        return Response.json({ error: "Invalid setup request." }, { status: 400 });
    }
}

function createDefaultCandidateSetupStartDependencies(): Pick<
    CandidateSetupStartDependencies,
    "resolveCandidateSetupIdentity" | "practiceSessionRepository"
> {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return {};
    }

    const queryClient = createLazyPostgresQueryClient(databaseUrl);

    return {
        resolveCandidateSetupIdentity: (request) => resolveCandidateSetupIdentityFromLaunchCookie(request, queryClient),
        practiceSessionRepository: createCandidatePracticeSessionRepository(queryClient),
    };
}

type CandidateSetupStartQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

function createLazyPostgresQueryClient(databaseUrl: string): CandidateSetupStartQueryClient {
    let pool: import("pg").Pool | null = null;

    return {
        async query(sql, values) {
            const { Pool } = await import("pg");
            pool ??= new Pool({
                connectionString: databaseUrl,
                ssl: getRuntimeSslConfig(databaseUrl),
                max: 2,
                application_name: "interview-coach-candidate-setup-start",
            });
            return pool.query(sql, values);
        },
    };
}

async function resolveCandidateSetupIdentityFromLaunchCookie(
    request: Request,
    client: CandidateSetupStartQueryClient,
): Promise<CandidateSetupIdentity | null> {
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

    return candidateProfileId
        ? {
            candidateProfileId,
            candidateLaunchSessionId,
        }
        : null;
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
