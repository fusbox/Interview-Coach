import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import CandidateDashboardPage, { getCandidateDashboardRuntimeSslConfig, renderCandidateDashboardPage } from "./page";

it("renders the candidate dashboard route shell", async () => {
    render(await CandidateDashboardPage());

    expect(screen.getByRole("heading", { name: "Coach Plan" })).toBeInTheDocument();
    expect(screen.getByText(/Start with one practice round/i)).toBeInTheDocument();
});

it("renders the V2 dashboard read boundary when completed-round facts are available", async () => {
    render(await renderCandidateDashboardPage({
        dependencies: {
            resolveDashboardModel: async () => ({
                status: "candidate_dashboard_v2_read_model",
                candidateProfileId: "candidate-1",
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
                        href: "/candidate/setup",
                        questionKeys: [],
                    },
                    coachGuidedFocus: {
                        status: "candidate_dashboard_coach_guided_focus_ready",
                        label: "Practice from feedback",
                        source: "coach_feedback",
                        title: "Add one result from the inventory count.",
                        body: "Use the latest coach feedback to choose one focused answer pattern to practice next.",
                        href: "/candidate/setup",
                        questionKeys: ["slot-1"],
                    },
                },
            }),
        },
    }));

    expect(screen.getByRole("heading", { name: "Coach Plan" })).toBeInTheDocument();
    expect(screen.getByText("Coach Update")).toBeInTheDocument();
    expect(screen.getByText("Plan progress")).toBeInTheDocument();
    expect(screen.getByText("Practice from feedback")).toBeInTheDocument();
    expect(screen.getByText("Use what happened in practice to choose the next useful move.")).toBeInTheDocument();
    expect(screen.getByText("Completed rounds")).toBeInTheDocument();
    expect(screen.getByText("Answered questions")).toBeInTheDocument();
    expect(screen.getByText("Coached answers")).toBeInTheDocument();
    expect(screen.getByText("Add one result from the inventory count.")).toBeInTheDocument();
    expect(screen.getByText("Material Handler I practice complete")).toBeInTheDocument();
});

it("renders the latest round review as a question-first coach update surface", async () => {
    render(await renderCandidateDashboardPage({
        dependencies: {
            resolveDashboardModel: async () => ({
                status: "candidate_dashboard_v2_read_model",
                candidateProfileId: "candidate-1",
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
                        href: "/candidate/setup",
                        questionKeys: [],
                    },
                    coachGuidedFocus: {
                        status: "candidate_dashboard_coach_guided_focus_ready",
                        label: "Practice from feedback",
                        source: "coach_feedback",
                        title: "Add the result of the inventory count.",
                        body: "Use the latest coach feedback to choose one focused answer pattern to practice next.",
                        href: "/candidate/setup",
                        questionKeys: ["slot-1"],
                    },
                },
            }),
        },
    }));

    expect(screen.getByRole("link", { name: /Coach Update/i })).toHaveAttribute(
        "href",
        "#latest-round-review",
    );
    expect(screen.getByText("Q1 - Behavioral")).toBeInTheDocument();
    expect(screen.getByText(/I noticed the count was off/i)).toBeInTheDocument();
    expect(screen.getAllByText("Your answer includes the task, but the result is still missing.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Add the result of the inventory count.").length).toBeGreaterThan(0);
    expect(screen.getByText("Q2 - Scenario")).toBeInTheDocument();
    expect(screen.getByText("Needs practice evidence")).toBeInTheDocument();
    expect(screen.getByText(/pallet label did not match/i)).toBeInTheDocument();
});

it("opens a Coach Update detail section from the sparse feedback card", async () => {
    render(await renderCandidateDashboardPage({
        dependencies: {
            resolveDashboardModel: async () => ({
                status: "candidate_dashboard_v2_read_model",
                candidateProfileId: "candidate-1",
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
                coachUpdateDetail: {
                    status: "candidate_coach_update_detail_ready",
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
                        href: "/candidate/setup",
                        questionKeys: [],
                    },
                    coachGuidedFocus: {
                        status: "candidate_dashboard_coach_guided_focus_ready",
                        label: "Practice from feedback",
                        source: "coach_feedback",
                        title: "Add the result of the inventory count.",
                        body: "Use the latest coach feedback to choose one focused answer pattern to practice next.",
                        href: "/candidate/setup",
                        questionKeys: ["slot-1"],
                    },
                },
            }),
        },
    }));

    expect(screen.getByRole("link", { name: /Coach Update/i })).toHaveAttribute("href", "#coach-update-detail");

    const detail = screen.getByRole("region", { name: "Coach Update detail" });
    expect(within(detail).getByRole("heading", { name: "Material Handler I Coach Update" })).toBeInTheDocument();
    expect(within(detail).getByText("Q1 - Behavioral")).toBeInTheDocument();
    expect(within(detail).getByText("I checked the shipment records before updating the inventory sheet.")).toBeInTheDocument();
    expect(within(detail).getByRole("region", { name: "Coach observation" })).toHaveTextContent(
        "Your answer includes the task, but the result is still missing.",
    );
    expect(within(detail).getByText("Add the result of the inventory count.")).toBeInTheDocument();
    expect(within(detail).queryByText("Q2 - Scenario")).not.toBeInTheDocument();
    expect(within(detail).queryByText("Still needs practice evidence")).not.toBeInTheDocument();
    expect(within(detail).getByRole("link", { name: "Practice this focus" })).toHaveAttribute(
        "href",
        "/candidate/practice/ready?intent=coach-update-feedback-focus&fromSession=session-1&questionKey=slot-1",
    );
    expect(within(detail).queryByRole("link", { name: "Practice this question" })).not.toBeInTheDocument();
    expect(JSON.stringify(detail.textContent)).not.toMatch(/score|oneBigUpgrade|percentile|pass|fail/i);
});

it("renders selected target interview context and switch links", async () => {
    render(await renderCandidateDashboardPage({
        dependencies: {
            resolveDashboardModel: async () => ({
                status: "candidate_dashboard_v2_read_model",
                candidateProfileId: "candidate-1",
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
                        href: "/candidate/setup",
                        questionKeys: [],
                    },
                    coachGuidedFocus: null,
                },
            }),
        },
    }));

    expect(screen.getByRole("navigation", { name: "Interview prep context" })).toHaveTextContent("Current focus");
    expect(screen.getByRole("heading", { name: "CSR" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Packaging Associate/i })).toHaveAttribute(
        "href",
        "/candidate/dashboard?prep=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
});

it("renders selected-context active round resume details", async () => {
    render(await renderCandidateDashboardPage({
        dependencies: {
            resolveDashboardModel: async () => ({
                status: "candidate_dashboard_v2_read_model",
                candidateProfileId: "candidate-1",
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
    expect(screen.getByText(/Start with one practice round/i)).toBeInTheDocument();
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
