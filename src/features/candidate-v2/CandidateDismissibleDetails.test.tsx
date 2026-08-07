import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CandidateDismissibleDetails } from "./CandidateDismissibleDetails";

describe("CandidateDismissibleDetails", () => {
    it("keeps inside interactions open and closes on an outside pointer", () => {
        const { container } = render(
            <CandidateDismissibleDetails className="candidate-dashboard-context-menu">
                <summary>Senior Product Designer</summary>
                <a href="/candidate/setup">Prep for a new role</a>
            </CandidateDismissibleDetails>,
        );

        const details = container.querySelector("details");
        expect(details).not.toBeNull();

        fireEvent.click(screen.getByText("Senior Product Designer"));
        expect(details).toHaveAttribute("open");

        fireEvent.pointerDown(screen.getByText("Prep for a new role"));
        expect(details).toHaveAttribute("open");

        fireEvent.pointerDown(document.body);
        expect(details).not.toHaveAttribute("open");
    });
});
