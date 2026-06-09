import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FeedbackDrawer } from "./FeedbackDrawer";
import type { AnalysisResult } from "@/lib/domain/types";

vi.mock("@/app/actions/feedback", () => ({
    captureFeedbackAction: vi.fn(),
}));

vi.mock("@/features/audio/audio-engine", () => ({
    audioEngine: {
        unlock: vi.fn(),
    },
}));

const analysisWithCoachSignal: AnalysisResult = {
    ack: "You gave a useful answer.",
    contentPulse: {
        dimension: "focus_relevance",
        headline: "Stay focused",
        body: "You stayed close to the question.",
        quote: "I would help the client.",
    },
    coachSignal: {
        focus: "Add the result",
        rationale: "This would show the interviewer what changed because of your action.",
        trySayingThis: "I helped the client reset access and confirmed they could log in before ending the call.",
    },
    nextAction: {
        label: "Continue",
        actionType: "next_question",
    },
    meta: {
        tier: 1,
        modality: "text",
    },
};

describe("FeedbackDrawer", () => {
    it("does not render candidate-only coach signal copy by default", () => {
        render(
            <FeedbackDrawer
                isOpen
                analysis={analysisWithCoachSignal}
                onNext={vi.fn()}
                onRetry={vi.fn()}
            />,
        );

        expect(screen.queryByText("For the biggest lift")).not.toBeInTheDocument();
    });

    it("renders coach signal copy when explicitly enabled for candidate-led sessions", () => {
        render(
            <FeedbackDrawer
                isOpen
                analysis={analysisWithCoachSignal}
                onNext={vi.fn()}
                onRetry={vi.fn()}
                showCoachSignal
            />,
        );

        expect(screen.getByText("For the biggest lift")).toBeInTheDocument();
        expect(screen.getByText("Add the result")).toBeInTheDocument();
    });
});
