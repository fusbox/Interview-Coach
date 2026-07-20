import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { CandidateDashboardV2ReadModel } from "@/features/candidate-dashboard-v2/candidate-dashboard-read-model";
import CandidateDashboardPage, { getCandidateDashboardRuntimeSslConfig, renderCandidateDashboardPage } from "./CandidateDashboardRoute";

vi.mock("next/navigation", () => ({
    redirect: vi.fn(),
    useRouter: () => ({ refresh: vi.fn() }),
}));

beforeEach(() => {
    window.localStorage.clear();
});

it("renders the candidate dashboard route shell", async () => {
    render(await CandidateDashboardPage());

    expect(screen.getByRole("banner", { name: "Dashboard header" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Build your first practice plan." })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Set up practice" })).toHaveLength(2);
});

it("renders the V2 dashboard read boundary when completed-round facts are available", async () => {
    render(await renderCandidateDashboardPage({
        dependencies: {
            resolveDashboardModel: async () => ({
                status: "candidate_dashboard_v2_read_model",
                candidateProfileId: "candidate-1",
                candidate: {
                    displayName: "Candidate One",
                    email: "candidate.one@example.com",
                },
                selectedTargetInterview: {
                    status: "candidate_dashboard_target_interview",
                    roleProfileId: null,
                    id: "material handler i",
                    targetRole: "Material Handler I",
                    isSelected: true,
                    activeRoundCount: 0,
                    completedRoundCount: 1,
                    answeredQuestionCount: 2,
                    coachedAnswerCount: 1,
                    lastActivityAt: "2026-07-11T12:00:00.000Z",
                },
                targetInterviews: [{
                    status: "candidate_dashboard_target_interview",
                    roleProfileId: null,
                    id: "material handler i",
                    targetRole: "Material Handler I",
                    isSelected: true,
                    activeRoundCount: 0,
                    completedRoundCount: 1,
                    answeredQuestionCount: 2,
                    coachedAnswerCount: 1,
                    lastActivityAt: "2026-07-11T12:00:00.000Z",
                }],
                source: {
                    kind: "derived_from_candidate_practice_sessions",
                    durableSource: "candidate_practice_sessions",
                    persistence: "read_time_projection",
                    shouldPersistDashboardProjection: false,
                },
                stats: {
                    activeRoundCount: 0,
                    completedRoundCount: 1,
                    answeredQuestionCount: 2,
                    coachedAnswerCount: 1,
                },
                activeRound: null,
                completedRounds: [],
                latestCoachUpdate: {
                    status: "candidate_dashboard_coach_update_ready",
                    candidatePracticeSessionId: "session-1",
                    title: "Material Handler I practice complete",
                    body: "You answered 2 of 3 questions. I have coaching ready for 1 answer.",
                    href: "/candidate/dashboard",
                    completedAt: "2026-07-11T12:00:00.000Z",
                    answeredCount: 2,
                    questionCount: 3,
                },
                coachUpdateState: {
                    status: "candidate_coach_update_unavailable",
                    candidatePracticeSessionId: "session-1",
                    reason: "artifact_missing",
                },
                coachUpdateDetail: null,
                coachingLoop: {
                    status: "candidate_dashboard_coaching_loop_ready",
                    principle: "Use what happened in practice to choose the next useful move.",
                    feedback: {
                        status: "candidate_dashboard_feedback_ready",
                        label: "Coach Update",
                        title: "Material Handler I practice complete",
                        body: "You answered 2 of 3 questions. I have coaching ready for 1 answer.",
                        href: "/candidate/dashboard",
                        completedAt: "2026-07-11T12:00:00.000Z",
                        answeredCount: 2,
                        questionCount: 3,
                        questionContext: "Question 2 · Behavioral",
                        observation: "Your answer connects to the role, but it can use one sharper detail.",
                    },
                    feedforward: {
                        status: "candidate_dashboard_feedforward_ready",
                        label: "Practice Next",
                        title: "Add one result from the inventory count.",
                        body: "Use the latest coach feedback to choose one focused answer pattern to practice next.",
                        href: "/candidate/setup",
                        source: "coaching_focus",
                        questionKeys: ["slot-1"],
                    },
                },
                postRoundReviews: [],
                practiceNext: {
                    status: "candidate_practice_next_ready",
                    source: "coaching_focus",
                    label: "Add one result from the inventory count.",
                    reason: "Use the latest coach feedback to choose one focused answer pattern to practice next.",
                    href: "/candidate/setup",
                    questionKeys: ["slot-1"],
                },
                practiceDirection: {
                    status: "candidate_dashboard_practice_direction_ready",
                    primaryAction: "practice_from_feedback",
                    planProgress: {
                        status: "candidate_dashboard_plan_progress_ready",
                        label: "Plan progress",
                        source: "completed_plan",
                        title: "The latest round is complete.",
                        body: "You answered every planned question in this round.",
                        href: null,
                        questionKeys: [],
                    },
                    coachGuidedFocus: {
                        status: "candidate_dashboard_coach_guided_focus_ready",
                        label: "Practice from feedback",
                        source: "coach_feedback",
                        title: "Add one result from the inventory count.",
                        body: "Use the latest coach feedback to choose one focused answer pattern to practice next.",
                        href: "/candidate/setup",
                        candidatePracticeSessionId: "session-1",
                        questionKeys: ["slot-1"],
                    },
                },
                coachPlan: null,
            }),
        },
    }));

    expect(screen.getByRole("heading", { name: "Material Handler I" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Signed in as Candidate One" })).toHaveTextContent("CO");
    expect(screen.getByText("Coach Update")).toBeInTheDocument();
    expect(screen.getByText("The latest round is complete.")).toBeInTheDocument();
    expect(screen.queryByText("Use what happened in practice to choose the next useful move.")).not.toBeInTheDocument();
    expect(screen.queryByText("Completed rounds")).not.toBeInTheDocument();
    expect(screen.queryByText("Answered questions")).not.toBeInTheDocument();
    expect(screen.queryByText("Coached answers")).not.toBeInTheDocument();
    expect(screen.getByText("Add one result from the inventory count.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your practice is saved." })).toBeInTheDocument();
    expect(screen.queryByText("Material Handler I practice complete")).not.toBeInTheDocument();
});

it("does not render the legacy latest-round transcript without a synthesized Coach Update detail", async () => {
    render(await renderCandidateDashboardPage({
        dependencies: {
            resolveDashboardModel: async () => ({
                status: "candidate_dashboard_v2_read_model",
                candidateProfileId: "candidate-1",
                candidate: {
                    displayName: "Candidate One",
                    email: "candidate.one@example.com",
                },
                selectedTargetInterview: {
                    status: "candidate_dashboard_target_interview",
                    roleProfileId: null,
                    id: "material handler i",
                    targetRole: "Material Handler I",
                    isSelected: true,
                    activeRoundCount: 0,
                    completedRoundCount: 1,
                    answeredQuestionCount: 1,
                    coachedAnswerCount: 1,
                    lastActivityAt: "2026-07-11T12:00:00.000Z",
                },
                targetInterviews: [{
                    status: "candidate_dashboard_target_interview",
                    roleProfileId: null,
                    id: "material handler i",
                    targetRole: "Material Handler I",
                    isSelected: true,
                    activeRoundCount: 0,
                    completedRoundCount: 1,
                    answeredQuestionCount: 1,
                    coachedAnswerCount: 1,
                    lastActivityAt: "2026-07-11T12:00:00.000Z",
                }],
                source: {
                    kind: "derived_from_candidate_practice_sessions",
                    durableSource: "candidate_practice_sessions",
                    persistence: "read_time_projection",
                    shouldPersistDashboardProjection: false,
                },
                stats: {
                    activeRoundCount: 0,
                    completedRoundCount: 1,
                    answeredQuestionCount: 1,
                    coachedAnswerCount: 1,
                },
                activeRound: null,
                completedRounds: [],
                latestCoachUpdate: {
                    status: "candidate_dashboard_coach_update_ready",
                    candidatePracticeSessionId: "session-1",
                    title: "Material Handler I practice complete",
                    body: "You answered 1 of 2 questions. I have coaching ready for 1 answer.",
                    href: "/candidate/dashboard",
                    completedAt: "2026-07-11T12:00:00.000Z",
                    answeredCount: 1,
                    questionCount: 2,
                },
                coachUpdateState: {
                    status: "candidate_coach_update_unavailable",
                    candidatePracticeSessionId: "session-1",
                    reason: "artifact_missing",
                },
                coachUpdateDetail: null,
                coachingLoop: {
                    status: "candidate_dashboard_coaching_loop_ready",
                    principle: "Use what happened in practice to choose the next useful move.",
                    feedback: {
                        status: "candidate_dashboard_feedback_ready",
                        label: "Coach Update",
                        title: "Material Handler I practice complete",
                        body: "You answered 1 of 2 questions. I have coaching ready for 1 answer.",
                        href: "/candidate/dashboard",
                        completedAt: "2026-07-11T12:00:00.000Z",
                        answeredCount: 1,
                        questionCount: 2,
                        questionContext: "Question 1 - Behavioral",
                        observation: "Your answer includes the task, but the result is still missing.",
                    },
                    feedforward: {
                        status: "candidate_dashboard_feedforward_ready",
                        label: "Practice Next",
                        title: "Add the result of the inventory count.",
                        body: "Use the latest coach feedback to choose one focused answer pattern to practice next.",
                        href: "/candidate/setup",
                        source: "coaching_focus",
                        questionKeys: ["slot-1"],
                    },
                },
                postRoundReviews: [{
                    status: "candidate_post_round_review_ready",
                    candidatePracticeSessionId: "session-1",
                    targetRole: "Material Handler I",
                    completedAt: "2026-07-11T12:00:00.000Z",
                    answeredCount: 1,
                    questionCount: 2,
                    questions: [
                        {
                            questionKey: "slot-1",
                            questionNumber: 1,
                            category: "Behavioral",
                            questionText: "Tell me about a time you handled an inventory issue.",
                            status: "practiced",
                            answer: {
                                mode: "text",
                                text: "I noticed the count was off and checked the shipment records before updating the inventory sheet.",
                                submittedAt: "2026-07-11T12:01:00.000Z",
                            },
                            coaching: {
                                acknowledgement: "You chose a relevant work example.",
                                observation: "Your answer includes the task, but the result is still missing.",
                                nextPracticeFocus: "Add the result of the inventory count.",
                                overallBand: "clear",
                            },
                        },
                        {
                            questionKey: "slot-2",
                            questionNumber: 2,
                            category: "Scenario",
                            questionText: "How would you respond if a pallet label did not match the manifest?",
                            status: "skipped_or_unanswered",
                        },
                    ],
                }],
                practiceNext: {
                    status: "candidate_practice_next_ready",
                    source: "coaching_focus",
                    label: "Add the result of the inventory count.",
                    reason: "Use the latest coach feedback to choose one focused answer pattern to practice next.",
                    href: "/candidate/setup",
                    questionKeys: ["slot-1"],
                },
                practiceDirection: {
                    status: "candidate_dashboard_practice_direction_ready",
                    primaryAction: "practice_from_feedback",
                    planProgress: {
                        status: "candidate_dashboard_plan_progress_ready",
                        label: "Plan progress",
                        source: "completed_plan",
                        title: "The latest round is complete.",
                        body: "You answered every planned question in this round.",
                        href: null,
                        questionKeys: [],
                    },
                    coachGuidedFocus: {
                        status: "candidate_dashboard_coach_guided_focus_ready",
                        label: "Practice from feedback",
                        source: "coach_feedback",
                        title: "Add the result of the inventory count.",
                        body: "Use the latest coach feedback to choose one focused answer pattern to practice next.",
                        href: "/candidate/setup",
                        candidatePracticeSessionId: "session-1",
                        questionKeys: ["slot-1"],
                    },
                },
                coachPlan: null,
            }),
        },
    }));

    expect(screen.queryByRole("link", { name: /Coach Update/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your practice is saved." })).toBeInTheDocument();
    expect(screen.queryByText("Q1 - Behavioral")).not.toBeInTheDocument();
    expect(screen.queryByText(/I noticed the count was off/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Q2 - Scenario")).not.toBeInTheDocument();
    expect(screen.queryByText("Needs practice evidence")).not.toBeInTheDocument();
});

it("opens the exact Coach Update artifact from the sparse feedback card", async () => {
    render(await renderCandidateDashboardPage({
        dependencies: {
            resolveDashboardModel: async () => ({
                status: "candidate_dashboard_v2_read_model",
                candidateProfileId: "candidate-1",
                candidate: {
                    displayName: "Candidate One",
                    email: "candidate.one@example.com",
                },
                selectedTargetInterview: {
                    status: "candidate_dashboard_target_interview",
                    roleProfileId: null,
                    id: "material handler i",
                    targetRole: "Material Handler I",
                    isSelected: true,
                    activeRoundCount: 0,
                    completedRoundCount: 1,
                    answeredQuestionCount: 1,
                    coachedAnswerCount: 1,
                    lastActivityAt: "2026-07-11T12:00:00.000Z",
                },
                targetInterviews: [{
                    status: "candidate_dashboard_target_interview",
                    roleProfileId: null,
                    id: "material handler i",
                    targetRole: "Material Handler I",
                    isSelected: true,
                    activeRoundCount: 0,
                    completedRoundCount: 1,
                    answeredQuestionCount: 1,
                    coachedAnswerCount: 1,
                    lastActivityAt: "2026-07-11T12:00:00.000Z",
                }],
                source: {
                    kind: "derived_from_candidate_practice_sessions",
                    durableSource: "candidate_practice_sessions",
                    persistence: "read_time_projection",
                    shouldPersistDashboardProjection: false,
                },
                stats: {
                    activeRoundCount: 0,
                    completedRoundCount: 1,
                    answeredQuestionCount: 1,
                    coachedAnswerCount: 1,
                },
                activeRound: null,
                completedRounds: [],
                latestCoachUpdate: {
                    status: "candidate_dashboard_coach_update_ready",
                    candidatePracticeSessionId: "session-1",
                    title: "Material Handler I practice complete",
                    body: "You answered 1 of 2 questions. I have coaching ready for 1 answer.",
                    href: "/candidate/dashboard",
                    completedAt: "2026-07-11T12:00:00.000Z",
                    answeredCount: 1,
                    questionCount: 2,
                },
                coachUpdateState: {
                    status: "candidate_coach_update_ready",
                    candidatePracticeSessionId: "session-1",
                    presentationKey: "artifact-1",
                    completedAt: "2026-07-11T12:00:00.000Z",
                    answeredCount: 1,
                    questionCount: 2,
                },
                coachUpdateDetail: {
                    status: "candidate_coach_update_detail_ready",
                    presentationKey: "artifact-1",
                    candidatePracticeSessionId: "session-1",
                    targetRole: "Material Handler I",
                    completedAt: "2026-07-11T12:00:00.000Z",
                    answeredCount: 1,
                    questionCount: 2,
                    reviewPosture: "fully_reviewable",
                    summary: "I reviewed your practiced answer.",
                    primaryFocus: "Add the result of the inventory count.",
                    items: [
                        {
                            status: "candidate_coach_update_question_detail",
                            questionKey: "slot-1",
                            questionNumber: 1,
                            category: "Behavioral",
                            questionText: "Tell me about a time you handled an inventory issue.",
                            evidenceStatus: "practiced",
                            answer: {
                                mode: "text",
                                text: "I checked the shipment records before updating the inventory sheet.",
                                submittedAt: "2026-07-11T12:01:00.000Z",
                            },
                            transcriptCanvas: null,
                            coachRead: {
                                acknowledgement: "You chose a relevant work example.",
                                observation: "Your answer includes the task, but the result is still missing.",
                                nextPracticeFocus: "Add the result of the inventory count.",
                                overallBand: "clear",
                            },
                            comparison: {
                                kind: "first_practice",
                                priorComparableAttemptCount: 0,
                                message: "This is the first accepted practice evidence for this question.",
                            },
                            actionPosture: {
                                kind: "review_coaching",
                                label: "Review coach feedback",
                                reason: "This answer has accepted coaching ready.",
                            },
                            focusedPracticeAction: {
                                status: "candidate_focused_practice_action",
                                kind: "practice_from_feedback",
                                label: "Practice this focus",
                                href: "/candidate/practice/ready?intent=coach-update-feedback-focus&fromSession=session-1&questionKey=slot-1",
                                source: {
                                    kind: "coach_update_detail",
                                    candidatePracticeSessionId: "session-1",
                                    questionKey: "slot-1",
                                    questionNumber: 1,
                                    category: "Behavioral",
                                    targetRole: "Material Handler I",
                                },
                            },
                        },
                    ],
                },
                coachingLoop: {
                    status: "candidate_dashboard_coaching_loop_ready",
                    principle: "Use what happened in practice to choose the next useful move.",
                    feedback: {
                        status: "candidate_dashboard_feedback_ready",
                        label: "Coach Update",
                        title: "Material Handler I practice complete",
                        body: "You answered 1 of 2 questions. I have coaching ready for 1 answer.",
                        href: "/candidate/dashboard",
                        completedAt: "2026-07-11T12:00:00.000Z",
                        answeredCount: 1,
                        questionCount: 2,
                    },
                    feedforward: {
                        status: "candidate_dashboard_feedforward_ready",
                        label: "Practice Next",
                        title: "Add the result of the inventory count.",
                        body: "Use the latest coach feedback to choose one focused answer pattern to practice next.",
                        href: "/candidate/setup",
                        source: "coaching_focus",
                        questionKeys: ["slot-1"],
                    },
                },
                postRoundReviews: [],
                practiceNext: {
                    status: "candidate_practice_next_ready",
                    source: "coaching_focus",
                    label: "Add the result of the inventory count.",
                    reason: "Use the latest coach feedback to choose one focused answer pattern to practice next.",
                    href: "/candidate/setup",
                    questionKeys: ["slot-1"],
                },
                practiceDirection: {
                    status: "candidate_dashboard_practice_direction_ready",
                    primaryAction: "practice_from_feedback",
                    planProgress: {
                        status: "candidate_dashboard_plan_progress_ready",
                        label: "Plan progress",
                        source: "completed_plan",
                        title: "The latest round is complete.",
                        body: "You answered every planned question in this round.",
                        href: null,
                        questionKeys: [],
                    },
                    coachGuidedFocus: {
                        status: "candidate_dashboard_coach_guided_focus_ready",
                        label: "Practice from feedback",
                        source: "coach_feedback",
                        title: "Add the result of the inventory count.",
                        body: "Use the latest coach feedback to choose one focused answer pattern to practice next.",
                        href: "/candidate/setup",
                        candidatePracticeSessionId: "session-1",
                        questionKeys: ["slot-1"],
                    },
                },
                coachPlan: null,
            }),
        },
    }));

    expect(screen.getByText("New")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Coach Update" }));

    expect(screen.queryByText("New")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("candidate-v2:coach-update-seen:candidate-1:session-1")).toBe("artifact-1");

    const detail = screen.getByRole("dialog", { name: "Let's review your latest practice." });
    expect(within(detail).getByText("Q1")).toBeInTheDocument();
    expect(within(detail).getByText("Behavioral")).toBeInTheDocument();
    expect(within(detail).getByText("I checked the shipment records before updating the inventory sheet.")).toBeInTheDocument();
    expect(within(detail).getByRole("region", { name: "Coach observation" })).toHaveTextContent(
        "Your answer includes the task, but the result is still missing.",
    );
    expect(within(detail).getByText("Add the result of the inventory count.")).toBeInTheDocument();
    expect(within(detail).queryByText("Q2")).not.toBeInTheDocument();
    expect(within(detail).queryByText("Still needs practice evidence")).not.toBeInTheDocument();
    expect(within(detail).getByRole("button", { name: "Practice this now" })).toBeEnabled();
    expect(within(detail).queryByRole("link", { name: "Practice this now" })).not.toBeInTheDocument();
    expect(within(detail).queryByRole("link", { name: "Practice this question" })).not.toBeInTheDocument();
    expect(JSON.stringify(detail.textContent)).not.toMatch(/score|oneBigUpgrade|percentile|pass|fail/i);

    const priorities = screen.getByRole("region", { name: "Practice priorities" });
    expect(within(priorities).getByRole("heading", { name: "Add the result of the inventory count." }).closest("article"))
        .toHaveClass("is-primary");
});

it("renders selected target interview context and switch links", async () => {
    render(await renderCandidateDashboardPage({
        dependencies: {
            resolveDashboardModel: async () => ({
                status: "candidate_dashboard_v2_read_model",
                candidateProfileId: "candidate-1",
                candidate: {
                    displayName: "Candidate One",
                    email: "candidate.one@example.com",
                },
                selectedTargetInterview: {
                    status: "candidate_dashboard_target_interview",
                    roleProfileId: null,
                    id: "csr",
                    targetRole: "CSR",
                    isSelected: true,
                    activeRoundCount: 0,
                    completedRoundCount: 1,
                    answeredQuestionCount: 5,
                    coachedAnswerCount: 5,
                    lastActivityAt: "2026-07-11T13:00:00.000Z",
                },
                targetInterviews: [
                    {
                        status: "candidate_dashboard_target_interview",
                        roleProfileId: null,
                        id: "csr",
                        targetRole: "CSR",
                        isSelected: true,
                        activeRoundCount: 0,
                        completedRoundCount: 1,
                        answeredQuestionCount: 5,
                        coachedAnswerCount: 5,
                        lastActivityAt: "2026-07-11T13:00:00.000Z",
                    },
                    {
                        status: "candidate_dashboard_target_interview",
                        roleProfileId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                        targetRole: "Packaging Associate",
                        isSelected: false,
                        activeRoundCount: 1,
                        completedRoundCount: 0,
                        answeredQuestionCount: 0,
                        coachedAnswerCount: 0,
                        lastActivityAt: "2026-07-11T12:00:00.000Z",
                    },
                ],
                source: {
                    kind: "derived_from_candidate_practice_sessions",
                    durableSource: "candidate_practice_sessions",
                    persistence: "read_time_projection",
                    shouldPersistDashboardProjection: false,
                },
                stats: {
                    activeRoundCount: 0,
                    completedRoundCount: 1,
                    answeredQuestionCount: 5,
                    coachedAnswerCount: 5,
                },
                activeRound: null,
                completedRounds: [],
                latestCoachUpdate: null,
                coachUpdateState: {
                    status: "candidate_coach_update_awaiting_practice",
                },
                coachUpdateDetail: null,
                coachingLoop: {
                    status: "candidate_dashboard_coaching_loop_ready",
                    principle: "Use what happened in practice to choose the next useful move.",
                    feedback: null,
                    feedforward: {
                        status: "candidate_dashboard_feedforward_ready",
                        label: "Practice Next",
                        title: "Start a practice round",
                        body: "Your first completed practice round will create the evidence this dashboard uses.",
                        href: "/candidate/setup",
                        source: "new_round",
                        questionKeys: [],
                    },
                },
                postRoundReviews: [],
                practiceNext: {
                    status: "candidate_practice_next_ready",
                    source: "new_round",
                    label: "Start a practice round",
                    reason: "Your first completed practice round will create the evidence this dashboard uses.",
                    href: "/candidate/setup",
                    questionKeys: [],
                },
                practiceDirection: {
                    status: "candidate_dashboard_practice_direction_ready",
                    primaryAction: "start_new_round",
                    planProgress: {
                        status: "candidate_dashboard_plan_progress_ready",
                        label: "Plan progress",
                        source: "completed_plan",
                        title: "The latest round is complete.",
                        body: "You answered every planned question in this round.",
                        href: null,
                        questionKeys: [],
                    },
                    coachGuidedFocus: null,
                },
                coachPlan: null,
            }),
        },
    }));

    expect(screen.getByText("Preparing for")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "CSR" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Packaging Associate/i })).toHaveAttribute(
        "href",
        "/candidate/dashboard?prep=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
    expect(screen.getByRole("link", { name: /Prep for a new role/i })).toHaveAttribute("href", "/candidate/setup");
    expect(screen.getByRole("link", { name: "Practice next" })).toHaveAttribute("href", "#practice-next");
    expect(screen.queryByRole("link", { name: "Open practice builder" })).not.toBeInTheDocument();
});

it("loads the durable builder only for the selected opaque prep context", async () => {
    const roleProfileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const resolveNextRoundBuilder = vi.fn(async () => ({
        status: "candidate_next_round_builder_ready" as const,
        candidateProfileId: "candidate-1",
        roleProfileId,
        targetRole: "Quality Inspector",
        candidateNextRoundDraftId: "draft-1",
        version: 3,
        itemCount: 1,
        capacity: 20,
        items: [{
            candidateNextRoundDraftItemId: "item-1",
            sourceCandidatePracticeSessionId: "session-1",
            sourceQuestionKey: "slot-1",
            rootCandidatePracticeSessionId: "session-1",
            rootQuestionKey: "slot-1",
            practiceKind: "practice_from_feedback" as const,
            provenance: "coach_update" as const,
            displayPosition: 0,
            questionNumber: 1,
            category: "Screening",
            questionText: "Why this role?",
            evidenceLabel: "Coach feedback" as const,
        }],
        choices: [],
    }));
    const dashboard = {
        status: "candidate_dashboard_v2_read_model",
        candidateProfileId: "candidate-1",
        candidate: { displayName: "Candidate One", email: "candidate.one@example.com" },
        selectedTargetInterview: {
            status: "candidate_dashboard_target_interview",
            roleProfileId,
            id: roleProfileId,
            targetRole: "Quality Inspector",
            isSelected: true,
            activeRoundCount: 0,
            completedRoundCount: 1,
            answeredQuestionCount: 2,
            coachedAnswerCount: 2,
            lastActivityAt: "2026-07-15T12:00:00.000Z",
        },
        targetInterviews: [],
        source: {
            kind: "derived_from_candidate_practice_sessions",
            durableSource: "candidate_practice_sessions",
            persistence: "read_time_projection",
            shouldPersistDashboardProjection: false,
        },
        stats: { activeRoundCount: 0, completedRoundCount: 1, answeredQuestionCount: 2, coachedAnswerCount: 2 },
        activeRound: null,
        completedRounds: [],
        latestCoachUpdate: null,
        coachUpdateState: { status: "candidate_coach_update_awaiting_practice" },
        coachUpdateDetail: null,
        coachingLoop: {
            status: "candidate_dashboard_coaching_loop_ready",
            principle: "Use what happened in practice to choose the next useful move.",
            feedback: null,
            feedforward: {
                status: "candidate_dashboard_feedforward_ready",
                label: "Practice Next",
                title: "Choose what to practice next.",
                body: "Build a focused round from your Coach Plan.",
                href: "#practice-next",
                source: "new_round",
                questionKeys: [],
            },
        },
        postRoundReviews: [],
        practiceNext: {
            status: "candidate_practice_next_ready",
            source: "new_round",
            label: "Choose what to practice next.",
            reason: "Build a focused round from your Coach Plan.",
            href: "#practice-next",
            questionKeys: [],
        },
        practiceDirection: {
            status: "candidate_dashboard_practice_direction_ready",
            primaryAction: "start_new_round",
            planProgress: {
                status: "candidate_dashboard_plan_progress_ready",
                label: "Plan progress",
                source: "completed_plan",
                title: "Your planned coverage is complete.",
                body: "Choose a focus for your next round.",
                href: null,
                questionKeys: [],
            },
            coachGuidedFocus: null,
        },
        coachPlan: null,
    } as CandidateDashboardV2ReadModel;

    render(await renderCandidateDashboardPage({
        dependencies: {
            resolveDashboardModel: async () => dashboard,
            resolveNextRoundBuilder,
        },
    }));

    expect(resolveNextRoundBuilder).toHaveBeenCalledWith({ candidateProfileId: "candidate-1", roleProfileId });
    expect(screen.getByRole("button", { name: "Next practice round, 1 queued" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open practice builder" })).toBeInTheDocument();
});

it("renders selected-context active round resume details", async () => {
    render(await renderCandidateDashboardPage({
        dependencies: {
            resolveDashboardModel: async () => ({
                status: "candidate_dashboard_v2_read_model",
                candidateProfileId: "candidate-1",
                candidate: {
                    displayName: "Candidate One",
                    email: "candidate.one@example.com",
                },
                selectedTargetInterview: {
                    status: "candidate_dashboard_target_interview",
                    roleProfileId: null,
                    id: "packaging associate",
                    targetRole: "Packaging Associate",
                    isSelected: true,
                    activeRoundCount: 1,
                    completedRoundCount: 0,
                    answeredQuestionCount: 2,
                    coachedAnswerCount: 2,
                    lastActivityAt: "2026-07-11T13:00:00.000Z",
                },
                targetInterviews: [{
                    status: "candidate_dashboard_target_interview",
                    roleProfileId: null,
                    id: "packaging associate",
                    targetRole: "Packaging Associate",
                    isSelected: true,
                    activeRoundCount: 1,
                    completedRoundCount: 0,
                    answeredQuestionCount: 2,
                    coachedAnswerCount: 2,
                    lastActivityAt: "2026-07-11T13:00:00.000Z",
                }],
                source: {
                    kind: "derived_from_candidate_practice_sessions",
                    durableSource: "candidate_practice_sessions",
                    persistence: "read_time_projection",
                    shouldPersistDashboardProjection: false,
                },
                stats: {
                    activeRoundCount: 1,
                    completedRoundCount: 0,
                    answeredQuestionCount: 0,
                    coachedAnswerCount: 0,
                },
                activeRound: {
                    status: "candidate_dashboard_active_round",
                    candidatePracticeSessionId: "active-session",
                    targetRole: "Packaging Associate",
                    sessionStatus: "in_progress",
                    href: "/candidate/session/active-session",
                    questionCount: 5,
                    answeredCount: 2,
                    currentQuestionNumber: 3,
                    progressLabel: "2 of 5 answered",
                },
                completedRounds: [],
                latestCoachUpdate: null,
                coachUpdateState: {
                    status: "candidate_coach_update_awaiting_practice",
                },
                coachUpdateDetail: null,
                coachingLoop: {
                    status: "candidate_dashboard_coaching_loop_ready",
                    principle: "Use what happened in practice to choose the next useful move.",
                    feedback: null,
                    feedforward: {
                        status: "candidate_dashboard_feedforward_ready",
                        label: "Practice Next",
                        title: "Start a practice round",
                        body: "Your first completed practice round will create the evidence this dashboard uses.",
                        href: "/candidate/setup",
                        source: "new_round",
                        questionKeys: [],
                    },
                },
                postRoundReviews: [],
                practiceNext: {
                    status: "candidate_practice_next_ready",
                    source: "new_round",
                    label: "Start a practice round",
                    reason: "Your first completed practice round will create the evidence this dashboard uses.",
                    href: "/candidate/setup",
                    questionKeys: [],
                },
                practiceDirection: {
                    status: "candidate_dashboard_practice_direction_ready",
                    primaryAction: "resume_planned_round",
                    planProgress: {
                        status: "candidate_dashboard_plan_progress_ready",
                        label: "Plan progress",
                        source: "active_round",
                        title: "Resume your current practice round.",
                        body: "Packaging Associate practice is already part of your Coach Plan.",
                        href: "/candidate/session/active-session",
                        questionKeys: [],
                        candidatePracticeSessionId: "active-session",
                    },
                    coachGuidedFocus: null,
                },
                coachPlan: null,
            }),
        },
    }));

    const activeRound = screen.getByRole("region", { name: "Active round" });
    expect(activeRound).toHaveTextContent("Packaging Associate");
    expect(activeRound).toHaveTextContent("2 of 5 answered");
    expect(activeRound).toHaveTextContent("Question 3");
    expect(within(activeRound).getByRole("link", { name: /Resume round/i })).toHaveAttribute(
        "href",
        "/candidate/session/active-session",
    );
});

it("passes explicit prep-context and bounded legacy selection into the dashboard read boundary", async () => {
    let capturedRoleProfileId: string | null | undefined;
    let capturedLegacyTargetRole: string | null | undefined;

    render(await renderCandidateDashboardPage({
        selectedRoleProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        selectedLegacyTargetRole: "csr",
        dependencies: {
            resolveDashboardModel: async ({ selectedRoleProfileId, selectedLegacyTargetRole }) => {
                capturedRoleProfileId = selectedRoleProfileId;
                capturedLegacyTargetRole = selectedLegacyTargetRole;
                return null;
            },
        },
    }));

    expect(capturedRoleProfileId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(capturedLegacyTargetRole).toBe("csr");
    expect(screen.getByRole("heading", { name: "Build your first practice plan." })).toBeInTheDocument();
});

it("does not force SSL for the plain local smoke database URL", () => {
    expect(getCandidateDashboardRuntimeSslConfig(
        "postgresql://postgres:password@127.0.0.1:5434/interviewcoach_smoke",
    )).toBeUndefined();
    expect(getCandidateDashboardRuntimeSslConfig(
        "postgresql://postgres:password@127.0.0.1:5434/interviewcoach_smoke?sslmode=disable",
    )).toBe(false);
    expect(getCandidateDashboardRuntimeSslConfig(
        "postgresql://postgres:password@db.example.supabase.co:5432/postgres?sslmode=require",
    )).toEqual({ rejectUnauthorized: false });
});
