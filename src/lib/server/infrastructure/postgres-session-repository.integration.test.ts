import { randomUUID } from "crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { InterviewSession } from "@/lib/domain/types";

const databaseUrl = process.env.POSTGRES_SESSION_REPOSITORY_TEST_DATABASE_URL;
const runIntegration = databaseUrl ? describe : describe.skip;

function makeAnalysis() {
    return {
        ack: "Good start.",
        meta: { tier: 1 as const, modality: "text" as const },
        contentPulse: {
            dimension: "focus_relevance" as const,
            headline: "Clear role link",
            body: "The response connects the work to the target role."
        }
    };
}

runIntegration("PostgresSessionRepository integration", () => {
    let pool: Pool;
    let recruiterId: string;
    let sessionId: string;
    let questionId: string;

    beforeAll(async () => {
        if (!databaseUrl) {
            return;
        }

        process.env.DATABASE_URL = databaseUrl;
        recruiterId = randomUUID();
        sessionId = randomUUID();
        questionId = randomUUID();
        pool = new Pool({ connectionString: databaseUrl });

        await pool.query(
            `
                insert into public.app_users (
                    user_id,
                    email,
                    display_name
                )
                values ($1, $2, 'Session Repo Recruiter')
            `,
            [recruiterId, `session-repo-${recruiterId}@example.com`]
        );
    });

    afterAll(async () => {
        if (!pool) {
            return;
        }

        await pool.query("delete from public.app_users where user_id = $1", [recruiterId]);
        await pool.end();

        const { closePostgresPoolForTests } = await import("../db/postgres");
        await closePostgresPoolForTests();
    });

    it("creates, reads, updates, lists, and deletes a session graph", async () => {
        const { PostgresSessionRepository } = await import("./postgres-session-repository");
        const repository = new PostgresSessionRepository();
        const baseSession: InterviewSession = {
            id: sessionId,
            recruiterId,
            role: "Security Engineer",
            jobDescription: "Protect systems.",
            status: "AWAITING_EVALUATION",
            questions: [{
                id: questionId,
                text: "Tell me about a security incident.",
                category: "Behavioral",
                index: 0
            }],
            currentQuestionIndex: 0,
            answers: {
                [questionId]: {
                    questionId,
                    transcript: "I contained a phishing incident.",
                    draft: "draft",
                    submittedAt: Date.now(),
                    analysis: makeAnalysis()
                }
            },
            initialsRequired: false,
            candidate: {
                firstName: "Sam",
                lastName: "Secure",
                email: "sam.secure@example.com",
                resumeText: "Security resume"
            },
            enteredInitials: "SS",
            engagedTimeSeconds: 10,
            attemptNumber: 1,
            clientName: "Rangam"
        };

        await repository.create(baseSession);
        let stored = await repository.get(sessionId);

        expect(stored).toMatchObject({
            id: sessionId,
            recruiterId,
            status: "AWAITING_EVALUATION",
            role: "Security Engineer",
            enteredInitials: "SS",
            engagedTimeSeconds: 10,
            candidate: {
                firstName: "Sam",
                lastName: "Secure",
                email: "sam.secure@example.com",
                resumeText: "Security resume"
            }
        });
        expect(stored?.questions).toEqual([
            expect.objectContaining({
                id: questionId,
                text: "Tell me about a security incident.",
                category: "Behavioral",
                index: 0
            })
        ]);
        expect(stored?.answers[questionId]).toEqual(expect.objectContaining({
            transcript: "I contained a phishing incident.",
            draft: "draft",
            analysis: expect.objectContaining({
                ack: "Good start."
            })
        }));

        await repository.saveDraft(sessionId, questionId, "revised draft");
        await repository.updatePartial(sessionId, {
            status: "IN_SESSION",
            engagedTimeSeconds: 8,
            engagedTimeDelta: 5
        });
        await repository.markViewed(sessionId);
        await repository.markInvitationSent(sessionId);

        stored = await repository.get(sessionId);
        expect(stored).toMatchObject({
            status: "IN_SESSION",
            engagedTimeSeconds: 15
        });
        expect(stored?.viewedAt).toEqual(expect.any(Number));
        expect(stored?.answers[questionId]?.draft).toBe("revised draft");

        const summaries = await repository.listByRecruiter(recruiterId);
        expect(summaries).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: sessionId,
                candidateName: "Sam Secure",
                questionCount: 1,
                answerCount: 1,
                submittedCount: 1,
                invitationSentAt: expect.any(Number)
            })
        ]));

        await repository.deleteAnalysis(sessionId, questionId);
        stored = await repository.get(sessionId);
        expect(stored?.answers[questionId]?.analysis).toBeUndefined();

        await repository.setSummaryExpiry(sessionId, Date.now() - 1);
        await repository.update({
            ...baseSession,
            status: "COMPLETED",
            summaryNarrative: "Temporary summary",
            engagedTimeSeconds: stored?.engagedTimeSeconds
        });
        stored = await repository.get(sessionId);
        expect(stored?.summaryExpired).toBe(true);
        expect(stored?.summaryNarrative).toBeNull();

        await repository.delete(sessionId);
        await expect(repository.get(sessionId)).resolves.toBeNull();
    });
});
