import { resolveCandidateOwnedRequestIdentity } from "@/features/candidate-auth-v2/candidate-route-authorization";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import {
    isCandidatePracticeIntentLaunchable,
    type CandidatePracticeIntentRecord,
} from "@/features/candidate-practice-v2/candidate-follow-up-practice-intent";
import { createCandidatePracticeIntentRepository } from "@/features/candidate-practice-v2/candidate-practice-intent-repository";
import {
    createSessionQuestionAudioRuntimeFromEnvironment,
    SessionQuestionAudioRuntimeError,
} from "@/features/interview-session-v2/session-question-audio-runtime";

const MAX_REQUEST_BYTES = 1_024;
const MAX_QUESTION_KEY_LENGTH = 128;

type PracticeIntentQuestionAudioIdentity = { candidateProfileId: string };

export type CandidatePracticeIntentQuestionAudioDependencies = {
    resolveIdentity?: (request: Request) => Promise<PracticeIntentQuestionAudioIdentity | null>;
    intentRepository?: {
        findPracticeIntent: (input: {
            candidatePracticeIntentId: string;
            candidateProfileId: string;
        }) => Promise<CandidatePracticeIntentRecord | null>;
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
    now?: () => Date;
    recordDiagnostic?: (event: CandidatePracticeIntentQuestionAudioDiagnostic) => void;
};

export type CandidatePracticeIntentQuestionAudioDiagnostic = {
    event: "session_question_audio";
    boundary: "practice_intent";
    outcome: "accepted" | "denied" | "unavailable";
    statusCode: number;
    failureClass?: string;
    provider?: string;
    profileId?: string;
    cacheOutcome?: "hit" | "joined" | "miss";
    audioBytes?: number;
    durationMs: number;
};

export async function handleCandidatePracticeIntentQuestionAudioRequest(input: {
    request: Request;
    intentId: string;
} & CandidatePracticeIntentQuestionAudioDependencies) {
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

    const identity = input.resolveIdentity ? await input.resolveIdentity(input.request) : null;
    if (!identity || !input.intentRepository) {
        return finishJson(401, "Practice access is required.", "identity_missing");
    }

    let intent: CandidatePracticeIntentRecord | null;
    try {
        intent = await input.intentRepository.findPracticeIntent({
            candidatePracticeIntentId: input.intentId,
            candidateProfileId: identity.candidateProfileId,
        });
    } catch {
        return finishJson(503, "Question audio is unavailable.", "intent_lookup_failed");
    }
    if (!intent || !isCandidatePracticeIntentLaunchable(intent, (input.now ?? (() => new Date()))())) {
        return finishJson(404, "Question audio was not found.", "owned_intent_not_found");
    }

    const question = intent.items.find((item) => item.source.questionKey === questionKey);
    if (!question) return finishJson(404, "Question audio was not found.", "owned_question_not_found");
    if (!input.audioRuntime) {
        return finishJson(503, "Question audio is unavailable.", "provider_not_configured");
    }

    try {
        const result = await input.audioRuntime.generateQuestionAudio(question.source.questionText);
        diagnostic({
            event: "session_question_audio",
            boundary: "practice_intent",
            outcome: "accepted",
            statusCode: 200,
            provider: result.provider,
            profileId: result.profileId,
            cacheOutcome: result.cacheOutcome,
            audioBytes: result.audioData.length,
            durationMs: Date.now() - startedAt,
        });
        return new Response(new Uint8Array(result.audioData), {
            status: 200,
            headers: {
                "Cache-Control": "private, max-age=86400",
                "Content-Length": String(result.audioData.length),
                "Content-Type": result.mimeType,
                ETag: `"${result.cacheIdentity}"`,
                "X-Content-Type-Options": "nosniff",
            },
        });
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
            boundary: "practice_intent",
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

export function createDefaultCandidatePracticeIntentQuestionAudioDependencies(): CandidatePracticeIntentQuestionAudioDependencies {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) return { audioRuntime: null };
    const queryClient = createLazyPostgresQueryClient(databaseUrl);
    let audioRuntime: CandidatePracticeIntentQuestionAudioDependencies["audioRuntime"] = null;
    try {
        audioRuntime = createSessionQuestionAudioRuntimeFromEnvironment({ env: process.env });
    } catch {
        audioRuntime = null;
    }

    return {
        resolveIdentity: async (request) => {
            const identity = await resolveCandidateOwnedRequestIdentity(request, queryClient);
            return identity ? { candidateProfileId: identity.candidateProfileId } : null;
        },
        intentRepository: createCandidatePracticeIntentRepository(queryClient),
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
                application_name: "interview-coach-practice-intent-audio",
            });
            return pool.query(sql, values);
        },
    };
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

function recordDefaultDiagnostic(event: CandidatePracticeIntentQuestionAudioDiagnostic) {
    console.info("session_question_audio", event);
}
