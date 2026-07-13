import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { InvitedPracticeEntry, normalizeInitials } from "./InvitedPracticeEntry";

it("normalizes invited candidate initials without treating them as identity proof", () => {
    expect(normalizeInitials(" a-1bC ")).toBe("AB");
});

it("keeps start gated by initials but does not gate invited practice on a rating", async () => {
    const onConfirmInitials = vi.fn(async () => undefined);

    render(
        <InvitedPracticeEntry
            targetRole="Material Handler I"
            stageLabel="First interview"
            questionCount={3}
            candidateFirstName="Irma"
            onConfirmInitials={onConfirmInitials}
            onStart={vi.fn()}
        />,
    );

    expect(screen.getByRole("button", { name: "Review practice" })).toBeDisabled();
    expect(screen.getByText(/does not verify your identity/i)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Your initials" }), {
        target: { value: "ic" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review practice" }));

    await waitFor(() => expect(onConfirmInitials).toHaveBeenCalledWith("IC"));
    expect(screen.getByRole("heading", { name: "Hi Irma. Ready to practice?" })).toBeInTheDocument();
    expect(screen.getByText(/use your original invitation link to return/i)).toBeInTheDocument();
    expect(screen.getByText(/recruiting team may review your answers/i)).toBeInTheDocument();
    expect(screen.getByText(/AI coaching is visible only to you/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start practice" })).toBeEnabled();
    expect(screen.queryByText(/prepared do you feel/i)).not.toBeInTheDocument();
});
