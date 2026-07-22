import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createCandidateSetupSessionTransition } from "@/features/candidate-setup-v2/candidate-setup-session-creation";

import { renderCandidateInvitedEntryRoute } from "./CandidateInvitedEntryRoute";

describe("candidate invited entry page", () => {
    it("renders the initials stage without serializing the intended first name", async () => {
        render(await renderCandidateInvitedEntryRoute({
            resolveState: async () => state(),
        }));
        expect(screen.getByRole("textbox", { name: "Your initials" })).toBeInTheDocument();
        expect(screen.getByText(/Quality Inspector role/i)).toBeInTheDocument();
        expect(screen.queryByText(/Irma/i)).not.toBeInTheDocument();
    });

    it("recovers an already matched entry directly to the invited landing", async () => {
        render(await renderCandidateInvitedEntryRoute({
            resolveState: async () => state({ initialsConfirmed: true, candidateFirstName: "Irma" }),
        }));
        expect(screen.queryByRole("textbox", { name: "Your initials" })).not.toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Hi Irma. Ready to practice?" })).toBeInTheDocument();
        expect(screen.getByText("Screening call")).toBeInTheDocument();
    });

    it("fails closed for missing, completed, and abandoned invited access", async () => {
        render(await renderCandidateInvitedEntryRoute({ resolveState: async () => null }));
        expect(screen.getByRole("heading", { name: /isn't available/i })).toBeInTheDocument();

        render(await renderCandidateInvitedEntryRoute({
            resolveState: async () => state({ sessionStatus: "completed" }),
        }));
        expect(screen.getByRole("heading", { name: /practice is complete/i })).toBeInTheDocument();
        expect(screen.getByText(/you can close this window when you are finished/i)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /close this window/i })).not.toBeInTheDocument();
    });
});

function entry(overrides: Record<string, unknown> = {}) {
    return {
        targetRole: "Quality Inspector",
        interviewStage: "screening" as const,
        questionCount: 5,
        sessionAttemptNumber: 1,
        sessionStatus: "planned" as const,
        initialsConfirmed: false,
        ...overrides,
    };
}

function state(overrides: Record<string, unknown> = {}) {
    return {
        entry: entry(overrides),
        initialSession: session(),
        completedDebrief: {
            sessionId: "30000000-0000-4000-8000-000000000001",
            sessionAttemptNumber: 1,
            targetRole: "Quality Inspector",
            questionCount: 1,
            answeredCount: 1,
            coachedCount: 1,
            questions: [{
                slotId: "slot-1",
                questionNumber: 1,
                categoryLabel: "Screening",
                questionText: "Why are you interested in this role?",
                answerText: "I enjoy quality-focused work.",
                coaching: {
                    acknowledgement: "You connected your interest to the work.",
                    observation: "A specific example would make the answer clearer.",
                    nextPracticeFocus: "Add one example from your experience.",
                },
            }],
        },
    };
}

function session() {
    return createCandidateSetupSessionTransition({
        payload: {
            targetRole: "Quality Inspector",
            jobDescription: "Inspect finished goods and document quality findings.",
            resumeText: "",
            interviewStage: "screening",
            questionCount: "5",
        },
        now: new Date("2026-07-20T00:00:00.000Z"),
        createSessionId: () => "30000000-0000-4000-8000-000000000001",
    });
}
