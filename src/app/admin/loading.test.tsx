import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AdminLoading from "./loading";

describe("administrator route loading boundary", () => {
    it("renders an identity-free busy state before administrator access resolves", () => {
        const { container } = render(<AdminLoading />);

        expect(screen.getByLabelText("Loading administrator workspace")).toHaveAttribute("aria-busy", "true");
        expect(screen.getByRole("status")).toHaveTextContent("Loading administrator workspace.");
        expect(container.querySelector(".recruiter-shell__header")).toHaveAttribute("aria-hidden", "true");
        expect(screen.queryByText("Admin User")).not.toBeInTheDocument();
        expect(screen.queryByText("Candidate engagement")).not.toBeInTheDocument();
        expect(screen.queryByText("Sessions tracked")).not.toBeInTheDocument();
    });
});
