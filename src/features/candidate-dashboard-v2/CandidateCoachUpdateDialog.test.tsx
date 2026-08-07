import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CandidateNextRoundBuilderModel } from "@/features/candidate-practice-v2/candidate-next-round-builder";

import type { CandidateCoachUpdateDetail } from "./candidate-coach-update-detail";
import { CandidateCoachUpdateDialog } from "./CandidateCoachUpdateDialog";
import { CandidateNextRoundBuilderExperience } from "./CandidateNextRoundBuilderExperience";

describe("CandidateCoachUpdateDialog", () => {
    it("keeps question context outside a shared answer review and exposes one next move", () => {
        render(<CandidateCoachUpdateDialog detail={createDetail()} onClose={() => undefined} />);

        const dialog = screen.getByRole("dialog", { name: "Let's review your latest practice." });
        const currentSlide = within(dialog).getByRole("group", { name: "Question feedback 1 of 2" });
        const evidence = currentSlide.querySelector(".candidate-answer-review__evidence");

        expect(dialog.querySelector(".candidate-coach-avatar")).not.toBeInTheDocument();
        expect(screen.getByTestId("coach-update-sheet-grabber")).toBeInTheDocument();
        expect(within(currentSlide).getByText("Behavioral")).toBeInTheDocument();
        expect(within(currentSlide).queryByText("Question 4")).not.toBeInTheDocument();
        expect(within(currentSlide).getByRole("heading", {
            name: "Tell me about a time you resolved a high-risk customer issue.",
        })).toBeInTheDocument();
        expect(evidence).not.toBeNull();
        expect(within(evidence as HTMLElement).getByText("Your answer")).toBeInTheDocument();
        expect(within(evidence as HTMLElement).getByText(/I brought support and engineering together/i)).toBeInTheDocument();
        expect(within(evidence as HTMLElement).queryByText("What I noticed")).not.toBeInTheDocument();
        expect(within(currentSlide).getByText("What I noticed")).toBeInTheDocument();
        expect(within(currentSlide).getByText("Try next")).toBeInTheDocument();
        expect(currentSlide.querySelector(".candidate-answer-review__icon")).not.toBeInTheDocument();
        expect(currentSlide.querySelector(".candidate-answer-review__coaching"))
            .toHaveClass("has-observation");
        expect(within(currentSlide).getByLabelText("What the coach noticed in question 4"))
            .not.toHaveClass("surface-sky");
        expect(within(currentSlide).getByLabelText("What to try next for question 4"))
            .toHaveClass("candidate-answer-review__next");
        expect(within(currentSlide).getByLabelText("What to try next for question 4"))
            .not.toHaveClass("surface-orange");
        expect(within(currentSlide).getByText("Name the measurable customer outcome.")).toBeInTheDocument();
        expect(within(currentSlide).queryByText("Answer shape")).not.toBeInTheDocument();
        expect(within(currentSlide).getByRole("list", { name: "Suggested answer structure" }))
            .toBeInTheDocument();
        expect(within(currentSlide).getByText("measurable result")).toBeInTheDocument();
    });

    it("dismisses the mobile sheet after a deliberate downward drag", () => {
        const onClose = vi.fn();
        render(<CandidateCoachUpdateDialog detail={createDetail()} onClose={onClose} />);

        const dialog = screen.getByRole("dialog", { name: "Let's review your latest practice." });
        const grabber = screen.getByTestId("coach-update-sheet-grabber");
        fireEvent.pointerDown(grabber, { pointerId: 1, pointerType: "touch", clientY: 20 });
        fireEvent.pointerMove(grabber, { pointerId: 1, pointerType: "touch", clientY: 120 });

        expect(dialog).toHaveStyle("--candidate-coach-update-sheet-offset: 100px");

        fireEvent.pointerUp(grabber, { pointerId: 1, pointerType: "touch", clientY: 120 });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("uses roving question tabs and suppresses actions in non-current slides", async () => {
        render(<CandidateCoachUpdateDialog detail={createDetail()} onClose={() => undefined} />);

        const dialog = screen.getByRole("dialog", { name: "Let's review your latest practice." });
        const navigation = within(dialog).getByRole("navigation", { name: "Coach Update question navigation" });
        expect(navigation.closest("header")).toHaveClass("candidate-opened-surface-header");
        const carousel = within(dialog).getByRole("region", { name: "Coach Update question feedback carousel" });
        expect(carousel).toHaveAttribute("data-has-previous", "false");
        expect(carousel).toHaveAttribute("data-has-next", "true");
        const firstTab = within(dialog).getByRole("button", { name: "Current feedback: question 4" });
        firstTab.focus();
        fireEvent.keyDown(firstTab, { key: "ArrowRight" });

        await waitFor(() => {
            expect(within(dialog).getByRole("button", { name: "Current feedback: question 1" })).toHaveFocus();
        });
        expect(within(dialog).getByRole("button", { name: "Current feedback: question 1" }))
            .toHaveAttribute("aria-current", "true");
        expect(carousel).toHaveAttribute("data-has-previous", "true");
        expect(carousel).toHaveAttribute("data-has-next", "false");
        const actions = within(dialog).getAllByRole("button", { name: "Practice this now", hidden: true });
        expect(actions[0]).toHaveAttribute("tabindex", "-1");
        expect(actions[1]).not.toHaveAttribute("tabindex", "-1");
    });

    it("does not imply adjacent feedback when the update contains one question", () => {
        const detail = createDetail();
        render(<CandidateCoachUpdateDialog
            detail={{
                ...detail,
                answeredCount: 1,
                questionCount: 1,
                items: detail.items.slice(0, 1),
            }}
            onClose={() => undefined}
        />);

        const dialog = screen.getByRole("dialog", { name: "Let's review your latest practice." });
        const carousel = within(dialog).getByRole("region", { name: "Coach Update question feedback carousel" });
        expect(carousel).toHaveAttribute("data-has-previous", "false");
        expect(carousel).toHaveAttribute("data-has-next", "false");
        expect(within(dialog).queryByRole("navigation", { name: "Coach Update question navigation" }))
            .not.toBeInTheDocument();
    });

    it("keeps the queued round handoff stable across feedback and restores the same question after review", async () => {
        render(
            <CandidateNextRoundBuilderExperience initialBuilder={createNextRoundBuilder()}>
                <CandidateCoachUpdateDialog detail={createDetail()} onClose={() => undefined} />
            </CandidateNextRoundBuilderExperience>,
        );

        const coachUpdate = screen.getByRole("dialog", { name: "Let's review your latest practice." });
        fireEvent.click(within(coachUpdate).getByRole("button", { name: "Go to question 1 feedback" }));
        await waitFor(() => {
            expect(within(coachUpdate).getByRole("button", { name: "Current feedback: question 1" }))
                .toHaveAttribute("aria-current", "true");
        });

        expect(within(coachUpdate).getByRole("group", { name: "Next round, 1 question" }))
            .toBeInTheDocument();
        const reviewNextRound = within(coachUpdate).getByRole("button", { name: "Review next round" });
        fireEvent.click(reviewNextRound);

        const nextRound = screen.getByRole("dialog", { name: "Next round" });
        expect(coachUpdate.parentElement).toHaveAttribute("aria-hidden", "true");
        expect(coachUpdate.parentElement).toHaveAttribute("inert");
        fireEvent.click(within(nextRound).getByRole("button", { name: "Close Next round" }));

        await waitFor(() => {
            expect(screen.queryByRole("dialog", { name: "Next round" })).not.toBeInTheDocument();
            expect(reviewNextRound).toHaveFocus();
        });
        expect(within(coachUpdate).getByRole("button", { name: "Current feedback: question 1" }))
            .toHaveAttribute("aria-current", "true");
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
                questionNumber: 4,
                category: "Behavioral",
                questionText: "Tell me about a time you resolved a high-risk customer issue.",
                answerText: "I brought support and engineering together, clarified the tradeoff, and shipped the fix.",
                observation: "You made your decision process concrete.",
                nextPracticeFocus: "Name the measurable customer outcome.",
                answerShape: ["direct point", "specific evidence", "measurable result"],
            }),
            createItem({
                questionKey: "slot-2",
                questionNumber: 1,
                category: "Situational",
                questionText: "How would you communicate a service disruption to key accounts?",
                answerText: "I would explain what happened, what customers can expect, and when I will update them.",
                observation: "Your communication sequence is easy to follow.",
                nextPracticeFocus: "Add the tradeoff behind your timing decision.",
            }),
        ],
    };
}

function createNextRoundBuilder(): CandidateNextRoundBuilderModel {
    return {
        status: "candidate_next_round_builder_ready",
        candidateProfileId: "candidate-1",
        roleProfileId: "10000000-0000-4000-8000-000000000001",
        targetRole: "Senior Product Designer",
        candidateNextRoundDraftId: "draft-1",
        version: 3,
        itemCount: 1,
        capacity: 20,
        items: [{
            candidateNextRoundDraftItemId: "item-1",
            sourceCandidatePracticeSessionId: "session-1",
            sourceQuestionKey: "slot-1",
            rootCandidatePracticeSessionId: "session-1",
            rootQuestionKey: "slot-1",
            practiceKind: "practice_from_feedback",
            provenance: "coach_update",
            displayPosition: 0,
            questionNumber: 4,
            category: "Behavioral",
            questionText: "Tell me about a time you resolved a high-risk customer issue.",
            evidenceLabel: "Coach feedback",
        }],
        choices: [
            {
                sourceCandidatePracticeSessionId: "session-1",
                sourceQuestionKey: "slot-1",
                rootCandidatePracticeSessionId: "session-1",
                rootQuestionKey: "slot-1",
                practiceKind: "practice_from_feedback",
                provenance: "coach_plan",
                questionNumber: 4,
                category: "Behavioral",
                questionText: "Tell me about a time you resolved a high-risk customer issue.",
                evidenceLabel: "Coach feedback",
                isQueued: true,
            },
            {
                sourceCandidatePracticeSessionId: "session-1",
                sourceQuestionKey: "slot-2",
                rootCandidatePracticeSessionId: "session-1",
                rootQuestionKey: "slot-2",
                practiceKind: "practice_from_feedback",
                provenance: "coach_plan",
                questionNumber: 1,
                category: "Situational",
                questionText: "How would you communicate a service disruption to key accounts?",
                evidenceLabel: "Coach feedback",
                isQueued: false,
            },
        ],
    };
}

function createItem({
    answerShape,
    answerText,
    category,
    nextPracticeFocus,
    observation,
    questionKey,
    questionNumber,
    questionText,
}: {
    answerShape?: string[];
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
        sourceOccurrence: {
            candidatePracticeSessionId: "session-1",
            questionKey,
        },
        canonicalQuestion: {
            candidatePracticeSessionId: "session-1",
            questionKey,
        },
        questionNumber,
        category,
        questionText,
        evidenceStatus: "practiced",
        answer: {
            mode: "text",
            text: answerText,
            submittedAt: "2026-07-31T11:55:00.000Z",
        },
        transcriptCanvas: answerShape ? {
            status: "candidate_transcript_canvas_v1",
            answerAttemptId: `attempt-${questionKey}`,
            evaluationRunId: `run-${questionKey}`,
            inputFingerprint: "a".repeat(64),
            transcriptFingerprint: "b".repeat(64),
            annotations: [],
            wholeAnswerIndicators: [],
            primaryGap: {
                id: `gap-${questionKey}`,
                basis: { kind: "missing_expected_signal", signalId: "missing_result" },
                label: "Try next",
                message: nextPracticeFocus,
                suggestedShape: answerShape,
            },
        } : null,
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
