import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import HomePage from "@/app/page";

it("renders the public Interview Coach root page", () => {
    render(<HomePage />);

    expect(
        screen.getByRole("heading", {
            name: "Practice with a coach, not a score.",
            level: 1,
        }),
    ).toBeInTheDocument();
    expect(screen.getByText("Interview Coach", { selector: ".marketing-hero__brand" })).toBeInTheDocument();
});
