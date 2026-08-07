import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CandidateNextRoundBuilderModel } from "@/features/candidate-practice-v2/candidate-next-round-builder";

import type { CandidateDashboardV2ReadModel } from "./candidate-dashboard-read-model";
import {
    CANDIDATE_COACH_UPDATE_REFRESH_DELAYS_MS,
    CandidateDashboardCoachDeskExperience,
    createCandidateActivePracticeNoticeStorageKey,
} from "./CandidateDashboardCoachDeskExperience";
import { CandidateNextRoundBuilderExperience } from "./CandidateNextRoundBuilderExperience";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
    useRouter: () => router,
}));

describe("CandidateDashboardCoachDeskExperience", () => {
    beforeEach(() => {
        window.localStorage.clear();
        router.refresh.mockReset();
    });

    afterEach(() => vi.useRealTimers());

    it("bounds pending Coach Update refreshes and leaves an explicit status check", async () => {
        vi.useFakeTimers();
        render(<CandidateDashboardCoachDeskExperience dashboard={createColdStartDashboard({
            coachUpdateState: {
                status: "candidate_coach_update_pending",
                candidatePracticeSessionId: "session-pending",
                requestedAt: "2026-08-07T12:00:00.000Z",
            },
        })} />);

        const pendingStatus = screen.getByText(/preparing your review/i).closest("article");
        expect(pendingStatus).toHaveAttribute("aria-busy", "true");
        for (const delay of CANDIDATE_COACH_UPDATE_REFRESH_DELAYS_MS) {
            await act(async () => {
                await vi.advanceTimersByTimeAsync(delay);
            });
        }

        expect(router.refresh).toHaveBeenCalledTimes(CANDIDATE_COACH_UPDATE_REFRESH_DELAYS_MS.length);
        const checkForUpdate = screen.getByRole("button", { name: "Check for update" });
        fireEvent.click(checkForUpdate);
        expect(router.refresh).toHaveBeenCalledTimes(CANDIDATE_COACH_UPDATE_REFRESH_DELAYS_MS.length + 1);
        expect(screen.queryByRole("button", { name: "Check for update" })).not.toBeInTheDocument();
    });

    it("cancels pending Coach Update refresh when lifecycle state changes", async () => {
        vi.useFakeTimers();
        const { rerender } = render(<CandidateDashboardCoachDeskExperience dashboard={createColdStartDashboard({
            coachUpdateState: {
                status: "candidate_coach_update_pending",
                candidatePracticeSessionId: "session-pending",
                requestedAt: "2026-08-07T12:00:00.000Z",
            },
        })} />);

        rerender(<CandidateDashboardCoachDeskExperience dashboard={createColdStartDashboard()} />);
        await act(async () => {
            await vi.runAllTimersAsync();
        });

        expect(router.refresh).not.toHaveBeenCalled();
    });

    it("renders the cold-start stage without inventing progress before evidence exists", () => {
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
        expect(within(stage).getByRole("list", { name: "2-question Coach Plan. Question 1 is recommended first." })).toBeInTheDocument();
        expect(screen.queryByRole("tab", { name: "Progress" })).not.toBeInTheDocument();
        expect(screen.queryByRole("img", { name: /questions are Strong/ })).not.toBeInTheDocument();
    });

    it("keeps unfinished-round continuity dismissible without hiding durable resume actions", async () => {
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

        const notice = await screen.findByRole("region", { name: "Practice in progress" });
        expect(notice).toHaveClass("surface-calm", "candidate-dashboard-active-practice-notice");
        expect(within(notice).getByRole("status")).toHaveTextContent("1 of 2 answered");
        expect(within(notice).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
        expect(within(notice).queryByText(/Question 2 of 2/)).not.toBeInTheDocument();
        const continueRound = screen.getByRole("link", { name: "Continue practice at question 2" });
        expect(continueRound).toHaveAttribute(
            "href",
            "/candidate/session/session-active",
        );
        expect(screen.getByRole("link", { name: "Practice only question 2 now" })).toHaveAttribute(
            "href",
            "/candidate/session/session-active?pace=one",
        );
        expect(screen.queryByText(/Questions 1–2 saved/i)).not.toBeInTheDocument();
        expect(document.querySelector(".candidate-dashboard-quiet-row")).not.toBeInTheDocument();

        fireEvent.click(within(notice).getByRole("button", {
            name: "Dismiss practice-in-progress notification",
        }));
        await waitFor(() => expect(notice).not.toBeInTheDocument());
        await waitFor(() => expect(continueRound).toHaveFocus());
        expect(window.localStorage.getItem(createCandidateActivePracticeNoticeStorageKey(dashboard)!)).toBe(
            "v1",
        );
    });

    it("reuses the canonical Plan Dial and limits unfinished-plan actions to unanswered questions", () => {
        const dashboard = createProgressDashboard();
        dashboard.activeRound = {
            status: "candidate_dashboard_active_round",
            candidatePracticeSessionId: "session-active",
            targetRole: "Senior Product Designer",
            sessionStatus: "in_progress",
            href: "/candidate/session/session-active",
            questionCount: 2,
            answeredCount: 1,
            answeredQuestionKeys: ["slot-1"],
            currentQuestionNumber: 2,
            progressLabel: "1 of 2 answered",
        };

        render(<CandidateDashboardCoachDeskExperience dashboard={dashboard} />);

        const plan = screen.getByRole("region", { name: "Coach plan" });
        expect(plan).toHaveClass("surface-plan", "candidate-dashboard-plan-progress");
        expect(within(plan).getByRole("button", { name: "View Coach Plan" })).toBeInTheDocument();
        expect(plan.querySelector(".candidate-dashboard-plan-dial-cluster")).toHaveClass(
            "candidate-plan-dial--layout-card",
            "candidate-plan-dial--material-plan",
        );
        expect(plan.querySelector(".candidate-dashboard-plan-dial")).toBeInTheDocument();
        expect(plan.querySelector(".candidate-dashboard-plan-dial__gauge em")).toHaveTextContent("Strong");
        expect(plan.querySelectorAll("[data-plan-question]")).toHaveLength(2);
        expect(within(plan).getByText("Clear")).toBeInTheDocument();
        expect(within(plan).getAllByText("Strong")).toHaveLength(2);

        fireEvent.click(within(plan).getByRole("button", { name: "View Coach Plan" }));
        const dialog = screen.getByRole("dialog", { name: "Senior Product Designer" });
        expect(dialog.querySelector(".candidate-dashboard-plan-dial-cluster")).toHaveClass(
            "candidate-plan-dial--layout-reference",
            "candidate-plan-dial--material-neutral",
        );
        fireEvent.click(within(dialog).getByRole("button", { name: "Reveal question" }));
        expect(within(dialog).queryByRole("link", { name: "Practice this now" })).not.toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole("tab", { name: /Question 2:/ }));
        fireEvent.click(within(dialog).getByRole("button", { name: "Reveal question" }));
        expect(within(dialog).getByRole("link", { name: "Practice this now" })).toHaveAttribute(
            "href",
            "/candidate/session/baseline-session?pace=one&question=slot-2",
        );
    });

    it("keeps quiet and promoted Practice Next tied to one canonical question and one coaching move", async () => {
        const base = createColdStartDashboard();
        const questionText = "The shift is 9:30 a.m. to 6 p.m. Does this schedule work for you?";
        const recommendedMove = "Keep the answer professional without sharing private personal details.";
        const dashboard = createColdStartDashboard({
            coachUpdateState: {
                status: "candidate_coach_update_ready",
                candidatePracticeSessionId: "follow-up-session",
                presentationKey: "update-1",
                completedAt: "2026-08-04T12:00:00.000Z",
                answeredCount: 1,
                questionCount: 1,
            },
            coachUpdateDetail: {
                status: "candidate_coach_update_detail_ready",
                presentationKey: "update-1",
                candidatePracticeSessionId: "follow-up-session",
                targetRole: "Senior Product Designer",
                completedAt: "2026-08-04T12:00:00.000Z",
                answeredCount: 1,
                questionCount: 1,
                reviewPosture: "fully_reviewable",
                summary: "Your feedback is ready.",
                primaryFocus: recommendedMove,
                items: [{
                    status: "candidate_coach_update_question_detail",
                    questionKey: "slot-1",
                    sourceOccurrence: {
                        candidatePracticeSessionId: "follow-up-session",
                        questionKey: "slot-1",
                    },
                    canonicalQuestion: {
                        candidatePracticeSessionId: "source-session",
                        questionKey: "slot-4",
                    },
                    questionNumber: 4,
                    category: "Screening",
                    questionText,
                    evidenceStatus: "practiced",
                    answer: {
                        mode: "text",
                        text: "The schedule works for me.",
                        submittedAt: "2026-08-04T11:55:00.000Z",
                    },
                    transcriptCanvas: null,
                    coachRead: {
                        acknowledgement: "You answered directly.",
                        observation: "You confirmed your availability.",
                        nextPracticeFocus: "Try the question again.",
                    },
                    comparison: {
                        kind: "first_practice",
                        priorComparableAttemptCount: 0,
                        message: "This is your first practice attempt for this question.",
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
                        href: "/candidate/practice/ready?intent=coach-update-feedback-focus&fromSession=follow-up-session&questionKey=slot-1",
                        source: {
                            kind: "coach_update_detail",
                            candidatePracticeSessionId: "follow-up-session",
                            questionKey: "slot-1",
                            questionNumber: 4,
                            category: "Screening",
                            targetRole: "Senior Product Designer",
                        },
                    },
                }],
            },
            practiceDirection: {
                status: "candidate_dashboard_practice_direction_ready",
                primaryAction: "practice_from_feedback",
                planProgress: {
                    status: "candidate_dashboard_plan_progress_ready",
                    label: "Plan progress",
                    source: "completed_plan",
                    title: "The latest round is complete.",
                    body: "Feedback-based practice can build on what I noticed.",
                    href: null,
                    questionKeys: [],
                },
                coachGuidedFocus: {
                    status: "candidate_dashboard_coach_guided_focus_ready",
                    label: "Practice from feedback",
                    source: "coach_feedback",
                    title: recommendedMove,
                    body: "Use the latest coach feedback to choose one focused answer pattern to practice next.",
                    href: "/candidate/practice/ready?intent=coach-update-feedback-focus&fromSession=follow-up-session&questionKey=slot-1",
                    candidatePracticeSessionId: "follow-up-session",
                    sourceQuestionKey: "slot-1",
                    questionKeys: ["slot-4"],
                },
            },
            coachPlan: {
                ...base.coachPlan!,
                questionCount: 5,
                questions: [{
                    questionKey: "slot-4",
                    questionNumber: 4,
                    category: "screening",
                    categoryLabel: "Screening",
                    questionText,
                    evidenceStatus: "practiced",
                }],
            },
        });

        render(<CandidateDashboardCoachDeskExperience dashboard={dashboard} />);

        expect(screen.queryByRole("button", { name: "Open one-question practice for question 4" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Review question 4" }));
        fireEvent.click(screen.getByRole("button", { name: "Close Coach Update" }));

        const quietCoachUpdate = screen.getByRole("button", { name: "Open Coach Update" });
        expect(quietCoachUpdate).toHaveClass("surface-coach-quiet");
        expect(quietCoachUpdate).not.toHaveClass("surface-glass-quiet");

        const oneQuestionTrigger = screen.getByRole("button", { name: "Open one-question practice for question 4" });
        expect(within(oneQuestionTrigger).getByText("One-question round")).toBeInTheDocument();
        expect(within(oneQuestionTrigger).getByText("Sharpen one answer.")).toBeInTheDocument();
        expect(within(oneQuestionTrigger).getByText("Practice next · Q4")).toBeInTheDocument();

        fireEvent.click(oneQuestionTrigger);
        const dialog = screen.getByRole("dialog", { name: "One-question round" });
        expect(within(dialog).getByText(/Question 4 of 5.*Screening/)).toBeInTheDocument();
        expect(within(dialog).getByText(questionText)).toBeInTheDocument();
        expect(within(dialog).getByRole("heading", { name: recommendedMove })).toBeInTheDocument();
        expect(within(dialog).queryByText("Use the latest coach feedback to choose one focused answer pattern to practice next.")).not.toBeInTheDocument();
        expect(within(dialog).queryByText("Try the question again.")).not.toBeInTheDocument();
        expect(within(dialog).getByRole("button", { name: "Practice this now" })).toBeEnabled();
    });

    it("shares one Plan Dial while preserving summary and interactive question identity", async () => {
        render(<CandidateDashboardCoachDeskExperience dashboard={createProgressDashboard()} />);

        expect(screen.getByRole("img", { name: /^1 of 2 questions are Strong/ })).toBeInTheDocument();
        expect(screen.queryByRole("tab", { name: "Practice" })).not.toBeInTheDocument();

        const dial = document.querySelector(".candidate-dashboard-plan-dial");
        const strongRow = dial?.querySelector('[data-plan-question][data-band="strong"]');
        const clearRow = dial?.querySelector('[data-plan-question][data-band="clear"]');
        expect(strongRow).toHaveAttribute("data-band", "strong");
        expect(strongRow?.querySelector(".candidate-dashboard-plan-dial__node-content > svg")).toBeInTheDocument();
        expect(clearRow).toHaveAttribute("data-band", "clear");
        expect(clearRow?.querySelector("svg")).not.toBeInTheDocument();
        expect(clearRow?.querySelector(".candidate-dashboard-plan-dial__node-content")).toHaveTextContent("Q2");

        fireEvent.click(screen.getByRole("button", { name: "View Coach Plan" }));
        const dialog = screen.getByRole("dialog", { name: "Senior Product Designer" });
        const planHeading = within(dialog).getByRole("heading", { name: "Senior Product Designer" });
        expect(planHeading.closest("header")).toHaveClass("candidate-opened-surface-header");
        expect(within(planHeading.closest("header") as HTMLElement).getByText("Coach plan")).toBeInTheDocument();
        const strongQuestionTab = within(dialog).getByRole("tab", { name: "Question 1: Strong" });
        expect(strongQuestionTab).toHaveTextContent("Q1");
        expect(strongQuestionTab.querySelector("svg")).toBeInTheDocument();
        expect(within(dialog).queryByText("Your interview range")).not.toBeInTheDocument();
        expect(dialog.querySelector(".candidate-coach-plan-map")).not.toHaveClass("surface-plan");
        fireEvent.click(within(dialog).getByRole("button", { name: "Reveal question" }));
        const answerGuidance = within(dialog).getByRole("region", { name: "Answer guidance" });
        expect(answerGuidance).toHaveClass("surface-plan");
        expect(answerGuidance).toContainElement(within(dialog).getByRole("list", { name: "Answer shape for question 1" }));
        expect(answerGuidance.querySelectorAll(".workflow-timeline__node.on-color-glass")).toHaveLength(3);
        expect(within(answerGuidance).getByText("Watch for").closest("aside")).toHaveClass("on-color-glass");
        const questionsTab = within(dialog).getByRole("tab", { name: "Questions" });
        expect(questionsTab).toHaveAttribute("aria-controls", "candidate-coach-plan-question-panel");
        questionsTab.focus();
        fireEvent.keyDown(questionsTab, { key: "End" });
        await waitFor(() => {
            expect(within(dialog).getByRole("tab", { name: "Categories" })).toHaveFocus();
        });
        expect(within(dialog).queryByRole("tab", { name: "Question 1: Strong" })).not.toBeInTheDocument();
        const categoryPattern = within(dialog).getByRole("region", { name: "Question status by category" });
        expect(categoryPattern).toHaveClass("surface-plan");
        expect(categoryPattern.querySelector(".candidate-coach-plan-category-pattern__table")).toHaveClass(
            "on-color-glass",
        );
        expect(within(dialog).getByRole("button", { name: "Behavioral. Question 1, Strong" })).toHaveAttribute(
            "aria-pressed",
            "true",
        );
        const categoryGuidance = within(dialog).getByRole("article", { name: "Behavioral answer guidance" });
        expect(categoryGuidance).toHaveClass("candidate-coach-plan-guidance--light");
        expect(categoryGuidance).toContainElement(
            within(dialog).getByRole("list", { name: "Answer shape for Behavioral" }),
        );
        expect(within(categoryGuidance).getByText("Watch for").closest("aside")).toHaveClass(
            "candidate-coach-plan-watch--light",
        );
        expect(within(dialog).queryByText("Category view")).not.toBeInTheDocument();
        expect(within(dialog).queryByText("How your plan is taking shape")).not.toBeInTheDocument();
        expect(within(dialog).queryByText("Plan pattern")).not.toBeInTheDocument();
        expect(within(dialog).queryByText("Where each question stands")).not.toBeInTheDocument();
        expect(within(dialog).queryByText("In this category")).not.toBeInTheDocument();
    });

    it("keeps the nonempty Next Round handoff visible outside opened Coach Plan content", () => {
        render(
            <CandidateNextRoundBuilderExperience initialBuilder={createQueuedNextRoundBuilder()}>
                <CandidateDashboardCoachDeskExperience dashboard={createProgressDashboard()} />
            </CandidateNextRoundBuilderExperience>,
        );

        fireEvent.click(screen.getByRole("button", { name: "View Coach Plan" }));

        const dialog = screen.getByRole("dialog", { name: "Senior Product Designer" });
        expect(within(dialog).getByRole("group", { name: "Next round, 1 question" })).toBeInTheDocument();
        expect(within(dialog).getByRole("button", { name: "Review next round" })).toBeInTheDocument();
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

function createQueuedNextRoundBuilder(): CandidateNextRoundBuilderModel {
    return {
        status: "candidate_next_round_builder_ready",
        candidateProfileId: "candidate-1",
        roleProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        targetRole: "Senior Product Designer",
        candidateNextRoundDraftId: "draft-1",
        version: 2,
        itemCount: 1,
        capacity: 20,
        items: [{
            candidateNextRoundDraftItemId: "item-1",
            sourceCandidatePracticeSessionId: "baseline-session",
            sourceQuestionKey: "slot-1",
            rootCandidatePracticeSessionId: "baseline-session",
            rootQuestionKey: "slot-1",
            practiceKind: "practice_from_feedback",
            provenance: "coach_update",
            displayPosition: 0,
            questionNumber: 1,
            category: "Behavioral",
            questionText: "Tell me about a time you resolved a high-risk customer issue.",
            evidenceLabel: "Coach feedback",
        }],
        choices: [],
    };
}
