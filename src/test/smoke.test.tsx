import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import HomePage from "@/app/page";

it("renders the public Interview Coach root page", () => {
    render(<HomePage />);

    expect(
        screen.getByRole("heading", {
            name: "Interview Coach",
            level: 1,
        }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Level up on your own terms." })).toBeInTheDocument();
});
