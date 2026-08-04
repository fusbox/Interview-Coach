import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CandidateDashboardV2ReadModel } from "./candidate-dashboard-read-model";
import {
    CandidateDashboardPriorityExperience,
    createCandidateCoachUpdateSeenStorageKey,
} from "./CandidateDashboardPriorityExperience";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh }),
}));

describe("CandidateDashboardPriorityExperience", () => {
    beforeEach(() => {
        window.localStorage.clear();
        refresh.mockClear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("uses browser-held seen state to hand primary emphasis to Practice Next", async () => {
        const dashboard = createReadyDashboard();
        const storageKey = createCandidateCoachUpdateSeenStorageKey(dashboard);
        expect(storageKey).not.toBeNull();
        window.localStorage.setItem(storageKey!, "artifact-1");

        render(<CandidateDashboardPriorityExperience dashboard={dashboard} />);

        await waitFor(() => expect(screen.queryByText("New")).not.toBeInTheDocument());
        const priorities = screen.getByRole("region", { name: "Practice priorities" });
        expect(within(priorities).getByRole("heading", { name: "Practice one clearer result." }).closest("article"))
            .toHaveClass("is-primary");
        expect(within(priorities).getByRole("button", { name: "Practice this now" })).toBeInTheDocument();

        fireEvent.click(within(priorities).getByRole("button", { name: "Open Coach Update" }));
        expect(screen.getByRole("dialog", { name: "Let's review your latest practice." })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Close Coach Update" }));
        expect(screen.queryByRole("dialog", { name: "Let's review your latest practice." })).not.toBeInTheDocument();
        expect(window.localStorage.getItem(storageKey!)).toBe("artifact-1");
    });

    it("renders pending and unavailable lifecycle truth without exposing an open action", () => {
        const pendingDashboard = createReadyDashboard({
            coachUpdateState: {
                status: "candidate_coach_update_pending",
                candidatePracticeSessionId: "session-1",
                requestedAt: "2026-07-15T12:03:00.000Z",
            },
            latestCoachUpdate: null,
            coachUpdateDetail: null,
        });
        const { rerender } = render(<CandidateDashboardPriorityExperience dashboard={pendingDashboard} />);

        expect(screen.getByRole("heading", { name: "I'm preparing your Coach Update." })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Open Coach Update" })).not.toBeInTheDocument();

        rerender(<CandidateDashboardPriorityExperience dashboard={createReadyDashboard({
            coachUpdateState: {
                status: "candidate_coach_update_unavailable",
                candidatePracticeSessionId: "session-1",
                reason: "generation_failed",
            },
            latestCoachUpdate: null,
            coachUpdateDetail: null,
        })} />);

        expect(screen.getByRole("heading", { name: "Your practice is saved." })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Open Coach Update" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Try Coach Update again" })).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/error code|provider|validation|TEST_COACH/i);
    });

    it("requests session-owned Coach Update repair and refreshes the side-effect-free dashboard read", async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({
            status: "candidate_completed_round_coaching_repair",
        }), { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);
        render(<CandidateDashboardPriorityExperience dashboard={createReadyDashboard({
            coachUpdateState: {
                status: "candidate_coach_update_unavailable",
                candidatePracticeSessionId: "session-1",
                reason: "artifact_missing",
            },
            latestCoachUpdate: null,
            coachUpdateDetail: null,
        })} />);

        fireEvent.click(screen.getByRole("button", { name: "Try Coach Update again" }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
            "/candidate/session/session-1/coach-update/repair",
            { method: "POST" },
        ));
        await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    });

    it("navigates practiced questions and keeps only the current focused-practice action tabbable", async () => {
        render(<CandidateDashboardPriorityExperience dashboard={createReadyDashboard()} />);
        await waitFor(() => expect(screen.getByText("New")).toBeInTheDocument());
        fireEvent.click(screen.getByRole("button", { name: "Open Coach Update" }));

        const dialog = screen.getByRole("dialog", { name: "Let's review your latest practice." });
        expect(within(dialog).getByRole("button", { name: "Current feedback: question 1" })).toHaveAttribute("aria-current", "true");
        expect(within(dialog).getByRole("button", { name: "Current feedback: question 1" })).toHaveTextContent("Q1");
        const currentSlide = within(dialog).getByRole("group", { name: "Question feedback 1 of 2" });
        expect(within(currentSlide).getByText("What I noticed")).toBeInTheDocument();
        expect(within(currentSlide).getByText("Try next")).toBeInTheDocument();
        const focusLinks = within(dialog).getAllByRole("button", { name: "Practice this now", hidden: true });
        expect(focusLinks[0]).not.toHaveAttribute("tabindex", "-1");
        expect(focusLinks[1]).toHaveAttribute("tabindex", "-1");

        fireEvent.click(within(dialog).getByRole("button", { name: "Next question feedback" }));

        expect(within(dialog).getByRole("button", { name: "Current feedback: question 2" })).toHaveAttribute("aria-current", "true");
        expect(focusLinks[0]).toHaveAttribute("tabindex", "-1");
        expect(focusLinks[1]).not.toHaveAttribute("tabindex", "-1");
        expect(within(dialog).getByRole("button", { name: "Next question feedback" })).toBeDisabled();
    });

    it("opens the Coach Plan question spine with a secondary category lens and hidden upcoming wording", () => {
        render(<CandidateDashboardPriorityExperience dashboard={createReadyDashboard()} />);

        fireEvent.click(screen.getByRole("button", { name: "View Coach Plan" }));
        const dialog = screen.getByRole("dialog", { name: "Material Handler I" });
        expect(within(dialog).getByRole("tab", { name: "Questions" })).toHaveAttribute("aria-selected", "true");
        expect(within(dialog).getByText("What interests you about this role?")).toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole("tab", { name: "Categories" }));
        fireEvent.click(within(dialog).getByRole("button", { name: /Behavioral.*1 question/i }));
        expect(within(dialog).getByRole("heading", { name: "Past examples and personal action." })).toBeInTheDocument();
        expect(dialog.querySelector(".candidate-coach-plan-coverage")).not.toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole("tab", { name: "Questions" }));
        fireEvent.click(within(dialog).getByRole("tab", { name: "Question 3: Not practiced yet" }));
        expect(within(dialog).queryByText("What work environment helps you do your best work?")).not.toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole("button", { name: "Reveal question" }));
        expect(within(dialog).getByText("What work environment helps you do your best work?")).toBeInTheDocument();
        expect(within(dialog).queryByText(/score|mastery/i)).not.toBeInTheDocument();

        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.queryByRole("dialog", { name: "Material Handler I" })).not.toBeInTheDocument();
    });

    it("presents plan coverage separately from highest-earned preparedness", () => {
        render(<CandidateDashboardPriorityExperience dashboard={createReadyDashboard({
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
                    canonicalQuestionCount: 3,
                    unpracticedQuestionCount: 1,
                    attemptedQuestionCount: 2,
                    evaluatedQuestionCount: 2,
                    incompleteQuestionCount: 0,
                    evaluationUnavailableQuestionCount: 0,
                },
                achievement: {
                    emerging: 0,
                    clear: 1,
                    strong: 1,
                },
                questions: [
                    createPreparednessQuestion({ questionKey: "slot-1", questionNumber: 1, band: "strong" }),
                    createPreparednessQuestion({ questionKey: "slot-2", questionNumber: 2, band: "clear" }),
                    createPreparednessQuestion({
                        questionKey: "slot-3",
                        questionNumber: 3,
                        state: "not_practiced",
                        band: null,
                    }),
                ],
            },
        })} />);

        const progress = screen.getByRole("region", { name: "See where your practice is taking you." });
        expect(within(progress).getByRole("img", { name: "2 of 3 planned questions practiced" })).toBeInTheDocument();
        expect(progress.querySelector('.candidate-preparedness__achievement [data-band="strong"] dd')).toHaveTextContent("1");
        expect(progress.querySelector('.candidate-preparedness__achievement [data-band="clear"] dd')).toHaveTextContent("1");
        expect(within(progress).getByText("Not practiced yet")).toBeInTheDocument();

        fireEvent.click(within(progress).getByRole("button", { name: "View Coach Plan" }));
        expect(screen.getByRole("dialog", { name: "Material Handler I" })).toBeInTheDocument();
    });
});

function createPreparednessQuestion({
    questionKey,
    questionNumber,
    state = "rated",
    band,
}: {
    questionKey: string;
    questionNumber: number;
    state?: "not_practiced" | "evaluation_unavailable" | "incomplete" | "rated";
    band: "emerging" | "clear" | "strong" | null;
}): NonNullable<CandidateDashboardV2ReadModel["questionPreparedness"]>["questions"][number] {
    return {
        questionKey,
        questionNumber,
        category: questionNumber === 2 ? "behavioral" : "screening",
        questionText: `Question ${questionNumber}`,
        attemptCount: state === "not_practiced" ? 0 : 1,
        evaluatedAttemptCount: state === "not_practiced" ? 0 : 1,
        state,
        band,
        highestEarnedAttemptId: band ? `attempt-${questionNumber}` : null,
        latestAttempt: null,
    };
}

function createReadyDashboard(
    overrides: Partial<CandidateDashboardV2ReadModel> = {},
): CandidateDashboardV2ReadModel {
    const dashboard: CandidateDashboardV2ReadModel = {
        status: "candidate_dashboard_v2_read_model",
        candidateProfileId: "candidate-1",
        candidate: { displayName: "Candidate One", email: "candidate@example.com" },
        selectedTargetInterview: {
            status: "candidate_dashboard_target_interview",
            id: "10000000-0000-4000-8000-000000000001",
            roleProfileId: "10000000-0000-4000-8000-000000000001",
            targetRole: "Material Handler I",
            isSelected: true,
            activeRoundCount: 0,
            completedRoundCount: 1,
            answeredQuestionCount: 2,
            coachedAnswerCount: 2,
            lastActivityAt: "2026-07-15T12:05:00.000Z",
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
            completedRoundCount: 1,
            answeredQuestionCount: 2,
            coachedAnswerCount: 2,
        },
        activeRound: null,
        completedRounds: [],
        latestCoachUpdate: {
            status: "candidate_dashboard_coach_update_ready",
            candidatePracticeSessionId: "session-1",
            title: "Material Handler I practice update",
            body: "I reviewed two practiced answers.",
            href: "#coach-update-detail",
            completedAt: "2026-07-15T12:05:00.000Z",
            answeredCount: 2,
            questionCount: 2,
        },
        coachUpdateState: {
            status: "candidate_coach_update_ready",
            candidatePracticeSessionId: "session-1",
            presentationKey: "artifact-1",
            completedAt: "2026-07-15T12:05:00.000Z",
            answeredCount: 2,
            questionCount: 2,
        },
        coachUpdateDetail: {
            status: "candidate_coach_update_detail_ready",
            presentationKey: "artifact-1",
            candidatePracticeSessionId: "session-1",
            targetRole: "Material Handler I",
            completedAt: "2026-07-15T12:05:00.000Z",
            answeredCount: 2,
            questionCount: 2,
            reviewPosture: "fully_reviewable",
            summary: "I reviewed the two answers from your latest round.",
            primaryFocus: "Practice one clearer result.",
            items: [
                createDetailItem({ questionKey: "slot-1", questionNumber: 1, category: "Screening" }),
                createDetailItem({ questionKey: "slot-2", questionNumber: 2, category: "Behavioral" }),
            ],
        },
        coachingLoop: {
            status: "candidate_dashboard_coaching_loop_ready",
            principle: "Use what happened in practice to choose the next useful move.",
            feedback: {
                status: "candidate_dashboard_feedback_ready",
                label: "Coach Update",
                title: "Material Handler I practice update",
                body: "I reviewed two practiced answers.",
                href: "#coach-update-detail",
                completedAt: "2026-07-15T12:05:00.000Z",
                answeredCount: 2,
                questionCount: 2,
            },
            feedforward: {
                status: "candidate_dashboard_feedforward_ready",
                label: "Practice Next",
                title: "Practice one clearer result.",
                body: "Use the latest coach feedback for one focused practice round.",
                href: "/candidate/practice/ready?intent=coach-update-feedback-focus&fromSession=session-1&questionKey=slot-1",
                source: "coaching_focus",
                questionKeys: ["slot-1"],
            },
        },
        postRoundReviews: [],
        practiceNext: {
            status: "candidate_practice_next_ready",
            source: "coaching_focus",
            label: "Practice one clearer result.",
            reason: "Use the latest coach feedback for one focused practice round.",
            href: "/candidate/practice/ready?intent=coach-update-feedback-focus&fromSession=session-1&questionKey=slot-1",
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
                title: "Practice one clearer result.",
                body: "Use the latest coach feedback for one focused practice round.",
                href: "/candidate/practice/ready?intent=coach-update-feedback-focus&fromSession=session-1&questionKey=slot-1",
                candidatePracticeSessionId: "session-1",
                sourceQuestionKey: "slot-1",
                questionKeys: ["slot-1"],
            },
        },
        coachPlan: createCoachPlanReference(),
        questionPreparedness: null,
    };

    return { ...dashboard, ...overrides };
}

function createCoachPlanReference(): NonNullable<CandidateDashboardV2ReadModel["coachPlan"]> {
    return {
        status: "candidate_coach_plan_reference_ready",
        source: {
            kind: "initial_session_plan",
            baselineCandidatePracticeSessionId: "session-1",
            roleProfileId: "10000000-0000-4000-8000-000000000001",
        },
        targetRole: "Material Handler I",
        stage: {
            id: "first_interview",
            label: "First interview",
            detail: "Practice a balanced set.",
        },
        questionCount: 3,
        practicedQuestionCount: 2,
        missingEvidenceCount: 1,
        categories: [
            createCategoryReference({
                category: "screening",
                label: "Screening",
                purpose: "Basic fit and role alignment.",
                practicedCount: 1,
            }),
            createCategoryReference({
                category: "behavioral",
                label: "Behavioral",
                purpose: "Past examples and personal action.",
                practicedCount: 1,
            }),
            createCategoryReference({
                category: "culture_fit",
                label: "Culture / Fit",
                purpose: "Motivation and work style.",
                practicedCount: 0,
            }),
        ],
        questions: [
            {
                questionKey: "slot-1",
                questionNumber: 1,
                category: "screening",
                categoryLabel: "Screening",
                questionText: "What interests you about this role?",
                evidenceStatus: "practiced",
            },
            {
                questionKey: "slot-2",
                questionNumber: 2,
                category: "behavioral",
                categoryLabel: "Behavioral",
                questionText: "Tell me about a time you handled similar work.",
                evidenceStatus: "practiced",
            },
            {
                questionKey: "slot-3",
                questionNumber: 3,
                category: "culture_fit",
                categoryLabel: "Culture / Fit",
                questionText: "What work environment helps you do your best work?",
                evidenceStatus: "missing_evidence",
            },
        ],
    };
}

function createCategoryReference({
    category,
    label,
    purpose,
    practicedCount,
}: {
    category: "screening" | "behavioral" | "culture_fit";
    label: string;
    purpose: string;
    practicedCount: number;
}): NonNullable<CandidateDashboardV2ReadModel["coachPlan"]>["categories"][number] {
    return {
        category,
        label,
        purpose,
        plannedCount: 1,
        practicedCount,
        missingEvidenceCount: 1 - practicedCount,
        teaching: {
            definition: `${label} questions help you prepare for this part of the interview.`,
            answerShape: ["Answer directly.", "Add one specific detail."],
            watchFor: ["Generic answers."],
        },
    };
}

function createDetailItem({
    questionKey,
    questionNumber,
    category,
}: {
    questionKey: string;
    questionNumber: number;
    category: string;
}): NonNullable<CandidateDashboardV2ReadModel["coachUpdateDetail"]>["items"][number] {
    return {
        status: "candidate_coach_update_question_detail",
        questionKey,
        questionNumber,
        category,
        questionText: `Question ${questionNumber} prompt`,
        evidenceStatus: "practiced",
        answer: {
            mode: "text",
            text: `Answer ${questionNumber}`,
            submittedAt: "2026-07-15T12:04:00.000Z",
        },
        transcriptCanvas: null,
        coachRead: {
            acknowledgement: "You gave me a direct starting point.",
            observation: `Observation ${questionNumber}`,
            nextPracticeFocus: "Practice one clearer result.",
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
            href: `/candidate/practice/ready?intent=coach-update-feedback-focus&fromSession=session-1&questionKey=${questionKey}`,
            source: {
                kind: "coach_update_detail",
                candidatePracticeSessionId: "session-1",
                questionKey,
                questionNumber,
                category,
                targetRole: "Material Handler I",
            },
        },
    };
}
