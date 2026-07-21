import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "@/features/candidate-auth-v2/host-launch-route";
import { resolveCandidateDevHostLaunchCookieIdentity } from "@/features/candidate-auth-v2/dev-host-launch-cookie-identity";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import {
    createCandidatePracticeSessionRepository,
    type CandidatePracticeSessionRecord,
} from "@/features/candidate-session-v2/candidate-practice-session-repository";
import {
    createSessionQuestionAudioRuntimeFromEnvironment,
    SessionQuestionAudioRuntimeError,
} from "@/features/interview-session-v2/session-question-audio-runtime";

const MAX_REQUEST_BYTES = 1_024;
const MAX_QUESTION_KEY_LENGTH = 128;

type SessionQuestionAudioIdentity = { ownerId: string };
type SessionQuestionAudioSession = Pick<CandidatePracticeSessionRecord, "questionWordingSnapshot">;

export type SessionQuestionAudioRouteDependencies = {
    resolveSessionIdentity?: (request: Request) => Promise<SessionQuestionAudioIdentity | null>;
    sessionRepository?: {
        findSetupSession: (input: {
            candidatePracticeSessionId: string;
            candidateProfileId: string;
        }) => Promise<SessionQuestionAudioSession | null>;
    };
    audioRuntime?: {
        generateQuestionAudio: (questionText: string) => Promise<{
            audioData: Buffer;
            mimeType: "audio/wav" | "audio/mpeg";
            cacheIdentity: string;
            cacheOutcome: "hit" | "joined" | "miss";
            provider: string;
            profileId: string;
        }>;
    } | null;
    recordDiagnostic?: (event: SessionQuestionAudioDiagnostic) => void;
};

export type SessionQuestionAudioDiagnostic = {
    event: "session_question_audio";
    outcome: "accepted" | "denied" | "unavailable";
    statusCode: number;
    failureClass?: string;
    provider?: string;
    profileId?: string;
    cacheOutcome?: "hit" | "joined" | "miss";
    audioBytes?: number;
    durationMs: number;
};

export async function handleSessionQuestionAudioRequest(input: {
    request: Request;
    sessionId: string;
} & SessionQuestionAudioRouteDependencies) {
    const startedAt = Date.now();
    const diagnostic = input.recordDiagnostic ?? recordDefaultDiagnostic;
    const declaredLength = Number(input.request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
        return finishJson(400, "Invalid question audio request.", "request_too_large");
    }

    let rawBody: string;
    try {
        rawBody = await input.request.text();
    } catch {
        return finishJson(400, "Invalid question audio request.", "request_unreadable");
    }
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
        return finishJson(400, "Invalid question audio request.", "request_too_large");
    }

    const questionKey = parseQuestionKey(rawBody);
    if (!questionKey) return finishJson(400, "Invalid question audio request.", "request_invalid");

    const identity = input.resolveSessionIdentity
        ? await input.resolveSessionIdentity(input.request)
        : null;
    if (!identity || !input.sessionRepository) {
        return finishJson(401, "Practice access is required.", "identity_missing");
    }

    let session: SessionQuestionAudioSession | null;
    try {
        session = await input.sessionRepository.findSetupSession({
            candidatePracticeSessionId: input.sessionId,
            candidateProfileId: identity.ownerId,
        });
    } catch {
        return finishJson(503, "Question audio is unavailable.", "session_lookup_failed");
    }
    const question = session?.questionWordingSnapshot?.questions.find((item) => item.slotId === questionKey);
    if (!question) return finishJson(404, "Question audio was not found.", "owned_question_not_found");

    if (!input.audioRuntime) {
        return finishJson(503, "Question audio is unavailable.", "provider_not_configured");
    }

    try {
        const result = await input.audioRuntime.generateQuestionAudio(question.questionText);
        const response = new Response(new Uint8Array(result.audioData), {
            status: 200,
            headers: {
                "Cache-Control": "private, max-age=86400",
                "Content-Length": String(result.audioData.length),
                "Content-Type": result.mimeType,
                ETag: `"${result.cacheIdentity}"`,
                "X-Content-Type-Options": "nosniff",
            },
        });
        diagnostic({
            event: "session_question_audio",
            outcome: "accepted",
            statusCode: 200,
            provider: result.provider,
            profileId: result.profileId,
            cacheOutcome: result.cacheOutcome,
            audioBytes: result.audioData.length,
            durationMs: Date.now() - startedAt,
        });
        return response;
    } catch (error) {
        return finishJson(
            503,
            "Question audio is unavailable.",
            error instanceof SessionQuestionAudioRuntimeError ? error.failureClass : "provider_failed",
        );
    }

    function finishJson(statusCode: number, message: string, failureClass: string) {
        diagnostic({
            event: "session_question_audio",
            outcome: statusCode === 503 ? "unavailable" : "denied",
            statusCode,
            failureClass,
            durationMs: Date.now() - startedAt,
        });
        return Response.json({ error: message }, {
            status: statusCode,
            headers: { "Cache-Control": "no-store" },
        });
    }
}

export function createDefaultCandidateQuestionAudioDependencies(): SessionQuestionAudioRouteDependencies {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) return { audioRuntime: null };
    const queryClient = createLazyPostgresQueryClient(databaseUrl);
    let audioRuntime: SessionQuestionAudioRouteDependencies["audioRuntime"] = null;
    try {
        audioRuntime = createSessionQuestionAudioRuntimeFromEnvironment({ env: process.env });
    } catch {
        audioRuntime = null;
    }

    return {
        resolveSessionIdentity: async (request) => {
            const devIdentity = resolveCandidateDevHostLaunchCookieIdentity(request.headers.get("cookie"));
            if (devIdentity) return { ownerId: devIdentity.candidateProfileId };
            const launchSessionId = readCookieValue(
                request.headers.get("cookie"),
                CANDIDATE_HOST_LAUNCH_SESSION_COOKIE,
            );
            if (!launchSessionId) return null;
            const result = await queryClient.query(`
                select candidate_profile_id
                from public.candidate_launch_sessions
                where candidate_launch_session_id = $1
                  and revoked_at is null
                  and expires_at > now()
                limit 1
            `, [launchSessionId]);
            const ownerId = readString(result.rows[0]?.candidate_profile_id);
            return ownerId ? { ownerId } : null;
        },
        sessionRepository: createCandidatePracticeSessionRepository(queryClient),
        audioRuntime,
    };
}

function parseQuestionKey(rawBody: string) {
    let body: unknown;
    try {
        body = JSON.parse(rawBody);
    } catch {
        return null;
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const record = body as Record<string, unknown>;
    if (Object.keys(record).length !== 1 || !("questionKey" in record)) return null;
    const questionKey = readString(record.questionKey);
    return questionKey && questionKey.length <= MAX_QUESTION_KEY_LENGTH ? questionKey : null;
}

function createLazyPostgresQueryClient(databaseUrl: string) {
    let pool: import("pg").Pool | null = null;
    return {
        async query(sql: string, values: unknown[]) {
            const { Pool } = await import("pg");
            pool ??= new Pool({
                connectionString: databaseUrl,
                ssl: getRuntimeSslConfig(databaseUrl),
                max: 2,
                application_name: "interview-coach-question-audio",
            });
            return pool.query(sql, values);
        },
    };
}

function readCookieValue(cookieHeader: string | null, name: string) {
    const cookie = cookieHeader?.split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));
    if (!cookie) return null;
    try {
        return decodeURIComponent(cookie.slice(name.length + 1));
    } catch {
        return null;
    }
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getRuntimeSslConfig(databaseUrl: string) {
    try {
        const sslMode = new URL(databaseUrl).searchParams.get("sslmode")?.toLowerCase();
        if (sslMode === "disable") return false;
        if (sslMode) return { rejectUnauthorized: sslMode === "verify-ca" || sslMode === "verify-full" };
    } catch {
        return undefined;
    }
    return undefined;
}

function recordDefaultDiagnostic(event: SessionQuestionAudioDiagnostic) {
    console.info("session_question_audio", event);
}
