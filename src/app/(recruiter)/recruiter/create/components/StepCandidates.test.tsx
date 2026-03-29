import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StepCandidates } from "./StepCandidates";
import type { CandidateRow } from "./StepCandidates";
import type { StepFooterProps } from "../constants";

function StepFooterStub({ onNext, isNextDisabled }: StepFooterProps) {
    return (
        <button type="button" onClick={onNext} disabled={isNextDisabled}>
            Next: Preview
        </button>
    );
}

describe("StepCandidates", () => {
    it("keeps next disabled until at least one valid candidate exists", async () => {
        const user = userEvent.setup();
        let currentCandidates: CandidateRow[] = [];

        const setCandidates = vi.fn((nextCandidates: CandidateRow[]) => {
            currentCandidates = nextCandidates;
            rerenderComponent();
        });

        const renderComponent = () => render(
            <StepCandidates
                candidates={currentCandidates}
                setCandidates={setCandidates}
                onBack={vi.fn()}
                onNext={vi.fn()}
                StepFooter={StepFooterStub}
            />
        );

        const rendered = renderComponent();
        const rerenderComponent = () => {
            rendered.rerender(
                <StepCandidates
                    candidates={currentCandidates}
                    setCandidates={setCandidates}
                    onBack={vi.fn()}
                    onNext={vi.fn()}
                    StepFooter={StepFooterStub}
                />
            );
        };

        expect(screen.getByRole("button", { name: "Next: Preview" })).toBeDisabled();

        await user.click(screen.getByRole("button", { name: /add candidate/i }));

        expect(screen.getByRole("button", { name: "Next: Preview" })).toBeDisabled();

        await user.type(screen.getByPlaceholderText("First Name"), "Pat");
        await user.type(screen.getByPlaceholderText("Last Name"), "Lee");
        await user.type(screen.getByPlaceholderText("Email Address"), "pat@example.com");

        expect(screen.getByRole("button", { name: "Next: Preview" })).toBeEnabled();
    });

    it("removes a candidate row and returns to the empty state", async () => {
        const user = userEvent.setup();
        let currentCandidates: CandidateRow[] = [{ id: "cand-1", firstName: "Pat", lastName: "Lee", email: "pat@example.com" }];

        const setCandidates = vi.fn((nextCandidates: CandidateRow[]) => {
            currentCandidates = nextCandidates;
            rerenderComponent();
        });

        const renderComponent = () => render(
            <StepCandidates
                candidates={currentCandidates}
                setCandidates={setCandidates}
                onBack={vi.fn()}
                onNext={vi.fn()}
                StepFooter={StepFooterStub}
            />
        );

        const rendered = renderComponent();
        const rerenderComponent = () => {
            rendered.rerender(
                <StepCandidates
                    candidates={currentCandidates}
                    setCandidates={setCandidates}
                    onBack={vi.fn()}
                    onNext={vi.fn()}
                    StepFooter={StepFooterStub}
                />
            );
        };

        await user.click(screen.getByRole("button", { name: "" }));

        expect(screen.getByText("No candidates yet")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Next: Preview" })).toBeDisabled();
    });
});
