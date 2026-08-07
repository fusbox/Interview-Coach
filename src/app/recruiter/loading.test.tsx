import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RecruiterLoading from "./loading";

describe("recruiter route loading boundary", () => {
    it("renders a privacy-safe busy state without duplicating the authenticated shell", () => {
        render(<RecruiterLoading />);

        expect(screen.getByLabelText("Loading recruiter workspace")).toHaveAttribute("aria-busy", "true");
        expect(screen.getByRole("status")).toHaveTextContent("Loading recruiter workspace.");
        expect(screen.queryByRole("banner")).not.toBeInTheDocument();
        expect(screen.queryByText("Settings")).not.toBeInTheDocument();
        expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
    });
});
