import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
    CandidatePreSessionLanding,
    CandidatePracticeEntryTransitionOverlay,
} from "./CandidatePreSessionLanding";

describe("candidate practice transition copy", () => {
    it("uses summary language for invited completion without changing Coach Plan completion", () => {
        const { rerender } = render(
            <CandidatePracticeEntryTransitionOverlay isReleasing={false} mode="summary" />,
        );

        expect(screen.getByRole("heading", { name: "Preparing your summary" })).toBeInTheDocument();
        expect(screen.getByText(/bringing together your answers and coaching/i)).toBeInTheDocument();

        rerender(<CandidatePracticeEntryTransitionOverlay isReleasing={false} mode="coach_plan" />);
        expect(screen.getByRole("heading", { name: "Preparing your Coach Plan" })).toBeInTheDocument();
    });

    it("shows the safe accepted resume label on candidate-owned landing screens", () => {
        render(<CandidatePreSessionLanding
            variant="initial"
            targetRole="Quality inspector"
            stageLabel="Screening call"
            questionCount={5}
            resumeIncluded
            resumeLabel="resume.pdf"
            onStart={() => undefined}
        />);

        expect(screen.getByText("resume.pdf")).toHaveAttribute("title", "resume.pdf");
        expect(screen.queryByText("Included")).not.toBeInTheDocument();
    });

    it("presents the immutable question plan without an estimated-time claim", () => {
        render(<CandidatePreSessionLanding
            variant="initial"
            targetRole="Quality inspector"
            stageLabel="Screening call"
            questionCount={2}
            resumeIncluded={false}
            questions={[
                {
                    id: "slot-1",
                    number: 1,
                    category: "Screening",
                    questionText: "What interests you about this quality inspector role?",
                },
                {
                    id: "slot-2",
                    number: 2,
                    category: "Behavioral",
                    questionText: "Tell me about a time you caught a quality issue before it became a larger problem.",
                },
            ]}
            onStart={() => undefined}
        />);

        expect(screen.getByRole("heading", { name: "Quality inspector", level: 1 })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Question plan" })).toBeInTheDocument();
        expect(screen.getByText("What interests you about this quality inspector role?")).toBeInTheDocument();
        expect(screen.getByText(/your practice is ready/i)).toBeInTheDocument();
        expect(screen.queryByText(/minutes?/i)).not.toBeInTheDocument();
    });

    it("keeps invited facts and disclosure distinct from candidate-owned practice", () => {
        render(<CandidatePreSessionLanding
            variant="invited"
            targetRole="Quality inspector"
            stageLabel="Screening call"
            questionCount={2}
            resumeIncluded={false}
            candidateFirstName="Fu"
            onStart={() => undefined}
        />);

        expect(screen.getByText(/Hi Fu\. Ready to practice\?/i)).toBeInTheDocument();
        expect(screen.queryByText("Resume")).not.toBeInTheDocument();
        expect(screen.getByText(/recruiting team may review your answers/i)).toBeInTheDocument();
        expect(screen.getByText(/original invitation link/i)).toBeInTheDocument();
    });

    it("shows expansion controls only when question text visibly overflows", () => {
        const questionText = "Describe how you would investigate a recurring quality problem, communicate the risk, and verify that the corrective action worked.";
        const scrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
        const clientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
        Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, value: 96 });
        Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 64 });

        try {
            render(<CandidatePreSessionLanding
                variant="follow_up"
                targetRole="Quality inspector"
                stageLabel="Follow-up interview"
                questionCount={1}
                resumeIncluded={false}
                questions={[{
                    id: "slot-1",
                    number: 1,
                    category: "case_scenario",
                    questionText,
                }]}
                onStart={() => undefined}
            />);

            expect(screen.getByText("Scenario")).toBeInTheDocument();
            const toggle = screen.getByRole("button", { name: "Show more" });
            expect(toggle).toHaveAttribute("aria-expanded", "false");

            fireEvent.click(toggle);
            expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");

            fireEvent.click(screen.getByRole("button", { name: "Show less" }));
            expect(screen.getByRole("button", { name: "Show more" })).toHaveAttribute("aria-expanded", "false");
        } finally {
            if (scrollHeight) {
                Object.defineProperty(HTMLElement.prototype, "scrollHeight", scrollHeight);
            } else {
                Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
            }
            if (clientHeight) {
                Object.defineProperty(HTMLElement.prototype, "clientHeight", clientHeight);
            } else {
                Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
            }
        }
    });

    it("leaves a routed follow-up transition to the destination session", () => {
        const unlock = vi.fn();
        render(<CandidatePreSessionLanding
            variant="follow_up"
            targetRole="Quality inspector"
            stageLabel="Screening call"
            questionCount={1}
            resumeIncluded={false}
            startActionUrl="/candidate/practice/ready/intent-1/start"
            questionAudio={{
                unlock,
                prefetch: vi.fn(),
                playOnce: vi.fn(),
            }}
        />);

        fireEvent.submit(screen.getByRole("form", { name: "Start follow-up practice" }));

        expect(unlock).toHaveBeenCalledOnce();
        expect(screen.getByRole("button", { name: "Start practice" })).toBeEnabled();
        expect(screen.queryByRole("heading", { name: "Entering practice space" })).not.toBeInTheDocument();
    });
});
