import { render, screen, within } from "@testing-library/react";
import { act } from "react";
import { expect, it } from "vitest";

import { interviewCoachBrand } from "@/features/brand-v2/interview-coach-brand";
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
    expect(screen.getByRole("link", {
        name: `${interviewCoachBrand.displayName} Interview Coach`,
    })).toHaveAttribute("href", "/");
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

    const heroActions = document.querySelector(".marketing-hero__actions");
    expect(heroActions).not.toBeNull();
    expect(within(heroActions as HTMLElement).getByRole("link", { name: /start practicing/i })).toHaveAttribute(
        "href",
        "/candidate/register",
    );
    expect(within(heroActions as HTMLElement).getByRole("link", { name: /create account/i })).toHaveAttribute(
        "href",
        "/candidate/register",
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
    expect(prepare).toHaveClass("is-handoff-pending");
    const chapter = within(prepare as HTMLElement);

    // Prepare stays inert until HIW docks; content is in the DOM but not exposed yet.
    expect(chapter.getByText("01", { selector: ".lab-chapter__index" })).toBeInTheDocument();
    expect(chapter.getByText(/^prepare$/i, { selector: ".lab-chapter__label" })).toBeInTheDocument();
    expect(chapter.getByAltText(/practice setup with role/i)).toBeInTheDocument();
    expect(
        chapter.getByText(/tell us what you’re interviewing for/i, { selector: ".lab-chapter__beat-title" }),
    ).toBeInTheDocument();
    expect(screen.getByText("How it works", { selector: ".lab-intro__hiw-title" })).toBeInTheDocument();
    expect(screen.getByText("How it works", { selector: ".lab-hiw-dock__title" })).toBeInTheDocument();
    const chapterNavigation = screen.getByRole("navigation", { name: "How it works chapters", hidden: true });
    expect(within(chapterNavigation).getByRole("link", { name: "Prepare", hidden: true })).toHaveAttribute("href", "#prepare");
    expect(within(chapterNavigation).getByRole("link", { name: "Practice", hidden: true })).toHaveAttribute("href", "#practice");
    expect(within(chapterNavigation).getByRole("link", { name: "Improve", hidden: true })).toHaveAttribute("href", "#improve");

    const prepareSteps = prepare?.querySelector<HTMLElement>(".lab-chapter__meter");
    expect(prepareSteps).not.toBeNull();
    const setUpStep = within(prepareSteps as HTMLElement).getByText("Set up").closest("button");
    const getReadyStep = within(prepareSteps as HTMLElement).getByText("Get ready").closest("button");
    expect(setUpStep).toHaveAttribute("aria-current", "step");
    await act(async () => {
        getReadyStep?.click();
    });
    expect(getReadyStep).toHaveAttribute("aria-current", "step");

    await act(async () => {
        selectLabChapterBeat("prepare", 1);
    });
    expect(await chapter.findByAltText(/pre-session landing/i)).toBeInTheDocument();
});

it("uses current product captures throughout the practice chapter", async () => {
    render(<Home />);

    const practice = document.getElementById("practice");
    expect(practice).not.toBeNull();
    const chapter = within(practice as HTMLElement);
    expect(chapter.getByAltText(/live interview practice/i)).toBeInTheDocument();

    await act(async () => {
        selectLabChapterBeat("practice", 1);
    });
    expect(await chapter.findByAltText(/post-answer coaching/i)).toBeInTheDocument();
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
