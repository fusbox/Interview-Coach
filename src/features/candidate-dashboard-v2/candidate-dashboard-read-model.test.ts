import { describe, expect, it } from "vitest";

import { createCandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";
import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";

import { createCandidateDashboardV2ReadModel } from "./candidate-dashboard-read-model";

describe("candidate dashboard V2 read model", () => {
    it("derives dashboard state from completed candidate practice sessions at read time", () => {
        const model = createCandidateDashboardV2ReadModel({
            candidateProfileId: "candidate-1",
            practiceSessions: [
                createCompletedSession({
                    candidatePracticeSessionId: "older-session",
                    completedAt: "2026-07-10T12:00:00.000Z",
                    answerText: "I handled inventory counts.",
                    focus: "Add one result from the inventory count.",
                }),
                createActiveSession(),
                createCompletedSession({
                    candidatePracticeSessionId: "newer-session",
                    completedAt: "2026-07-11T12:00:00.000Z",
                    answerText: "I checked damaged materials and told my lead.",
                    focus: "Explain what changed after you escalated the damage.",
                }),
                {
                    ...createCompletedSession({
                        candidatePracticeSessionId: "other-candidate-session",
                        completedAt: "2026-07-12T12:00:00.000Z",
                        answerText: "This belongs to someone else.",
                        focus: "Should not appear.",
                    }),
                    candidateProfileId: "candidate-2",
                },
            ],
        });

        expect(model).toMatchObject({
            status: "candidate_dashboard_v2_read_model",
            selectedTargetInterview: {
                id: "material handler i",
                targetRole: "Material Handler I",
                activeRoundCount: 1,
                completedRoundCount: 2,
            },
            activeRound: {
                status: "candidate_dashboard_active_round",
                candidatePracticeSessionId: "active-session",
                targetRole: "Material Handler I",
                sessionStatus: "in_progress",
                href: "/candidate/session/active-session",
                questionCount: 1,
                answeredCount: 1,
                currentQuestionNumber: 1,
                progressLabel: "1 of 1 answered",
            },
            source: {
                kind: "derived_from_candidate_practice_sessions",
                durableSource: "candidate_practice_sessions",
                persistence: "read_time_projection",
                shouldPersistDashboardProjection: false,
            },
            stats: {
                activeRoundCount: 1,
                completedRoundCount: 2,
                answeredQuestionCount: 2,
                coachedAnswerCount: 2,
            },
            latestCoachUpdate: {
                candidatePracticeSessionId: "newer-session",
                title: "Material Handler I practice complete",
                completedAt: "2026-07-11T12:00:00.000Z",
            },
            coachUpdateDetail: {
                status: "candidate_coach_update_detail_ready",
                candidatePracticeSessionId: "newer-session",
                targetRole: "Material Handler I",
                reviewPosture: "fully_reviewable",
                items: [
                    {
                        status: "candidate_coach_update_question_detail",
                        questionKey: "slot-1",
                        evidenceStatus: "practiced",
                        actionPosture: {
                            kind: "review_coaching",
                        },
                    },
                ],
            },
            practiceNext: {
                source: "coaching_focus",
                label: "Explain what changed after you escalated the damage.",
            },
            practiceDirection: {
                status: "candidate_dashboard_practice_direction_ready",
                primaryAction: "resume_planned_round",
                planProgress: {
                    status: "candidate_dashboard_plan_progress_ready",
                    label: "Plan progress",
                    source: "active_round",
                    title: "Resume your current practice round.",
                    href: "/candidate/session/active-session",
                },
                coachGuidedFocus: {
                    status: "candidate_dashboard_coach_guided_focus_ready",
                    label: "Practice from feedback",
                    source: "coach_feedback",
                    title: "Explain what changed after you escalated the damage.",
                },
            },
            coachingLoop: {
                status: "candidate_dashboard_coaching_loop_ready",
                principle: "Use what happened in practice to choose the next useful move.",
                feedback: {
                    status: "candidate_dashboard_feedback_ready",
                    label: "Coach Update",
                    title: "Material Handler I practice complete",
                    observation: "The answer connects to the job, but it can use one sharper detail.",
                },
                feedforward: {
                    status: "candidate_dashboard_feedforward_ready",
                    label: "Practice Next",
                    title: "Explain what changed after you escalated the damage.",
                    source: "coaching_focus",
                },
            },
        });
        expect(model.completedRounds.map((round) => round.round.candidatePracticeSessionId)).toEqual([
            "newer-session",
            "older-session",
        ]);
        expect(model.postRoundReviews).toHaveLength(2);
    });

    it("scopes dashboard guidance to one selected target interview context before choosing next actions", () => {
        const model = createCandidateDashboardV2ReadModel({
            candidateProfileId: "candidate-1",
            practiceSessions: [
                createCompletedSession({
                    candidatePracticeSessionId: "csr-completed-session",
                    completedAt: "2026-07-11T12:00:00.000Z",
                    targetRole: "CSR",
                    answerText: "I helped a customer resolve an account problem.",
                    focus: "Add the customer outcome from your example.",
                }),
                createActiveSession({
                    candidatePracticeSessionId: "packaging-active-session",
                    targetRole: "Packaging Associate (2nd Shift)",
                    createdAt: "2026-07-10T10:00:00.000Z",
                }),
            ],
        });

        expect(model.selectedTargetInterview).toMatchObject({
            id: "packaging associate (2nd shift)",
            targetRole: "Packaging Associate (2nd Shift)",
            activeRoundCount: 1,
            completedRoundCount: 0,
            isSelected: true,
        });
        expect(model.targetInterviews).toEqual([
            expect.objectContaining({
                id: "packaging associate (2nd shift)",
                targetRole: "Packaging Associate (2nd Shift)",
                activeRoundCount: 1,
                completedRoundCount: 0,
                isSelected: true,
            }),
            expect.objectContaining({
                id: "csr",
                targetRole: "CSR",
                activeRoundCount: 0,
                completedRoundCount: 1,
                isSelected: false,
            }),
        ]);
        expect(model.stats).toEqual({
            activeRoundCount: 1,
            completedRoundCount: 0,
            answeredQuestionCount: 0,
            coachedAnswerCount: 0,
            attempts: {
                sessionAttemptCount: 1,
                followUpSessionAttemptCount: 0,
                questionAttemptCount: 1,
                followUpQuestionAttemptCount: 0,
            },
        });
        expect(model.latestCoachUpdate).toBeNull();
        expect(model.completedRounds).toEqual([]);
        expect(model.practiceDirection).toMatchObject({
            primaryAction: "resume_planned_round",
            planProgress: {
                source: "active_round",
                title: "Resume your current practice round.",
                href: "/candidate/session/packaging-active-session",
            },
            coachGuidedFocus: null,
        });
        expect(model.activeRound).toMatchObject({
            candidatePracticeSessionId: "packaging-active-session",
            targetRole: "Packaging Associate (2nd Shift)",
            sessionStatus: "in_progress",
            progressLabel: "1 of 1 answered",
        });
        expect(JSON.stringify(model)).not.toContain("Add the customer outcome");
    });

    it("can honor an explicit target interview selection instead of the default active context", () => {
        const model = createCandidateDashboardV2ReadModel({
            candidateProfileId: "candidate-1",
            selectedTargetInterviewId: "csr",
            practiceSessions: [
                createCompletedSession({
                    candidatePracticeSessionId: "csr-completed-session",
                    completedAt: "2026-07-11T12:00:00.000Z",
                    targetRole: "CSR",
                    answerText: "I helped a customer resolve an account problem.",
                    focus: "Add the customer outcome from your example.",
                }),
                createActiveSession({
                    candidatePracticeSessionId: "packaging-active-session",
                    targetRole: "Packaging Associate (2nd Shift)",
                    createdAt: "2026-07-10T10:00:00.000Z",
                }),
            ],
        });

        expect(model.selectedTargetInterview).toMatchObject({
            id: "csr",
            targetRole: "CSR",
            activeRoundCount: 0,
            completedRoundCount: 1,
            isSelected: true,
        });
        expect(model.latestCoachUpdate).toMatchObject({
            candidatePracticeSessionId: "csr-completed-session",
            title: "CSR practice complete",
        });
        expect(model.practiceDirection).toMatchObject({
            primaryAction: "practice_from_feedback",
            planProgress: {
                source: "completed_plan",
                title: "The latest round is complete.",
            },
            coachGuidedFocus: {
                title: "Add the customer outcome from your example.",
            },
        });
    });

    it("keeps unfinished plan coverage separate from feedback-based practice guidance", () => {
        const model = createCandidateDashboardV2ReadModel({
            candidateProfileId: "candidate-1",
            practiceSessions: [
                createCompletedSession({
                    candidatePracticeSessionId: "partial-session",
                    completedAt: "2026-07-11T12:00:00.000Z",
                    answerText: "I checked damaged materials and told my lead.",
                    focus: "Explain what changed after you escalated the damage.",
                    skippedQuestionCount: 1,
                }),
            ],
        });

        expect(model.practiceNext).toMatchObject({
            source: "unanswered_question",
            label: "Practice the questions you did not answer",
        });
        expect(model.practiceDirection).toMatchObject({
            primaryAction: "finish_planned_coverage",
            planProgress: {
                label: "Plan progress",
                source: "unanswered_planned_questions",
                title: "Practice the questions you did not answer",
                questionKeys: ["slot-2"],
            },
            coachGuidedFocus: {
                label: "Practice from feedback",
                source: "coach_feedback",
                title: "Explain what changed after you escalated the damage.",
                questionKeys: ["slot-1"],
            },
        });
    });

    it("rolls up repeated follow-up practice attempts without counting them as duplicated baseline coverage", () => {
        const model = createCandidateDashboardV2ReadModel({
            candidateProfileId: "candidate-1",
            practiceSessions: [
                createCompletedSession({
                    candidatePracticeSessionId: "source-session-1",
                    completedAt: "2026-07-10T12:00:00.000Z",
                    answerText: "I kept materials organized.",
                    focus: "Add the result of the organization work.",
                }),
                createCompletedSession({
                    candidatePracticeSessionId: "follow-up-session-2",
                    completedAt: "2026-07-11T12:00:00.000Z",
                    answerText: "I kept materials organized and reduced search time.",
                    focus: "Name the measurable outcome sooner.",
                    followUpPractice: {
                        sourceIntentId: "intent-1",
                        sessionAttemptNumber: 2,
                        itemCount: 1,
                        items: [{
                            localSlotId: "slot-1",
                            localQuestionNumber: 1,
                            candidatePracticeSessionId: "source-session-1",
                            questionKey: "slot-1",
                            sourceCandidatePracticeSessionId: "source-session-1",
                            sourceQuestionKey: "slot-1",
                            sourceQuestionNumber: 1,
                            sourceQuestionText: "Tell me about a time you handled warehouse materials.",
                            sourceCategory: "Behavioral",
                            questionAttemptNumber: 2,
                            practiceKind: "practice_from_feedback",
                        }],
                    },
                }),
            ],
        });

        expect(model.stats.attempts).toEqual({
            sessionAttemptCount: 2,
            followUpSessionAttemptCount: 1,
            questionAttemptCount: 2,
            followUpQuestionAttemptCount: 1,
        });
        expect(model.selectedTargetInterview?.attempts).toEqual({
            sessionAttemptCount: 2,
            followUpSessionAttemptCount: 1,
            questionAttemptCount: 2,
            followUpQuestionAttemptCount: 1,
        });
        expect(model.postRoundReviews[0].questions).toHaveLength(1);
        expect(model.postRoundReviews[0].questions[0]).toMatchObject({
            questionKey: "slot-1",
            attemptContext: {
                isFollowUpPractice: true,
                sessionAttemptNumber: 2,
                questionAttemptNumber: 2,
                sourceCandidatePracticeSessionId: "source-session-1",
                sourceQuestionKey: "slot-1",
            },
        });
    });

    it("returns a first-practice next step when the candidate has no completed V2 rounds", () => {
        const model = createCandidateDashboardV2ReadModel({
            candidateProfileId: "candidate-1",
            practiceSessions: [],
        });

        expect(model.completedRounds).toEqual([]);
        expect(model.latestCoachUpdate).toBeNull();
        expect(model.coachingLoop.feedback).toBeNull();
        expect(model.coachingLoop.feedforward).toMatchObject({
            label: "Practice Next",
            title: "Start a practice round",
            source: "new_round",
        });
        expect(model.practiceNext).toEqual({
            status: "candidate_practice_next_ready",
            source: "new_round",
            label: "Start a practice round",
            reason: "Your first completed practice round will create the evidence this dashboard uses.",
            href: "/candidate/setup",
            questionKeys: [],
        });
        expect(model.practiceDirection).toMatchObject({
            primaryAction: "start_first_round",
            planProgress: {
                label: "Plan progress",
                source: "first_round",
                title: "Start a practice round",
            },
            coachGuidedFocus: null,
        });
    });

    it("does not promote legacy dashboard fields or hidden scoring into the dashboard read", () => {
        const model = createCandidateDashboardV2ReadModel({
            candidateProfileId: "candidate-1",
            practiceSessions: [
                createCompletedSession({
                    candidatePracticeSessionId: "session-1",
                    completedAt: "2026-07-11T12:00:00.000Z",
                    answerText: "I moved materials safely.",
                    focus: "Add a concrete safety example.",
                }),
            ],
        });

        expect(JSON.stringify(model)).not.toMatch(/eval_results|feedback_json|oneBigUpgrade|readinessLevel|averageScore|summaryNarrative/i);
    });
});

function createActiveSession({
    candidatePracticeSessionId = "active-session",
    targetRole = "Material Handler I",
    createdAt = "2026-07-11T11:00:00.000Z",
}: {
    candidatePracticeSessionId?: string;
    targetRole?: string;
    createdAt?: string;
} = {}): CandidatePracticeSessionRecord {
    return {
        ...createCompletedSession({
            candidatePracticeSessionId,
            completedAt: "2026-07-11T10:00:00.000Z",
            targetRole,
            answerText: "Draft answer.",
            focus: "Draft focus.",
            createdAt,
        }),
        status: "in_progress",
        completionSnapshot: null,
        progress: {
            status: "live_question",
            currentQuestionIndex: 0,
        },
    };
}

function createCompletedSession({
    candidatePracticeSessionId,
    completedAt,
    answerText,
    focus,
    targetRole = "Material Handler I",
    createdAt = "2026-07-11T11:00:00.000Z",
    skippedQuestionCount = 0,
    followUpPractice,
}: {
    candidatePracticeSessionId: string;
    completedAt: string;
    answerText: string;
    focus: string;
    targetRole?: string;
    createdAt?: string;
    skippedQuestionCount?: number;
    followUpPractice?: {
        sourceIntentId: string;
        sessionAttemptNumber: number;
        itemCount: number;
        items: Array<{
            localSlotId: string;
            localQuestionNumber: number;
            candidatePracticeSessionId: string;
            questionKey: string;
            sourceCandidatePracticeSessionId: string;
            sourceQuestionKey: string;
            sourceQuestionNumber: number;
            sourceQuestionText: string;
            sourceCategory: string;
            questionAttemptNumber: number;
            practiceKind: "practice_from_feedback" | "practice_missing_evidence";
        }>;
    };
}): CandidatePracticeSessionRecord {
    const questionPlanSnapshot = createCandidateQuestionPlan({
        interviewStage: "first_interview",
        questionCount: skippedQuestionCount > 0 ? 2 : 1,
    });
    const questions = [
        {
            slotId: "slot-1",
            index: 0,
            category: "behavioral" as const,
            questionText: "Tell me about a time you handled warehouse materials.",
        },
        ...(skippedQuestionCount > 0
            ? [{
                slotId: "slot-2",
                index: 1,
                category: "case_scenario" as const,
                questionText: "How would you handle damaged materials?",
            }]
            : []),
    ];

    return {
        candidatePracticeSessionId,
        candidateProfileId: "candidate-1",
        roleProfileId: null,
        candidateLaunchSessionId: null,
        status: "completed",
        setupSnapshot: {
            targetRole,
            jobDescription: "Move materials safely.",
            resumeText: null,
            interviewStage: "first_interview",
            questionCount: 1,
            resumeCaptureMode: "none",
            createdAt,
            ...(followUpPractice
                ? {
                    followUpPractice: {
                        status: "candidate_follow_up_practice_session",
                        sourceIntentId: followUpPractice.sourceIntentId,
                        source: "practice_builder",
                        sessionAttemptNumber: followUpPractice.sessionAttemptNumber,
                        itemCount: followUpPractice.itemCount,
                        items: followUpPractice.items,
                    },
                }
                : {}),
        },
        questionPlanSnapshot,
        questionWordingSnapshot: {
            status: "questions_worded",
            questions,
            ...(followUpPractice
                ? {
                    followUpPractice: {
                        sourceIntentId: followUpPractice.sourceIntentId,
                        source: "practice_builder",
                        sessionAttemptNumber: followUpPractice.sessionAttemptNumber,
                        itemCount: followUpPractice.itemCount,
                    },
                }
                : {}),
        },
        questionWordingStatus: "worded",
        progress: {
            status: "completed",
            currentQuestionIndex: 0,
        },
        answerDrafts: {},
        answerSubmissions: {
            "slot-1": {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text",
                text: answerText,
                submittedAt: "2026-07-11T11:30:00.000Z",
                status: "pending_analysis",
            },
        },
        answerIdempotencyRecords: {},
        answerAnalysisSnapshots: {
            "slot-1": {
                status: "answer_analysis_provider_result",
                provider: "candidate_v2_answer_evaluator",
                analyzedAt: "2026-07-11T11:31:00.000Z",
                answer: {
                    slotId: "slot-1",
                    questionIndex: 0,
                },
                coachFeedback: {
                    acknowledgement: "You gave a relevant answer.",
                    observation: "The answer connects to the job, but it can use one sharper detail.",
                    nextPracticeFocus: focus,
                },
                evidence: [{
                    criterionId: "focus_relevance",
                    applicability: "observed",
                    score: 3.5,
                }],
            },
        },
        feedbackActionEvents: {},
        completionSnapshot: {
            status: "candidate_session_completed",
            audience: "candidate_led",
            sessionId: candidatePracticeSessionId,
            completedAt,
            finalProgress: {
                status: "completed",
                currentQuestionIndex: 0,
            },
            questionCount: questions.length,
            answeredCount: 1,
            coachedCount: 1,
            answeredQuestionKeys: ["slot-1"],
            coachedQuestionKeys: ["slot-1"],
            skippedOrUnansweredQuestionKeys: questions.slice(1).map((question) => question.slotId),
            nextRoute: "/candidate/dashboard",
        },
    };
}
