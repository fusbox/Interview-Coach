import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionRuntimeFacts } from "./session-runtime-facts";
import { SharedLivePracticeShell } from "./SharedLivePracticeShell";

describe("SharedLivePracticeShell", () => {
    beforeEach(() => {
        window.scrollTo = vi.fn();
    });

    it("renders the candidate live workspace from shared facts and exits to the dashboard", () => {
        const prefetch = vi.fn();
        const playOnce = vi.fn();
        const stop = vi.fn();

        render(
            <SharedLivePracticeShell
                facts={createFacts("candidate_led")}
                answerMode="text"
                draftText="A saved draft"
                questionAudio={{
                    unlock: vi.fn(),
                    prefetch,
                    playOnce,
                    stop,
                }}
                onDraftChange={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );

        expect(screen.getByText("Material Handler")).toBeInTheDocument();
        expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Question 2" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Return to dashboard" })).toHaveAttribute(
            "href",
            "/candidate/dashboard?targetRole=material-handler",
        );
        expect(screen.getByRole("button", { name: "Type" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "Record" })).toBeDisabled();
        expect(screen.queryByRole("button", { name: /back to plan/i })).not.toBeInTheDocument();
        expect(prefetch).toHaveBeenCalledTimes(2);
        expect(prefetch).toHaveBeenNthCalledWith(1, expect.objectContaining({ questionKey: "slot-2" }));
        expect(prefetch).toHaveBeenNthCalledWith(2, expect.objectContaining({ questionKey: "slot-3" }));
        expect(playOnce).toHaveBeenCalledWith(expect.objectContaining({ questionKey: "slot-2" }));
    });

    it("lets an invited adapter return to its invitation landing boundary", () => {
        render(
            <SharedLivePracticeShell
                facts={createFacts("invited_candidate")}
                answerMode="text"
                draftText=""
                exitHref="/invited/session-1"
                onDraftChange={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );

        expect(screen.getByRole("link", { name: "Return to invitation" })).toHaveAttribute(
            "href",
            "/invited/session-1",
        );
    });
});

function createFacts(audience: "candidate_led" | "invited_candidate") {
    return createSessionRuntimeFacts({
        audience,
        sessionId: "session-1",
        targetRole: "Material Handler",
        interviewStage: "first_interview",
        questionCount: 3,
        currentQuestionIndex: 1,
        questions: [0, 1, 2].map((questionIndex) => ({
            questionKey: `slot-${questionIndex + 1}`,
            questionIndex,
            category: "screening" as const,
            questionText: `Question ${questionIndex + 1}`,
        })),
        completionBehavior: audience === "candidate_led"
            ? {
                kind: "candidate_dashboard",
                dashboardHref: "/candidate/dashboard?targetRole=material-handler",
            }
            : {
                kind: "invited_debrief",
            },
    });
}
