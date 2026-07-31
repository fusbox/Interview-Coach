import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { CandidateCoachUpdateDetail } from "./candidate-coach-update-detail";
import { CandidateCoachUpdateDialog } from "./CandidateCoachUpdateDialog";

describe("CandidateCoachUpdateDialog", () => {
    it("keeps question context outside a shared answer review and exposes one next move", () => {
        render(<CandidateCoachUpdateDialog detail={createDetail()} onClose={() => undefined} />);

        const dialog = screen.getByRole("dialog", { name: "Let's review your latest practice." });
        const currentSlide = within(dialog).getByRole("group", { name: "Question feedback 1 of 2" });
        const evidence = currentSlide.querySelector(".candidate-answer-review__evidence");

        expect(within(currentSlide).getByText(/Question 1 .* Behavioral/)).toBeInTheDocument();
        expect(within(currentSlide).getByRole("heading", {
            name: "Tell me about a time you resolved a high-risk customer issue.",
        })).toBeInTheDocument();
        expect(evidence).not.toBeNull();
        expect(within(evidence as HTMLElement).getByText("Your answer")).toBeInTheDocument();
        expect(within(evidence as HTMLElement).getByText(/I brought support and engineering together/i)).toBeInTheDocument();
        expect(within(evidence as HTMLElement).queryByText("What I noticed")).not.toBeInTheDocument();
        expect(within(currentSlide).getByText("What I noticed")).toBeInTheDocument();
        expect(within(currentSlide).getByText("Try next")).toBeInTheDocument();
        expect(within(currentSlide).getByLabelText("What to try next for question 1"))
            .toHaveClass("candidate-answer-review__next");
        expect(within(currentSlide).getByLabelText("What to try next for question 1"))
            .not.toHaveClass("surface-orange");
        expect(within(currentSlide).getByText("Name the measurable customer outcome.")).toBeInTheDocument();
    });

    it("uses roving question tabs and suppresses actions in non-current slides", async () => {
        render(<CandidateCoachUpdateDialog detail={createDetail()} onClose={() => undefined} />);

        const dialog = screen.getByRole("dialog", { name: "Let's review your latest practice." });
        const firstTab = within(dialog).getByRole("button", { name: "Current feedback: question 1" });
        firstTab.focus();
        fireEvent.keyDown(firstTab, { key: "ArrowRight" });

        await waitFor(() => {
            expect(within(dialog).getByRole("button", { name: "Current feedback: question 2" })).toHaveFocus();
        });
        expect(within(dialog).getByRole("button", { name: "Current feedback: question 2" }))
            .toHaveAttribute("aria-current", "true");
        const actions = within(dialog).getAllByRole("button", { name: "Practice this now", hidden: true });
        expect(actions[0]).toHaveAttribute("tabindex", "-1");
        expect(actions[1]).not.toHaveAttribute("tabindex", "-1");
    });

    it("restores focus to the current dashboard trigger after the opening trigger is replaced", async () => {
        function Harness() {
            const [isOpen, setIsOpen] = useState(false);
            const [hasOpened, setHasOpened] = useState(false);
            return (
                <>
                    <button
                        type="button"
                        data-coach-update-trigger
                        onClick={() => {
                            setHasOpened(true);
                            setIsOpen(true);
                        }}
                    >
                        {hasOpened ? "Reopen Coach Update" : "Open Coach Update"}
                    </button>
                    {isOpen ? <CandidateCoachUpdateDialog detail={createDetail()} onClose={() => setIsOpen(false)} /> : null}
                </>
            );
        }

        render(<Harness />);
        fireEvent.click(screen.getByRole("button", { name: "Open Coach Update" }));
        expect(screen.getByRole("button", { name: "Close Coach Update" })).toHaveFocus();

        fireEvent.keyDown(document, { key: "Escape" });

        await waitFor(() => {
            expect(screen.getByRole("button", { name: "Reopen Coach Update" })).toHaveFocus();
        });
        expect(document.body.style.overflow).toBe("");
    });
});

function createDetail(): CandidateCoachUpdateDetail {
    return {
        status: "candidate_coach_update_detail_ready",
        presentationKey: "artifact-1",
        candidatePracticeSessionId: "session-1",
        targetRole: "Senior Product Designer",
        completedAt: "2026-07-31T12:00:00.000Z",
        answeredCount: 2,
        questionCount: 2,
        reviewPosture: "fully_reviewable",
        summary: "You practiced two questions. Here is the feedback for each answer.",
        primaryFocus: "Make outcomes easier to see.",
        items: [
            createItem({
                questionKey: "slot-1",
                questionNumber: 1,
                category: "Behavioral",
                questionText: "Tell me about a time you resolved a high-risk customer issue.",
                answerText: "I brought support and engineering together, clarified the tradeoff, and shipped the fix.",
                observation: "You made your decision process concrete.",
                nextPracticeFocus: "Name the measurable customer outcome.",
            }),
            createItem({
                questionKey: "slot-2",
                questionNumber: 2,
                category: "Situational",
                questionText: "How would you communicate a service disruption to key accounts?",
                answerText: "I would explain what happened, what customers can expect, and when I will update them.",
                observation: "Your communication sequence is easy to follow.",
                nextPracticeFocus: "Add the tradeoff behind your timing decision.",
            }),
        ],
    };
}

function createItem({
    answerText,
    category,
    nextPracticeFocus,
    observation,
    questionKey,
    questionNumber,
    questionText,
}: {
    answerText: string;
    category: string;
    nextPracticeFocus: string;
    observation: string;
    questionKey: string;
    questionNumber: number;
    questionText: string;
}): CandidateCoachUpdateDetail["items"][number] {
    return {
        status: "candidate_coach_update_question_detail",
        questionKey,
        questionNumber,
        category,
        questionText,
        evidenceStatus: "practiced",
        answer: {
            mode: "text",
            text: answerText,
            submittedAt: "2026-07-31T11:55:00.000Z",
        },
        transcriptCanvas: null,
        coachRead: {
            acknowledgement: "Thanks for grounding this in a real example.",
            observation,
            nextPracticeFocus,
        },
        comparison: {
            kind: "first_practice",
            priorComparableAttemptCount: 0,
            message: "This is your first comparable answer for this question.",
        },
        actionPosture: {
            kind: "review_coaching",
            label: "Review coach feedback",
            reason: "This answer has accepted coaching ready.",
        },
        focusedPracticeAction: {
            status: "candidate_focused_practice_action",
            kind: "practice_from_feedback",
            label: "Practice this focus",
            href: `/candidate/practice/ready?intent=coach-update-feedback-focus&fromSession=session-1&questionKey=${questionKey}`,
            source: {
                kind: "coach_update_detail",
                candidatePracticeSessionId: "session-1",
                questionKey,
                questionNumber,
                category,
                targetRole: "Senior Product Designer",
            },
        },
    };
}
