import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import CandidatePracticeReadyPage, { renderCandidatePracticeReadyPage } from "./CandidatePracticeReadyRoute";

it("renders a recovery state when a follow-up practice intent is missing", async () => {
    render(await CandidatePracticeReadyPage());

    expect(screen.getByRole("heading", { name: "Practice round is not ready yet." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to Coach Plan" })).toHaveAttribute("href", "/candidate/dashboard");
});

it("renders a resolved single-question follow-up practice staging surface", async () => {
    render(await renderCandidatePracticeReadyPage({
        searchParams: {
            intent: "coach-update-feedback-focus",
            fromSession: "session-1",
            questionKey: "slot-1",
        },
        dependencies: {
            resolveFollowUpPracticeIntent: async () => ({
                status: "candidate_follow_up_practice_intent_resolved",
                roleProfileId: null,
                kind: "practice_from_feedback",
                source: {
                    kind: "coach_update_detail",
                    candidatePracticeSessionId: "session-1",
                    questionKey: "slot-1",
                    targetInterviewId: "material handler i",
                    targetRole: "Material Handler I",
                    questionNumber: 1,
                    category: "Behavioral",
                    questionText: "Tell me about a time you handled an inventory issue.",
                    evidenceStatus: "practiced_with_coaching",
                },
                setupContext: {
                    targetRole: "Material Handler I",
                    jobDescription: "Move materials safely.",
                    interviewStage: "first_interview",
                    questionCount: 3,
                    resumeIncluded: false,
                },
                display: {
                    label: "Practice from coach feedback",
                    body: "I found the source coach read for Material Handler I, question 1. Review the setup details before starting.",
                },
            }),
        },
    }));

    expect(screen.getByRole("heading", { name: "Ready for focused practice." })).toBeInTheDocument();
    expect(screen.getByText("Material Handler I")).toBeInTheDocument();
    expect(screen.getByText("Question 1 - Behavioral")).toBeInTheDocument();
    expect(screen.getByText("Tell me about a time you handled an inventory issue.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start focused practice" })).toBeDisabled();
    expect(screen.queryByLabelText("Target role *")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Job description *")).not.toBeInTheDocument();
});

it("suppresses source details when candidate-owned validation fails", async () => {
    render(await renderCandidatePracticeReadyPage({
        searchParams: {
            intent: "coach-update-feedback-focus",
            fromSession: "session-1",
            questionKey: "slot-1",
        },
        dependencies: {
            resolveFollowUpPracticeIntent: async () => null,
        },
    }));

    expect(screen.getByRole("heading", { name: "Practice round is not ready yet." })).toBeInTheDocument();
    expect(screen.queryByText("Material Handler I")).not.toBeInTheDocument();
});
