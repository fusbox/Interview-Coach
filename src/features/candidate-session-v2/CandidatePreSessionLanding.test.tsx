import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CandidatePracticeEntryTransitionOverlay } from "./CandidatePreSessionLanding";

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
});
