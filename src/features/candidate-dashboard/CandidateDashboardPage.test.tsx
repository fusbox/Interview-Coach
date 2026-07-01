import { fireEvent, render, screen } from "@testing-library/react";
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
            practicedQuestionCount: 1,
            plannedQuestionCount: 3,
            lastPracticedAt: Date.parse("2026-05-12T14:00:00.000Z"),
            prepState: "emerging",
        },
        {
            id: "support lead",
            label: "Support Lead",
            href: "/dashboard?targetRole=support%20lead",
            isSelected: false,
            activeCount: 0,
            completedCount: 1,
            practicedQuestionCount: 2,
            plannedQuestionCount: 2,
            lastPracticedAt: Date.parse("2026-05-11T14:00:00.000Z"),
            prepState: "clear",
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

        expect(screen.getByRole("heading", { name: "Interview Coach", level: 1 })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Interview Coach", level: 1 })).toHaveClass("text-[rgb(var(--candidate-foreground)/0.84)]");
        const header = screen.getByRole("banner", { name: /dashboard header/i });
        expect(header).toHaveClass("fixed");
        expect(header).not.toHaveClass("border-b");
        expect(header).not.toHaveClass("backdrop-blur-xl");
        expect(header).toHaveClass("bg-gradient-to-b");
        expect(screen.getByRole("button", { name: /next practice round/i })).toHaveClass("w-full");
        expect(screen.queryByRole("heading", { name: "QA Analyst", level: 2 })).not.toBeInTheDocument();
        expect(screen.queryByText("Target interview")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /switch interview prep context/i })).toHaveTextContent("QA Analyst");
        expect(screen.getByLabelText("1 of 3 questions practiced")).toHaveAttribute("data-prep-state", "emerging");
        expect(screen.getByRole("button", { name: /switch interview prep context/i })).not.toHaveTextContent("1/3");
        expect(screen.queryByText("1 active")).not.toBeInTheDocument();
        expect(screen.queryByText("1 completed")).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: /switch interview prep context/i }));
        expect(screen.getByRole("dialog", { name: /interview prep contexts/i })).toHaveTextContent("Support Lead");
        expect(screen.getByRole("link", { name: /support lead/i })).toHaveAttribute("href", "/dashboard?targetRole=support%20lead");
        expect(screen.getByRole("link", { name: /prep for a new role/i })).toHaveAttribute("href", "/practice");
        expect(screen.getByRole("region", { name: /preparedness map/i })).toHaveTextContent("How your answers are shaping up");
        expect(screen.getByRole("tab", { name: /quick view/i })).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("button", { name: /open structure details/i })).toBeInTheDocument();

        fireEvent.mouseDown(screen.getByRole("button", { name: /open structure details/i }));

        expect(screen.getByRole("dialog", { name: /interview structure/i })).toHaveTextContent("Why this matters");
        await user.click(screen.getByRole("button", { name: /close/i }));

        fireEvent.mouseDown(screen.getByRole("button", { name: /open flow details/i }));

        expect(screen.getByRole("dialog", { name: /interview structure/i })).toHaveTextContent("Why this matters");
        await user.click(screen.getByRole("button", { name: /close/i }));

        fireEvent.mouseDown(screen.getByRole("button", { name: /open behavioral.*details/i }));

        expect(screen.getByRole("dialog", { name: /behavioral/i })).toHaveTextContent("Interviewers look for a clear situation");
        await user.click(screen.getByRole("button", { name: /close/i }));

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

    it("renders Coach Plan framing and a qualitative preparedness target", () => {
        render(<CandidateDashboardPage dashboard={{
            ...baseModel,
            activeItems: [],
            completedItems: [
                {
                    ...baseModel.completedItems[0],
                    title: "Client Services Executive - WWT",
                    progressLabel: "3 of 3 answered",
                    practiceCoverageBaseline: {
                        interviewStage: "follow_up_final",
                        minimumQuestionCount: 5,
                        categoryMinimums: {
                            screening: 0,
                            behavioral: 1,
                            culture_fit: 1,
                            case_scenario: 1,
                            technical_role_specific: 2,
                        },
                    },
                    prepProfile: {
                        prepProfileId: "role-profile-2",
                        primarySignal: {
                            label: "Make the client impact visible",
                            state: "clear",
                        },
                        signals: [],
                        categoryCards: [
                            {
                                categoryId: "behavioral",
                                label: "Behavioral",
                                questionCount: 1,
                                practicedQuestionCount: 1,
                                upcomingQuestionCount: 0,
                                evidenceState: "clear",
                                averageScore: 3.2,
                                sourceRefs: [],
                            },
                            {
                                categoryId: "culture_fit",
                                label: "Culture / Fit",
                                questionCount: 1,
                                practicedQuestionCount: 1,
                                upcomingQuestionCount: 0,
                                evidenceState: "emerging",
                                averageScore: 2.4,
                                sourceRefs: [],
                            },
                            {
                                categoryId: "technical_role_specific",
                                label: "Technical / Role-Specific",
                                questionCount: 1,
                                practicedQuestionCount: 1,
                                upcomingQuestionCount: 0,
                                evidenceState: "strong",
                                averageScore: 4.2,
                                sourceRefs: [],
                            },
                        ],
                        signalCounts: {
                            not_practiced: 0,
                            emerging: 1,
                            clear: 1,
                            strong: 1,
                        },
                        recommendation: {
                            label: "Practice the biggest lift",
                            reason: "Make the client impact visible.",
                            source: "session_summary",
                            href: "/practice",
                        },
                    },
                },
            ],
        }} />);

        const coachPlan = screen.getByRole("region", { name: /^coach plan$/i });
        expect(coachPlan).toHaveTextContent("Coach Plan");
        expect(coachPlan).toHaveTextContent("Client Services Executive - WWT");
        expect(coachPlan).toHaveTextContent("Final interview");
        expect(coachPlan).toHaveTextContent("5-question baseline");
        expect(coachPlan).toHaveTextContent("3/5 practiced");
        expect(coachPlan).toHaveTextContent("Current read");
        expect(coachPlan).toHaveTextContent("Clear");
        expect(screen.getByRole("img", { name: /preparedness gauge: clear, 3 of 5 practiced, 60% complete/i })).toBeInTheDocument();
        expect(screen.getByText("3/5")).toBeInTheDocument();
        expect(coachPlan).toHaveTextContent("You've practiced 3 of the 5 questions I've recommended.");
        expect(coachPlan).toHaveTextContent("I see clear evidence that you're well on your way to being fully prepared.");
        expect(coachPlan).toHaveTextContent("This plan covers the question range your coach expects for this interview.");
    });

    it("opens question-by-question Coach Update feedback from latest practice", async () => {
        const user = userEvent.setup();

        render(<CandidateDashboardPage dashboard={{
            ...baseModel,
            activeItems: [],
            completedItems: [{
                ...baseModel.completedItems[0],
                title: "Client Services Executive - WWT",
                coachingSnippetLabel: "For the biggest lift",
                coachingSnippet: "Make the client impact visible: That helped the client understand the next step and reduced repeat follow-up.",
                lastActivityAt: Date.parse("2026-06-26T15:30:00.000Z"),
                prepProfile: {
                    prepProfileId: "role-profile-2",
                    primarySignal: {
                        label: "Make the client impact visible",
                        state: "clear",
                    },
                    signals: [],
                    categoryCards: [
                        {
                            categoryId: "behavioral",
                            label: "Behavioral",
                            questionCount: 1,
                            practicedQuestionCount: 1,
                            upcomingQuestionCount: 0,
                            evidenceState: "clear",
                            averageScore: 3.2,
                            questionStatuses: [
                                { questionId: "question-1", questionNumber: 1, status: "practiced" },
                            ],
                            sourceRefs: [
                                {
                                    type: "answer",
                                    id: "question-1",
                                    label: "Behavioral",
                                    questionText: "Tell me about a client issue you resolved.",
                                    answerTranscript: "I helped the client understand the next step and reduced repeat follow-up.",
                                    answerModality: "voice",
                                    answerSubmittedAt: Date.parse("2026-06-26T15:30:00.000Z"),
                                    sessionId: "session-2",
                                    sessionTitle: "Client Services Executive - WWT",
                                    sessionSortAt: Date.parse("2026-06-26T15:30:00.000Z"),
                                    excerpt: "I helped the client understand the next step.",
                                    evaluation: "Behavioral feedback: You gave a relevant client example. For the biggest lift: Make the client impact visible. Try: I reduced repeat follow-up while we resolved the billing issue. Next step: Keep the story tied to what changed for the client.",
                                },
                            ],
                        },
                    ],
                    signalCounts: {
                        not_practiced: 0,
                        emerging: 1,
                        clear: 1,
                        strong: 1,
                    },
                    recommendation: {
                        label: "Practice delivery clarity",
                        reason: "Make the client impact easier to hear.",
                        source: "answer_feedback",
                        href: "/practice",
                    },
                },
            }],
            nextBestAction: {
                title: "Practice delivery clarity",
                body: "Make the client impact easier to hear.",
                href: "/practice",
                actionLabel: "Practice again",
            },
        }} />);

        const coachUpdate = screen.getByRole("button", { name: /open coach update/i });
        expect(coachUpdate).toHaveTextContent("I have a new read from your latest practice.");
        expect(coachUpdate).toHaveTextContent("I reviewed your latest practice.");
        expect(coachUpdate).not.toHaveTextContent("Make the client impact visible");

        await user.click(coachUpdate);

        const dialog = screen.getByRole("dialog", { name: /coach update/i });
        expect(dialog).toHaveTextContent("I reviewed your latest practice. Here's what stood out.");
        expect(dialog).not.toHaveTextContent("Quick markers");
        expect(screen.queryByText(/^Question$/i)).not.toBeInTheDocument();
        expect(dialog).toHaveTextContent("Tell me about a client issue you resolved.");
        expect(screen.queryByText(/^Your answer$/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/^Voice response$/i)).not.toBeInTheDocument();
        expect(dialog).toHaveTextContent("I helped the client understand the next step and reduced repeat follow-up.");
        expect(screen.getByLabelText(/question prompt/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/candidate answer/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/voice response mode/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/coach observation/i)).toHaveTextContent("You gave a relevant client example.");
        expect(screen.getByLabelText(/coach observation/i)).toHaveTextContent("Make the client impact visible");
        expect(screen.queryByLabelText(/coach guidance/i)).not.toBeInTheDocument();
        expect(dialog).toHaveTextContent("Make the client impact visible");
        await user.click(screen.getByRole("button", { name: /add this to my next round/i }));
        expect(screen.getByRole("button", { name: /added/i })).toHaveAttribute("aria-pressed", "true");
        expect(screen.queryByRole("link", { name: /skip to recommendation/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /not now/i })).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /close/i }));
        await user.click(screen.getByRole("button", { name: /open q1 question detail/i }));

        const questionDialog = screen.getByRole("dialog", { name: /q1 question detail/i });
        expect(questionDialog).toHaveTextContent("Tell me about a client issue you resolved.");
        expect(screen.getByRole("button", { name: /added/i })).toHaveAttribute("aria-pressed", "true");

        await user.click(screen.getByRole("button", { name: /close/i }));
        await user.click(screen.getByRole("button", { name: /next practice round/i }));

        const nextRound = screen.getByRole("dialog", { name: /next practice round/i });
        expect(nextRound).toHaveTextContent("Tell me about a client issue you resolved.");
        expect(nextRound).toHaveTextContent("Behavioral");

        await user.click(screen.getByRole("button", { name: /remove q1 from next practice round/i }));

        expect(screen.queryByRole("dialog", { name: /next practice round/i })).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: /open q1 question detail/i }));
        expect(screen.getByRole("button", { name: /add this to my next round/i })).toHaveAttribute("aria-pressed", "false");
    });

    it("resets the local next-round queue when the selected prep context changes", async () => {
        const user = userEvent.setup();
        const { rerender } = render(<CandidateDashboardPage dashboard={baseModel} />);

        await user.click(screen.getAllByRole("button", { name: /open q1 question detail/i })[1]);
        await user.click(screen.getByRole("button", { name: /add this to my next round/i }));

        expect(screen.getByRole("button", { name: /next practice round/i })).toHaveTextContent("1");

        rerender(<CandidateDashboardPage dashboard={{
            ...baseModel,
            selectedTargetInterviewId: "support lead",
            targetInterviews: baseModel.targetInterviews.map((targetInterview) => ({
                ...targetInterview,
                isSelected: targetInterview.id === "support lead",
            })),
            activeItems: [],
            completedItems: [
                {
                    ...baseModel.completedItems[0],
                    prepProfile: {
                        prepProfileId: "role-profile-2",
                        primarySignal: {
                            label: "Make the client impact visible",
                            state: "clear",
                        },
                        signals: [],
                        categoryCards: [
                            {
                                categoryId: "behavioral",
                                label: "Behavioral",
                                questionCount: 1,
                                practicedQuestionCount: 1,
                                upcomingQuestionCount: 0,
                                evidenceState: "clear",
                                averageScore: 3.2,
                                questionStatuses: [
                                    { questionId: "support-question-1", questionNumber: 1, status: "practiced" },
                                ],
                                sourceRefs: [
                                    {
                                        type: "answer",
                                        id: "support-question-1",
                                        label: "Behavioral",
                                        questionText: "Tell me about coaching an escalated account.",
                                        answerTranscript: "I aligned the team and kept the customer informed.",
                                        answerModality: "voice",
                                        excerpt: "I aligned the team and kept the customer informed.",
                                    },
                                ],
                            },
                        ],
                        signalCounts: {
                            not_practiced: 0,
                            emerging: 0,
                            clear: 1,
                            strong: 0,
                        },
                        recommendation: {
                            label: "Practice the next account story",
                            reason: "Keep the customer impact visible.",
                            source: "answer_feedback",
                            href: "/practice",
                        },
                    },
                },
            ],
        }} />);

        expect(screen.getByRole("button", { name: /switch interview prep context/i })).toHaveTextContent("Support Lead");
        expect(screen.getByRole("button", { name: /next practice round/i })).not.toHaveTextContent("1");
    });

    it("opens a teaching-first Coach Plan category sheet from the category face", async () => {
        const user = userEvent.setup();

        render(<CandidateDashboardPage dashboard={{
            ...baseModel,
            activeItems: [],
            completedItems: [
                {
                    ...baseModel.completedItems[0],
                    practiceCoverageBaseline: {
                        interviewStage: "follow_up_final",
                        minimumQuestionCount: 5,
                        categoryMinimums: {
                            screening: 0,
                            behavioral: 1,
                            culture_fit: 1,
                            case_scenario: 1,
                            technical_role_specific: 2,
                        },
                    },
                    prepProfile: {
                        prepProfileId: "role-profile-2",
                        primarySignal: {
                            label: "Make the client impact visible",
                            state: "clear",
                        },
                        signals: [],
                        categoryCards: [
                            {
                                categoryId: "behavioral",
                                label: "Behavioral",
                                questionCount: 1,
                                practicedQuestionCount: 1,
                                upcomingQuestionCount: 0,
                                evidenceState: "clear",
                                averageScore: 3.2,
                                sourceRefs: [],
                            },
                            {
                                categoryId: "case_scenario",
                                label: "Case / Scenario",
                                questionCount: 1,
                                practicedQuestionCount: 0,
                                upcomingQuestionCount: 1,
                                evidenceState: "not_practiced",
                                sourceRefs: [],
                            },
                        ],
                        signalCounts: {
                            not_practiced: 1,
                            emerging: 0,
                            clear: 1,
                            strong: 0,
                        },
                        recommendation: {
                            label: "Practice the biggest lift",
                            reason: "Make the client impact visible.",
                            source: "session_summary",
                            href: "/practice",
                        },
                    },
                },
            ],
        }} />);

        const categoryFace = screen.getByRole("region", { name: /coach plan categories/i });
        expect(categoryFace).toHaveTextContent("Question plan");
        expect(categoryFace).toHaveTextContent("Behavioral");
        expect(categoryFace).toHaveTextContent("Case / Scenario");

        await user.click(screen.getByRole("button", { name: /open behavioral category guidance/i }));

        const sheet = screen.getByRole("dialog", { name: /behavioral category guidance/i });
        expect(sheet).toHaveTextContent("Purpose");
        expect(sheet).toHaveTextContent("Interviewers look for a clear situation");
        expect(sheet).toHaveTextContent("Answer shape");
        expect(sheet).toHaveTextContent("Use a real example");
        expect(sheet).toHaveTextContent("1 planned");
        expect(sheet).toHaveTextContent("1 practiced");
    });

    it("opens a teaching-first Coach Plan skill lane sheet from the skills face", async () => {
        const user = userEvent.setup();

        render(<CandidateDashboardPage dashboard={{
            ...baseModel,
            activeItems: [],
            completedItems: [
                {
                    ...baseModel.completedItems[0],
                    prepProfile: {
                        prepProfileId: "role-profile-2",
                        primarySignal: {
                            label: "Make the client impact visible",
                            state: "clear",
                        },
                        signals: [
                            {
                                prepProfileId: "role-profile-2",
                                signalId: "content:specificity_concreteness",
                                label: "Use concrete examples",
                                lane: "answer_substance",
                                evidenceState: "clear",
                                averageScore: 3.2,
                                scoreCount: 1,
                                evidenceCounts: {
                                    not_practiced: 0,
                                    emerging: 0,
                                    clear: 1,
                                    strong: 0,
                                },
                                dimensionStates: [
                                    {
                                        dimension: "specificity_concreteness",
                                        label: "Specificity",
                                        evidenceState: "clear",
                                        averageScore: 3.2,
                                        scoreCount: 1,
                                    },
                                ],
                                priority: "primary",
                                sourceRefs: [],
                            },
                            {
                                prepProfileId: "role-profile-2",
                                signalId: "content:structural_clarity",
                                label: "Make the answer easy to follow",
                                lane: "interview_structure",
                                evidenceState: "emerging",
                                averageScore: 2.2,
                                scoreCount: 1,
                                evidenceCounts: {
                                    not_practiced: 0,
                                    emerging: 1,
                                    clear: 0,
                                    strong: 0,
                                },
                                priority: "supporting",
                                sourceRefs: [],
                            },
                        ],
                        categoryCards: [],
                        signalCounts: {
                            not_practiced: 0,
                            emerging: 1,
                            clear: 1,
                            strong: 0,
                        },
                        recommendation: {
                            label: "Practice the biggest lift",
                            reason: "Make the client impact visible.",
                            source: "session_summary",
                            href: "/practice",
                        },
                    },
                },
            ],
        }} />);

        const skillsFace = screen.getByRole("region", { name: /coach plan skills/i });
        expect(skillsFace).toHaveTextContent("Answer skills");
        expect(skillsFace).toHaveTextContent("Substance");
        expect(skillsFace).toHaveTextContent("Structure");
        expect(skillsFace).toHaveTextContent("Delivery");

        await user.click(screen.getByRole("button", { name: /open substance skill guidance/i }));

        const sheet = screen.getByRole("dialog", { name: /substance skill guidance/i });
        expect(sheet).toHaveTextContent("Purpose");
        expect(sheet).toHaveTextContent("Interviewers need answers with relevant examples");
        expect(sheet).toHaveTextContent("Dimensions");
        expect(sheet).toHaveTextContent("Focus");
        expect(sheet).toHaveTextContent("Specificity");
        expect(sheet).toHaveTextContent("Outcome");
        expect(sheet).toHaveTextContent("Rationale");
        expect(sheet).toHaveTextContent("Answer shape");
        expect(sheet).toHaveTextContent("Make the client impact visible");
    });

    it("shows answered questions by default and revealable unanswered questions in the Coach Plan question set", async () => {
        const user = userEvent.setup();

        render(<CandidateDashboardPage dashboard={{
            ...baseModel,
            activeItems: [],
            completedItems: [
                {
                    ...baseModel.completedItems[0],
                    prepProfile: {
                        prepProfileId: "role-profile-2",
                        primarySignal: {
                            label: "Make the client impact visible",
                            state: "clear",
                        },
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
                                    {
                                        questionId: "question-2",
                                        questionNumber: 2,
                                        questionText: "How would you rebuild trust with a client after a missed deadline?",
                                        status: "upcoming",
                                    },
                                ],
                                evidenceState: "clear",
                                sourceRefs: [
                                    {
                                        type: "answer",
                                        id: "question-1",
                                        label: "Behavioral",
                                        questionText: "Tell me about a customer issue you resolved.",
                                        answerTranscript: "I helped the customer understand the next step and reduced follow-up.",
                                        excerpt: "I helped the customer understand the next step.",
                                    },
                                ],
                            },
                        ],
                        signalCounts: {
                            not_practiced: 1,
                            emerging: 0,
                            clear: 1,
                            strong: 0,
                        },
                        recommendation: {
                            label: "Practice the biggest lift",
                            reason: "Make the client impact visible.",
                            source: "session_summary",
                            href: "/practice",
                        },
                    },
                },
            ],
        }} />);

        const questionSet = screen.getByRole("region", { name: /coach plan question set/i });
        expect(questionSet).toHaveTextContent("Question set");
        expect(questionSet).toHaveTextContent("Tell me about a customer issue you resolved.");
        expect(questionSet).toHaveTextContent("Answered");
        expect(questionSet).not.toHaveTextContent("Q2: Behavioral");

        await user.click(screen.getByRole("button", { name: /reveal unanswered questions/i }));

        expect(questionSet).toHaveTextContent("Q2: Behavioral");
        expect(questionSet).toHaveTextContent("How would you rebuild trust with a client after a missed deadline?");
        expect(questionSet).not.toHaveTextContent("Hidden until you choose to reveal unanswered questions.");

        await user.click(screen.getByRole("button", { name: /open q1 question detail/i }));

        const sheet = screen.getByRole("dialog", { name: /q1 question detail/i });
        expect(sheet).toHaveTextContent("Tell me about a customer issue you resolved.");
        expect(sheet).toHaveTextContent("I helped the customer understand the next step and reduced follow-up.");
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

        expect(container.firstElementChild).toHaveClass("w-screen");
        expect(container.firstElementChild).toHaveClass("-ml-[50vw]");
        expect(container.firstElementChild).toHaveClass("-mr-[50vw]");
        expect(container.firstElementChild).toHaveClass("-mt-4");
        expect(container.firstElementChild).toHaveClass("lg:-mt-10");
    });

    it("meets the candidate primary-page accessibility baseline", () => {
        const { container } = render(<CandidateDashboardPage dashboard={baseModel} />);

        expect(getBasicAccessibilityViolations(container)).toEqual([]);
    });
});
