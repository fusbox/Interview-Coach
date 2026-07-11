import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "@/features/candidate-auth-v2/host-launch-route";
import { resolveCandidateDevHostLaunchCookieIdentity } from "@/features/candidate-auth-v2/dev-host-launch-cookie-identity";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import {
    completeCandidateAnswerIdempotencyRecord,
    createCandidateAnswerDraftChange,
    createCandidateAnswerIdempotencyPendingRecord,
    createCandidateAnswerSubmission,
    createCandidateAnswerSubmitIdempotencyContract,
    createCandidateAnswerSubmitRequest,
    resolveCandidateAnswerIdempotencyDecision,
    type CandidateAnswerIdempotencyRecord,
    type CandidateAnswerIdempotencyRecords,
    type CandidateAnswerSubmission,
    type CandidateAnswerSubmissions,
} from "@/features/candidate-session-v2/candidate-answer-lifecycle";
import { createCandidatePracticeSessionRepository } from "@/features/candidate-session-v2/candidate-practice-session-repository";

type CandidateSessionIdentity = {
    candidateProfileId: string;
};

type CandidateAnswerSubmitSession = {
    answerIdempotencyRecords?: CandidateAnswerIdempotencyRecords;
};

type CandidateAnswerSubmitRepository = {
    findSetupSession: (input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
    }) => Promise<CandidateAnswerSubmitSession | null>;
    saveAnswerSubmission: (input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
        answerSubmission: CandidateAnswerSubmission;
    }) => Promise<CandidateAnswerSubmissions | null>;
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

export type CandidateAnswerSubmitRouteDependencies = {
    now: Date;
    resolveCandidateSessionIdentity?: (request: Request) => Promise<CandidateSessionIdentity | null>;
    practiceSessionRepository?: CandidateAnswerSubmitRepository;
};

export async function POST(
    request: Request,
    context: { params: Promise<{ sessionId: string }> },
) {
    const { sessionId } = await context.params;
    return handleCandidateAnswerSubmitRequest({
        request,
        sessionId,
        now: new Date(),
        ...createDefaultCandidateAnswerSubmitDependencies(),
    });
}

export async function handleCandidateAnswerSubmitRequest({
    request,
    sessionId,
    now,
    resolveCandidateSessionIdentity,
    practiceSessionRepository,
}: CandidateAnswerSubmitRouteDependencies & {
    request: Request;
    sessionId: string;
}) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid answer submit request." }, { status: 400 });
    }

    const parsedBody = parseAnswerSubmitBody(body);
    if (!parsedBody) {
        return Response.json({ error: "Invalid answer submit request." }, { status: 400 });
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

    const draftChange = createCandidateAnswerDraftChange({
        ...parsedBody,
        now,
    });
    const submitRequest = createCandidateAnswerSubmitRequest({
        draft: draftChange.draft,
        requestedAt: now,
    });
    const idempotencyContract = createCandidateAnswerSubmitIdempotencyContract({
        candidatePracticeSessionId: sessionId,
        candidateProfileId: identity.candidateProfileId,
        request: submitRequest,
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
            error: "An identical answer submit request is already in progress.",
            retryable: true,
        }, { status: idempotencyContract.replay.pendingHttpStatus });
    }

    if (idempotencyDecision.kind === "conflict") {
        return Response.json({
            code: "IDEMPOTENCY_MISMATCH",
            error: "Idempotency key cannot be reused with a different answer submit payload.",
            retryable: false,
        }, { status: idempotencyContract.replay.conflictHttpStatus });
    }

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

    const answerSubmission = createCandidateAnswerSubmission({
        request: submitRequest,
    });
    const answerSubmissions = await practiceSessionRepository.saveAnswerSubmission({
        candidatePracticeSessionId: sessionId,
        candidateProfileId: identity.candidateProfileId,
        answerSubmission,
    });

    if (!answerSubmissions) {
        if (practiceSessionRepository.clearAnswerIdempotencyRecord) {
            await practiceSessionRepository.clearAnswerIdempotencyRecord({
                candidatePracticeSessionId: sessionId,
                candidateProfileId: identity.candidateProfileId,
                recordKey: idempotencyDecision.record.recordKey,
            });
        }
        return Response.json({ error: "Candidate answer submission could not be saved." }, { status: 404 });
    }

    const responseBody = {
        status: "answer_submit_saved",
        answerSubmissions,
        request: submitRequest,
        next: "analysis_not_connected",
    };

    if (practiceSessionRepository.saveAnswerIdempotencyRecord) {
        await practiceSessionRepository.saveAnswerIdempotencyRecord({
            candidatePracticeSessionId: sessionId,
            candidateProfileId: identity.candidateProfileId,
            record: completeCandidateAnswerIdempotencyRecord({
                record: idempotencyDecision.record,
                completedAt: now,
                statusCode: 202,
                body: responseBody,
            }),
        });
    }

    return Response.json(responseBody, { status: 202 });
}

function createDefaultCandidateAnswerSubmitDependencies(): Pick<
    CandidateAnswerSubmitRouteDependencies,
    "resolveCandidateSessionIdentity" | "practiceSessionRepository"
> {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return {};
    }

    const queryClient = createLazyPostgresQueryClient(databaseUrl);

    return {
        resolveCandidateSessionIdentity: async (request) => {
            const devIdentity = resolveCandidateAnswerSubmitIdentityFromDevLaunchCookie(request.headers.get("Cookie"));
            return devIdentity ?? resolveCandidateSessionIdentityFromLaunchCookie(request, queryClient);
        },
        practiceSessionRepository: createCandidatePracticeSessionRepository(queryClient),
    };
}

type CandidateAnswerSubmitQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

function createLazyPostgresQueryClient(databaseUrl: string): CandidateAnswerSubmitQueryClient {
    let pool: import("pg").Pool | null = null;

    return {
        async query(sql, values) {
            const { Pool } = await import("pg");
            pool ??= new Pool({
                connectionString: databaseUrl,
                ssl: getRuntimeSslConfig(databaseUrl),
                max: 2,
                application_name: "interview-coach-candidate-answer-submit",
            });
            return pool.query(sql, values);
        },
    };
}

async function resolveCandidateSessionIdentityFromLaunchCookie(
    request: Request,
    client: CandidateAnswerSubmitQueryClient,
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

export function resolveCandidateAnswerSubmitIdentityFromDevLaunchCookie(cookieHeader: string | null) {
    return resolveCandidateDevHostLaunchCookieIdentity(cookieHeader);
}

function parseAnswerSubmitBody(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const body = value as Record<string, unknown>;
    const slotId = readString(body.slotId);
    if (
        !slotId
        || body.mode !== "text"
        || typeof body.text !== "string"
        || !body.text.trim()
        || typeof body.questionIndex !== "number"
        || !Number.isInteger(body.questionIndex)
        || body.questionIndex < 0
    ) {
        return null;
    }

    return {
        slotId,
        questionIndex: body.questionIndex,
        mode: "text" as const,
        text: body.text,
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
