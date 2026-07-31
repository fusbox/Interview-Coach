import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PostAnswerCoachingProgress } from "./PostAnswerCoachingProgress";

describe("PostAnswerCoachingProgress", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("shows the three fixed typed-answer steps while an answer is being saved", () => {
        render(<PostAnswerCoachingProgress phase="submitting" answerMode="text" />);

        expect(screen.getByRole("dialog", { name: "Reviewing your response" })).toBeInTheDocument();
        const steps = within(screen.getByRole("list", { name: "Coaching progress" }));
        expect(steps.getByText("Taking a look...")).toBeInTheDocument();
        expect(steps.getByText("Reviewing answer content...")).toBeInTheDocument();
        expect(steps.getByText("Creating feedback...")).toBeInTheDocument();
        expect(screen.queryByText("Noting your speaking delivery...")).not.toBeInTheDocument();
        expect(screen.getByRole("progressbar", { name: "Preparing coaching" })).toHaveAttribute(
            "aria-valuenow",
            "1",
        );
    });

    it("uses the four fixed voice-answer steps and advances them on the established timer", () => {
        vi.useFakeTimers();
        render(<PostAnswerCoachingProgress phase="analyzing" answerMode="voice" />);

        expect(screen.getByText("Noting your speaking delivery...")).toBeInTheDocument();
        expect(screen.getByRole("progressbar", { name: "Preparing coaching" })).toHaveAttribute(
            "aria-valuetext",
            "Taking a look...",
        );

        act(() => vi.advanceTimersByTime(2_500));
        expect(screen.getByRole("progressbar", { name: "Preparing coaching" })).toHaveAttribute(
            "aria-valuetext",
            "Reviewing answer content...",
        );

        act(() => vi.advanceTimersByTime(2_500));
        expect(screen.getByRole("progressbar", { name: "Preparing coaching" })).toHaveAttribute(
            "aria-valuetext",
            "Noting your speaking delivery...",
        );

        act(() => vi.advanceTimersByTime(2_500));
        expect(screen.getByRole("progressbar", { name: "Preparing coaching" })).toHaveAttribute(
            "aria-valuetext",
            "Creating feedback...",
        );
    });

    it("covers quick voice transcription with the shared coaching sequence", () => {
        render(
            <PostAnswerCoachingProgress
                phase="idle"
                answerMode="voice"
                isVoiceSubmitPreparing
            />,
        );

        expect(screen.getByRole("dialog", { name: "Reviewing your response" })).toBeInTheDocument();
        expect(screen.getByText("Noting your speaking delivery...")).toBeInTheDocument();
    });

    it.each([
        "idle",
        "analysis_ready",
        "analysis_failed",
        "analysis_unavailable",
        "draft_save_failed",
    ] as const)("does not cover the session during %s", (phase) => {
        render(<PostAnswerCoachingProgress phase={phase} answerMode="text" />);

        expect(screen.queryByRole("dialog", { name: "Reviewing your response" })).not.toBeInTheDocument();
    });
});
