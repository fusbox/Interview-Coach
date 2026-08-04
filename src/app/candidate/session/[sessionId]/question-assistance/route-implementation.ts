import { randomUUID } from "node:crypto";

import { resolveCandidateOwnedRequestIdentity } from "@/features/candidate-auth-v2/candidate-route-authorization";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import {
    createCandidatePracticeSessionRepository,
    type CandidatePracticeSessionRecord,
} from "@/features/candidate-session-v2/candidate-practice-session-repository";
import {
    CANDIDATE_QUESTION_ASSISTANCE_KINDS,
    type CandidateQuestionAssistanceKind,
} from "@/features/candidate-session-v2/candidate-question-assistance";
import {
    CANDIDATE_QUESTION_ASSISTANCE_GENERATION_REVISION,
    createCandidateQuestionAssistanceRepository,
} from "@/features/candidate-session-v2/candidate-question-assistance-repository";
import {
    CandidateQuestionAssistanceRuntimeError,
    createCandidateQuestionAssistanceRuntimeFromEnvironment,
    type CandidateQuestionAssistanceRuntime,
} from "@/features/candidate-session-v2/candidate-question-assistance-runtime";

const MAX_REQUEST_BYTES = 1_024;
const MAX_QUESTION_KEY_LENGTH = 128;
const CLAIM_LEASE_MS = 30_000;

type QuestionAssistanceIdentity = { ownerId: string };
type QuestionAssistanceSession = Pick<
    CandidatePracticeSessionRecord,
    "setupSnapshot" | "questionWordingSnapshot"
>;

export type QuestionAssistanceRouteDependencies = {
    resolveSessionIdentity?: (request: Request) => Promise<QuestionAssistanceIdentity | null>;
    sessionRepository?: {
        findSetupSession: (input: {
            candidatePracticeSessionId: string;
            candidateProfileId: string;
        }) => Promise<QuestionAssistanceSession | null>;
    };
    assistanceRepository?: ReturnType<typeof createCandidateQuestionAssistanceRepository>;
    assistanceRuntime?: CandidateQuestionAssistanceRuntime | null;
    createClaimToken?: () => string;
    recordDiagnostic?: (event: QuestionAssistanceDiagnostic) => void;
};

export type QuestionAssistanceDiagnostic = {
    event: "candidate_question_assistance";
    assistanceKind?: CandidateQuestionAssistanceKind;
    outcome: "accepted" | "replayed" | "pending" | "denied" | "unavailable";
    statusCode: number;
    failureClass?: string;
    provider?: string;
    profileId?: string;
    responseLength?: number;
    providerFinishReason?: string;
    durationMs: number;
};

export async function handleQuestionAssistanceRequest(input: {
    request: Request;
    sessionId: string;
} & QuestionAssistanceRouteDependencies) {
    const startedAt = Date.now();
    const diagnostic = input.recordDiagnostic ?? recordDefaultDiagnostic;
    const requestBody = await readRequestBody(input.request);
    if (!requestBody) {
        return finish(400, { error: "Invalid question assistance request." }, "denied", "request_invalid");
    }

    const identity = input.resolveSessionIdentity
        ? await input.resolveSessionIdentity(input.request)
        : null;
    if (
        !identity
        || !input.sessionRepository
        || !input.assistanceRepository
    ) {
        return finish(401, { error: "Practice access is required." }, "denied", "identity_missing");
    }
    if (!input.assistanceRuntime) {
        return finish(
            503,
            { error: "Question assistance is unavailable.", retryable: false },
            "unavailable",
            "provider_not_configured",
        );
    }

    let session: QuestionAssistanceSession | null;
    try {
        session = await input.sessionRepository.findSetupSession({
            candidatePracticeSessionId: input.sessionId,
            candidateProfileId: identity.ownerId,
        });
    } catch {
        return finish(503, { error: "Question assistance is unavailable." }, "unavailable", "session_lookup_failed");
    }
    const question = session?.questionWordingSnapshot?.questions.find(
        (item) => item.slotId === requestBody.questionKey,
    );
    if (!session || !question) {
        return finish(404, { error: "Question assistance was not found." }, "denied", "owned_question_not_found");
    }

    const runtimeRequest = {
        assistanceKind: requestBody.assistanceKind,
        questionKey: question.slotId,
        questionText: question.questionText,
        category: question.category,
        targetRole: session.setupSnapshot.targetRole,
        jobDescription: session.setupSnapshot.jobDescription,
        resumeText: session.setupSnapshot.resumeText,
    };
    const requestFingerprint = input.assistanceRuntime.createRequestFingerprint(runtimeRequest);
    const claimToken = input.createClaimToken?.() ?? randomUUID();
    let claim;
    try {
        claim = await input.assistanceRepository.claim({
            practiceSessionId: input.sessionId,
            ownerId: identity.ownerId,
            questionKey: question.slotId,
            assistanceKind: requestBody.assistanceKind,
            requestFingerprint,
            claimToken,
            claimLeaseMs: CLAIM_LEASE_MS,
            generationRevision: CANDIDATE_QUESTION_ASSISTANCE_GENERATION_REVISION,
        });
    } catch {
        return finish(503, { error: "Question assistance is unavailable." }, "unavailable", "claim_failed");
    }
    if (claim.kind === "conflict") {
        return finish(409, { error: "Question assistance context changed." }, "denied", "fingerprint_conflict");
    }
    if (claim.kind === "pending") {
        return finish(202, {
            status: "loading",
            assistanceKind: requestBody.assistanceKind,
        }, "pending");
    }
    if (claim.kind === "exhausted") {
        return finish(503, {
            error: "Question assistance is unavailable.",
            retryable: false,
        }, "unavailable", "attempts_exhausted");
    }
    if (claim.kind === "replay") {
        return finish(200, {
            status: "ready",
            assistanceKind: requestBody.assistanceKind,
            output: claim.output,
        }, "replayed");
    }

    try {
        const result = await input.assistanceRuntime.generate(runtimeRequest);
        if (result.requestFingerprint !== requestFingerprint) {
            throw new CandidateQuestionAssistanceRuntimeError("fingerprint_mismatch", false);
        }
        const completed = await input.assistanceRepository.complete({
            practiceSessionId: input.sessionId,
            ownerId: identity.ownerId,
            questionKey: question.slotId,
            assistanceKind: requestBody.assistanceKind,
            claimToken,
            output: result.output,
            provider: result.provider,
            profileId: result.profileId,
            promptVersion: result.promptVersion,
            configurationFingerprint: result.configurationFingerprint,
        });
        if (!completed) {
            return finish(409, { error: "Question assistance request expired." }, "denied", "claim_expired");
        }
        return finish(200, {
            status: "ready",
            assistanceKind: requestBody.assistanceKind,
            output: result.output,
        }, "accepted", undefined, result.provider, result.profileId);
    } catch (error) {
        const failureClass = error instanceof CandidateQuestionAssistanceRuntimeError
            ? error.code
            : "provider_failed";
        try {
            await input.assistanceRepository.fail({
                practiceSessionId: input.sessionId,
                ownerId: identity.ownerId,
                questionKey: question.slotId,
                assistanceKind: requestBody.assistanceKind,
                claimToken,
                errorCode: failureClass,
            });
        } catch {
            // Preserve the safe provider failure response even if diagnostic persistence fails.
        }
        return finish(503, {
            error: "Question assistance is unavailable.",
            retryable: error instanceof CandidateQuestionAssistanceRuntimeError
                ? error.retryable
                : true,
        }, "unavailable", failureClass, undefined, undefined,
        error instanceof CandidateQuestionAssistanceRuntimeError
            ? error.diagnostics
            : undefined);
    }

    function finish(
        statusCode: number,
        body: Record<string, unknown>,
        outcome: QuestionAssistanceDiagnostic["outcome"],
        failureClass?: string,
        provider?: string,
        profileId?: string,
        runtimeDiagnostics?: CandidateQuestionAssistanceRuntimeError["diagnostics"],
    ) {
        diagnostic({
            event: "candidate_question_assistance",
            assistanceKind: requestBody?.assistanceKind,
            outcome,
            statusCode,
            ...(failureClass ? { failureClass } : {}),
            ...(provider ? { provider } : {}),
            ...(profileId ? { profileId } : {}),
            ...(runtimeDiagnostics ? {
                responseLength: runtimeDiagnostics.responseLength,
                ...(runtimeDiagnostics.finishReason
                    ? { providerFinishReason: runtimeDiagnostics.finishReason }
                    : {}),
            } : {}),
            durationMs: Date.now() - startedAt,
        });
        return Response.json(body, {
            status: statusCode,
            headers: {
                "Cache-Control": "no-store",
                ...(statusCode === 202 ? { "Retry-After": "1" } : {}),
            },
        });
    }
}

export function createDefaultQuestionAssistanceDependencies():
QuestionAssistanceRouteDependencies {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return { assistanceRuntime: null };
    }
    const queryClient = createLazyPostgresQueryClient(databaseUrl);
    let assistanceRuntime: CandidateQuestionAssistanceRuntime | null = null;
    try {
        assistanceRuntime = createCandidateQuestionAssistanceRuntimeFromEnvironment({
            env: process.env,
        });
    } catch {
        assistanceRuntime = null;
    }
    return {
        resolveSessionIdentity: async (request) => {
            const identity = await resolveCandidateOwnedRequestIdentity(request, queryClient);
            return identity ? { ownerId: identity.candidateProfileId } : null;
        },
        sessionRepository: createCandidatePracticeSessionRepository(queryClient),
        assistanceRepository: createCandidateQuestionAssistanceRepository(queryClient),
        assistanceRuntime,
    };
}

async function readRequestBody(request: Request) {
    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
        return null;
    }
    let rawBody: string;
    try {
        rawBody = await request.text();
    } catch {
        return null;
    }
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
        return null;
    }
    let value: unknown;
    try {
        value = JSON.parse(rawBody);
    } catch {
        return null;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const record = value as Record<string, unknown>;
    if (
        Object.keys(record).sort().join("|") !== "assistanceKind|questionKey"
        || typeof record.questionKey !== "string"
        || !record.questionKey.trim()
        || record.questionKey.length > MAX_QUESTION_KEY_LENGTH
        || !CANDIDATE_QUESTION_ASSISTANCE_KINDS.includes(
            record.assistanceKind as CandidateQuestionAssistanceKind,
        )
    ) {
        return null;
    }
    return {
        questionKey: record.questionKey.trim(),
        assistanceKind: record.assistanceKind as CandidateQuestionAssistanceKind,
    };
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
                application_name: "interview-coach-question-assistance",
            });
            return pool.query(sql, values);
        },
    };
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

function recordDefaultDiagnostic(event: QuestionAssistanceDiagnostic) {
    console.info("candidate_question_assistance", event);
}
