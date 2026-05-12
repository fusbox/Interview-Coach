import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PracticeSetupForm } from "./PracticeSetupForm";

describe("PracticeSetupForm", () => {
    it("announces target role validation errors and associates the message to the field", async () => {
        const user = userEvent.setup();
        render(<PracticeSetupForm />);

        await user.click(screen.getByRole("button", { name: /start generating questions/i }));

        const targetRole = screen.getByLabelText(/target role/i);
        const error = await screen.findByText("Target role is required.");

        expect(screen.getByRole("alert")).toHaveTextContent(/review the highlighted fields/i);
        expect(targetRole).toHaveAttribute("aria-invalid", "true");
        expect(targetRole).toHaveAttribute("aria-describedby", expect.stringContaining(error.id));
    });

    it("renders server submission errors in an announced region", () => {
        render(<PracticeSetupForm submissionError="We could not save your draft. Please try again." />);

        expect(screen.getByRole("alert")).toHaveTextContent("We could not save your draft. Please try again.");
    });
});
