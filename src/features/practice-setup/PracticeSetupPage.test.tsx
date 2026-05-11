import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PracticeSetupPage } from "./PracticeSetupPage";

describe("PracticeSetupPage", () => {
    it("renders the first candidate-owned setup form fields", () => {
        render(<PracticeSetupPage />);

        expect(screen.getByRole("heading", { name: /set up your practice/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/target role/i)).toBeRequired();
        expect(screen.getByLabelText(/job description/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/resume text/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /start generating questions/i })).toBeInTheDocument();
    });

    it("keeps future personalization and upload paths visible but secondary", () => {
        render(<PracticeSetupPage />);

        expect(screen.getByText(/resume file upload is coming next/i)).toBeInTheDocument();
        expect(screen.getByText(/personalization intake will plug into this setup later/i)).toBeInTheDocument();
    });
});
