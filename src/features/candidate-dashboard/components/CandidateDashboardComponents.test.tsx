import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
    EmptyPreparednessDashboard,
    PracticeNextCard,
    PreparednessMap,
    QuestionCategoryCoverage,
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

    it("renders a drilldown with evidence and the primary practice action", () => {
        render(<SkillDrilldown skill={skill} onClose={() => undefined} />);

        const dialog = screen.getByRole("dialog", { name: /specific examples/i });
        expect(dialog).toHaveTextContent("Why this matters");
        expect(dialog).toHaveTextContent("What your practice shows");
        expect(dialog).toHaveTextContent("How to use this");
        expect(dialog).toHaveTextContent("Practice adding the outcome");
        expect(screen.queryByRole("link", { name: /practice this area/i })).not.toBeInTheDocument();
    });

    it("closes the drilldown when clicking outside the panel", async () => {
        const user = userEvent.setup();
        let closeCount = 0;

        render(<SkillDrilldown skill={skill} onClose={() => closeCount += 1} />);

        await user.click(screen.getByTestId("preparedness-drilldown-backdrop"));

        expect(closeCount).toBe(1);
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

        expect(screen.getByRole("region", { name: /empty preparedness dashboard/i })).toHaveTextContent("Start preparing for an interview");
        expect(screen.getByText("Interview expectations")).toBeInTheDocument();
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
        expect(screen.getByText("Behavioral").closest("article")).toHaveAttribute("data-evidence-state", "clear");
        expect(screen.getByText("Screening").closest("article")).toHaveAttribute("data-evidence-state", "emerging");
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
});
