import { describe, expect, it } from "vitest";

import { createRecruiterDashboardReadModel, type RecruiterDashboardRecipientFact } from "./recruiter-dashboard-read-model";

describe("recruiter dashboard read model", () => {
    it("derives precise operational states without inflating question progress", () => {
        const model = createRecruiterDashboardReadModel([
            fact({
                recipientId: "recipient-planned",
                sessionId: "session-planned",
                lastActivityAt: "2026-07-20T01:00:00.000Z",
            }),
            fact({
                recipientId: "recipient-active",
                sessionId: "session-active",
                sessionStatus: "in_progress",
                answeredQuestionCount: 2,
                firstOpenedAt: "2026-07-20T02:00:00.000Z",
                lastActivityAt: "2026-07-20T02:00:00.000Z",
            }),
            fact({
                recipientId: "recipient-completed",
                sessionId: "session-completed",
                sessionStatus: "completed",
                answeredQuestionCount: 5,
                completedAt: "2026-07-20T03:00:00.000Z",
                deliveryLifecycleState: "provider_accepted",
                deliveryAttemptNumber: 1,
                entryMatchState: "match",
                firstOpenedAt: "2026-07-20T02:30:00.000Z",
                lastActivityAt: "2026-07-20T03:00:00.000Z",
            }),
            fact({
                recipientId: "recipient-attention",
                sessionId: "session-attention",
                deliveryLifecycleState: "failed",
                deliveryAttemptNumber: 2,
                deliveryRetryable: true,
                entryMatchState: "mismatch",
                firstOpenedAt: "2026-07-20T04:00:00.000Z",
                lastActivityAt: "2026-07-20T04:00:00.000Z",
            }),
            fact({
                recipientId: "recipient-revoked",
                sessionId: "session-revoked",
                recipientLifecycleState: "revoked",
                lastActivityAt: "2026-07-20T05:00:00.000Z",
            }),
        ]);

        expect(model.summary).toEqual({
            totalInvitations: 5,
            notStarted: 2,
            inPractice: 1,
            completed: 1,
            needsAttention: 1,
        });
        expect(model.recipients[0]).toMatchObject({
            recipientId: "recipient-attention",
            deliveryState: "failed_retryable",
            entryState: "initials_mismatch",
            practiceState: "not_started",
            needsAttention: true,
        });
        expect(model.recipients.find((recipient) => recipient.recipientId === "recipient-active")).toMatchObject({
            deliveryState: "not_requested",
            entryState: "opened",
            practiceState: "in_progress",
            answeredQuestionCount: 2,
        });
        expect(model.recipients.find((recipient) => recipient.recipientId === "recipient-completed")).toMatchObject({
            deliveryState: "provider_accepted",
            entryState: "initials_match",
            practiceState: "completed",
        });
        expect(model.recipients.find((recipient) => recipient.recipientId === "recipient-revoked")?.practiceState).toBe("revoked");
    });

    it("fails closed when durable answer progress exceeds the worded question set", () => {
        expect(() => createRecruiterDashboardReadModel([
            fact({ answeredQuestionCount: 6 }),
        ])).toThrow("answered-question count exceeds");
    });
});

function fact(overrides: Partial<RecruiterDashboardRecipientFact> = {}): RecruiterDashboardRecipientFact {
    return {
        batchId: "batch-1",
        batchLifecycleState: "ready",
        targetRole: "Quality Inspector",
        interviewStage: "screening",
        batchCreatedAt: "2026-07-20T00:00:00.000Z",
        recipientId: "recipient-1",
        recipientLifecycleState: "ready",
        candidateIndex: 0,
        firstName: "Irma",
        lastName: "Castillo",
        email: "irma@example.invalid",
        requisitionReference: "REQ-1",
        sessionId: "session-1",
        sessionStatus: "planned",
        sessionAttemptNumber: 1,
        questionCount: 5,
        answeredQuestionCount: 0,
        completedAt: null,
        deliveryLifecycleState: null,
        deliveryAttemptNumber: null,
        deliveryRetryable: false,
        entryMatchState: null,
        firstOpenedAt: null,
        lastActivityAt: "2026-07-20T00:00:00.000Z",
        ...overrides,
    };
}
