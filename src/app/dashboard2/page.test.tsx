import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import Dashboard2Page from "./page";

it("renders the candidate V2 dashboard shell", () => {
    render(<Dashboard2Page />);

    expect(screen.getByRole("heading", { name: "Dashboard V2" })).toBeInTheDocument();
    expect(screen.getByText(/rebuilt Coach Plan dashboard/i)).toBeInTheDocument();
});
