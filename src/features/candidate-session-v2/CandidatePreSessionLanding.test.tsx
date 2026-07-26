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

        expect(screen.getByText("resume.pdf")).toBeInTheDocument();
        expect(screen.queryByText("Included")).not.toBeInTheDocument();
    });

    it("locks a follow-up launch after submission begins", () => {
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
        expect(screen.getByText("Starting practice").closest("button")).toBeDisabled();
        expect(screen.getByRole("heading", { name: "Entering practice space" })).toBeInTheDocument();
    });
});
