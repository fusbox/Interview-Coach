import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import Home from "./page";

it("renders the v1 root page entry actions", () => {
    render(<Home />);

    expect(
        screen.getByRole("heading", {
            name: "Interview practice that gets you in quickly and guides you forward.",
        }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Talent Arbor" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /start practicing/i })[0]).toHaveAttribute(
        "href",
        "/auth/talentarbor/start?next=/practice",
    );
    expect(screen.getAllByRole("link", { name: /review dashboard/i })[0]).toHaveAttribute(
        "href",
        "/auth/talentarbor/start?next=/dashboard",
    );
});
