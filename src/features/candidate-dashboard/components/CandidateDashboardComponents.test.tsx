import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
    EmptyPreparednessDashboard,
    PracticeNextCard,
    PreparednessInstantRead,
    PreparednessMapExperience,
    PreparednessMatrix,
    PreparednessMap,
    QuestionCategoryCoverage,
    QuestionCategoryDrilldown,
    RecentActivityList,
    SkillDrilldown,
    toInstantReadCategoryMix,
    toInstantReadPreparednessModel,
    toQuestionCategoryCards,
    toPreparednessMatrix,
    toPreparednessSkills,
    toPracticeNextItems,
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
                items={[
                    {
                        id: "q2",
                        label: "Q2: Behavioral",
                        detail: "Waiting in your active QA Analyst practice round.",
                        state: "not_practiced",
                    },
                ]}
            />,
        );

        expect(screen.getByRole("region", { name: /practice next/i })).toHaveTextContent("Resume QA Analyst");
        expect(screen.getByRole("region", { name: /practice next/i })).toHaveTextContent("Upcoming practice items");
        expect(screen.getByRole("region", { name: /practice next/i })).toHaveTextContent("Q2: Behavioral");
        expect(screen.getByRole("link", { name: /resume practice/i })).toHaveAttribute("href", "/session/session-1");
        expect(screen.getByRole("link", { name: /resume practice/i })).toHaveClass("bg-primary");
        expect(screen.getByRole("link", { name: /resume practice/i })).toHaveClass("rounded-2xl");
    });

    it("derives pending question items before matrix improvement items for an active round", () => {
        const activeItem = {
            practiceDraftId: "draft-1",
            roleProfileId: "role-1",
            roleContextLabel: "Role context saved",
            title: "QA Analyst",
            statusLabel: "In progress",
            progressLabel: "1 of 3 answered",
            href: "/session/session-1",
            lastActivityLabel: "May 12, 2026",
            lastActivityAt: Date.UTC(2026, 4, 12),
        } satisfies CandidateDashboardItem;
        const categories = toQuestionCategoryCards([{
            ...activeItem,
            prepProfile: {
                prepProfileId: "role-1",
                primarySignal: null,
                signals: [],
                signalCounts: { not_practiced: 0, emerging: 0, clear: 0, strong: 0 },
                recommendation: {
                    label: "Resume QA Analyst",
                    reason: "Resume your current practice.",
                    source: "unfinished_session",
                    href: "/session/session-1",
                },
                categoryCards: [{
                    categoryId: "behavioral",
                    label: "Behavioral",
                    questionCount: 2,
                    practicedQuestionCount: 1,
                    upcomingQuestionCount: 1,
                    questionStatuses: [
                        { questionId: "q1", questionNumber: 1, status: "practiced" },
                        { questionId: "q2", questionNumber: 2, status: "upcoming" },
                    ],
                    evidenceState: "strong",
                    sourceRefs: [],
                }],
            },
        }]);
        const matrix = toPreparednessMatrix([skill], categories);

        expect(toPracticeNextItems({
            activeItems: [activeItem],
            matrix,
            categories,
        })).toEqual([{
            id: "draft-1:behavioral:q2",
            label: "Q2: Behavioral",
            detail: "Waiting in your active QA Analyst practice round.",
            state: "not_practiced",
        }]);
    });

    it("derives planned coverage gaps before score-improvement items for completed rounds", () => {
        const completedItem = {
            practiceDraftId: "draft-1",
            roleProfileId: "role-1",
            roleContextLabel: "Role context saved",
            title: "QA Analyst",
            statusLabel: "Completed",
            progressLabel: "1 of 1 answered",
            href: "/summary/session-1",
            lastActivityLabel: "May 12, 2026",
            lastActivityAt: Date.UTC(2026, 4, 12),
            practiceCoverageBaseline: {
                interviewStage: "initial_screening",
                minimumQuestionCount: 3,
                categoryMinimums: {
                    screening: 2,
                    behavioral: 1,
                    culture_fit: 0,
                    case_scenario: 0,
                    technical_role_specific: 0,
                },
            },
            prepProfile: {
                prepProfileId: "role-1",
                primarySignal: null,
                signals: [],
                signalCounts: { not_practiced: 0, emerging: 0, clear: 0, strong: 0 },
                recommendation: {
                    label: "Practice one focused improvement",
                    reason: "Practice another screening question.",
                    source: "session_summary",
                    href: "/practice",
                },
                categoryCards: [{
                    categoryId: "screening",
                    label: "Screening",
                    questionCount: 1,
                    practicedQuestionCount: 1,
                    upcomingQuestionCount: 0,
                    questionStatuses: [
                        { questionId: "q1", questionNumber: 1, status: "practiced" },
                    ],
                    evidenceState: "clear",
                    sourceRefs: [],
                }],
            },
        } satisfies CandidateDashboardItem;
        const categories = toQuestionCategoryCards([completedItem]);
        const matrix = toPreparednessMatrix([skill], categories);

        const items = toPracticeNextItems({
            activeItems: [],
            completedItems: [completedItem],
            matrix,
            categories,
        });

        expect(items[0]).toMatchObject({
            id: "coverage:screening",
            label: "Screening coverage",
            detail: "Practice 1 more question in this area for the planned interview scope.",
            state: "not_practiced",
        });
    });

    it("renders an instant-read snapshot with lane and category tap targets", async () => {
        const user = userEvent.setup();
        const laneClicks: string[] = [];
        const categoryClicks: string[] = [];
        const snapshot = toInstantReadPreparednessModel(
            [{
                ...skill,
                id: "answer_substance",
                label: "Answer Substance",
                state: "strong",
                evidenceCounts: { not_practiced: 0, emerging: 0, clear: 0, strong: 2 },
                evidence: [
                    { type: "practice", content: "Strong answer content." },
                    { type: "practice", content: "Another answer with strong content." },
                    { type: "practice", content: "Repeated answer content." },
                ],
            }, {
                ...skill,
                id: "interview_structure",
                label: "Interview Structure",
                state: "clear",
                evidenceCounts: { not_practiced: 0, emerging: 0, clear: 1, strong: 0 },
            }, {
                ...skill,
                id: "communication_delivery",
                label: "Communication Delivery",
                state: "not_practiced",
                evidenceCounts: { not_practiced: 1, emerging: 0, clear: 0, strong: 0 },
                evidence: [],
            }],
            [{
                categoryId: "behavioral",
                label: "Behavioral",
                questionCount: 2,
                practicedQuestionCount: 1,
                upcomingQuestionCount: 1,
                evidenceState: "strong",
                sourceRefs: [],
            }],
        );

        render(
            <PreparednessInstantRead
                snapshot={snapshot}
                onLaneClick={(id) => laneClicks.push(id)}
                onCategoryClick={(id) => categoryClicks.push(id)}
            />,
        );

        expect(screen.getByRole("region", { name: /preparedness snapshot/i })).toHaveTextContent("How your answers are shaping up");
        expect(screen.getByLabelText("Answer skills chart")).toBeInTheDocument();
        expect(screen.getByLabelText("Question mix chart")).toBeInTheDocument();
        expect(screen.queryByText("Skill areas")).not.toBeInTheDocument();
        expect(screen.queryByText("Question types")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /open substance details/i }));

        expect(laneClicks).toEqual(["answer_substance"]);

        const substanceSlice = screen.getByRole("button", { name: /open substance details/i });
        await user.hover(substanceSlice);

        expect(screen.getByRole("region", { name: /preparedness snapshot/i })).toHaveTextContent("Substance");
        expect(screen.getByRole("region", { name: /preparedness snapshot/i })).toHaveTextContent("carrying strong practice evidence");
        expect(screen.getByRole("button", { name: /open substance details/i })).toHaveClass("drop-shadow-[0_5px_8px_rgb(var(--candidate-success)/0.28)]");
        expect(laneClicks).toEqual(["answer_substance"]);

        fireEvent.mouseOut(screen.getByRole("button", { name: /open substance details/i }));

        expect(screen.getByRole("region", { name: /preparedness snapshot/i })).toHaveTextContent(snapshot.overallRead.label);
        expect(screen.getByRole("region", { name: /preparedness snapshot/i })).toHaveTextContent(snapshot.overallRead.summary);

        fireEvent.click(screen.getByRole("button", { name: /open behavioral practiced details/i }));

        expect(categoryClicks).toEqual(["behavioral"]);

        const behavioralSlice = screen.getByRole("button", { name: /open behavioral practiced details/i });
        await user.hover(behavioralSlice);

        expect(screen.getByRole("region", { name: /preparedness snapshot/i })).toHaveTextContent("Behavioral");
        expect(screen.getByRole("region", { name: /preparedness snapshot/i })).toHaveTextContent("1 of 2 planned Behavioral");
        expect(categoryClicks).toEqual(["behavioral"]);

        fireEvent.keyDown(screen.getByRole("button", { name: /open behavioral practiced details/i }), { key: "Escape" });

        expect(screen.getByRole("region", { name: /preparedness snapshot/i })).toHaveTextContent(snapshot.overallRead.label);
    });

    it("uses mobile first-tap guidance, tapaway reset, and second-tap open for pie segments", () => {
        const laneClicks: string[] = [];
        const snapshot = toInstantReadPreparednessModel(
            [{
                ...skill,
                id: "answer_substance",
                label: "Answer Substance",
                state: "strong",
                evidenceCounts: { not_practiced: 0, emerging: 0, clear: 0, strong: 1 },
                dimensionStates: [
                    {
                        dimension: "focus_relevance",
                        label: "Focus",
                        evidenceState: "strong",
                        scoreCount: 1,
                    },
                    {
                        dimension: "specificity_concreteness",
                        label: "Specific detail",
                        evidenceState: "clear",
                        scoreCount: 1,
                    },
                ],
            } as PreparednessSkill],
            [],
        );

        render(<PreparednessInstantRead snapshot={snapshot} onLaneClick={(id) => laneClicks.push(id)} />);

        const region = screen.getByRole("region", { name: /preparedness snapshot/i });
        const focusSlice = screen.getByRole("button", { name: /open focus details/i });

        fireEvent.pointerDown(focusSlice, { pointerType: "touch" });

        expect(laneClicks).toEqual([]);
        expect(region).toHaveTextContent("Focus");
        expect(region).toHaveTextContent("stays tied to the question");
        const focusedFocusSlice = screen.getByRole("button", { name: /open focus details/i });
        const secondarySiblingSlice = screen.getByRole("button", { name: /open specific detail details/i });
        expect(focusedFocusSlice).toHaveClass("-translate-x-px");
        expect(focusedFocusSlice).toHaveClass("drop-shadow-[0_5px_8px_rgb(var(--candidate-success)/0.28)]");
        expect(focusedFocusSlice).toHaveAttribute("stroke", "white");
        expect(secondarySiblingSlice).toHaveAttribute("stroke", "white");
        expect(secondarySiblingSlice).not.toHaveClass("-translate-x-px");

        fireEvent.pointerDown(screen.getByText(/stays tied to the question/i), { pointerType: "touch" });

        expect(region).toHaveTextContent(snapshot.overallRead.label);
        expect(laneClicks).toEqual([]);

        fireEvent.pointerDown(screen.getByRole("button", { name: /open focus details/i }), { pointerType: "touch" });
        fireEvent.pointerDown(screen.getByRole("button", { name: /open focus details/i }), { pointerType: "touch" });

        expect(laneClicks).toEqual(["answer_substance"]);
    });

    it("keeps child answer-skill ring states distinct from the parent lane state", () => {
        const snapshot = toInstantReadPreparednessModel(
            [{
                ...skill,
                id: "answer_substance",
                label: "Answer Substance",
                state: "strong",
                evidenceCounts: { not_practiced: 0, emerging: 0, clear: 0, strong: 1 },
                dimensionStates: [
                    {
                        dimension: "focus_relevance",
                        label: "Focus",
                        evidenceState: "strong",
                        scoreCount: 1,
                    },
                    {
                        dimension: "specificity_concreteness",
                        label: "Specific detail",
                        evidenceState: "emerging",
                        scoreCount: 1,
                    },
                ],
            } as PreparednessSkill],
            [],
        );

        expect(snapshot.lanes[0]).toMatchObject({
            id: "answer_substance",
            state: "strong",
            dimensionStates: [
                {
                    dimension: "focus_relevance",
                    label: "Focus",
                    evidenceState: "strong",
                },
                {
                    dimension: "specificity_concreteness",
                    label: "Specific detail",
                    evidenceState: "emerging",
                },
            ],
        });
    });

    it("models question mix as planned category distribution with practiced and upcoming arcs", () => {
        const snapshot = toInstantReadPreparednessModel(
            [],
            [{
                categoryId: "behavioral",
                label: "Behavioral",
                questionCount: 3,
                practicedQuestionCount: 1,
                upcomingQuestionCount: 2,
                evidenceState: "strong",
                sourceRefs: [],
            }, {
                categoryId: "culture_fit",
                label: "Culture / Fit",
                questionCount: 2,
                practicedQuestionCount: 0,
                upcomingQuestionCount: 2,
                evidenceState: "not_practiced",
                sourceRefs: [],
            }],
        );

        expect(snapshot.categoryCoverage).toEqual([
            expect.objectContaining({
                categoryId: "behavioral",
                plannedCount: 3,
                practicedCount: 1,
                upcomingCount: 2,
                state: "strong",
            }),
            expect.objectContaining({
                categoryId: "culture_fit",
                plannedCount: 2,
                practicedCount: 0,
                upcomingCount: 2,
                state: "not_practiced",
            }),
        ]);
        expect(toInstantReadCategoryMix(snapshot.categoryCoverage)).toEqual([
            expect.objectContaining({
                id: "behavioral:practiced",
                categoryId: "behavioral",
                label: "Behavioral practiced",
                value: 1,
                coverageKind: "practiced",
                state: "strong",
            }),
            expect.objectContaining({
                id: "behavioral:upcoming",
                categoryId: "behavioral",
                label: "Behavioral upcoming",
                value: 2,
                coverageKind: "upcoming",
                state: "not_practiced",
            }),
            expect.objectContaining({
                id: "culture_fit:upcoming",
                categoryId: "culture_fit",
                label: "Culture / Fit upcoming",
                value: 2,
                coverageKind: "upcoming",
                state: "not_practiced",
            }),
        ]);
    });

    it("defaults the preparedness map experience to quick view and toggles to details", async () => {
        const user = userEvent.setup();
        const cellClicks: string[] = [];
        const skills = [
            {
                ...skill,
                id: "answer_substance",
                label: "Answer Substance",
                state: "strong" as const,
                evidenceCounts: { not_practiced: 0, emerging: 0, clear: 0, strong: 2 },
                evidence: [{ type: "practice" as const, content: "Strong answer content." }],
            },
            {
                ...skill,
                id: "interview_structure",
                label: "Interview Structure",
                state: "clear" as const,
                evidenceCounts: { not_practiced: 0, emerging: 0, clear: 1, strong: 0 },
            },
            {
                ...skill,
                id: "communication_delivery",
                label: "Communication Delivery",
                state: "not_practiced" as const,
                evidenceCounts: { not_practiced: 1, emerging: 0, clear: 0, strong: 0 },
                evidence: [],
            },
        ];
        const categories = [{
            categoryId: "behavioral" as const,
            label: "Behavioral",
            questionCount: 1,
            practicedQuestionCount: 1,
            upcomingQuestionCount: 0,
            evidenceState: "strong" as const,
            sourceRefs: [],
        }];

        render(
            <PreparednessMapExperience
                snapshot={toInstantReadPreparednessModel(skills, categories)}
                matrix={toPreparednessMatrix(skills, categories)}
                onLaneClick={() => undefined}
                onCategoryClick={() => undefined}
                onCellClick={(cellId) => cellClicks.push(cellId)}
            />,
        );

        expect(screen.getByRole("region", { name: /^preparedness map$/i })).toHaveTextContent("Quick View");
        expect(screen.getByRole("tabpanel", { name: /quick preparedness view/i })).toHaveTextContent("Answer skills");
        expect(screen.getByRole("button", { name: /open substance details/i })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /answer substance in behavioral: strong/i })).not.toBeInTheDocument();

        await user.click(screen.getByRole("tab", { name: /details/i }));

        expect(screen.getByRole("tab", { name: /details/i })).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("button", { name: /answer substance in behavioral: to practice/i })).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /answer substance in behavioral: to practice/i }));

        expect(cellClicks).toEqual(["answer_substance:behavioral"]);
    });

    it("renders the empty preview state without blank analytics cards", () => {
        render(<EmptyPreparednessDashboard />);

        expect(screen.getByRole("region", { name: /empty preparedness dashboard/i })).toHaveTextContent("Start with the interview you want to prepare for.");
        expect(screen.getByLabelText("Preview of your preparedness map")).toHaveTextContent("Preparedness map preview");
        expect(screen.getByLabelText("Preview of your preparedness map")).toHaveTextContent("Answer skills");
        expect(screen.getByLabelText("Preview of your preparedness map")).toHaveTextContent("Question mix");
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

    it("builds and renders a preparedness matrix from lane and category score evidence", async () => {
        const user = userEvent.setup();
        const clickedCells: string[] = [];
        const item: CandidateDashboardItem = {
            practiceDraftId: "draft-1",
            roleProfileId: "role-profile-1",
            roleContextLabel: "Role context saved",
            title: "QA Analyst",
            statusLabel: "Completed",
            progressLabel: "1 of 1 answered",
            href: "/summary/session-1",
            lastActivityLabel: "May 12, 2026",
            lastActivityAt: Date.parse("2026-05-12T00:00:00.000Z"),
            prepProfile: {
                prepProfileId: "role-profile-1",
                primarySignal: null,
                signals: [
                    {
                        prepProfileId: "role-profile-1",
                        signalId: "lane:answer_substance",
                        label: "Answer Substance",
                        lane: "answer_substance",
                        evidenceState: "strong",
                        evidenceCounts: { not_practiced: 0, emerging: 0, clear: 0, strong: 1 },
                        averageScore: 4.25,
                        scoreCount: 4,
                        priority: "supporting",
                        sourceRefs: [{
                            type: "answer",
                            id: "question-1",
                            label: "Practice",
                            questionText: "Tell me about a customer issue you resolved.",
                            answerTranscript: "I helped the customer understand the next step.",
                            answerModality: "text",
                            answerSubmittedAt: Date.UTC(2026, 4, 20, 16, 45),
                            evaluation: "You gave a specific answer. Coach signals: Focus relevance: Directly answered the question.",
                        }],
                    },
                    {
                        prepProfileId: "role-profile-1",
                        signalId: "lane:interview_structure",
                        label: "Interview Structure",
                        lane: "interview_structure",
                        evidenceState: "clear",
                        evidenceCounts: { not_practiced: 0, emerging: 0, clear: 1, strong: 0 },
                        averageScore: 3.5,
                        scoreCount: 2,
                        priority: "supporting",
                        sourceRefs: [{
                            type: "answer",
                            id: "question-1",
                            label: "Practice",
                            questionText: "Tell me about a customer issue you resolved.",
                            answerTranscript: "I helped the customer understand the next step.",
                            answerModality: "text",
                            answerSubmittedAt: Date.UTC(2026, 4, 20, 16, 45),
                            evaluation: "You organized the answer clearly. Coach signals: Structural clarity: Clear flow.",
                        }],
                    },
                    {
                        prepProfileId: "role-profile-1",
                        signalId: "lane:communication_delivery",
                        label: "Communication Delivery",
                        lane: "communication_delivery",
                        evidenceState: "emerging",
                        evidenceCounts: { not_practiced: 0, emerging: 1, clear: 0, strong: 0 },
                        averageScore: 2.5,
                        scoreCount: 3,
                        priority: "supporting",
                        sourceRefs: [{
                            type: "answer",
                            id: "question-1",
                            label: "Practice",
                            questionText: "Tell me about a customer issue you resolved.",
                            answerTranscript: "I helped the customer understand the next step.",
                            answerModality: "text",
                            answerSubmittedAt: Date.UTC(2026, 4, 20, 16, 45),
                            evaluation: "You can tighten the delivery. Coach signals: Conciseness: Could be shorter.",
                        }],
                    },
                ],
                categoryCards: [{
                    categoryId: "behavioral",
                    label: "Behavioral",
                    questionCount: 1,
                    practicedQuestionCount: 1,
                    upcomingQuestionCount: 0,
                    questionStatuses: [
                        { questionId: "question-1", questionNumber: 1, status: "practiced" },
                    ],
                    evidenceState: "clear",
                    averageScore: 3.4,
                    laneStates: {
                        answer_substance: { evidenceState: "strong", averageScore: 4.25, scoreCount: 4 },
                        interview_structure: { evidenceState: "clear", averageScore: 3.5, scoreCount: 2 },
                        communication_delivery: { evidenceState: "emerging", averageScore: 2.5, scoreCount: 3 },
                    },
                    sourceRefs: [{
                        type: "answer",
                        id: "question-1",
                        label: "Behavioral",
                        questionText: "Tell me about a customer issue you resolved.",
                        answerTranscript: "I helped the customer understand the next step.",
                        answerModality: "text",
                        answerSubmittedAt: Date.UTC(2026, 4, 20, 16, 45),
                        evaluation: "Behavioral feedback: You gave a relevant example.",
                    }],
                }],
                signalCounts: { not_practiced: 0, emerging: 1, clear: 1, strong: 1 },
                recommendation: {
                    label: "Practice the biggest lift",
                    reason: "Use the latest feedback as the focus for your next round.",
                    source: "answer_feedback",
                    href: "/practice",
                },
            },
        };
        const skills = toPreparednessSkills({ latestItem: item, fallbackHref: "/practice" });
        const categories = toQuestionCategoryCards([item]);
        const matrix = toPreparednessMatrix(skills, categories);

        expect(matrix.cells.find((cell) => cell.id === "answer_substance:behavioral")).toMatchObject({
            state: "strong",
            label: "Behavioral - Answer Substance",
            evidence: [expect.objectContaining({ questionText: "Tell me about a customer issue you resolved." })],
        });
        expect(matrix.cells.find((cell) => cell.id === "communication_delivery:behavioral")).toMatchObject({
            state: "emerging",
        });

        render(
            <PreparednessMatrix
                matrix={matrix}
                onLaneClick={() => undefined}
                onCategoryClick={() => undefined}
                onCellClick={(cellId) => clickedCells.push(cellId)}
            />,
        );

        expect(screen.getByRole("region", { name: /preparedness map/i })).toHaveTextContent("Behavioral");
        expect(screen.getByRole("button", { name: /^answer substance$/i })).toHaveTextContent("Substance");
        expect(screen.getByRole("button", { name: /^interview structure$/i })).toHaveTextContent("Structure");
        expect(screen.getByRole("button", { name: /^communication delivery$/i })).toHaveTextContent("Delivery");
        expect(screen.getByRole("button", { name: /answer substance in behavioral: strong/i })).toHaveAttribute("data-evidence-state", "strong");
        expect(screen.getByRole("button", { name: /communication delivery in behavioral: emerging/i })).toHaveAttribute("data-evidence-state", "emerging");
        expect(screen.getByRole("button", { name: /answer substance in behavioral: strong/i })).not.toHaveTextContent(/practiced/i);

        await user.click(screen.getByRole("button", { name: /answer substance in behavioral: strong/i }));

        expect(clickedCells).toEqual(["answer_substance:behavioral"]);
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
