import { randomUUID } from "crypto";

import { createCandidateSetupSessionTransition } from "@/features/candidate-setup-v2/candidate-setup-session-creation";
import { safeParseCandidateSetupInput } from "@/features/candidate-setup-v2/candidate-setup-contract";
import type { CandidateProvisionalSessionProgress } from "@/features/candidate-session-v2/candidate-provisional-session-store";
import {
    createCandidatePracticeSessionRepository,
    type CreateCandidatePracticeSessionInput,
} from "@/features/candidate-session-v2/candidate-practice-session-repository";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "@/features/candidate-auth-v2/host-launch-route";
import { isCandidateDevHostLaunchEnabled } from "@/features/candidate-auth-v2/dev-host-launch";
import { resolveCandidateDevHostLaunchCookieIdentity } from "@/features/candidate-auth-v2/dev-host-launch-cookie-identity";
import {
    createCandidateSetupPrepContextRepository,
    type CandidateSetupPrepContextResolver,
} from "@/features/candidate-setup-v2/candidate-setup-prep-context-repository";

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
    allowManualPrepContextCreation?: boolean;
    allowBrowserBridgeFallback?: boolean;
};

type CandidateSetupStartPracticeSessionRepository = {
    createSetupSession: (input: CreateCandidatePracticeSessionInput) => Promise<{
        candidatePracticeSessionId: string;
    } | null>;
};

export type CandidateSetupStartDependencies = {
    now: Date;
    createSessionId: () => string;
    allowBrowserBridgeWithoutIdentity?: boolean;
    resolveCandidateSetupIdentity?: (request: Request) => Promise<CandidateSetupIdentity | null>;
    prepContextResolver?: CandidateSetupPrepContextResolver;
    practiceSessionRepository?: CandidateSetupStartPracticeSessionRepository;
};

export async function handleCandidateSetupStartRequest({
    request,
    now,
    createSessionId,
    allowBrowserBridgeWithoutIdentity = false,
    resolveCandidateSetupIdentity,
    prepContextResolver,
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

    const parsedSetup = safeParseCandidateSetupInput(body);
    if (!parsedSetup.success) {
        return Response.json({
            error: "Invalid setup request.",
            fieldErrors: parsedSetup.error.flatten().fieldErrors,
        }, { status: 400 });
    }

    const prepContextDecision = readPrepContextDecision(body);
    if (prepContextDecision === "invalid") {
        return Response.json({ error: "Invalid preparation-context choice." }, { status: 400 });
    }

    const result = createCandidateSetupSessionTransition({
        payload: parsedSetup.data,
        now,
        createSessionId,
    });

    try {
        const identity = resolveCandidateSetupIdentity
            ? await resolveCandidateSetupIdentity(request)
            : null;

        if (identity && practiceSessionRepository) {
            if (!prepContextResolver) {
                return Response.json({
                    error: "Candidate preparation context could not be resolved.",
                }, { status: 503 });
            }

            const prepContext = await prepContextResolver.resolveSetupPrepContext({
                candidateProfileId: identity.candidateProfileId,
                requestedRoleProfileId: identity.roleProfileId ?? null,
                createSeparateFromRoleProfileId: prepContextDecision?.matchingRoleProfileId ?? null,
                allowManualCreation: identity.allowManualPrepContextCreation === true,
                setupSnapshot: result.setupSnapshot,
            });
            if (!prepContext) {
                return Response.json({
                    error: "Candidate preparation context could not be resolved.",
                }, { status: 503 });
            }

            if (prepContext.status === "existing_paths") {
                return Response.json({
                    status: "existing_prep_context_found",
                    existingPrepContexts: prepContext.existingPrepContexts,
                }, { status: 409 });
            }

            if (prepContext.status === "decision_invalid") {
                return Response.json({
                    error: "That existing practice path is no longer available. Review the current choices and try again.",
                }, { status: 409 });
            }

            const progress: CandidateProvisionalSessionProgress = {
                status: "planned",
                currentQuestionIndex: 0,
            };
            const durableSession = await practiceSessionRepository.createSetupSession({
                candidateProfileId: identity.candidateProfileId,
                roleProfileId: prepContext.roleProfileId,
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

        if (identity && !identity.allowBrowserBridgeFallback) {
            return Response.json({
                error: "Candidate practice session could not be saved.",
            }, { status: 503 });
        }

        if (!identity && !allowBrowserBridgeWithoutIdentity) {
            return Response.json({
                error: "Candidate access could not be verified.",
            }, { status: 401 });
        }

        return Response.json(result, { status: 201 });
    } catch {
        return Response.json({ error: "Candidate setup could not be started." }, { status: 503 });
    }
}

function createDefaultCandidateSetupStartDependencies(): Pick<
    CandidateSetupStartDependencies,
    "allowBrowserBridgeWithoutIdentity" | "resolveCandidateSetupIdentity" | "prepContextResolver" | "practiceSessionRepository"
> {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    const allowBrowserBridgeWithoutIdentity = process.env.NODE_ENV !== "production";
    if (!databaseUrl) {
        return isCandidateDevHostLaunchEnabled()
            ? {
                allowBrowserBridgeWithoutIdentity,
                resolveCandidateSetupIdentity: resolveCandidateSetupIdentityFromDevLaunchCookie,
            }
            : { allowBrowserBridgeWithoutIdentity };
    }

    const queryClient = createLazyPostgresQueryClient(databaseUrl);

    return {
        allowBrowserBridgeWithoutIdentity,
        resolveCandidateSetupIdentity: async (request) => {
            const devIdentity = await resolveCandidateSetupIdentityFromDevLaunchCookie(request);
            return devIdentity ?? resolveCandidateSetupIdentityFromLaunchCookie(request, queryClient);
        },
        prepContextResolver: createCandidateSetupPrepContextRepository(queryClient),
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
            allowManualPrepContextCreation: false,
            allowBrowserBridgeFallback: false,
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

function readPrepContextDecision(body: unknown): {
    action: "create_separate_path";
    matchingRoleProfileId: string;
} | null | "invalid" {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return null;
    }

    const rawDecision = (body as Record<string, unknown>).prepContextDecision;
    if (rawDecision == null) {
        return null;
    }
    if (!rawDecision || typeof rawDecision !== "object" || Array.isArray(rawDecision)) {
        return "invalid";
    }

    const decision = rawDecision as Record<string, unknown>;
    const matchingRoleProfileId = readString(decision.matchingRoleProfileId);
    if (decision.action !== "create_separate_path" || !matchingRoleProfileId) {
        return "invalid";
    }

    return {
        action: "create_separate_path",
        matchingRoleProfileId,
    };
}

export async function resolveCandidateSetupIdentityFromDevLaunchCookie(request: Request): Promise<CandidateSetupIdentity | null> {
    const identity = resolveCandidateDevHostLaunchCookieIdentity(request.headers.get("Cookie"));

    return identity
        ? {
            candidateProfileId: identity.candidateProfileId,
            candidateLaunchSessionId: null,
            allowManualPrepContextCreation: true,
            allowBrowserBridgeFallback: true,
        }
        : null;
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
