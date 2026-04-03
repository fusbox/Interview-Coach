import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteSession } from "../actions";
import { RecruiterSessionsTable } from "./RecruiterSessionsTable";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        refresh: refreshMock,
    }),
}));

vi.mock("../actions", () => ({
    deleteSession: vi.fn(),
}));

vi.mock("./ResendInviteButton", () => ({
    ResendInviteButton: () => <button type="button">Resend invite</button>,
}));

describe("RecruiterSessionsTable", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const sessions = [
        {
            id: "session-1",
            candidateName: "Charlie Adams",
            candidateFirstName: "Charlie",
            candidateEmail: "charlie@example.com",
            role: "Warehouse Associate",
            status: "NOT_STARTED" as const,
            createdAt: 100,
            updatedAt: 100,
            questionCount: 3,
            answerCount: 0,
            submittedCount: 0,
            engagedTimeSeconds: 120,
        },
        {
            id: "session-2",
            candidateName: "Alice Baker",
            candidateFirstName: "Alice",
            candidateEmail: "alice@example.com",
            role: "QA Engineer",
            status: "COMPLETED" as const,
            createdAt: 200,
            updatedAt: 250,
            questionCount: 4,
            answerCount: 4,
            submittedCount: 4,
            engagedTimeSeconds: 300,
        },
    ];

    it("filters sessions by candidate or role search", async () => {
        const user = userEvent.setup();

        render(<RecruiterSessionsTable initialSessions={sessions} />);

        expect(screen.getByText("Charlie Adams")).toBeInTheDocument();
        expect(screen.getByText("Alice Baker")).toBeInTheDocument();

        await user.type(screen.getByRole("textbox", { name: /search candidates or roles/i }), "qa");

        expect(screen.queryByText("Charlie Adams")).not.toBeInTheDocument();
        expect(screen.getByText("Alice Baker")).toBeInTheDocument();
    });

    it("sorts candidate names and updates aria-sort", async () => {
        const user = userEvent.setup();

        render(<RecruiterSessionsTable initialSessions={sessions} />);

        const candidateSort = screen.getByRole("button", { name: /sort by candidate/i });
        await user.click(candidateSort);

        const candidateHeaders = screen.getAllByText(/Alice Baker|Charlie Adams/);
        expect(candidateHeaders[0]).toHaveTextContent("Charlie Adams");
        expect(screen.getByRole("columnheader", { name: /candidate/i })).toHaveAttribute("aria-sort", "descending");

        await user.click(candidateSort);

        const reordered = screen.getAllByText(/Alice Baker|Charlie Adams/);
        expect(reordered[0]).toHaveTextContent("Alice Baker");
        expect(screen.getByRole("columnheader", { name: /candidate/i })).toHaveAttribute("aria-sort", "ascending");
    });

    it("shows an inline error panel when deleting a session fails", async () => {
        const user = userEvent.setup();
        vi.spyOn(window, "confirm").mockReturnValue(true);
        vi.mocked(deleteSession).mockRejectedValue(new Error("Delete failed"));

        render(<RecruiterSessionsTable initialSessions={sessions} isAdmin />);

        await user.click(screen.getByRole("button", { name: /delete charlie adams's session/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "We couldn't delete Charlie Adams's session. Please try again."
        );
    });
});
