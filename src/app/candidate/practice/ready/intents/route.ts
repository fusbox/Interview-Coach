import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "@/features/candidate-auth-v2/host-launch-route";
import { resolveCandidateDevHostLaunchCookieIdentity } from "@/features/candidate-auth-v2/dev-host-launch-cookie-identity";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import {
    createCandidatePracticeIntentRepository,
} from "@/features/candidate-practice-v2/candidate-practice-intent-repository";
import {
    createCandidateDirectPracticeIntentFromResolvedItems,
    type CandidatePracticeIntentCreationResult,
} from "@/features/candidate-practice-v2/candidate-practice-intent-creation";
import {
    CANDIDATE_DIRECT_PRACTICE_INTENT_IDEMPOTENCY_HEADER,
    hashCandidateDirectPracticeIntentIdempotencyKey,
    normalizeCandidateDirectPracticeIntentIdempotencyKey,
} from "@/features/candidate-practice-v2/candidate-direct-practice-intent-request";
import {
    isCandidatePracticeIntentSource,
    parseCandidateFollowUpPracticeIntent,
    resolveCandidateFollowUpPracticeIntent,
    type CandidatePracticeIntentSource,
} from "@/features/candidate-practice-v2/candidate-follow-up-practice-intent";
import {
    createCandidatePracticeSessionRepository,
} from "@/features/candidate-session-v2/candidate-practice-session-repository";

type CandidatePracticeIntentPointer = {
    intent: string;
    fromSession: string;
    questionKey: string;
};

type CandidateDirectPracticeIntentSource = Exclude<CandidatePracticeIntentSource, "practice_builder">;

type CandidatePracticeIntentCreateIdentity = {
    candidateProfileId: string;
};

type CandidatePracticeIntentCreateDependencies = {
    resolveCandidatePracticeIntentIdentity: () => Promise<CandidatePracticeIntentCreateIdentity | null>;
    createPracticeIntentFromPointers: (input: {
        candidateProfileId: string;
        source: CandidateDirectPracticeIntentSource;
        pointers: CandidatePracticeIntentPointer[];
        idempotencyKeyHash: string;
    }) => Promise<CandidatePracticeIntentCreationResult>;
};

export async function POST(request: Request) {
    return handleCandidatePracticeIntentCreateRequest({
        request,
        ...createDefaultCandidatePracticeIntentCreateDependencies(),
    });
}

export async function handleCandidatePracticeIntentCreateRequest({
    request,
    resolveCandidatePracticeIntentIdentity,
    createPracticeIntentFromPointers,
}: {
    request: Request;
} & CandidatePracticeIntentCreateDependencies) {
    const payload = await readJson(request);
    const parsedPayload = parsePracticeIntentCreatePayload(payload);
    const idempotencyKey = normalizeCandidateDirectPracticeIntentIdempotencyKey(
        request.headers.get(CANDIDATE_DIRECT_PRACTICE_INTENT_IDEMPOTENCY_HEADER),
    );
    if (!parsedPayload || !idempotencyKey) {
        return jsonResponse({
            error: "Invalid practice intent request.",
        }, 400);
    }

    const identity = await resolveCandidatePracticeIntentIdentity();
    if (!identity) {
        return jsonResponse({
            error: "Candidate identity could not be confirmed.",
        }, 401);
    }

    let result: CandidatePracticeIntentCreationResult;
    try {
        result = await createPracticeIntentFromPointers({
            candidateProfileId: identity.candidateProfileId,
            source: parsedPayload.source,
            pointers: parsedPayload.pointers,
            idempotencyKeyHash: hashCandidateDirectPracticeIntentIdempotencyKey(idempotencyKey),
        });
    } catch {
        return jsonResponse({
            error: "Practice intent could not be created.",
            reason: "persistence_failed",
        }, 503);
    }

    if (result.status !== "candidate_practice_intent_created") {
        const status = result.reason === "idempotency_conflict"
            ? 409
            : result.reason === "persistence_failed"
                ? 503
                : 422;
        return jsonResponse({
            error: "Practice intent could not be created.",
            reason: result.reason,
        }, status);
    }

    return jsonResponse(result, result.requestDisposition === "replayed" ? 200 : 201);
}

function createDefaultCandidatePracticeIntentCreateDependencies(): CandidatePracticeIntentCreateDependencies {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return {
            resolveCandidatePracticeIntentIdentity: async () => null,
            createPracticeIntentFromPointers: async () => ({
                status: "candidate_practice_intent_not_created",
                reason: "persistence_failed",
            }),
        };
    }

    const queryClient = createLazyPostgresQueryClient(databaseUrl);
    const practiceSessionRepository = createCandidatePracticeSessionRepository(queryClient);
    const practiceIntentRepository = createCandidatePracticeIntentRepository(queryClient);

    return {
        async resolveCandidatePracticeIntentIdentity() {
            const { headers } = await import("next/headers");
            const requestHeaders = await headers();
            const candidateProfileId = await resolveCandidateProfileIdFromRequestHeaders(
                requestHeaders.get("cookie"),
                queryClient,
            );

            return candidateProfileId ? { candidateProfileId } : null;
        },
        async createPracticeIntentFromPointers({ candidateProfileId, source, pointers, idempotencyKeyHash }) {
            const practiceSessions = await loadCandidatePracticeIntentSourceSessions({
                candidateProfileId,
                pointers,
                findSetupSession: practiceSessionRepository.findSetupSession,
            });
            const resolvedItems = pointers
                .map((pointer) => parseCandidateFollowUpPracticeIntent({
                    intent: pointer.intent,
                    fromSession: pointer.fromSession,
                    questionKey: pointer.questionKey,
                }))
                .map((intent) => resolveCandidateFollowUpPracticeIntent({
                    intent,
                    candidateProfileId,
                    practiceSessions,
                }));

            if (resolvedItems.some((item) => !item)) {
                return {
                    status: "candidate_practice_intent_not_created",
                    reason: "invalid_intent_items",
                };
            }

            return createCandidateDirectPracticeIntentFromResolvedItems({
                candidateProfileId,
                source,
                resolvedItems: resolvedItems.filter((item): item is NonNullable<typeof item> => Boolean(item)),
                idempotencyKeyHash,
                practiceIntentRepository,
            });
        },
    };
}

export async function loadCandidatePracticeIntentSourceSessions({
    candidateProfileId,
    pointers,
    findSetupSession,
}: {
    candidateProfileId: string;
    pointers: CandidatePracticeIntentPointer[];
    findSetupSession: ReturnType<typeof createCandidatePracticeSessionRepository>["findSetupSession"];
}) {
    const sourceSessionIds = Array.from(new Set(pointers.map((pointer) => pointer.fromSession)));
    const sessions = await Promise.all(sourceSessionIds.map((candidatePracticeSessionId) => (
        findSetupSession({ candidateProfileId, candidatePracticeSessionId })
    )));
    return sessions.filter((session): session is NonNullable<typeof session> => Boolean(session));
}

function parsePracticeIntentCreatePayload(payload: unknown): {
    source: CandidateDirectPracticeIntentSource;
    pointers: CandidatePracticeIntentPointer[];
} | null {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return null;
    }

    const body = payload as Record<string, unknown>;
    const source = body.source;
    if (!isCandidatePracticeIntentSource(source) || source === "practice_builder") {
        return null;
    }

    const items = body.items;
    if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
        return null;
    }

    const pointers = items.map(readPointer).filter((pointer): pointer is CandidatePracticeIntentPointer => Boolean(pointer));
    return pointers.length === items.length ? { source, pointers } : null;
}

function readPointer(value: unknown): CandidatePracticeIntentPointer | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const item = value as Record<string, unknown>;
    const intent = readStableString(item.intent);
    const fromSession = readStableString(item.fromSession);
    const questionKey = readStableString(item.questionKey);
    if (!intent || !fromSession || !questionKey) {
        return null;
    }

    const parsedIntent = parseCandidateFollowUpPracticeIntent({
        intent,
        fromSession,
        questionKey,
    });
    return parsedIntent ? { intent, fromSession, questionKey } : null;
}

async function readJson(request: Request) {
    try {
        return await request.json();
    } catch {
        return null;
    }
}

function jsonResponse(body: unknown, status: number) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "content-type": "application/json",
        },
    });
}

function readStableString(value: unknown) {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed && trimmed.length <= 120 && /^[A-Za-z0-9._:-]+$/.test(trimmed) ? trimmed : null;
}

type CandidatePracticeIntentReadyQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

function createLazyPostgresQueryClient(databaseUrl: string): CandidatePracticeIntentReadyQueryClient {
    let pool: import("pg").Pool | null = null;

    return {
        async query(sql, values) {
            const { Pool } = await import("pg");
            pool ??= new Pool({
                connectionString: databaseUrl,
                ssl: getRuntimeSslConfig(databaseUrl),
                max: 2,
                application_name: "interview-coach-candidate-practice-intent-create",
            });
            return pool.query(sql, values);
        },
    };
}

async function resolveCandidateProfileIdFromRequestHeaders(
    cookieHeader: string | null,
    client: CandidatePracticeIntentReadyQueryClient,
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
