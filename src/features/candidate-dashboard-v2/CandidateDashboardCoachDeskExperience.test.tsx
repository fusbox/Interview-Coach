import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CandidateDashboardV2ReadModel } from "./candidate-dashboard-read-model";
import { CandidateDashboardCoachDeskExperience } from "./CandidateDashboardCoachDeskExperience";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: vi.fn() }),
}));

describe("CandidateDashboardCoachDeskExperience", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it("renders the cold-start stage with the accepted hierarchy and moves to plan progress", () => {
        render(<CandidateDashboardCoachDeskExperience dashboard={createColdStartDashboard()} />);

        const stage = screen.getByRole("region", {
            name: "Start with the questions most likely to shape this interview",
        });
        expect(stage).toHaveClass("surface-glass-raised", "candidate-dashboard-stage--cold");
        expect(within(stage).getByText("Your plan is ready")).toBeInTheDocument();
        expect(within(stage).getByText("2 questions")).toBeInTheDocument();
        expect(within(stage).getByText("Question 1 of 2 · Behavioral")).toBeInTheDocument();
        expect(within(stage).getByRole("link", { name: "Start question 1" })).toHaveAttribute(
            "href",
            "/candidate/setup",
        );

        fireEvent.click(screen.getByRole("tab", { name: "Progress" }));

        expect(screen.getByRole("heading", { name: "Coach plan progress" })).toBeInTheDocument();
        expect(screen.getByRole("img", { name: "0 of 2 questions are Strong" })).toBeInTheDocument();
        expect(screen.getAllByText("Not practiced yet")).toHaveLength(2);
    });

    it("keeps unfinished-round facts primary and does not fabricate a supporting row", () => {
        const dashboard = createColdStartDashboard({
            activeRound: {
                status: "candidate_dashboard_active_round",
                candidatePracticeSessionId: "session-active",
                targetRole: "Senior Product Designer",
                sessionStatus: "in_progress",
                href: "/candidate/session/session-active",
                questionCount: 2,
                answeredCount: 1,
                currentQuestionNumber: 2,
                progressLabel: "1 of 2 answered",
            },
            practiceDirection: {
                status: "candidate_dashboard_practice_direction_ready",
                primaryAction: "resume_planned_round",
                planProgress: {
                    status: "candidate_dashboard_plan_progress_ready",
                    label: "Plan progress",
                    source: "active_round",
                    title: "Resume your current practice round.",
                    body: "Finish the planned round before starting another focus.",
                    href: "/candidate/session/session-active",
                    questionKeys: [],
                    candidatePracticeSessionId: "session-active",
                },
                coachGuidedFocus: null,
            },
        });

        render(<CandidateDashboardCoachDeskExperience dashboard={dashboard} />);

        const stage = screen.getByRole("region", { name: "Pick up where you left off" });
        expect(stage).toHaveClass("surface-glass-raised", "candidate-dashboard-stage--unfinished");
        expect(within(stage).getByText("Round in progress")).toBeInTheDocument();
        expect(within(stage).getByText("1 of 2 answered")).toBeInTheDocument();
        expect(within(stage).getByText("Question 2 of 2 · Situational")).toBeInTheDocument();
        expect(within(stage).getByRole("link", { name: "Resume question 2" })).toHaveAttribute(
            "href",
            "/candidate/session/session-active",
        );
        expect(screen.queryByText(/Questions 1–2 saved/i)).not.toBeInTheDocument();
        expect(document.querySelector(".candidate-dashboard-quiet-row")).not.toBeInTheDocument();
    });

    it("uses roving tab focus and keeps Strong as the only checked question badge", async () => {
        render(<CandidateDashboardCoachDeskExperience dashboard={createProgressDashboard()} />);

        const practiceTab = screen.getByRole("tab", { name: "Practice" });
        practiceTab.focus();
        fireEvent.keyDown(practiceTab, { key: "End" });

        const progressTab = screen.getByRole("tab", { name: "Progress" });
        expect(progressTab).toHaveAttribute("aria-selected", "true");
        expect(progressTab).toHaveFocus();
        expect(screen.getByRole("img", { name: "1 of 2 questions are Strong" })).toBeInTheDocument();

        const strongRow = screen.getByText("Strong").closest("li");
        const clearRow = screen.getByText("Clear").closest("li");
        expect(strongRow).toHaveAttribute("data-band", "strong");
        expect(strongRow?.querySelector("svg")).toBeInTheDocument();
        expect(clearRow).toHaveAttribute("data-band", "clear");
        expect(clearRow?.querySelector("svg")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "View plan" }));
        const dialog = screen.getByRole("dialog", { name: "Senior Product Designer" });
        expect(within(dialog).getByRole("tab", { name: "Question 1: Strong" })).toBeInTheDocument();
        const questionsTab = within(dialog).getByRole("tab", { name: "Questions" });
        questionsTab.focus();
        fireEvent.keyDown(questionsTab, { key: "End" });
        await waitFor(() => {
            expect(within(dialog).getByRole("tab", { name: "Categories" })).toHaveFocus();
        });
        expect(within(dialog).getByRole("button", { name: /Behavioral.*1 of 1 Strong/i })).toBeInTheDocument();
    });
});

function createColdStartDashboard(
    overrides: Partial<CandidateDashboardV2ReadModel> = {},
): CandidateDashboardV2ReadModel {
    const dashboard: CandidateDashboardV2ReadModel = {
        status: "candidate_dashboard_v2_read_model",
        candidateProfileId: "candidate-1",
        candidate: { displayName: "Morgan Patel", email: "morgan@example.com" },
        selectedTargetInterview: {
            status: "candidate_dashboard_target_interview",
            id: "role-profile-1",
            roleProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            targetRole: "Senior Product Designer",
            isSelected: true,
            activeRoundCount: 0,
            completedRoundCount: 0,
            answeredQuestionCount: 0,
            coachedAnswerCount: 0,
            lastActivityAt: "2026-07-31T12:00:00.000Z",
        },
        targetInterviews: [],
        source: {
            kind: "derived_from_candidate_practice_sessions",
            durableSource: "candidate_practice_sessions",
            persistence: "read_time_projection",
            shouldPersistDashboardProjection: false,
        },
        stats: {
            activeRoundCount: 0,
            completedRoundCount: 0,
            answeredQuestionCount: 0,
            coachedAnswerCount: 0,
        },
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
            primaryAction: "start_first_round",
            planProgress: {
                status: "candidate_dashboard_plan_progress_ready",
                label: "Plan progress",
                source: "first_round",
                title: "Start a practice round",
                body: "Your first completed practice round will create the evidence this dashboard uses.",
                href: "/candidate/setup",
                questionKeys: [],
            },
            coachGuidedFocus: null,
        },
        coachPlan: {
            status: "candidate_coach_plan_reference_ready",
            source: {
                kind: "prep_context_baseline",
                baselineCandidatePracticeSessionId: "baseline-session",
                roleProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            },
            targetRole: "Senior Product Designer",
            stage: {
                id: "screening",
                label: "Screening call",
                detail: "Prepare for an early conversation.",
            },
            questionCount: 2,
            practicedQuestionCount: 0,
            missingEvidenceCount: 2,
            categories: [{
                category: "behavioral",
                label: "Behavioral",
                purpose: "Use a past example.",
                plannedCount: 1,
                practicedCount: 0,
                missingEvidenceCount: 1,
                teaching: {
                    definition: "Show what you did in a real situation.",
                    answerShape: ["Situation", "Action", "Result"],
                    watchFor: ["General claims without evidence"],
                },
            }, {
                category: "case_scenario",
                label: "Situational",
                purpose: "Explain how you would respond.",
                plannedCount: 1,
                practicedCount: 0,
                missingEvidenceCount: 1,
                teaching: {
                    definition: "Make your decision process visible.",
                    answerShape: ["Context", "Decision", "Outcome"],
                    watchFor: ["Skipping the tradeoff"],
                },
            }],
            questions: [{
                questionKey: "slot-1",
                questionNumber: 1,
                category: "behavioral",
                categoryLabel: "Behavioral",
                questionText: "Tell me about a time you resolved a high-risk customer issue.",
                evidenceStatus: "missing_evidence",
            }, {
                questionKey: "slot-2",
                questionNumber: 2,
                category: "case_scenario",
                categoryLabel: "Situational",
                questionText: "How would you communicate a service disruption to key accounts?",
                evidenceStatus: "missing_evidence",
            }],
        },
        questionPreparedness: null,
    };

    return { ...dashboard, ...overrides };
}

function createProgressDashboard(): CandidateDashboardV2ReadModel {
    return createColdStartDashboard({
        questionPreparedness: {
            status: "candidate_question_preparedness_progress",
            source: {
                persistence: "read_time_projection",
                durableFacts: [
                    "candidate_practice_plan_baselines",
                    "candidate_practice_sessions",
                    "candidate_answer_attempts",
                    "candidate_answer_evaluation_runs",
                ],
                bandSelection: "highest_earned",
                regressionPolicy: "deferred_keep_highest",
            },
            coverage: {
                canonicalQuestionCount: 2,
                unpracticedQuestionCount: 0,
                attemptedQuestionCount: 2,
                evaluatedQuestionCount: 2,
                incompleteQuestionCount: 0,
                evaluationUnavailableQuestionCount: 0,
            },
            achievement: { emerging: 0, clear: 1, strong: 1 },
            questions: [{
                questionKey: "slot-1",
                questionNumber: 1,
                category: "behavioral",
                questionText: "Tell me about a time you resolved a high-risk customer issue.",
                attemptCount: 1,
                evaluatedAttemptCount: 1,
                state: "rated",
                band: "strong",
                highestEarnedAttemptId: "attempt-1",
                latestAttempt: null,
            }, {
                questionKey: "slot-2",
                questionNumber: 2,
                category: "case_scenario",
                questionText: "How would you communicate a service disruption to key accounts?",
                attemptCount: 1,
                evaluatedAttemptCount: 1,
                state: "rated",
                band: "clear",
                highestEarnedAttemptId: "attempt-2",
                latestAttempt: null,
            }],
        },
    });
}
