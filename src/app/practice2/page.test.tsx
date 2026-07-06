import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import Practice2Page from "./page";

it("renders the candidate V2 practice setup route shell", () => {
    render(<Practice2Page />);

    expect(screen.getByRole("heading", { name: "Practice setup V2" })).toBeInTheDocument();
    expect(screen.getByText(/rebuilt candidate-owned practice setup flow/i)).toBeInTheDocument();
});
