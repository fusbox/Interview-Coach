import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
    EmptyPreparednessDashboard,
    PracticeNextCard,
    PreparednessMap,
    QuestionCategoryCoverage,
    QuestionCategoryDrilldown,
    RecentActivityList,
    SkillDrilldown,
    toQuestionCategoryCards,
    toPreparednessSkills,
    type PreparednessSkill,
} from "./CandidateDashboardComponents";
import type { CandidateDashboardItem } from "@/lib/server/candidate";

const skill: PreparednessSkill = {
    id: "specific-examples",
    label: "Specific examples",
    state: "emerging",
    evidenceCounts: {
        not_practiced: 0,
        emerging: 1,
        clear: 0,
        strong: 0,
    },
    whyItMatters: "Concrete examples help interviewers understand what you did.",
    evidence: [
        {
            type: "practice",
            content: "You described the problem clearly but did not include the result.",
        },
    ],
    nextPracticeAction: "Practice adding the outcome to your answer.",
    href: "/practice",
};

describe("candidate dashboard component set", () => {
    it("renders the preparedness map with qualitative state labels", async () => {
        const user = userEvent.setup();
        const clicked: string[] = [];

        render(<PreparednessMap skills={[skill]} onSkillClick={(id) => clicked.push(id)} />);

        const lane = screen.getByRole("button", { name: /specific examples/i });

        expect(screen.getByRole("region", { name: /preparedness map/i })).toHaveTextContent("Specific examples");
        expect(lane).toHaveTextContent("Emerging");
        expect(lane.textContent).toMatch(/^Emerging\s*Specific examples/);
        expect(lane).toHaveAttribute("data-evidence-state", "emerging");
        expect(lane).toHaveStyle({ "--preparedness-fill": "35%" });

        await user.click(screen.getByRole("button", { name: /specific examples/i }));

        expect(clicked).toEqual(["specific-examples"]);
    });

    it("renders lane fill from mixed evidence without showing numeric counts", () => {
        render(
            <PreparednessMap
                skills={[{
                    ...skill,
                    state: "clear",
                    evidenceCounts: {
                        not_practiced: 0,
                        emerging: 1,
                        clear: 0,
                        strong: 1,
                    },
                }]}
                onSkillClick={() => undefined}
            />,
        );

        const lane = screen.getByRole("button", { name: /specific examples/i });

        expect(lane).toHaveAttribute("data-evidence-state", "clear");
        expect(lane).toHaveStyle({ "--preparedness-fill": "55%" });
        expect(lane).not.toHaveTextContent("55%");
        expect(lane).not.toHaveTextContent("1/2");
    });

    it("does not render a progress fill for fully strong lanes", () => {
        render(
            <PreparednessMap
                skills={[{
                    ...skill,
                    state: "strong",
                    fillPercent: 0,
                    evidenceCounts: {
                        not_practiced: 0,
                        emerging: 0,
                        clear: 0,
                        strong: 3,
                    },
                }]}
                onSkillClick={() => undefined}
            />,
        );

        const lane = screen.getByRole("button", { name: /specific examples/i });

        expect(lane).toHaveAttribute("data-evidence-state", "strong");
        expect(lane).toHaveStyle({ "--preparedness-fill": "0%" });
    });

    it("renders a drilldown with evidence and the header instruction", () => {
        render(<SkillDrilldown skill={skill} onClose={() => undefined} />);

        const dialog = screen.getByRole("dialog", { name: /specific examples/i });
        expect(dialog).toHaveTextContent("Why this matters");
        expect(dialog).toHaveTextContent("Tap/click any card below to see coach guidance.");
        expect(dialog).not.toHaveTextContent("What your practice shows");
        expect(dialog).not.toHaveTextContent("How to use this");
        expect(screen.queryByRole("link", { name: /practice this area/i })).not.toBeInTheDocument();
    });

    it("closes the drilldown when clicking outside the panel", async () => {
        const user = userEvent.setup();
        let closeCount = 0;

        render(<SkillDrilldown skill={skill} onClose={() => closeCount += 1} />);

        await user.click(screen.getByTestId("preparedness-drilldown-backdrop"));

        expect(closeCount).toBe(1);
    });

    it("renders lane evidence as question-answer cards and opens candidate-safe evaluation copy", async () => {
        const user = userEvent.setup();

        render(
            <SkillDrilldown
                skill={{
                    ...skill,
                    evidence: [{
                        type: "practice",
                        content: "I listened, clarified, and fixed the schedule.",
                        questionText: "Tell me about a time you handled an upset client.",
                        answerTranscript: "I listened, clarified, and fixed the schedule. Then I followed up with the client so they knew exactly what changed and when the schedule would be updated.",
                        answerModality: "voice",
                        answerSubmittedAt: Date.UTC(2026, 4, 19, 15, 30),
                        evaluation: "The answer was relevant and clear, but the outcome could be more explicit. Coach signals: Focus relevance: Directly answers the question.; Specificity concreteness: Includes a specific client detail.; Outcome explicitness: The result could be sharper.",
                    }],
                }}
                onClose={() => undefined}
            />,
        );

        expect(screen.getByRole("dialog", { name: /specific examples/i })).toHaveTextContent("Tell me about a time you handled an upset client.");
        expect(screen.getByRole("dialog", { name: /specific examples/i })).toHaveTextContent("Voice response");
        expect(screen.getByRole("dialog", { name: /specific examples/i })).toHaveTextContent("Practice round");
        expect(screen.getByRole("dialog", { name: /specific examples/i })).toHaveTextContent("Practiced:");
        expect(screen.getByRole("dialog", { name: /specific examples/i })).not.toHaveTextContent("Tap/click for guidance");
        expect(screen.queryByText(/open coach read/i)).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /tell me about a time you handled an upset client/i }));

        expect(screen.getByRole("dialog", { name: /guidance/i })).toHaveTextContent("My Read");
        expect(screen.getByRole("dialog", { name: /guidance/i })).toHaveTextContent("Your answer was relevant and clear");
        expect(screen.getByRole("dialog", { name: /guidance/i })).toHaveTextContent("What stood out");
        expect(screen.getByRole("dialog", { name: /guidance/i })).toHaveTextContent("Focus relevance");
        expect(screen.getByRole("dialog", { name: /guidance/i })).toHaveTextContent("Directly answers the question");
        expect(screen.getByRole("dialog", { name: /guidance/i })).not.toHaveTextContent("Coach signals");
        expect(screen.getByRole("dialog", { name: /guidance/i })).not.toHaveTextContent("Then I followed up with the client");
    });

    it("shows the full My Read guidance without truncating long evaluation content", async () => {
        const user = userEvent.setup();
        const longSignal = "This detail should remain visible at the end of the guidance because the My Read modal should not truncate coach output.";

        render(
            <SkillDrilldown
                skill={{
                    ...skill,
                    evidence: [{
                        type: "practice",
                        content: "I helped the client reset access.",
                        questionText: "How would you help a client who cannot log in?",
                        answerTranscript: "I helped the client reset access.",
                        answerModality: "text",
                        evaluation: `You handled the client calmly and clearly. Coach signals: Focus relevance: ${"Relevant detail. ".repeat(18)}${longSignal}; Specificity concreteness: Includes concrete troubleshooting steps.`,
                    }],
                }}
                onClose={() => undefined}
            />,
        );

        await user.click(screen.getByRole("button", { name: /how would you help a client/i }));

        expect(screen.getByRole("dialog", { name: /guidance/i })).toHaveTextContent(longSignal);
    });

    it("lets long Q/A card transcripts expand without opening guidance", async () => {
        const user = userEvent.setup();
        const longTranscript = "I listened to the client and clarified what went wrong. ".repeat(8);

        render(
            <SkillDrilldown
                skill={{
                    ...skill,
                    evidence: [{
                        type: "practice",
                        content: longTranscript,
                        questionText: "Tell me about a client issue.",
                        answerTranscript: longTranscript,
                        answerModality: "text",
                        evaluation: "Your answer has useful detail.",
                    }],
                }}
                onClose={() => undefined}
            />,
        );

        await user.click(screen.getByRole("button", { name: /show more/i }));

        expect(screen.queryByRole("dialog", { name: /guidance/i })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /show less/i })).toBeInTheDocument();
    });

    it("groups drilldown Q/A cards by session with newest session open first", async () => {
        const user = userEvent.setup();

        render(
            <SkillDrilldown
                skill={{
                    ...skill,
                    evidence: [
                        {
                            type: "practice",
                            content: "Older answer",
                            questionText: "Older question",
                            answerTranscript: "Older answer",
                            answerModality: "text",
                            answerSubmittedAt: Date.UTC(2026, 4, 18, 15, 30),
                            sessionId: "older-session",
                            sessionTitle: "Older practice",
                            sessionStatusLabel: "Completed",
                            sessionActivityLabel: "May 18, 2026",
                            sessionSortAt: Date.UTC(2026, 4, 18, 16, 0),
                            evaluation: "Older evaluation",
                        },
                        {
                            type: "practice",
                            content: "Newer answer",
                            questionText: "Newer question",
                            answerTranscript: "Newer answer",
                            answerModality: "voice",
                            answerSubmittedAt: Date.UTC(2026, 4, 20, 15, 30),
                            sessionId: "newer-session",
                            sessionTitle: "Newer practice",
                            sessionStatusLabel: "Completed",
                            sessionActivityLabel: "May 20, 2026",
                            sessionSortAt: Date.UTC(2026, 4, 20, 16, 0),
                            evaluation: "Newer evaluation",
                        },
                    ],
                }}
                onClose={() => undefined}
            />,
        );

        expect(screen.getByRole("button", { name: /newer practice/i })).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByRole("button", { name: /older practice/i })).toHaveAttribute("aria-expanded", "false");
        expect(screen.getByText("Newer question")).toBeInTheDocument();
        expect(screen.queryByText("Older question")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /older practice/i }));

        expect(screen.getByText("Older question")).toBeInTheDocument();
    });

    it("renders category drilldown question-answer cards with category-scoped coach copy", async () => {
        const user = userEvent.setup();

        render(
            <QuestionCategoryDrilldown
                category={{
                    id: "behavioral",
                    label: "Behavioral",
                    state: "clear",
                    questionCount: 1,
                    practicedQuestionCount: 1,
                    upcomingQuestionCount: 0,
                    questionStatuses: [
                        { questionId: "question-1", questionNumber: 1, status: "practiced" },
                    ],
                    whyItMatters: "Interviewers look for a clear situation, your specific action, and what changed because of it.",
                    evidence: [{
                        type: "practice",
                        content: "I helped the customer understand the next step.",
                        questionText: "Tell me about a customer issue you resolved.",
                        answerTranscript: "I helped the customer understand the next step.",
                        answerModality: "text",
                        answerSubmittedAt: Date.UTC(2026, 4, 20, 16, 45),
                        evaluation: "Behavioral feedback: The answer gives a relevant customer example. For the biggest lift: Add the customer impact. Try: I followed up so the customer knew the issue was resolved. Next step: Keep the story tied to the role.",
                    }],
                }}
                onClose={() => undefined}
            />,
        );

        expect(screen.getByRole("dialog", { name: /behavioral/i })).toHaveTextContent("Q1 Practiced");
        expect(screen.getByRole("dialog", { name: /behavioral/i })).toHaveTextContent("Tap/click any card below to see coach guidance.");
        expect(screen.getByRole("dialog", { name: /behavioral/i })).toHaveTextContent("Interviewers look for a clear situation");
        expect(screen.getByRole("dialog", { name: /behavioral/i })).toHaveTextContent("Practice round");
        expect(screen.getByRole("dialog", { name: /behavioral/i })).toHaveTextContent("Practiced:");
        await user.click(screen.getByRole("button", { name: /tell me about a customer issue/i }));

        expect(screen.getByRole("dialog", { name: /guidance/i })).toHaveTextContent("My Read");
        expect(screen.getByRole("dialog", { name: /guidance/i })).toHaveTextContent("Your answer gives a relevant customer example.");
        expect(screen.getByRole("dialog", { name: /guidance/i })).toHaveTextContent("For the biggest lift");
        expect(screen.getByRole("dialog", { name: /guidance/i })).toHaveTextContent("I followed up so the customer knew the issue was resolved.");
        expect(screen.getByRole("dialog", { name: /guidance/i })).toHaveTextContent("Next step");
        expect(screen.getByRole("dialog", { name: /guidance/i })).not.toHaveTextContent("Behavioral feedback:");
    });

    it("renders practice next with the primary blue action button", () => {
        render(
            <PracticeNextCard
                title="Resume QA Analyst"
                body="Pick up the active practice round."
                href="/session/session-1"
                actionLabel="Resume practice"
            />,
        );

        expect(screen.getByRole("region", { name: /practice next/i })).toHaveTextContent("Resume QA Analyst");
        expect(screen.getByRole("link", { name: /resume practice/i })).toHaveAttribute("href", "/session/session-1");
        expect(screen.getByRole("link", { name: /resume practice/i })).toHaveClass("bg-primary");
        expect(screen.getByRole("link", { name: /resume practice/i })).toHaveClass("rounded-2xl");
    });

    it("renders the empty preview state without blank analytics cards", () => {
        render(<EmptyPreparednessDashboard />);

        expect(screen.getByRole("region", { name: /empty preparedness dashboard/i })).toHaveTextContent("Start with the interview you want to prepare for.");
        expect(screen.getByLabelText("Preview of your preparedness map")).toHaveTextContent("Answer Substance");
        expect(screen.getByLabelText("Preview of question coverage")).toHaveTextContent("Behavioral");
        expect(screen.getByRole("link", { name: /create practice/i })).toHaveAttribute("href", "/practice");
    });

    it("renders recent activity as a compact list", () => {
        render(
            <RecentActivityList
                items={[
                    {
                        practiceDraftId: "draft-1",
                        roleProfileId: null,
                        roleContextLabel: "Role context from practice history",
                        title: "Operations Clerk",
                        statusLabel: "Completed",
                        progressLabel: "3 of 3 answered",
                        href: "/summary/session-1",
                        lastActivityLabel: "May 22, 2026",
                        lastActivityAt: Date.parse("2026-05-22T00:00:00.000Z"),
                        coachingSnippetLabel: "Biggest lift",
                        coachingSnippet: "Lead with the outcome.",
                    },
                ]}
            />,
        );

        expect(screen.getByRole("region", { name: /recent activity/i })).toHaveTextContent("Operations Clerk");
        expect(screen.getByRole("region", { name: /recent activity/i })).toHaveTextContent("Biggest lift");
        expect(screen.getByRole("link", { name: /summary/i })).toHaveAttribute("href", "/summary/session-1");
    });

    it("derives preparedness skills from the current dashboard item", () => {
        const item: CandidateDashboardItem = {
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
                        signalId: "category:behavioral",
                        label: "Practice Behavioral questions",
                        lane: "interview_range",
                        evidenceState: "clear",
                        evidenceCounts: {
                            not_practiced: 0,
                            emerging: 0,
                            clear: 1,
                            strong: 0,
                        },
                        priority: "supporting",
                        sourceRefs: [
                            {
                                type: "question",
                                id: "question-1",
                                label: "Behavioral",
                                excerpt: "Tell me about a release you improved.",
                            },
                        ],
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
        };

        const skills = toPreparednessSkills({ latestItem: item, fallbackHref: "/practice" });

        expect(skills.map((derivedSkill) => derivedSkill.label)).toEqual([
            "Answer Substance",
            "Interview Structure",
            "Communication Delivery",
        ]);
        expect(skills.find((derivedSkill) => derivedSkill.label === "Interview Structure")).toMatchObject({
            label: "Interview Structure",
            state: "emerging",
            evidenceCounts: {
                not_practiced: 0,
                emerging: 1,
                clear: 0,
                strong: 0,
            },
            href: "/session/session-1",
            evidence: [
                {
                    type: "practice",
                    content: "Structure the answer: The answer needs a clearer beginning, middle, and end.",
                },
            ],
        });
        expect(skills.find((derivedSkill) => derivedSkill.label === "Interview Range")).toBeUndefined();
        expect(skills.map((derivedSkill) => derivedSkill.label)).not.toContain("Role connection");
        expect(skills).toHaveLength(3);
        expect(toQuestionCategoryCards([item])).toEqual([]);
    });

    it("renders score-driven question category coverage separately from preparedness lanes", () => {
        const item: CandidateDashboardItem = {
            practiceDraftId: "draft-1",
            roleProfileId: "role-profile-1",
            roleContextLabel: "Role context saved",
            title: "QA Analyst",
            statusLabel: "Completed",
            progressLabel: "2 of 2 answered",
            href: "/summary/session-1",
            lastActivityLabel: "May 12, 2026",
            lastActivityAt: Date.parse("2026-05-12T00:00:00.000Z"),
            prepProfile: {
                prepProfileId: "role-profile-1",
                primarySignal: null,
                signals: [],
                categoryCards: [
                    {
                        categoryId: "behavioral",
                        label: "Behavioral",
                        questionCount: 1,
                        evidenceState: "clear",
                        averageScore: 3.2,
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
                    not_practiced: 0,
                    emerging: 1,
                    clear: 1,
                    strong: 0,
                },
                recommendation: {
                    label: "Practice the biggest lift",
                    reason: "Use the latest feedback as the focus for your next round.",
                    source: "answer_feedback",
                    href: "/practice",
                },
            },
        };

        const categories = toQuestionCategoryCards([item]);
        render(<QuestionCategoryCoverage categories={categories} />);

        expect(screen.getByRole("region", { name: /question coverage/i })).toHaveTextContent("Behavioral");
        expect(screen.getByRole("region", { name: /question coverage/i })).toHaveTextContent("Screening");
        expect(screen.getByRole("button", { name: /behavioral/i })).toHaveAttribute("data-evidence-state", "clear");
        expect(screen.getByRole("button", { name: /screening/i })).toHaveAttribute("data-evidence-state", "emerging");
    });

    it("rolls up category cards from weighted score and orders categories by practice need", () => {
        const newerItem: CandidateDashboardItem = {
            practiceDraftId: "draft-newer",
            roleProfileId: "role-profile-1",
            roleContextLabel: "Role context saved",
            title: "Client Service Coordinator",
            statusLabel: "Completed",
            progressLabel: "2 of 2 answered",
            href: "/summary/session-newer",
            lastActivityLabel: "May 30, 2026",
            lastActivityAt: Date.parse("2026-05-30T00:00:00.000Z"),
            prepProfile: {
                prepProfileId: "role-profile-1",
                primarySignal: null,
                signals: [],
                categoryCards: [
                    {
                        categoryId: "behavioral",
                        label: "Behavioral",
                        questionCount: 1,
                        evidenceState: "strong",
                        averageScore: 4.4,
                        sourceRefs: [],
                    },
                    {
                        categoryId: "technical_role_specific",
                        label: "Technical / Role-Specific",
                        questionCount: 1,
                        evidenceState: "strong",
                        averageScore: 4.2,
                        sourceRefs: [],
                    },
                ],
                signalCounts: {
                    not_practiced: 0,
                    emerging: 0,
                    clear: 0,
                    strong: 2,
                },
                recommendation: {
                    label: "Practice the biggest lift",
                    reason: "Use the latest feedback as the focus for your next round.",
                    source: "answer_feedback",
                    href: "/practice",
                },
            },
        };
        const olderItem: CandidateDashboardItem = {
            ...newerItem,
            practiceDraftId: "draft-older",
            href: "/summary/session-older",
            lastActivityLabel: "May 29, 2026",
            lastActivityAt: Date.parse("2026-05-29T00:00:00.000Z"),
            prepProfile: {
                ...newerItem.prepProfile!,
                categoryCards: [
                    {
                        categoryId: "behavioral",
                        label: "Behavioral",
                        questionCount: 1,
                        evidenceState: "emerging",
                        averageScore: 1.6,
                        sourceRefs: [],
                    },
                    {
                        categoryId: "culture_fit",
                        label: "Culture / Fit",
                        questionCount: 1,
                        evidenceState: "clear",
                        averageScore: 3.1,
                        sourceRefs: [],
                    },
                ],
            },
        };

        const categories = toQuestionCategoryCards([newerItem, olderItem]);

        expect(categories.map((category) => category.label)).toEqual([
            "Behavioral",
            "Culture / Fit",
            "Technical / Role-Specific",
        ]);
        expect(categories.find((category) => category.categoryId === "behavioral")).toMatchObject({
            questionCount: 2,
            averageScore: 3,
            evidenceState: "clear",
        });
    });

    it("shows practiced and upcoming question statuses on category cards without depressing scored state", () => {
        const categories = toQuestionCategoryCards([{
            practiceDraftId: "draft-partial",
            roleProfileId: "role-profile-1",
            roleContextLabel: "Role context saved",
            title: "Client Services Specialist",
            statusLabel: "Active",
            progressLabel: "1 of 2 answered",
            href: "/session/session-partial",
            lastActivityLabel: "Jun 4, 2026",
            lastActivityAt: Date.parse("2026-06-04T00:00:00.000Z"),
            prepProfile: {
                prepProfileId: "role-profile-1",
                primarySignal: null,
                signals: [],
                categoryCards: [{
                    categoryId: "behavioral",
                    label: "Behavioral",
                    questionCount: 2,
                    practicedQuestionCount: 1,
                    upcomingQuestionCount: 1,
                    questionStatuses: [
                        { questionId: "q-1", questionNumber: 1, status: "practiced" },
                        { questionId: "q-5", questionNumber: 5, status: "upcoming" },
                    ],
                    evidenceState: "strong",
                    averageScore: 4.4,
                    sourceRefs: [],
                }],
                signalCounts: {
                    not_practiced: 0,
                    emerging: 0,
                    clear: 0,
                    strong: 1,
                },
                recommendation: {
                    label: "Practice the biggest lift",
                    reason: "Use the latest feedback as the focus for your next round.",
                    source: "answer_feedback",
                    href: "/practice",
                },
            },
        }]);

        render(<QuestionCategoryCoverage categories={categories} />);

        expect(screen.getByRole("button", { name: /behavioral/i })).toHaveAttribute("data-evidence-state", "strong");
        expect(screen.getByRole("button", { name: /behavioral/i })).toHaveTextContent("Q1 Practiced");
        expect(screen.getByRole("button", { name: /behavioral/i })).toHaveTextContent("Q5 Upcoming");
        expect(screen.getByRole("button", { name: /behavioral/i })).not.toHaveTextContent("2 questions practiced");
    });

    it("rolls up lane evidence across scoped items for the same selected target interview", () => {
        const latestItem: CandidateDashboardItem = {
            practiceDraftId: "draft-latest",
            roleProfileId: "role-profile-latest",
            roleContextLabel: "Role context saved",
            title: "Client Service Coordinator",
            statusLabel: "Completed",
            progressLabel: "3 of 3 answered",
            href: "/summary/session-latest",
            lastActivityLabel: "Jun 1, 2026",
            lastActivityAt: Date.parse("2026-06-01T00:00:00.000Z"),
            prepProfile: {
                prepProfileId: "role-profile-latest",
                primarySignal: null,
                signals: [
                    {
                        prepProfileId: "role-profile-latest",
                        signalId: "content:specificity_concreteness",
                        label: "Use concrete examples",
                        lane: "answer_substance",
                        evidenceState: "strong",
                        evidenceCounts: {
                            not_practiced: 0,
                            emerging: 0,
                            clear: 0,
                            strong: 1,
                        },
                        priority: "primary",
                        sourceRefs: [
                            {
                                type: "content_pulse",
                                id: "question-1",
                                label: "Specificity",
                                excerpt: "The answer used a direct customer scheduling example.",
                            },
                        ],
                    },
                ],
                signalCounts: {
                    not_practiced: 0,
                    emerging: 0,
                    clear: 0,
                    strong: 1,
                },
                recommendation: {
                    label: "Practice the biggest lift",
                    reason: "Use the latest feedback as the focus for your next round.",
                    source: "answer_feedback",
                    href: "/practice",
                },
            },
        };
        const olderItem: CandidateDashboardItem = {
            ...latestItem,
            practiceDraftId: "draft-older",
            roleProfileId: "role-profile-older",
            href: "/summary/session-older",
            lastActivityLabel: "May 31, 2026",
            lastActivityAt: Date.parse("2026-05-31T00:00:00.000Z"),
            prepProfile: {
                prepProfileId: "role-profile-older",
                primarySignal: null,
                signals: [
                    {
                        prepProfileId: "role-profile-older",
                        signalId: "delivery:filler_words",
                        label: "Keep delivery clean",
                        lane: "communication_delivery",
                        evidenceState: "emerging",
                        evidenceCounts: {
                            not_practiced: 0,
                            emerging: 1,
                            clear: 0,
                            strong: 0,
                        },
                        priority: "supporting",
                        sourceRefs: [
                            {
                                type: "delivery_pulse",
                                id: "question-5",
                                label: "Filler words",
                                excerpt: "The spoken answer had a few places where trimming would help.",
                            },
                        ],
                    },
                ],
                signalCounts: {
                    not_practiced: 0,
                    emerging: 1,
                    clear: 0,
                    strong: 0,
                },
                recommendation: {
                    label: "Practice keep delivery clean",
                    reason: "Use the next round to make delivery cleaner.",
                    source: "answer_feedback",
                    href: "/practice",
                },
            },
        };

        const skills = toPreparednessSkills({
            latestItem,
            items: [latestItem, olderItem],
            fallbackHref: "/practice",
        });

        expect(skills.find((derivedSkill) => derivedSkill.label === "Answer Substance")).toMatchObject({
            state: "strong",
            evidence: [
                {
                    type: "practice",
                    content: "Specificity: The answer used a direct customer scheduling example.",
                },
            ],
        });
        expect(skills.find((derivedSkill) => derivedSkill.label === "Communication Delivery")).toMatchObject({
            state: "emerging",
            evidence: [
                {
                    type: "practice",
                    content: "Filler words: The spoken answer had a few places where trimming would help.",
                },
            ],
        });
    });

    it("orders drilldown evidence chronologically across sessions even when recent activity is newest first", () => {
        const latestItem: CandidateDashboardItem = {
            practiceDraftId: "draft-latest",
            roleProfileId: "role-profile-latest",
            roleContextLabel: "Role context saved",
            title: "Client Service Coordinator",
            statusLabel: "Completed",
            progressLabel: "3 of 3 answered",
            href: "/summary/session-latest",
            lastActivityLabel: "Jun 1, 2026",
            lastActivityAt: Date.parse("2026-06-01T00:00:00.000Z"),
            prepProfile: {
                prepProfileId: "role-profile-latest",
                primarySignal: null,
                signals: [{
                    prepProfileId: "role-profile-latest",
                    signalId: "lane:answer_substance",
                    label: "Answer Substance",
                    lane: "answer_substance",
                    evidenceState: "clear",
                    evidenceCounts: { not_practiced: 0, emerging: 0, clear: 1, strong: 0 },
                    averageScore: 3,
                    scoreCount: 4,
                    fillPercent: 0,
                    priority: "supporting",
                    sourceRefs: [
                        { type: "feedback_plan", id: "latest-q1", label: "Latest feedback", excerpt: "This is the newer session." },
                        { type: "feedback_plan", id: "latest-q1", label: "Latest score", excerpt: "This is the newer score." },
                    ],
                }],
                signalCounts: { not_practiced: 0, emerging: 0, clear: 1, strong: 0 },
                recommendation: {
                    label: "Practice the biggest lift",
                    reason: "Use the latest feedback as the focus for your next round.",
                    source: "answer_feedback",
                    href: "/practice",
                },
            },
        };
        const olderItem: CandidateDashboardItem = {
            ...latestItem,
            practiceDraftId: "draft-older",
            roleProfileId: "role-profile-older",
            href: "/summary/session-older",
            lastActivityLabel: "May 31, 2026",
            lastActivityAt: Date.parse("2026-05-31T00:00:00.000Z"),
            prepProfile: {
                ...latestItem.prepProfile!,
                prepProfileId: "role-profile-older",
                signals: [{
                    ...latestItem.prepProfile!.signals[0],
                    prepProfileId: "role-profile-older",
                    sourceRefs: [
                        { type: "feedback_plan", id: "older-q1", label: "Older feedback", excerpt: "This is the older session." },
                        { type: "feedback_plan", id: "older-q1", label: "Older score", excerpt: "This is the older score." },
                    ],
                }],
            },
        };

        const skills = toPreparednessSkills({
            latestItem,
            items: [latestItem, olderItem],
            fallbackHref: "/practice",
        });

        expect(skills.find((derivedSkill) => derivedSkill.label === "Answer Substance")?.evidence.map((item) => item.content)).toEqual([
            "Older feedback: This is the older session.",
            "Older score: This is the older score.",
            "Latest feedback: This is the newer session.",
            "Latest score: This is the newer score.",
        ]);
    });
});
