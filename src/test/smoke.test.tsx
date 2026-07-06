import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import HomePage from "@/app/page";

it("renders the cleanroom scaffold home page", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "Cleanroom scaffold" })).toBeInTheDocument();
    expect(screen.getByText(/brought in slice by slice/i)).toBeInTheDocument();
});
