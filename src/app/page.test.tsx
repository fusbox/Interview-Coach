import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import Home from "./page";

it("renders the public Interview Coach gateway", () => {
    render(<Home />);

    expect(
        screen.getByRole("heading", {
            level: 1,
            name: "Interview Coach",
        }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "TalentArbor Interview Coach" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Employee login" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: /visit talentarbor/i })).toHaveAttribute(
        "href",
        "https://talentarbor.com/job-seeker",
    );
    expect(screen.getByRole("link", { name: /visit rangam/i })).toHaveAttribute(
        "href",
        "https://rangam.com/employers",
    );
    expect(screen.getByRole("img", { name: "TalentArbor" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Rangam" })).toBeInTheDocument();
});

it("keeps public product claims candidate-safe", () => {
    render(<Home />);

    expect(screen.getByText(/built for preparation, not hiring decisions/i)).toBeInTheDocument();
    expect(screen.getByText(/candidate-led practice content is for preparation and review/i)).toBeInTheDocument();
    expect(screen.getByText(/resume content is optional/i)).toBeInTheDocument();
});

it("renders the TalentArbor policy footer", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
        "href",
        "https://talentarbor.com/privacy-policy",
    );
    expect(screen.getByRole("link", { name: "Cookie Policy" })).toHaveAttribute(
        "href",
        "https://talentarbor.com/cookie-policy",
    );
    expect(screen.getByRole("link", { name: "Terms of Use" })).toHaveAttribute(
        "href",
        "https://talentarbor.com/terms-of-use",
    );
    expect(screen.getByRole("link", { name: "Responsible AI Statement" })).toHaveAttribute(
        "href",
        "https://talentarbor.com/ResponsibleAIStatement",
    );
    expect(screen.getByText("A product of")).toBeInTheDocument();
    expect(screen.getByText(/2026 Rangam Consultants Inc/i)).toBeInTheDocument();
});
