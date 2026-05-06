import { describe, expect, it, vi } from "vitest";
import { submitAnswer, submitInitials, nextQuestion, startSession } from "@/lib/server/session/orchestrator";
import type { AnalysisResult, InterviewSession, Question } from "@/lib/domain/types";
import { startSessionCommand } from "./start-session";
import { getSessionCommand } from "./get-session";
import { updateSessionCommand } from "./update-session";

class InMemorySessionRepository {
    private sessions = new Map<string, InterviewSession>();

    async create(session: InterviewSession): Promise<void> {
        this.sessions.set(session.id, structuredClone(session));
    }

    async get(id: string): Promise<InterviewSession | null> {
        const session = this.sessions.get(id);
        return session ? structuredClone(session) : null;
    }

    async update(session: InterviewSession): Promise<void> {
        this.sessions.set(session.id, structuredClone(session));
    }

    async updatePartial(id: string, updates: Partial<InterviewSession>): Promise<void> {
        const existing = this.sessions.get(id);
        if (!existing) {
            throw new Error(`Missing session ${id}`);
        }

        this.sessions.set(id, structuredClone({
            ...existing,
            ...updates,
        }));
    }

    async deleteAnalysis(sessionId: string, questionId: string): Promise<void> {
        const existing = this.sessions.get(sessionId);
        if (!existing) {
            throw new Error(`Missing session ${sessionId}`);
        }

        const answer = existing.answers[questionId];
        if (!answer) {
            return;
        }

        existing.answers[questionId] = {
            ...answer,
            analysis: undefined,
        };
        this.sessions.set(sessionId, structuredClone(existing));
    }

    async setSummaryExpiry(sessionId: string, expiresAt: number): Promise<void> {
        const existing = this.sessions.get(sessionId);
        if (!existing) {
            throw new Error(`Missing session ${sessionId}`);
        }

        existing.summaryExpiresAt = expiresAt;
        this.sessions.set(sessionId, structuredClone(existing));
    }

    async markViewed(sessionId: string): Promise<void> {
        const existing = this.sessions.get(sessionId);
        if (!existing || existing.viewedAt) {
            return;
        }

        existing.viewedAt = 1111;
        this.sessions.set(sessionId, structuredClone(existing));
    }
}

describe("candidate session lifecycle integration", () => {
    it("moves from start through answer persistence to completion side effects using one shared repository", async () => {
        const repository = new InMemorySessionRepository();
        const questions: Question[] = [
            {
                id: "question-1",
                text: "Tell me about a bug you found.",
                category: "STAR",
                index: 0,
            },
            {
                id: "question-2",
                text: "How do you handle flaky tests?",
                category: "Technical",
                index: 1,
            },
        ];
        const candidateToken = "candidate-token-1";
        const incrementMetricMock = vi.fn();
        const sendDebriefEmailMock = vi.fn().mockResolvedValue({ id: "email-1" });
        const summarizeSessionMock = vi.fn().mockResolvedValue("Candidate summary");

        const startResult = await startSessionCommand(
            new Request("http://localhost/api/session/start", {
                method: "POST",
                body: JSON.stringify({ role: "QA Engineer" }),
            }),
            { role: "QA Engineer" },
            {
                repository,
                requireCandidateToken: async () => ({ ok: true, status: 200 }),
                generateQuestions: async () => questions,
                issueCandidateToken: async () => candidateToken,
            }
        );

        expect(startResult.candidateToken).toBe(candidateToken);
        expect(startResult.session.status).toBe("NOT_STARTED");
        expect(startResult.session.questions).toEqual(questions);

        const viewedSession = await getSessionCommand(startResult.session.id, { repository });
        expect(viewedSession.viewedAt).toBeUndefined();

        const storedAfterView = await repository.get(startResult.session.id);
        expect(storedAfterView?.viewedAt).toBe(1111);

        const startedSession = submitInitials(startSession(storedAfterView!), "PL");
        await repository.update({
            ...startedSession,
            candidate: {
                firstName: "Pat",
                lastName: "Lee",
                email: "pat@example.com",
            },
            candidateName: "Pat Lee",
        });

        let currentSession = await repository.get(startedSession.id);
        expect(currentSession).toEqual(expect.objectContaining({
            status: "IN_SESSION",
            enteredInitials: "PL",
            initialsRequired: false,
            currentQuestionIndex: 0,
            candidate: {
                firstName: "Pat",
                lastName: "Lee",
                email: "pat@example.com",
            },
        }));

        const firstSubmitted = submitAnswer(
            currentSession!,
            "question-1",
            "I isolated the flaky API test and fixed the race condition."
        );
        await repository.deleteAnalysis(firstSubmitted.id, "question-1");
        await repository.update(firstSubmitted);

        currentSession = await repository.get(firstSubmitted.id);
        expect(currentSession).toEqual(expect.objectContaining({
            status: "AWAITING_EVALUATION",
        }));
        expect(currentSession?.answers["question-1"]).toEqual(expect.objectContaining({
            questionId: "question-1",
            transcript: "I isolated the flaky API test and fixed the race condition.",
            submittedAt: expect.any(Number),
        }));

        const secondQuestionSession = nextQuestion(currentSession!);
        await repository.update(secondQuestionSession);

        currentSession = await repository.get(secondQuestionSession.id);
        expect(currentSession).toEqual(expect.objectContaining({
            status: "IN_SESSION",
            currentQuestionIndex: 1,
        }));

        const embeddedAnalysis: AnalysisResult = {
            ack: "Strong structure.",
            meta: {
                tier: 1,
                modality: "text",
            },
        };
        const secondSubmitted = submitAnswer(
            currentSession!,
            "question-2",
            "I reduce flakiness by isolating timing, test data, and network seams.",
            embeddedAnalysis
        );
        await repository.deleteAnalysis(secondSubmitted.id, "question-2");
        await repository.update(secondSubmitted);

        currentSession = await repository.get(secondSubmitted.id);
        expect(currentSession).toEqual(expect.objectContaining({
            status: "REVIEWING",
        }));
        expect(currentSession?.answers["question-2"]).toEqual(expect.objectContaining({
            transcript: "I reduce flakiness by isolating timing, test data, and network seams.",
            analysis: embeddedAnalysis,
        }));

        const completedSession = nextQuestion(currentSession!);
        await repository.update(completedSession);

        const finalized = await updateSessionCommand(completedSession.id, { status: "COMPLETED" }, {
            repository,
            summarizeSession: summarizeSessionMock,
            sendDebriefEmail: sendDebriefEmailMock,
            incrementMetric: incrementMetricMock,
            now: () => 5000,
        });

        expect(finalized).toEqual(expect.objectContaining({
            status: "COMPLETED",
            summaryNarrative: "Candidate summary",
        }));
        expect(summarizeSessionMock).toHaveBeenCalledWith(expect.objectContaining({
            id: completedSession.id,
            status: "COMPLETED",
        }));
        expect(sendDebriefEmailMock).toHaveBeenCalledWith(expect.objectContaining({
            summaryNarrative: "Candidate summary",
        }));
        expect(incrementMetricMock).toHaveBeenCalledWith("session_completion_total", {
            outcome: "success",
        });

        const persisted = await repository.get(completedSession.id);
        expect(persisted).toEqual(expect.objectContaining({
            status: "COMPLETED",
            summaryNarrative: "Candidate summary",
            summaryExpiresAt: 21605000,
            enteredInitials: "PL",
            viewedAt: 1111,
        }));
        expect(Object.keys(persisted?.answers ?? {})).toEqual(["question-1", "question-2"]);
    });

    it("can create a third attempt from a second attempt using the second attempt token", async () => {
        const repository = new InMemorySessionRepository();
        const questions: Question[] = [{
            id: "question-1",
            text: "Tell me about a bug you found.",
            category: "STAR",
            index: 0,
        }];
        const issuedTokens = ["attempt-1-token", "attempt-2-token", "attempt-3-token"];
        const issueCandidateTokenMock = vi.fn(async () => issuedTokens.shift() || "extra-token");

        const attempt1 = await startSessionCommand(
            new Request("http://localhost/api/session/start", { method: "POST" }),
            { role: "QA Engineer" },
            {
                repository,
                requireCandidateToken: async () => ({ ok: true, status: 200 }),
                generateQuestions: async () => questions,
                issueCandidateToken: issueCandidateTokenMock,
            }
        );
        expect(attempt1.session.inviteToken).toBe("attempt-1-token");

        const attempt2 = await startSessionCommand(
            new Request("http://localhost/api/session/start", {
                method: "POST",
                headers: { "x-candidate-token": "attempt-1-token" },
            }),
            { role: "QA Engineer", parentId: attempt1.session.id },
            {
                repository,
                requireCandidateToken: async (_request, sessionId) => ({
                    ok: sessionId === attempt1.session.id,
                    status: 200,
                }),
                generateQuestions: async () => {
                    throw new Error("Repeat attempts should reuse cloned questions.");
                },
                issueCandidateToken: issueCandidateTokenMock,
            }
        );
        expect(attempt2.session).toEqual(expect.objectContaining({
            parentSessionId: attempt1.session.id,
            attemptNumber: 2,
            inviteToken: "attempt-2-token",
        }));

        const persistedAttempt2 = await repository.get(attempt2.session.id);
        expect(persistedAttempt2?.inviteToken).toBe("attempt-2-token");

        const attempt3 = await startSessionCommand(
            new Request("http://localhost/api/session/start", {
                method: "POST",
                headers: { "x-candidate-token": "attempt-2-token" },
            }),
            { role: "QA Engineer", parentId: attempt2.session.id },
            {
                repository,
                requireCandidateToken: async (_request, sessionId) => ({
                    ok: sessionId === attempt2.session.id,
                    status: 200,
                }),
                generateQuestions: async () => {
                    throw new Error("Repeat attempts should reuse cloned questions.");
                },
                issueCandidateToken: issueCandidateTokenMock,
            }
        );

        expect(attempt3.session).toEqual(expect.objectContaining({
            parentSessionId: attempt2.session.id,
            attemptNumber: 3,
            inviteToken: "attempt-3-token",
        }));
    });
});
