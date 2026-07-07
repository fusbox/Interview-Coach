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
    expect(screen.getByText("Connect to better interview prep")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /for job seekers/i })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /for job seekers/i })[0]).toHaveAttribute(
        "href",
        "https://talentarbor.com/job-seeker",
    );
    expect(screen.getAllByRole("link", { name: /for employers/i })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /for employers/i })[0]).toHaveAttribute(
        "href",
        "https://rangam.com/employers",
    );
    expect(screen.queryByRole("link", { name: /visit talentarbor/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /visit rangam/i })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "TalentArbor" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Rangam" })).toBeInTheDocument();
});

it("keeps public product claims candidate-safe", () => {
    render(<Home />);

    expect(screen.getByText(/practice with coaching, not a score/i)).toBeInTheDocument();
    expect(screen.getByText(/smart coaching for everyone/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Built to be flexible, designed for you." })).toBeInTheDocument();
    expect(screen.getByText(/coaching, not scoring/i)).toBeInTheDocument();
    expect(screen.getByText(/practice on your own terms/i)).toBeInTheDocument();
    expect(screen.getByText(/built for many kinds of work/i)).toBeInTheDocument();
    expect(screen.getByText(/learn what the question is really asking/i)).toBeInTheDocument();
    expect(screen.getByText(/no candidate score/i)).toBeInTheDocument();
    expect(screen.getByText(/all job types/i)).toBeInTheDocument();
    expect(screen.getByText(/for preparation, not hiring decisions/i)).toBeInTheDocument();
    expect(screen.getAllByText(/not used to make hiring decisions/i)).toHaveLength(2);
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
