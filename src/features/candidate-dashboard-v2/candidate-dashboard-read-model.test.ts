import { describe, expect, it } from "vitest";

import { createCandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";
import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import { createCandidateAnswerAnalysisProviderResultFixture } from "@/features/candidate-session-v2/candidate-answer-analysis-test-fixture";

import type { CandidateCoachUpdateArtifactRecord } from "./candidate-coach-update-artifact";
import { createCandidateDashboardV2ReadModel } from "./candidate-dashboard-read-model";

describe("candidate dashboard V2 read model", () => {
    it("derives dashboard state from completed candidate practice sessions at read time", () => {
        const model = createCandidateDashboardV2ReadModel({
            candidateProfileId: "candidate-1",
            candidateIdentity: {
                displayName: "Candidate One",
                email: "candidate.one@example.com",
            },
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
            candidate: {
                displayName: "Candidate One",
                email: "candidate.one@example.com",
            },
            selectedTargetInterview: {
                id: "material handler i",
                targetRole: "Material Handler I",
                activeRoundCount: 1,
                completedRoundCount: 2,
                answeredQuestionCount: 3,
                coachedAnswerCount: 3,
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
                answeredQuestionCount: 3,
                coachedAnswerCount: 3,
            },
            latestCoachUpdate: null,
            coachUpdateDetail: null,
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
                    candidatePracticeSessionId: "newer-session",
                },
            },
            coachingLoop: {
                status: "candidate_dashboard_coaching_loop_ready",
                principle: "Use what happened in practice to choose the next useful move.",
                feedback: null,
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

    it("keeps the dashboard available when optional preparedness history cannot be read", () => {
        const model = createCandidateDashboardV2ReadModel({
            candidateProfileId: "candidate-1",
            practiceSessions: [createActiveSession()],
            answerAttempts: null,
            acceptedEvaluationRuns: null,
        });

        expect(model.activeRound).toMatchObject({
            status: "candidate_dashboard_active_round",
            candidatePracticeSessionId: "active-session",
        });
        expect(model.questionPreparedness).toBeNull();
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
            answeredQuestionCount: 1,
            coachedAnswerCount: 1,
            isSelected: true,
        });
        expect(model.targetInterviews).toEqual([
            expect.objectContaining({
                id: "packaging associate (2nd shift)",
                targetRole: "Packaging Associate (2nd Shift)",
                activeRoundCount: 1,
                completedRoundCount: 0,
                answeredQuestionCount: 1,
                coachedAnswerCount: 1,
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
            answeredQuestionCount: 1,
            coachedAnswerCount: 1,
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

    it("treats a session entered before its first answer as resumable practice", () => {
        const enteredSession = createActiveSession();
        enteredSession.status = "planned";

        const model = createCandidateDashboardV2ReadModel({
            candidateProfileId: "candidate-1",
            practiceSessions: [enteredSession],
        });

        expect(model.practiceDirection.planProgress).toMatchObject({
            source: "active_round",
            title: "Resume your current practice round.",
            href: "/candidate/session/active-session",
        });
    });

    it("counts active-round question evidence without treating retries as extra answered questions", () => {
        const session = createActiveSession({
            candidatePracticeSessionId: "quality-control-active-session",
            roleProfileId: "533906a2-8e9b-456e-9189-3daea92bebd3",
            targetRole: "Quality Control Inspector",
        });
        session.questionPlanSnapshot = createCandidateQuestionPlan({
            interviewStage: "screening",
            questionCount: 3,
        });
        session.questionWordingSnapshot = {
            status: "questions_worded",
            questions: [
                { slotId: "slot-1", index: 0, category: "screening", questionText: "Why does this role interest you?" },
                { slotId: "slot-2", index: 1, category: "behavioral", questionText: "Tell me about a quality issue you found." },
                { slotId: "slot-3", index: 2, category: "case_scenario", questionText: "How would you handle a failed inspection?" },
            ],
        };
        session.progress = { status: "live_question", currentQuestionIndex: 2 };
        session.answerSubmissions["slot-1"] = {
            ...session.answerSubmissions["slot-1"],
            answerAttemptId: "attempt-1-retry",
            attemptNumber: 2,
            trigger: "feedback_retry",
            supersedesAnswerAttemptId: "attempt-1",
        };
        session.answerAnalysisSnapshots["slot-1"] = {
            ...session.answerAnalysisSnapshots["slot-1"],
            answer: {
                slotId: "slot-1",
                questionIndex: 0,
                answerAttemptId: "attempt-1-retry",
                attemptNumber: 2,
                trigger: "feedback_retry",
            },
        };
        session.answerSubmissions["slot-2"] = {
            slotId: "slot-2",
            questionIndex: 1,
            mode: "text",
            text: "I quarantined the item and documented the defect.",
            submittedAt: "2026-07-15T14:53:14.451Z",
            status: "pending_analysis",
            answerAttemptId: "attempt-2",
            attemptNumber: 1,
            trigger: "initial_submit",
            supersedesAnswerAttemptId: null,
        };
        session.answerAnalysisSnapshots["slot-2"] = {
            ...session.answerAnalysisSnapshots["slot-1"],
            analyzedAt: "2026-07-15T14:53:14.607Z",
            answer: {
                slotId: "slot-2",
                questionIndex: 1,
                answerAttemptId: "attempt-2",
                attemptNumber: 1,
                trigger: "initial_submit",
            },
        };

        const model = createCandidateDashboardV2ReadModel({
            candidateProfileId: "candidate-1",
            selectedRoleProfileId: "533906a2-8e9b-456e-9189-3daea92bebd3",
            practiceSessions: [session],
        });

        expect(model.stats).toMatchObject({
            activeRoundCount: 1,
            completedRoundCount: 0,
            answeredQuestionCount: 2,
            coachedAnswerCount: 2,
        });
        expect(model.selectedTargetInterview).toMatchObject({
            answeredQuestionCount: 2,
            coachedAnswerCount: 2,
        });
        expect(model.activeRound).toMatchObject({
            sessionStatus: "in_progress",
            answeredCount: 2,
            questionCount: 3,
            currentQuestionNumber: 3,
        });
    });

    it("can honor an explicit target interview selection instead of the default active context", () => {
        const model = createCandidateDashboardV2ReadModel({
            candidateProfileId: "candidate-1",
            selectedLegacyTargetRole: "csr",
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
        expect(model.latestCoachUpdate).toBeNull();
        expect(model.practiceDirection).toMatchObject({
            primaryAction: "practice_from_feedback",
            planProgress: {
                source: "completed_plan",
                title: "The latest round is complete.",
                href: null,
            },
            coachGuidedFocus: {
                title: "Add the customer outcome from your example.",
                href: "/candidate/practice/ready?intent=coach-update-feedback-focus&fromSession=csr-completed-session&questionKey=slot-1",
            },
        });
    });

    it("uses only a matching completed artifact for the latest profile-backed round", () => {
        const roleProfileId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
        const session = createCompletedSession({
            candidatePracticeSessionId: "profile-session",
            completedAt: "2026-07-11T12:00:00.000Z",
            roleProfileId,
            answerText: "I like keeping materials organized.",
            focus: "Add one concrete result.",
        });
        const model = createCandidateDashboardV2ReadModel({
            candidateProfileId: "candidate-1",
            selectedRoleProfileId: roleProfileId,
            practiceSessions: [session],
            coachUpdateArtifacts: [createCoachUpdateArtifact({
                roleProfileId,
                sourceSessionId: "profile-session",
            })],
        });

        expect(model.latestCoachUpdate).toMatchObject({
            candidatePracticeSessionId: "profile-session",
            title: "Material Handler I practice update",
        });
        expect(model.coachUpdateState).toEqual({
            status: "candidate_coach_update_ready",
            candidatePracticeSessionId: "profile-session",
            presentationKey: "artifact-1",
            completedAt: "2026-07-11T12:00:02.000Z",
            answeredCount: 1,
            questionCount: 1,
        });
        expect(model.coachUpdateDetail).toMatchObject({
            presentationKey: "artifact-1",
            candidatePracticeSessionId: "profile-session",
            reviewPosture: "fully_reviewable",
            items: [expect.objectContaining({ questionKey: "slot-1", evidenceStatus: "practiced" })],
        });
        expect(model.coachingLoop.feedback).toMatchObject({
            label: "Coach Update",
            title: "Material Handler I practice update",
        });
    });

    it("shows the newest requested Coach Update attempt as pending without falling back to older prose", () => {
        const roleProfileId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
        const session = createCompletedSession({
            candidatePracticeSessionId: "profile-session",
            completedAt: "2026-07-11T12:00:00.000Z",
            roleProfileId,
            answerText: "I like keeping materials organized.",
            focus: "Add one concrete result.",
        });
        const model = createCandidateDashboardV2ReadModel({
            candidateProfileId: "candidate-1",
            selectedRoleProfileId: roleProfileId,
            practiceSessions: [session],
            coachUpdateArtifacts: [
                createCoachUpdateArtifact({ roleProfileId, sourceSessionId: "profile-session" }),
                createCoachUpdateArtifact({
                    roleProfileId,
                    sourceSessionId: "profile-session",
                    artifactId: "artifact-2",
                    generationAttempt: 2,
                    lifecycleState: "requested",
                }),
            ],
        });

        expect(model.coachUpdateState).toEqual({
            status: "candidate_coach_update_pending",
            candidatePracticeSessionId: "profile-session",
            requestedAt: "2026-07-11T12:00:01.000Z",
        });
        expect(model.latestCoachUpdate).toBeNull();
        expect(model.coachUpdateDetail).toBeNull();
    });

    it("shows a failed newest Coach Update attempt as unavailable without exposing its error code", () => {
        const roleProfileId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
        const session = createCompletedSession({
            candidatePracticeSessionId: "profile-session",
            completedAt: "2026-07-11T12:00:00.000Z",
            roleProfileId,
            answerText: "I like keeping materials organized.",
            focus: "Add one concrete result.",
        });
        const model = createCandidateDashboardV2ReadModel({
            candidateProfileId: "candidate-1",
            selectedRoleProfileId: roleProfileId,
            practiceSessions: [session],
            coachUpdateArtifacts: [
                createCoachUpdateArtifact({ roleProfileId, sourceSessionId: "profile-session" }),
                createCoachUpdateArtifact({
                    roleProfileId,
                    sourceSessionId: "profile-session",
                    artifactId: "artifact-2",
                    generationAttempt: 2,
                    lifecycleState: "failed",
                }),
            ],
        });

        expect(model.coachUpdateState).toEqual({
            status: "candidate_coach_update_unavailable",
            candidatePracticeSessionId: "profile-session",
            reason: "generation_failed",
        });
        expect(model.latestCoachUpdate).toBeNull();
        expect(model.coachUpdateDetail).toBeNull();
        expect(JSON.stringify(model)).not.toContain("TEST_COACH_UPDATE_FAILURE");
    });

    it("shows a completed round with no Coach Update artifact as unavailable", () => {
        const roleProfileId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
        const model = createCandidateDashboardV2ReadModel({
            candidateProfileId: "candidate-1",
            selectedRoleProfileId: roleProfileId,
            practiceSessions: [createCompletedSession({
                candidatePracticeSessionId: "profile-session",
                completedAt: "2026-07-11T12:00:00.000Z",
                roleProfileId,
                answerText: "I like keeping materials organized.",
                focus: "Add one concrete result.",
            })],
        });

        expect(model.coachUpdateState).toEqual({
            status: "candidate_coach_update_unavailable",
            candidatePracticeSessionId: "profile-session",
            reason: "artifact_missing",
        });
        expect(model.latestCoachUpdate).toBeNull();
        expect(model.coachUpdateDetail).toBeNull();
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
                candidatePracticeSessionId: "partial-session",
            },
            coachGuidedFocus: {
                label: "Practice from feedback",
                source: "coach_feedback",
                title: "Explain what changed after you escalated the damage.",
                questionKeys: ["slot-1"],
                href: "/candidate/practice/ready?intent=coach-update-feedback-focus&fromSession=partial-session&questionKey=slot-1",
            },
        });
    });

    it("keeps same-title preparation contexts separate by candidate-owned role profile id", () => {
        const firstProfileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
        const secondProfileId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
        const model = createCandidateDashboardV2ReadModel({
            candidateProfileId: "candidate-1",
            selectedRoleProfileId: firstProfileId,
            practiceSessions: [
                createCompletedSession({
                    candidatePracticeSessionId: "first-warehouse-context",
                    roleProfileId: firstProfileId,
                    completedAt: "2026-07-11T12:00:00.000Z",
                    targetRole: "Warehouse Associate",
                    answerText: "I checked labels before moving stock.",
                    focus: "Add the result of your checks.",
                }),
                createCompletedSession({
                    candidatePracticeSessionId: "second-warehouse-context",
                    roleProfileId: secondProfileId,
                    completedAt: "2026-07-11T13:00:00.000Z",
                    targetRole: "Warehouse Associate",
                    answerText: "I organized outbound pallets.",
                    focus: "Explain how you prioritized the work.",
                }),
            ],
        });

        expect(model.targetInterviews).toHaveLength(2);
        expect(model.targetInterviews.map((context) => context.roleProfileId)).toEqual([
            firstProfileId,
            secondProfileId,
        ]);
        expect(model.selectedTargetInterview).toMatchObject({
            id: firstProfileId,
            roleProfileId: firstProfileId,
            targetRole: "Warehouse Associate",
        });
        expect(model.completedRounds.map((round) => round.round.candidatePracticeSessionId)).toEqual([
            "first-warehouse-context",
        ]);
        expect(JSON.stringify(model)).not.toContain("prioritized the work");
    });

    it("uses title fallback only for legacy records and canonical fallback for an invalid profile id", () => {
        const roleProfileId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
        const legacySession = createCompletedSession({
            candidatePracticeSessionId: "legacy-session",
            completedAt: "2026-07-11T12:00:00.000Z",
            targetRole: "CSR",
            answerText: "I resolved the request.",
            focus: "Add the customer outcome.",
        });
        const profiledSession = createActiveSession({
            candidatePracticeSessionId: "profiled-session",
            roleProfileId,
            targetRole: "CSR",
            createdAt: "2026-07-11T13:00:00.000Z",
        });

        const legacySelected = createCandidateDashboardV2ReadModel({
            candidateProfileId: "candidate-1",
            selectedLegacyTargetRole: "csr",
            practiceSessions: [profiledSession, legacySession],
        });
        expect(legacySelected.selectedTargetInterview).toMatchObject({
            roleProfileId: null,
            id: "csr",
        });
        expect(legacySelected.activeRound).toBeNull();

        const invalidProfileFallback = createCandidateDashboardV2ReadModel({
            candidateProfileId: "candidate-1",
            selectedRoleProfileId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            practiceSessions: [profiledSession, legacySession],
        });
        expect(invalidProfileFallback.selectedTargetInterview).toMatchObject({
            roleProfileId,
            id: roleProfileId,
        });
        expect(invalidProfileFallback.activeRound?.candidatePracticeSessionId).toBe("profiled-session");

        const invalidProfileDoesNotDowngradeToLegacy = createCandidateDashboardV2ReadModel({
            candidateProfileId: "candidate-1",
            selectedRoleProfileId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            selectedLegacyTargetRole: "csr",
            practiceSessions: [profiledSession, legacySession],
        });
        expect(invalidProfileDoesNotDowngradeToLegacy.selectedTargetInterview).toMatchObject({
            roleProfileId,
            id: roleProfileId,
        });
        expect(invalidProfileDoesNotDowngradeToLegacy.activeRound?.candidatePracticeSessionId).toBe("profiled-session");
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
    roleProfileId = null,
    targetRole = "Material Handler I",
    createdAt = "2026-07-11T11:00:00.000Z",
}: {
    candidatePracticeSessionId?: string;
    roleProfileId?: string | null;
    targetRole?: string;
    createdAt?: string;
} = {}): CandidatePracticeSessionRecord {
    return {
        ...createCompletedSession({
            candidatePracticeSessionId,
            roleProfileId,
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
    roleProfileId = null,
    targetRole = "Material Handler I",
    createdAt = "2026-07-11T11:00:00.000Z",
    skippedQuestionCount = 0,
    followUpPractice,
}: {
    candidatePracticeSessionId: string;
    completedAt: string;
    answerText: string;
    focus: string;
    roleProfileId?: string | null;
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
        roleProfileId,
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
            "slot-1": createCandidateAnswerAnalysisProviderResultFixture({
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
            }),
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

function createCoachUpdateArtifact({
    roleProfileId,
    sourceSessionId,
    artifactId = "artifact-1",
    generationAttempt = 1,
    lifecycleState = "completed",
}: {
    roleProfileId: string;
    sourceSessionId: string;
    artifactId?: string;
    generationAttempt?: number;
    lifecycleState?: CandidateCoachUpdateArtifactRecord["lifecycleState"];
}): CandidateCoachUpdateArtifactRecord {
    const completedArtifact: CandidateCoachUpdateArtifactRecord = {
        candidateCoachUpdateArtifactId: artifactId,
        candidateProfileId: "candidate-1",
        roleProfileId,
        sourceCandidatePracticeSessionId: sourceSessionId,
        sourceCompletionFingerprint: "completion-1",
        sourceAnswerAttemptIds: ["attempt-1"],
        acceptedEvaluationRunIds: ["run-1"],
        synthesisInputFingerprint: "input-1",
        provider: "fixture",
        modelName: "fixture-v1",
        promptVersion: "prompt-v1",
        evaluatorVersion: "evaluator-v1",
        profileId: "fixture-profile-v1",
        configurationFingerprint: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        generationAttempt,
        lifecycleState: "completed",
        candidateSafeContent: {
            status: "candidate_coach_update_content_v3",
            targetRole: "Material Handler I",
            title: "Material Handler I practice update",
            summary: "I reviewed your practiced answer.",
            primaryFocus: "Add one concrete result.",
            questions: [{
                questionKey: "slot-1",
                questionNumber: 1,
                category: "Screening",
                questionText: "What interests you about this role?",
                answer: {
                    candidateAnswerAttemptId: "attempt-1",
                    mode: "text",
                    text: "I like keeping materials organized.",
                    submittedAt: "2026-07-11T12:01:00.000Z",
                },
                coaching: {
                    acknowledgement: "You gave me a direct starting point.",
                    observation: "Your answer connects to the role.",
                    nextPracticeFocus: "Add one concrete result.",
                },
                comparison: {
                    kind: "first_practice",
                    priorComparableAttemptCount: 0,
                    message: "This is the first accepted practice evidence for this question.",
                },
                source: {
                    candidatePracticeSessionId: sourceSessionId,
                    questionKey: "slot-1",
                },
                transcriptCanvas: null,
            }],
        },
        validation: { disposition: "accepted" },
        errorCode: null,
        requestedAt: "2026-07-11T12:00:01.000Z",
        completedAt: "2026-07-11T12:00:02.000Z",
        createdAt: "2026-07-11T12:00:01.000Z",
        updatedAt: "2026-07-11T12:00:02.000Z",
    };

    if (lifecycleState === "requested") {
        return {
            ...completedArtifact,
            lifecycleState,
            candidateSafeContent: null,
            validation: null,
            completedAt: null,
            updatedAt: completedArtifact.requestedAt,
        };
    }

    if (lifecycleState === "failed" || lifecycleState === "rejected") {
        return {
            ...completedArtifact,
            lifecycleState,
            candidateSafeContent: null,
            validation: { disposition: lifecycleState },
            errorCode: "TEST_COACH_UPDATE_FAILURE",
        };
    }

    return completedArtifact;
}
