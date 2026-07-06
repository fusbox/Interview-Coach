import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import Session2Page from "./page";

it("renders the candidate V2 session route shell for the requested session", async () => {
    const ui = await Session2Page({ params: Promise.resolve({ sessionId: "session-v2-1" }) });

    render(ui);

    expect(screen.getByRole("heading", { name: "Practice session V2" })).toBeInTheDocument();
    expect(screen.getByText(/session-v2-1/i)).toBeInTheDocument();
});
