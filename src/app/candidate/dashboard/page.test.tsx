import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import CandidateDashboardPage from "./page";

it("renders the candidate dashboard route shell", () => {
    render(<CandidateDashboardPage />);

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText(/rebuilt Coach Plan dashboard/i)).toBeInTheDocument();
});
