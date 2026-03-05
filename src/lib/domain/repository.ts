import { InterviewSession, SessionSummary } from "./types";

export interface SessionRepository {
    create(session: InterviewSession): Promise<void>;
    get(id: string): Promise<InterviewSession | null>;
    listByRecruiter(recruiterId: string): Promise<SessionSummary[]>;
    update(session: InterviewSession): Promise<void>;
    saveDraft(sessionId: string, questionId: string, draftText: string): Promise<void>;
    updatePartial(id: string, updates: Partial<InterviewSession>): Promise<void>;
    delete(id: string): Promise<void>;
    deleteAnalysis(sessionId: string, questionId: string): Promise<void>;
}
