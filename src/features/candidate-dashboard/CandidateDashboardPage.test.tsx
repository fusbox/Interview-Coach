import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { getBasicAccessibilityViolations } from "@/test/accessibility";
import { CandidateDashboardPage } from "./CandidateDashboardPage";
import type { CandidateDashboardModel } from "@/lib/server/candidate";

const baseModel: CandidateDashboardModel = {
    candidate: {
        candidateProfileId: "profile-1",
        displayName: "Candidate One",
        email: "candidate@example.com",
    },
    stats: {
        activeCount: 1,
        completedCount: 1,
        totalPracticeCount: 2,
    },
    selectedTargetInterviewId: "qa analyst",
    targetInterviews: [
        {
            id: "qa analyst",
            label: "QA Analyst",
            href: "/dashboard?targetRole=qa%20analyst",
            isSelected: true,
            activeCount: 1,
            completedCount: 0,
        },
        {
            id: "support lead",
            label: "Support Lead",
            href: "/dashboard?targetRole=support%20lead",
            isSelected: false,
            activeCount: 0,
            completedCount: 1,
        },
    ],
    activeItems: [
        {
            practiceDraftId: "draft-1",
            roleProfileId: "role-profile-1",
            roleContextLabel: "Role context saved",
            title: "QA Analyst",
            statusLabel: "In progress",
            progressLabel: "1 of 3 answered",
            href: "/session/session-1",
            lastActivityLabel: "May 12, 2026",
            lastActivityAt: Date.parse("2026-05-12T00:00:00.000Z"),
            prepProfile: {
                prepProfileId: "role-profile-1",
                primarySignal: {
                    label: "Make the answer easy to follow",
                    state: "emerging",
                },
                signals: [
                    {
                        prepProfileId: "role-profile-1",
                        signalId: "content:structural_clarity",
                        label: "Make the answer easy to follow",
                        lane: "interview_structure",
                        evidenceState: "emerging",
                        evidenceCounts: {
                            not_practiced: 0,
                            emerging: 1,
                            clear: 0,
                            strong: 0,
                        },
                        priority: "primary",
                        sourceRefs: [
                            {
                                type: "content_pulse",
                                id: "question-1",
                                label: "Structure the answer",
                                excerpt: "The answer needs a clearer beginning, middle, and end.",
                            },
                        ],
                    },
                    {
                        prepProfileId: "role-profile-1",
                        signalId: "content:specificity_concreteness",
                        label: "Use concrete examples",
                        lane: "answer_substance",
                        evidenceState: "not_practiced",
                        evidenceCounts: {
                            not_practiced: 1,
                            emerging: 0,
                            clear: 0,
                            strong: 0,
                        },
                        priority: "supporting",
                        sourceRefs: [
                            {
                                type: "question",
                                id: "question-2",
                                label: "Specificity",
                                excerpt: "Practice adding concrete details to this target interview.",
                            },
                        ],
                    },
                ],
                categoryCards: [
                    {
                        categoryId: "behavioral",
                        label: "Behavioral",
                        questionCount: 1,
                        evidenceState: "clear",
                        averageScore: 3,
                        sourceRefs: [],
                    },
                    {
                        categoryId: "screening",
                        label: "Screening",
                        questionCount: 1,
                        evidenceState: "emerging",
                        averageScore: 1.8,
                        sourceRefs: [],
                    },
                ],
                signalCounts: {
                    not_practiced: 2,
                    emerging: 1,
                    clear: 1,
                    strong: 1,
                },
                recommendation: {
                    label: "Resume QA Analyst",
                    reason: "You have an unfinished practice round for this target interview.",
                    source: "unfinished_session",
                    href: "/session/session-1",
                },
            },
        },
    ],
    completedItems: [
        {
            practiceDraftId: "draft-2",
            roleProfileId: null,
            roleContextLabel: "Role context from practice history",
            title: "Support Lead",
            statusLabel: "Completed",
            progressLabel: "2 of 2 answered",
            href: "/summary/session-2",
            repeatHref: "/practice",
            lastActivityLabel: "May 11, 2026",
            lastActivityAt: Date.parse("2026-05-11T00:00:00.000Z"),
            summarySnippet: "Clearer answers and stronger examples.",
        },
    ],
    nextBestAction: {
        title: "Resume QA Analyst",
        body: "You have 1 of 3 answered. Pick up this active practice before starting another round.",
        href: "/session/session-1",
        actionLabel: "Resume practice",
    },
};

describe("CandidateDashboardPage", () => {
    it("renders the preparedness-map dashboard and opens a signal drilldown", async () => {
        const user = userEvent.setup();

        render(<CandidateDashboardPage dashboard={baseModel} />);

        expect(screen.queryByRole("link", { name: /back to overview/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: /welcome back/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("region", { name: /practice momentum/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("region", { name: /resume-to-role bridge/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("region", { name: /recommended practice path/i })).not.toBeInTheDocument();

        expect(screen.getByRole("heading", { name: "QA Analyst", level: 2 })).toBeInTheDocument();
        expect(screen.queryByText("Target interview")).not.toBeInTheDocument();
        expect(screen.getByRole("navigation", { name: /target interviews/i })).toHaveTextContent("QA Analyst");
        expect(screen.getByRole("link", { name: /support lead/i })).toHaveAttribute("href", "/dashboard?targetRole=support%20lead");
        expect(screen.getByRole("region", { name: /preparedness map/i })).toHaveTextContent("How your answers are shaping up");
        expect(screen.getByRole("tab", { name: /quick view/i })).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("button", { name: /open structure details/i })).toHaveTextContent("Structure");

        await user.click(screen.getByRole("tab", { name: /details/i }));

        expect(screen.getByRole("button", { name: /^interview structure$/i })).toHaveTextContent("Structure");
        expect(screen.getByRole("button", { name: /^answer substance$/i })).toHaveTextContent("Substance");
        expect(screen.getByRole("button", { name: /^interview structure$/i })).not.toHaveTextContent("Emerging");
        expect(screen.queryByRole("button", { name: /interview range/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("region", { name: /question coverage/i })).not.toBeInTheDocument();
        expect(screen.getAllByRole("button", { name: /behavioral/i }).length).toBeGreaterThan(0);
        expect(screen.getAllByRole("button", { name: /screening/i }).length).toBeGreaterThan(0);
        expect(screen.getByRole("region", { name: /practice next/i })).toHaveTextContent("Resume QA Analyst");
        expect(screen.getByRole("link", { name: /resume practice/i })).toHaveAttribute("href", "/session/session-1");

        await user.click(screen.getByRole("button", { name: /^interview structure$/i }));

        expect(screen.getByRole("dialog", { name: /interview structure/i })).toHaveTextContent("Why this matters");
        expect(screen.getByRole("dialog", { name: /interview structure/i })).toHaveTextContent("Tap/click any card below to see coach guidance.");
        expect(screen.getByRole("dialog", { name: /interview structure/i })).not.toHaveTextContent("What your practice shows");
        expect(screen.getByRole("dialog", { name: /interview structure/i })).not.toHaveTextContent("How to use this");
        expect(screen.getByRole("dialog", { name: /interview structure/i })).toHaveTextContent("The answer needs a clearer beginning");
        expect(screen.queryByRole("link", { name: /practice this area/i })).not.toBeInTheDocument();
    });

    it("renders an empty state with a start-practice action", () => {
        render(<CandidateDashboardPage dashboard={{
            ...baseModel,
            stats: {
                activeCount: 0,
                completedCount: 0,
                totalPracticeCount: 0,
            },
            activeItems: [],
            completedItems: [],
            nextBestAction: {
                title: "Start with a target role",
                body: "Create a lightweight practice setup when you know what role you want to prepare for.",
                href: "/practice",
                actionLabel: "Start practice",
            },
        }} />);

        expect(screen.getByRole("region", { name: /empty preparedness dashboard/i })).toHaveTextContent("Start with the interview you want to prepare for.");
        expect(screen.getByLabelText("Preview of your preparedness map")).toHaveTextContent("Preparedness map preview");
        expect(screen.getByLabelText("Preview of your preparedness map")).toHaveTextContent("Answer skills");
        expect(screen.getByLabelText("Preview of your preparedness map")).toHaveTextContent("Question mix");
        expect(screen.getByRole("link", { name: /create practice/i })).toHaveAttribute("href", "/practice");
        expect(screen.queryByRole("region", { name: /recommended practice path/i })).not.toBeInTheDocument();
    });

    it("surfaces completed-session coaching snippets in the history card", () => {
        render(<CandidateDashboardPage dashboard={{
            ...baseModel,
            stats: {
                activeCount: 0,
                completedCount: 1,
                totalPracticeCount: 1,
            },
            activeItems: [],
            completedItems: [
                {
                    ...baseModel.completedItems[0],
                    coachingSnippet: "Lead with the measurable result before the process detail.",
                },
            ],
            nextBestAction: {
                title: "Practice the latest coaching signal",
                body: "Use the latest feedback as the focus for your next round.",
                href: "/practice",
                actionLabel: "Start focused practice",
            },
        }} />);

        expect(screen.getByRole("region", { name: /recent activity/i })).toHaveTextContent(
            "Lead with the measurable result before the process detail.",
        );
        expect(screen.getByRole("region", { name: /practice next/i })).toHaveTextContent("Practice the latest coaching signal");
    });

    it("lists the upcoming questions from an active practice plan in Practice Next", () => {
        render(<CandidateDashboardPage dashboard={{
            ...baseModel,
            activeItems: [
                {
                    ...baseModel.activeItems[0],
                    prepProfile: {
                        ...baseModel.activeItems[0].prepProfile!,
                        signals: [],
                        categoryCards: [
                            {
                                categoryId: "behavioral",
                                label: "Behavioral",
                                questionCount: 2,
                                practicedQuestionCount: 1,
                                upcomingQuestionCount: 1,
                                questionStatuses: [
                                    { questionId: "question-1", questionNumber: 1, status: "practiced" },
                                    { questionId: "question-2", questionNumber: 2, status: "upcoming" },
                                ],
                                evidenceState: "strong",
                                sourceRefs: [],
                            },
                            {
                                categoryId: "screening",
                                label: "Screening",
                                questionCount: 1,
                                practicedQuestionCount: 0,
                                upcomingQuestionCount: 1,
                                questionStatuses: [
                                    { questionId: "question-3", questionNumber: 3, status: "upcoming" },
                                ],
                                evidenceState: "not_practiced",
                                sourceRefs: [],
                            },
                        ],
                    },
                },
            ],
        }} />);

        const practiceNext = screen.getByRole("region", { name: /practice next/i });
        expect(practiceNext).toHaveTextContent("Upcoming practice items");
        expect(practiceNext).toHaveTextContent("Q2: Behavioral");
        expect(practiceNext).toHaveTextContent("Q3: Screening");
    });

    it("labels focused coaching snippets distinctly from generic notes", () => {
        render(<CandidateDashboardPage dashboard={{
            ...baseModel,
            completedItems: [
                {
                    ...baseModel.completedItems[0],
                    coachingSnippetLabel: "For the biggest lift",
                    coachingSnippet: "Lead with the result: I helped the team finish early.",
                },
            ],
            nextBestAction: {
                title: "Practice the biggest lift",
                body: "From your Support Lead feedback: Lead with the result. Try: I helped the team finish early.",
                href: "/practice",
                actionLabel: "Practice again",
            },
        }} />);

        expect(screen.getByRole("region", { name: /practice next/i })).toHaveTextContent("Practice the biggest lift");
        expect(screen.getByRole("region", { name: /recent activity/i })).toHaveTextContent("For the biggest lift");
        expect(screen.getByRole("region", { name: /recent activity/i })).toHaveTextContent("Lead with the result");
    });

    it("extends its background surface to the candidate content frame edges", () => {
        const { container } = render(<CandidateDashboardPage dashboard={baseModel} />);

        expect(container.firstElementChild).toHaveClass("-mx-4");
        expect(container.firstElementChild).toHaveClass("-mt-4");
        expect(container.firstElementChild).toHaveClass("lg:-mx-10");
        expect(container.firstElementChild).toHaveClass("lg:-mt-10");
    });

    it("meets the candidate primary-page accessibility baseline", () => {
        const { container } = render(<CandidateDashboardPage dashboard={baseModel} />);

        expect(getBasicAccessibilityViolations(container)).toEqual([]);
    });
});
