import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import CandidateSessionPage from "./page";

it("renders the candidate session route shell for the requested session", async () => {
    const ui = await CandidateSessionPage({ params: Promise.resolve({ sessionId: "session-v2-1" }) });

    render(ui);

    expect(screen.getByRole("heading", { name: "Practice session" })).toBeInTheDocument();
    expect(screen.getByText(/session-v2-1/i)).toBeInTheDocument();
});

it("routes candidate-owned session completion back to the candidate dashboard", async () => {
    const ui = await CandidateSessionPage({ params: Promise.resolve({ sessionId: "session-v2-1" }) });

    render(ui);

    expect(screen.getByRole("link", { name: "Finish session" })).toHaveAttribute(
        "href",
        "/candidate/dashboard",
    );
    expect(screen.getByText(/dashboard is the next stop/i)).toBeInTheDocument();
});
