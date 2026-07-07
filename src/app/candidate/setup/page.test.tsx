import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import CandidateSetupPage from "./page";

it("renders the candidate practice setup route shell", () => {
    render(<CandidateSetupPage />);

    expect(screen.getByRole("heading", { name: "Practice setup" })).toBeInTheDocument();
    expect(screen.getByText(/rebuilt candidate-owned practice setup flow/i)).toBeInTheDocument();
});
