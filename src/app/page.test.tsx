import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { expect, it } from "vitest";
import Home from "./page";
import {
    CANDIDATE_LOGIN_HREF,
    CANDIDATE_REGISTER_HREF,
    EMPLOYER_DEMO_HREF,
    EMPLOYER_HREF,
    JOB_SEEKER_HREF,
} from "@/features/marketing-home-v2/MarketingHomePage";
import { selectLabChapterBeat } from "@/features/marketing-home-v2/LabChapter";

it("renders the marketing Interview Coach home", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { level: 1, name: /practice with a coach, not a score/i })).toBeInTheDocument();
    expect(screen.getByText("Interview Coach", { selector: ".marketing-hero__brand" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "TalentArbor Interview Coach" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Employee login" })).toHaveAttribute("href", "/login");
});

it("states interview-domain expertise and next-practice clarity in the lede", () => {
    render(<Home />);

    expect(
        screen.getByText(/interview-domain expertise shapes every question and every coaching note/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/know what to practice next/i)).toBeInTheDocument();
});

it("routes candidate practice CTAs to registration and sign-in", () => {
    render(<Home />);

    expect(screen.getAllByRole("link", { name: /start practicing/i })[0]).toHaveAttribute(
        "href",
        CANDIDATE_REGISTER_HREF,
    );
    expect(screen.getByRole("link", { name: /create account/i })).toHaveAttribute(
        "href",
        CANDIDATE_REGISTER_HREF,
    );
    expect(screen.getAllByRole("link", { name: /^sign in$/i })[0]).toHaveAttribute(
        "href",
        CANDIDATE_LOGIN_HREF,
    );
});

it("presents equal job-seeker and employer audience columns", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: /^job seekers$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^employers$/i })).toBeInTheDocument();

    const audience = screen.getByRole("article", { name: /job seekers/i });
    expect(audience.querySelector(`a[href="${CANDIDATE_LOGIN_HREF}"]`)).toHaveTextContent(/sign in/i);
    expect(audience.querySelector(`a[href="${CANDIDATE_REGISTER_HREF}"]`)).toHaveTextContent(/start practicing/i);
    expect(screen.getByRole("link", { name: /talentarbor for job seekers/i })).toHaveAttribute("href", JOB_SEEKER_HREF);

    expect(screen.getByRole("link", { name: /rangam for employers/i })).toHaveAttribute("href", EMPLOYER_HREF);
    expect(screen.getByRole("link", { name: /request a demo/i })).toHaveAttribute("href", EMPLOYER_DEMO_HREF);
});

it("keeps public product claims candidate-safe", () => {
    render(<Home />);

    expect(screen.getByText(/start from the interview in front of you/i)).toBeInTheDocument();
    expect(screen.getByText(/strengthen one answer at a time/i)).toBeInTheDocument();
    expect(screen.getByText(/carry the coaching into your next practice/i)).toBeInTheDocument();
    expect(screen.getByText(/walk in knowing what this interview will ask/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /your practice stays yours/i })).toBeInTheDocument();
    expect(screen.getByText(/not for hiring decisions/i)).toBeInTheDocument();
    expect(screen.getAllByText(/not used to make hiring decisions/i).length).toBeGreaterThanOrEqual(1);
});

it("lets visitors step through prepare chapter stages", async () => {
    render(<Home />);

    const prepare = document.getElementById("prepare");
    expect(prepare).not.toBeNull();
    const chapter = within(prepare as HTMLElement);

    expect(chapter.getByRole("heading", { name: /^prepare$/i })).toBeInTheDocument();
    expect(chapter.getByText(/what are you interviewing for/i)).toBeInTheDocument();
    expect(
        chapter.getByText(/tell us what you’re interviewing for/i, { selector: ".lab-chapter__beat-title" }),
    ).toBeInTheDocument();
    expect(screen.getByText("How it works", { selector: ".lab-intro__hiw-title" })).toBeInTheDocument();
    expect(screen.getByText("How it works", { selector: ".lab-hiw-dock__title" })).toBeInTheDocument();

    await act(async () => {
        selectLabChapterBeat("prepare", 1);
    });
    expect(await chapter.findByText(/your practice is ready/i)).toBeInTheDocument();
    expect(chapter.getByText(/question plan/i)).toBeInTheDocument();
});

it("lets visitors open Session Mobile A coaching assists", async () => {
    const user = userEvent.setup();
    render(<Home />);

    expect(screen.getByRole("heading", { name: /resolved a conflict on your team/i })).toBeInTheDocument();

    await user.click(screen.getByTitle("Hints"));
    expect(screen.getByText(/use the star method/i)).toBeInTheDocument();
    expect(screen.getByTitle("Hints")).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByTitle("Strong response framework"));
    expect(screen.getByText(/canonical target structure/i)).toBeInTheDocument();
    expect(screen.getByTitle("Strong response framework")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTitle("Hints")).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByLabelText(/close coaching drawer/i));
    expect(screen.getByTitle("Hints")).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByTitle("Voice answer"));
    expect(screen.getByText(/tap to record/i)).toBeInTheDocument();
    expect(screen.getByTitle("Text answer")).toBeInTheDocument();
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
