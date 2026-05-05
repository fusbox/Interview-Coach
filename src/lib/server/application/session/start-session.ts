import { z } from "zod";
import { InitSessionSchema } from "@/lib/domain/schemas";
import { addQuestions, cloneSession, createSession } from "@/lib/server/session/orchestrator";
import { QuestionService } from "@/lib/server/services/question-service";
import type { InterviewSession, Question } from "@/lib/domain/types";
import { SessionStartAccessError, SessionStartNotFoundError } from "./errors";

type StartSessionInput = z.infer<typeof InitSessionSchema>;

type CandidateAuthResult = {
    ok: boolean;
    status: 200 | 401 | 403;
    error?: string;
};

type SessionRepository = {
    get(id: string): Promise<InterviewSession | null>;
    create(session: InterviewSession): Promise<void>;
};

type StartSessionDependencies = {
    repository: SessionRepository;
    requireCandidateToken: (request: Request, sessionId: string) => Promise<CandidateAuthResult>;
    generateQuestions: (role: string) => Promise<Question[]>;
    issueCandidateToken: (sessionId: string) => Promise<string>;
};

export async function startSessionCommand(
    request: Request,
    input: StartSessionInput,
    dependencies?: Partial<StartSessionDependencies>
) {
    const repository = dependencies?.repository ?? await (await import("@/lib/server/infrastructure/session-repository")).createSessionRepository();
    const requireCandidateToken = dependencies?.requireCandidateToken ?? (await import("@/lib/server/auth/candidate-token")).requireCandidateToken;
    const generateQuestions = dependencies?.generateQuestions ?? QuestionService.generateQuestions;
    const issueCandidateToken = dependencies?.issueCandidateToken ?? (await import("@/lib/server/auth/candidate-token")).issueCandidateToken;

    let session: InterviewSession;

    if (input.parentId) {
        const parentAuth = await requireCandidateToken(request, input.parentId);
        if (!parentAuth.ok) {
            const status = parentAuth.status === 403 ? 403 : 401;
            throw new SessionStartAccessError(parentAuth.error || "Unauthorized", status);
        }

        const parentSession = await repository.get(input.parentId);
        if (!parentSession) {
            throw new SessionStartNotFoundError("Parent session not found");
        }

        session = cloneSession(parentSession);
    } else {
        session = createSession(input);
        const questions = await generateQuestions(session.role || "General");
        session = addQuestions(session, questions);
    }

    await repository.create(session);
    const candidateToken = await issueCandidateToken(session.id);

    return { session, candidateToken };
}
