import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import QaLoading from "./loading";

describe("AI quality route loading boundary", () => {
    it("renders a grant-neutral busy state before operator access resolves", () => {
        const { container } = render(<QaLoading />);

        expect(screen.getByLabelText("Loading AI quality workspace")).toHaveAttribute("aria-busy", "true");
        expect(screen.getByRole("status")).toHaveTextContent("Loading AI quality workspace.");
        expect(container.querySelector(".ai-eval-shell__header")).toHaveAttribute("aria-hidden", "true");
        expect(screen.queryByText("AI quality workbench")).not.toBeInTheDocument();
        expect(screen.queryByText("Operator User")).not.toBeInTheDocument();
        expect(screen.queryByText("Live estimate")).not.toBeInTheDocument();
        expect(screen.queryByText(/cases|runs|cost/i)).not.toBeInTheDocument();
    });
});
