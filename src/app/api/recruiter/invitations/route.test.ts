import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { createCandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";
import { RecruiterQuestionSetInProgressError } from "@/features/recruiter-invites-v2/recruiter-invitation-create-service";
import { createRecruiterInvitationsRouteHandler } from "./route-implementation";

describe("recruiter invitations API", () => {
    it("requires an authenticated recruiter before reading create input", async () => {
        const prepareQuestions = vi.fn();
        const response = await createRecruiterInvitationsRouteHandler({
            resolveAccess: vi.fn().mockResolvedValue({ kind: "missing" }),
            prepareQuestions,
        })(request(prepareBody()));

        expect(response.status).toBe(401);
        expect(prepareQuestions).not.toHaveBeenCalled();
    });

    it("derives the recruiter from the app session and returns an immutable prepared set", async () => {
        const prepareQuestions = vi.fn().mockResolvedValue({
            outcome: "created",
            questionSet: readyQuestionSet(),
        });
        const response = await createRecruiterInvitationsRouteHandler({
            resolveAccess: authorizedAccess,
            prepareQuestions,
        })(request(prepareBody()));
        const body = await response.json();

        expect(response.status).toBe(201);
        expect(body).toMatchObject({
            status: "questions_ready",
            questionSetId: QUESTION_SET_ID,
            questionCount: 5,
        });
        expect(body.questions).toHaveLength(5);
        expect(body.questions[0]).toMatchObject({ slotId: "slot-1", label: "Screening" });
        expect(prepareQuestions).toHaveBeenCalledWith(RECRUITER_ID, expect.not.objectContaining({ recruiterId: expect.anything() }));
    });

    it("returns an in-progress conflict without pretending generation failed", async () => {
        const response = await createRecruiterInvitationsRouteHandler({
            resolveAccess: authorizedAccess,
            prepareQuestions: vi.fn().mockRejectedValue(new RecruiterQuestionSetInProgressError()),
        })(request(prepareBody()));
        expect(response.status).toBe(409);
        expect(response.headers.get("retry-after")).toBe("2");
        await expect(response.json()).resolves.toMatchObject({ code: "QUESTION_SET_IN_PROGRESS", retryable: true });
    });

    it("creates handoff links without exposing a standalone raw token field", async () => {
        const createInvitations = vi.fn().mockResolvedValue({
            outcome: "created",
            batchId: "batch-1",
            targetRole: "Quality Inspector",
            recipients: [{
                recipientId: "recipient-1",
                sessionId: "session-1",
                firstName: "Irma",
                lastName: "Castillo",
                email: "irma@example.com",
                rawToken: "secret-token",
                tokenExpiresAt: "2026-08-02T00:00:00.000Z",
            }],
        });
        const response = await createRecruiterInvitationsRouteHandler({
            resolveAccess: authorizedAccess,
            createInvitations,
            resolveAppOrigin: () => "https://interviewcoach.example",
        })(request(createBody()));
        const body = await response.json();

        expect(response.status).toBe(201);
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        expect(body.recipients[0].inviteLink).toBe("https://interviewcoach.example/s/secret-token");
        expect(body.recipients[0].copyMessage).toContain("https://interviewcoach.example/s/secret-token");
        expect(body.recipients[0].copyMessage).toContain("does not make hiring decisions");
        expect(body.recipients[0]).not.toHaveProperty("rawToken");
        expect(createInvitations).toHaveBeenCalledWith(RECRUITER_ID, expect.objectContaining({ questionSetId: QUESTION_SET_ID }));
    });

    it("rejects unknown fields that could imply body-owned recruiter identity", async () => {
        const response = await createRecruiterInvitationsRouteHandler({ resolveAccess: authorizedAccess })(
            request({ ...prepareBody(), recruiterId: crypto.randomUUID() }),
        );
        expect(response.status).toBe(400);
    });

    it("requires JSON so browser form posts cannot reach the cookie-authenticated mutation", async () => {
        const response = await createRecruiterInvitationsRouteHandler({ resolveAccess: authorizedAccess })(
            new NextRequest("http://localhost:3000/api/recruiter/invitations", {
                method: "POST",
                headers: { "content-type": "text/plain" },
                body: JSON.stringify(prepareBody()),
            }),
        );

        expect(response.status).toBe(415);
        await expect(response.json()).resolves.toMatchObject({ code: "JSON_REQUIRED" });
    });
});

const RECRUITER_ID = "20000000-0000-4000-8000-000000000001";
const QUESTION_SET_ID = "30000000-0000-4000-8000-000000000001";

async function authorizedAccess() {
    return {
        kind: "authorized" as const,
        user: {
            id: RECRUITER_ID,
            email: "recruiter@example.com",
            status: "active" as const,
            roles: ["recruiter" as const],
        },
    };
}

function request(body: unknown) {
    return new NextRequest("http://localhost:3000/api/recruiter/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

function prepareBody() {
    return {
        operation: "prepare_questions",
        actionKey: "browser-action-key-0001",
        source: "generated",
        targetRole: "Quality Inspector",
        jobDescription: "Inspect finished goods.",
        interviewStage: "screening",
    };
}

function createBody() {
    return {
        operation: "create_invitations",
        actionKey: "browser-action-key-0001",
        questionSetId: QUESTION_SET_ID,
        recipients: [{ firstName: "Irma", lastName: "Castillo", email: "irma@example.com" }],
    };
}

function readyQuestionSet() {
    const questionPlanSnapshot = createCandidateQuestionPlan({ interviewStage: "screening", questionCount: 5 });
    return {
        questionSetId: QUESTION_SET_ID,
        recruiterId: RECRUITER_ID,
        actionKeyHash: "a".repeat(64),
        requestFingerprint: "b".repeat(64),
        source: "generated" as const,
        lifecycleState: "ready" as const,
        targetRole: "Quality Inspector",
        jobDescription: "Inspect finished goods.",
        interviewStage: "screening" as const,
        questionPlanSnapshot,
        questionWordingSnapshot: {
            status: "questions_worded" as const,
            questions: questionPlanSnapshot.slots.map((slot) => ({
                slotId: slot.id,
                index: slot.index,
                category: slot.category,
                questionText: `Question ${slot.index + 1}?`,
            })),
        },
        expiresAt: "2026-07-20T18:00:00.000Z",
    };
}
