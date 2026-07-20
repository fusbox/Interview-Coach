import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createCandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";
import { createFixtureCandidateQuestionWordingResult } from "@/features/candidate-session-v2/candidate-question-wording";
import type { RecruiterInvitedTranscriptFact } from "@/features/recruiter-invites-v2/recruiter-invited-transcript-read-model";
import { renderRecruiterSessionTranscriptRoute } from "./RecruiterSessionTranscriptRoute";

const { notFoundMock, redirectMock } = vi.hoisted(() => ({
    notFoundMock: vi.fn(() => {
        throw new Error("not-found");
    }),
    redirectMock: vi.fn((target: string) => {
        throw new Error(`redirect:${target}`);
    }),
}));

vi.mock("next/navigation", () => ({
    notFound: notFoundMock,
    redirect: redirectMock,
    useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe("recruiter invited transcript page", () => {
    it("renders only the latest submitted responses for an owning recruiter", async () => {
        const loadTranscriptFact = vi.fn().mockResolvedValue(fact());
        render(await renderRecruiterSessionTranscriptRoute({
            params: Promise.resolve({ sessionId: "session-1" }),
            resolveAccess: async () => ({ kind: "authorized", user: recruiterUser() }),
            loadTranscriptFact,
        }));

        expect(loadTranscriptFact).toHaveBeenCalledWith("recruiter-1", "session-1");
        expect(screen.getByRole("heading", { name: "Irma Castillo" })).toBeInTheDocument();
        expect(screen.getByText("My latest submitted response.")).toBeInTheDocument();
        expect(screen.getByText("No answer submitted.")).toBeInTheDocument();
        expect(screen.getByText(/Drafts and AI coaching are not included/i)).toBeInTheDocument();
        expect(screen.queryByText(/engagement/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
    });

    it("uses one not-found boundary for an unknown or foreign-owned session", async () => {
        await expect(renderRecruiterSessionTranscriptRoute({
            params: { sessionId: "foreign-session" },
            resolveAccess: async () => ({ kind: "authorized", user: recruiterUser() }),
            loadTranscriptFact: async () => null,
        })).rejects.toThrow("not-found");

        expect(notFoundMock).toHaveBeenCalledTimes(1);
    });

    it("does not query transcript data for forbidden or missing recruiter access", async () => {
        const loadTranscriptFact = vi.fn();
        render(await renderRecruiterSessionTranscriptRoute({
            params: { sessionId: "session-1" },
            resolveAccess: async () => ({ kind: "forbidden", user: { ...recruiterUser(), roles: ["qa"] } }),
            loadTranscriptFact,
        }));
        expect(loadTranscriptFact).not.toHaveBeenCalled();
        expect(screen.getByRole("heading", { name: "This account does not have recruiter access." })).toBeInTheDocument();

        await expect(renderRecruiterSessionTranscriptRoute({
            params: { sessionId: "session-1" },
            resolveAccess: async () => ({ kind: "missing" }),
            loadTranscriptFact,
        })).rejects.toThrow("redirect:/login?next=%2Frecruiter%2Fsessions%2Fsession-1");
        expect(loadTranscriptFact).not.toHaveBeenCalled();
    });
});

function recruiterUser() {
    return {
        id: "recruiter-1",
        email: "recruiter@example.invalid",
        displayName: "Dev Recruiter",
        status: "active" as const,
        roles: ["recruiter" as const],
    };
}

function fact(): RecruiterInvitedTranscriptFact {
    const questionPlanSnapshot = createCandidateQuestionPlan({ interviewStage: "screening", questionCount: 2 });
    return {
        sessionId: "session-1",
        recipientId: "recipient-1",
        batchLifecycleState: "ready",
        recipientLifecycleState: "ready",
        firstName: "Irma",
        lastName: "Castillo",
        email: "irma@example.invalid",
        requisitionReference: null,
        targetRole: "Quality Inspector",
        interviewStage: "screening",
        sessionStatus: "in_progress",
        sessionAttemptNumber: 1,
        questionPlanSnapshot,
        questionWordingQuestions: createFixtureCandidateQuestionWordingResult({
            setupSnapshot: {
                targetRole: "Quality Inspector",
                jobDescription: "Inspect finished products.",
                resumeText: null,
                resumeCaptureMode: "none",
                interviewStage: "screening",
                questionCount: 2,
                createdAt: "2026-07-20T00:00:00.000Z",
            },
            questionPlanSnapshot,
        }).questions,
        latestAnswers: [
            { questionSlotId: "slot-1", questionIndex: 0, answerText: "My latest submitted response." },
        ],
    };
}
