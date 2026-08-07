import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
    CandidatePlanDial,
    type CandidatePlanDialQuestion,
} from "./CandidatePlanDial";

function createQuestions(count: number): CandidatePlanDialQuestion[] {
    return Array.from({ length: count }, (_, index) => ({
        questionKey: `question-${index + 1}`,
        questionNumber: index + 1,
        state: index < 2 ? "strong" : "clear",
        stateLabel: index < 2 ? "Strong" : "Clear",
    }));
}

describe("CandidatePlanDial", () => {
    it.each([5, 7])("uses the same reference construction for a %i-question plan", (count) => {
        render(
            <CandidatePlanDial
                aria-label={`${count}-question Coach Plan`}
                interactive
                layout="reference"
                material="neutral"
                questions={createQuestions(count)}
            />,
        );

        const dial = screen.getByRole("group", { name: `${count}-question Coach Plan` });
        expect(dial.parentElement).toHaveClass(
            "candidate-plan-dial--layout-reference",
            "candidate-plan-dial--material-neutral",
        );
        expect(dial.querySelectorAll("[data-plan-question]")).toHaveLength(count);
    });

    it("declares the card and Plan material modes by default", () => {
        render(
            <CandidatePlanDial
                aria-label="Default Coach Plan"
                questions={createQuestions(5)}
            />,
        );

        const dial = screen.getByRole("img", { name: "Default Coach Plan" });
        expect(dial.parentElement).toHaveClass(
            "candidate-plan-dial--layout-card",
            "candidate-plan-dial--material-plan",
        );
    });
});
