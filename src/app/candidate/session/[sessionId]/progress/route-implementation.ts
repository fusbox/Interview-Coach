import { resolveCandidateOwnedRequestIdentity } from "@/features/candidate-auth-v2/candidate-route-authorization";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import type { CandidateProvisionalSessionProgress } from "@/features/candidate-session-v2/candidate-provisional-session-store";
import { createCandidatePracticeSessionRepository } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import {
    isSessionAnswerMode,
    isSessionRuntimeProgressStatus,
} from "@/features/interview-session-v2/session-runtime-contract";

type CandidateSessionIdentity = {
    candidateProfileId: string;
};

type CandidateSessionProgressRepository = {
    saveProgress: (input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
        progress: CandidateProvisionalSessionProgress;
    }) => Promise<CandidateProvisionalSessionProgress | null>;
};

export type CandidateSessionProgressRouteDependencies = {
    resolveCandidateSessionIdentity?: (request: Request) => Promise<CandidateSessionIdentity | null>;
    practiceSessionRepository?: CandidateSessionProgressRepository;
};

export async function PUT(
    request: Request,
    context: { params: Promise<{ sessionId: string }> },
) {
    const { sessionId } = await context.params;
    return handleCandidateSessionProgressRequest({
        request,
        sessionId,
        ...createDefaultCandidateSessionProgressDependencies(),
    });
}

export async function handleCandidateSessionProgressRequest({
    request,
    sessionId,
    resolveCandidateSessionIdentity,
    practiceSessionRepository,
}: CandidateSessionProgressRouteDependencies & {
    request: Request;
    sessionId: string;
}) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid session progress request." }, { status: 400 });
    }

    const progress = parseProgressBody(body);
    if (!progress) {
        return Response.json({ error: "Invalid session progress request." }, { status: 400 });
    }

    const identity = resolveCandidateSessionIdentity
        ? await resolveCandidateSessionIdentity(request)
        : null;
    if (!identity || !practiceSessionRepository) {
        return Response.json({ error: "Candidate session identity is required." }, { status: 401 });
    }

    const savedProgress = await practiceSessionRepository.saveProgress({
        candidatePracticeSessionId: sessionId,
        candidateProfileId: identity.candidateProfileId,
        progress,
    });

    if (!savedProgress) {
        return Response.json({ error: "Candidate session progress could not be saved." }, { status: 404 });
    }

    return Response.json({
        status: "progress_saved",
        progress: savedProgress,
    });
}

function createDefaultCandidateSessionProgressDependencies(): Pick<
    CandidateSessionProgressRouteDependencies,
    "resolveCandidateSessionIdentity" | "practiceSessionRepository"
> {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return {};
    }

    const queryClient = createLazyPostgresQueryClient(databaseUrl);

    return {
        resolveCandidateSessionIdentity: (request) =>
            resolveCandidateOwnedRequestIdentity(request, queryClient),
        practiceSessionRepository: createCandidatePracticeSessionRepository(queryClient),
    };
}

type CandidateSessionProgressQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

function createLazyPostgresQueryClient(databaseUrl: string): CandidateSessionProgressQueryClient {
    let pool: import("pg").Pool | null = null;

    return {
        async query(sql, values) {
            const { Pool } = await import("pg");
            pool ??= new Pool({
                connectionString: databaseUrl,
                ssl: getRuntimeSslConfig(databaseUrl),
                max: 2,
                application_name: "interview-coach-candidate-session-progress",
            });
            return pool.query(sql, values);
        },
    };
}

function parseProgressBody(value: unknown): CandidateProvisionalSessionProgress | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const body = value as Record<string, unknown>;
    if (!isSessionRuntimeProgressStatus(body.status)) {
        return null;
    }

    const currentQuestionIndex = body.currentQuestionIndex;
    if (
        typeof currentQuestionIndex !== "number"
        || !Number.isInteger(currentQuestionIndex)
        || currentQuestionIndex < 0
        || (body.answerMode !== undefined && !isSessionAnswerMode(body.answerMode))
    ) {
        return null;
    }

    return {
        status: body.status,
        currentQuestionIndex,
        ...(isSessionAnswerMode(body.answerMode) ? { answerMode: body.answerMode } : {}),
    };
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
