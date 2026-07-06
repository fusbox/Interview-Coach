import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import HomePage from "@/app/page";

it("renders the restored v1 root page", () => {
    render(<HomePage />);

    expect(
        screen.getByRole("heading", {
            name: "Interview practice that gets you in quickly and guides you forward.",
        }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Beyond scores, coaching that helps you grow." })).toBeInTheDocument();
});
