import { resolveCandidateOwnedRequestIdentity } from "@/features/candidate-auth-v2/candidate-route-authorization";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import {
    createCandidateAnswerDraftChange,
    type CandidateAnswerDraft,
    type CandidateAnswerDrafts,
} from "@/features/candidate-session-v2/candidate-answer-lifecycle";
import { createCandidatePracticeSessionRepository } from "@/features/candidate-session-v2/candidate-practice-session-repository";

type CandidateSessionIdentity = {
    candidateProfileId: string;
};

type CandidateAnswerDraftRepository = {
    saveAnswerDraft: (input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
        draft: CandidateAnswerDraft;
    }) => Promise<CandidateAnswerDrafts | null>;
};

export type CandidateAnswerDraftRouteDependencies = {
    now: Date;
    resolveCandidateSessionIdentity?: (request: Request) => Promise<CandidateSessionIdentity | null>;
    practiceSessionRepository?: CandidateAnswerDraftRepository;
};

export async function PUT(
    request: Request,
    context: { params: Promise<{ sessionId: string }> },
) {
    const { sessionId } = await context.params;
    return handleCandidateAnswerDraftRequest({
        request,
        sessionId,
        now: new Date(),
        ...createDefaultCandidateAnswerDraftDependencies(),
    });
}

export async function handleCandidateAnswerDraftRequest({
    request,
    sessionId,
    now,
    resolveCandidateSessionIdentity,
    practiceSessionRepository,
}: CandidateAnswerDraftRouteDependencies & {
    request: Request;
    sessionId: string;
}) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid answer draft request." }, { status: 400 });
    }

    const parsedBody = parseAnswerDraftBody(body);
    if (!parsedBody) {
        return Response.json({ error: "Invalid answer draft request." }, { status: 400 });
    }

    const identity = resolveCandidateSessionIdentity
        ? await resolveCandidateSessionIdentity(request)
        : null;
    if (!identity || !practiceSessionRepository) {
        return Response.json({ error: "Candidate session identity is required." }, { status: 401 });
    }

    const draftChange = createCandidateAnswerDraftChange({
        ...parsedBody,
        now,
    });
    const answerDrafts = await practiceSessionRepository.saveAnswerDraft({
        candidatePracticeSessionId: sessionId,
        candidateProfileId: identity.candidateProfileId,
        draft: draftChange.draft,
    });

    if (!answerDrafts) {
        return Response.json({ error: "Candidate answer draft could not be saved." }, { status: 404 });
    }

    return Response.json({
        status: "answer_draft_saved",
        answerDrafts,
    });
}

function createDefaultCandidateAnswerDraftDependencies(): Pick<
    CandidateAnswerDraftRouteDependencies,
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

type CandidateAnswerDraftQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

function createLazyPostgresQueryClient(databaseUrl: string): CandidateAnswerDraftQueryClient {
    let pool: import("pg").Pool | null = null;

    return {
        async query(sql, values) {
            const { Pool } = await import("pg");
            pool ??= new Pool({
                connectionString: databaseUrl,
                ssl: getRuntimeSslConfig(databaseUrl),
                max: 2,
                application_name: "interview-coach-candidate-answer-draft",
            });
            return pool.query(sql, values);
        },
    };
}

function parseAnswerDraftBody(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const body = value as Record<string, unknown>;
    const slotId = readString(body.slotId);
    if (
        !slotId
        || body.mode !== "text"
        || typeof body.text !== "string"
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
