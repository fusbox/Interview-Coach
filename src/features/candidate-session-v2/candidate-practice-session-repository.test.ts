import { describe, expect, it, vi } from "vitest";

import { createCandidatePracticeSessionRepository } from "./candidate-practice-session-repository";
import { createCandidateQuestionPlan } from "./candidate-question-plan";
import { createFixtureCandidateQuestionWordingResult } from "./candidate-question-wording";
import type { CandidateLedSessionCompletionSnapshot } from "@/features/interview-session-v2/session-completion-contract";
import { createCandidatePracticePlanBaseline } from "@/features/candidate-setup-v2/candidate-practice-plan-baseline";

describe("candidate practice session repository", () => {
    it("stores a setup-created candidate practice session with traceable snapshots", async () => {
        const query = vi.fn(async () => ({
            rows: [{ candidate_practice_session_id: "11111111-1111-4111-8111-111111111111" }],
        }));
        const repository = createCandidatePracticeSessionRepository({ query });
        const setupSnapshot = {
            targetRole: "Customer service representative",
            jobDescription: "Help customers resolve service questions.",
            resumeText: null,
            interviewStage: "first_interview" as const,
            questionCount: 7,
            resumeCaptureMode: "none" as const,
            createdAt: "2026-07-09T16:00:00.000Z",
        };
        const questionPlanSnapshot = createCandidateQuestionPlan({
            interviewStage: "first_interview",
            questionCount: 7,
        });
        const questionWordingSnapshot = createFixtureCandidateQuestionWordingResult({
            setupSnapshot,
            questionPlanSnapshot,
        });
        const baseline = createBaselineInput(setupSnapshot);

        await expect(repository.createSetupSession({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            roleProfileId: "33333333-3333-4333-8333-333333333333",
            candidateLaunchSessionId: "44444444-4444-4444-8444-444444444444",
            setupSnapshot,
            ...baseline,
            questionPlanSnapshot,
            questionWordingSnapshot,
            progress: {
                status: "planned",
                currentQuestionIndex: 0,
            },
        })).resolves.toEqual({
            candidatePracticeSessionId: "11111111-1111-4111-8111-111111111111",
        });

        expect(query).toHaveBeenCalledWith(expect.stringContaining("insert into public.candidate_practice_sessions"), [
            "22222222-2222-4222-8222-222222222222",
            "33333333-3333-4333-8333-333333333333",
            "44444444-4444-4444-8444-444444444444",
            "planned",
            setupSnapshot,
            questionPlanSnapshot,
            questionWordingSnapshot,
            "worded",
            {
                status: "planned",
                currentQuestionIndex: 0,
            },
            {},
            false,
            false,
            null,
            null,
            null,
            baseline.rigorBaselineSnapshot,
            baseline.rigorBaselineQuestionWordingSnapshot,
        ]);
    });

    it("completes only the currently leased setup-start generation with the inserted session", async () => {
        const query = vi.fn(async () => ({
            rows: [{ candidate_practice_session_id: "11111111-1111-4111-8111-111111111111" }],
        }));
        const repository = createCandidatePracticeSessionRepository({ query });
        const setupSnapshot = {
            targetRole: "Warehouse lead",
            jobDescription: "Coordinate safety workflows.",
            resumeText: null,
            interviewStage: "screening" as const,
            questionCount: 5,
            resumeCaptureMode: "none" as const,
            createdAt: "2026-07-18T12:00:00.000Z",
        };
        const questionPlanSnapshot = createCandidateQuestionPlan({
            interviewStage: "screening",
            questionCount: 5,
        });
        const baseline = createBaselineInput(setupSnapshot);

        await repository.createSetupSession({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            roleProfileId: "33333333-3333-4333-8333-333333333333",
            setupSnapshot,
            ...baseline,
            questionPlanSnapshot,
            setupStartClaim: {
                idempotencyKeyHash: "a".repeat(64),
                requestFingerprint: "b".repeat(64),
                claimGeneration: 3,
            },
        });

        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("completed_setup_start_request"),
            expect.arrayContaining([true, "a".repeat(64), "b".repeat(64), 3]),
        );
    });

    it("consumes a trusted launch setup context in the same statement as session creation", async () => {
        const query = vi.fn(async () => ({
            rows: [{ candidate_practice_session_id: "11111111-1111-4111-8111-111111111111" }],
        }));
        const repository = createCandidatePracticeSessionRepository({ query });
        const setupSnapshot = {
            targetRole: "Warehouse Associate",
            jobDescription: "Pick, pack, and prepare shipments safely.",
            resumeText: null,
            interviewStage: "screening" as const,
            questionCount: 5,
            resumeCaptureMode: "none" as const,
            createdAt: "2026-07-17T16:00:00.000Z",
        };
        const questionPlanSnapshot = createCandidateQuestionPlan({
            interviewStage: "screening",
            questionCount: 5,
        });
        const baseline = createBaselineInput(setupSnapshot);

        await expect(repository.createSetupSession({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            roleProfileId: "33333333-3333-4333-8333-333333333333",
            candidateLaunchSessionId: "44444444-4444-4444-8444-444444444444",
            consumeTrustedLaunchSetupContext: true,
            setupSnapshot,
            ...baseline,
            questionPlanSnapshot,
        })).resolves.toEqual({
            candidatePracticeSessionId: "11111111-1111-4111-8111-111111111111",
        });

        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("delete from public.candidate_launch_setup_contexts"),
            expect.arrayContaining([true]),
        );
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("set setup_context_consumed_at = now()"),
            expect.any(Array),
        );
    });

    it("restores the durable setup-created session by candidate and session id", async () => {
        const setupSnapshot = {
            targetRole: "Warehouse lead",
            jobDescription: "Coordinate safety workflows.",
            resumeText: "Led daily standups.",
            interviewStage: "screening",
            questionCount: 5,
            resumeCaptureMode: "pasted_text",
            createdAt: "2026-07-09T16:00:00.000Z",
        };
        const questionPlanSnapshot = createCandidateQuestionPlan({
            interviewStage: "screening",
            questionCount: 5,
        });
        const progress = {
            status: "question_preview",
            currentQuestionIndex: 2,
        };
        const query = vi.fn(async () => ({
            rows: [{
                candidate_practice_session_id: "11111111-1111-4111-8111-111111111111",
                candidate_profile_id: "22222222-2222-4222-8222-222222222222",
                role_profile_id: null,
                candidate_launch_session_id: null,
                status: "planned",
                setup_snapshot_json: setupSnapshot,
                question_plan_snapshot_json: questionPlanSnapshot,
                question_wording_snapshot_json: null,
                question_wording_status: "provider_not_configured",
                progress_state_json: progress,
                answer_drafts_json: {
                    "slot-3": {
                        slotId: "slot-3",
                        questionIndex: 2,
                        mode: "text",
                        text: "I would confirm the safety step first.",
                        updatedAt: "2026-07-09T20:00:00.000Z",
                    },
                },
            }],
        }));
        const repository = createCandidatePracticeSessionRepository({ query });

        await expect(repository.findSetupSession({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            candidatePracticeSessionId: "11111111-1111-4111-8111-111111111111",
        })).resolves.toMatchObject({
            candidatePracticeSessionId: "11111111-1111-4111-8111-111111111111",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            setupSnapshot: {
                targetRole: "Warehouse lead",
            },
            questionPlanSnapshot: {
                questionCount: 5,
            },
            questionWordingStatus: "provider_not_configured",
            questionWordingSnapshot: null,
            progress,
            answerDrafts: {
                "slot-3": {
                    slotId: "slot-3",
                    questionIndex: 2,
                    mode: "text",
                    text: "I would confirm the safety step first.",
                    updatedAt: "2026-07-09T20:00:00.000Z",
                },
            },
        });
        expect(query).toHaveBeenCalledWith(expect.stringContaining("from public.candidate_practice_sessions"), [
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222",
        ]);
    });

    it("lists candidate-owned practice sessions for dashboard read models", async () => {
        const setupSnapshot = {
            targetRole: "Warehouse lead",
            jobDescription: "Coordinate safety workflows.",
            resumeText: null,
            interviewStage: "first_interview" as const,
            questionCount: 3,
            resumeCaptureMode: "none" as const,
            createdAt: "2026-07-09T16:00:00.000Z",
        };
        const questionPlanSnapshot = createCandidateQuestionPlan({
            interviewStage: "first_interview",
            questionCount: 3,
        });
        const query = vi.fn(async () => ({
            rows: [{
                candidate_practice_session_id: "11111111-1111-4111-8111-111111111111",
                candidate_profile_id: "22222222-2222-4222-8222-222222222222",
                role_profile_id: null,
                candidate_launch_session_id: null,
                status: "completed",
                setup_snapshot_json: setupSnapshot,
                question_plan_snapshot_json: questionPlanSnapshot,
                question_wording_snapshot_json: null,
                question_wording_status: "worded",
                progress_state_json: {
                    status: "completed",
                    currentQuestionIndex: 2,
                },
                answer_drafts_json: {},
                answer_submissions_json: {},
                answer_idempotency_json: {},
                answer_analysis_snapshots_json: {},
                feedback_actions_json: {},
                completion_snapshot_json: null,
            }],
        }));
        const repository = createCandidatePracticeSessionRepository({ query });

        await expect(repository.listPracticeSessionsForCandidate({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            limit: 25,
        })).resolves.toMatchObject([{
            candidatePracticeSessionId: "11111111-1111-4111-8111-111111111111",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            status: "completed",
            setupSnapshot: {
                targetRole: "Warehouse lead",
            },
        }]);
        expect(query).toHaveBeenCalledWith(expect.stringContaining("order by updated_at desc, created_at desc"), [
            "22222222-2222-4222-8222-222222222222",
            25,
        ]);
    });

    it("lists the complete candidate-owned session history for cross-role dashboard inventory", async () => {
        const query = vi.fn(async (sql: string, values: unknown[]) => {
            void sql;
            void values;
            return { rows: [] };
        });
        const repository = createCandidatePracticeSessionRepository({ query });

        await expect(repository.listAllPracticeSessionsForCandidate({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
        })).resolves.toEqual([]);

        expect(query).toHaveBeenCalledWith(expect.stringContaining("where candidate_profile_id = $1"), [
            "22222222-2222-4222-8222-222222222222",
        ]);
        expect(query.mock.calls[0]?.[0]).toContain("order by created_at asc, candidate_practice_session_id asc");
        expect(query.mock.calls[0]?.[0]).not.toContain("limit");
    });

    it("lists the complete candidate-owned session history for one prep context", async () => {
        const query = vi.fn(async (sql: string, values: unknown[]) => {
            void sql;
            void values;
            return { rows: [] };
        });
        const repository = createCandidatePracticeSessionRepository({ query });

        await expect(repository.listPracticeSessionsForCandidateRoleProfile({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            roleProfileId: "33333333-3333-4333-8333-333333333333",
        })).resolves.toEqual([]);

        expect(query).toHaveBeenCalledWith(expect.stringContaining("and role_profile_id = $2"), [
            "22222222-2222-4222-8222-222222222222",
            "33333333-3333-4333-8333-333333333333",
        ]);
        expect(query.mock.calls[0]?.[0]).toContain("order by created_at asc, candidate_practice_session_id asc");
        expect(query.mock.calls[0]?.[0]).not.toContain("limit");
    });

    it("persists one answer draft by candidate-owned session and slot", async () => {
        const query = vi.fn(async () => ({
            rows: [{
                answer_drafts_json: {
                    "slot-1": {
                        slotId: "slot-1",
                        questionIndex: 0,
                        mode: "text",
                        text: "I would ask a clarifying question first.",
                        updatedAt: "2026-07-09T20:00:00.000Z",
                    },
                },
            }],
        }));
        const repository = createCandidatePracticeSessionRepository({ query });

        await expect(repository.saveAnswerDraft({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            candidatePracticeSessionId: "11111111-1111-4111-8111-111111111111",
            draft: {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text",
                text: "I would ask a clarifying question first.",
                updatedAt: "2026-07-09T20:00:00.000Z",
            },
        })).resolves.toEqual({
            "slot-1": {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text",
                text: "I would ask a clarifying question first.",
                updatedAt: "2026-07-09T20:00:00.000Z",
            },
        });

        expect(query).toHaveBeenCalledWith(expect.stringContaining("jsonb_set"), [
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222",
            ["slot-1"],
            {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text",
                text: "I would ask a clarifying question first.",
                updatedAt: "2026-07-09T20:00:00.000Z",
            },
        ]);
    });

    it("persists one submitted answer by candidate-owned session and slot", async () => {
        const query = vi.fn(async () => ({
            rows: [{
                answer_submissions_json: {
                    "slot-1": {
                        slotId: "slot-1",
                        questionIndex: 0,
                        mode: "text",
                        text: "I would ask a clarifying question first.",
                        submittedAt: "2026-07-09T20:01:00.000Z",
                        status: "pending_analysis",
                    },
                },
            }],
        }));
        const repository = createCandidatePracticeSessionRepository({ query });

        await expect(repository.saveAnswerSubmission({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            candidatePracticeSessionId: "11111111-1111-4111-8111-111111111111",
            answerSubmission: {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text",
                text: "I would ask a clarifying question first.",
                submittedAt: "2026-07-09T20:01:00.000Z",
                status: "pending_analysis",
            },
        })).resolves.toEqual({
            "slot-1": {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text",
                text: "I would ask a clarifying question first.",
                submittedAt: "2026-07-09T20:01:00.000Z",
                status: "pending_analysis",
            },
        });

        expect(query).toHaveBeenCalledWith(expect.stringContaining("answer_submissions_json = jsonb_set"), [
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222",
            ["slot-1"],
            {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text",
                text: "I would ask a clarifying question first.",
                submittedAt: "2026-07-09T20:01:00.000Z",
                status: "pending_analysis",
            },
        ]);
        expect(query).toHaveBeenCalledWith(expect.stringContaining(
            "status = case when status = 'planned' then 'in_progress' else status end",
        ), expect.any(Array));
    });

    it("persists one answer analysis snapshot by candidate-owned session and slot", async () => {
        const analysisSnapshot = {
            status: "answer_analysis_provider_result" as const,
            provider: "candidate_v2_answer_evaluator" as const,
            analyzedAt: "2026-07-09T20:02:00.000Z",
            answer: {
                slotId: "slot-1",
                questionIndex: 0,
            },
            coachFeedback: {
                acknowledgement: "You named a practical first step.",
                observation: "The answer would be stronger with the result of your choice.",
                nextPracticeFocus: "Add what changed after you set the priority.",
            },
            evidence: [
                {
                    criterionId: "answer_specificity",
                    applicability: "observed" as const,
                    score: 3,
                },
            ],
        };
        const query = vi.fn(async () => ({
            rows: [{
                answer_analysis_snapshots_json: {
                    "slot-1": analysisSnapshot,
                },
            }],
        }));
        const repository = createCandidatePracticeSessionRepository({ query });

        await expect(repository.saveAnswerAnalysisSnapshot({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            candidatePracticeSessionId: "11111111-1111-4111-8111-111111111111",
            analysisSnapshot,
        })).resolves.toEqual({
            "slot-1": analysisSnapshot,
        });

        expect(query).toHaveBeenCalledWith(expect.stringContaining("answer_analysis_snapshots_json = jsonb_set"), [
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222",
            ["slot-1"],
            analysisSnapshot,
        ]);
    });

    it("persists one feedback action event by candidate-owned session and slot", async () => {
        const feedbackActionEvent = {
            status: "feedback_action_selected" as const,
            answer: {
                slotId: "slot-1",
                questionIndex: 0,
            },
            stageId: "next_step" as const,
            actionKind: "continue_to_next_question" as const,
            transition: "advance_to_next_question" as const,
            selectedAt: "2026-07-09T20:03:00.000Z",
        };
        const query = vi.fn(async () => ({
            rows: [{
                feedback_actions_json: {
                    "slot-1": feedbackActionEvent,
                },
            }],
        }));
        const repository = createCandidatePracticeSessionRepository({ query });

        await expect(repository.saveFeedbackActionEvent({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            candidatePracticeSessionId: "11111111-1111-4111-8111-111111111111",
            feedbackActionEvent,
        })).resolves.toEqual({
            "slot-1": feedbackActionEvent,
        });

        expect(query).toHaveBeenCalledWith(expect.stringContaining("feedback_actions_json = jsonb_set"), [
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222",
            ["slot-1"],
            feedbackActionEvent,
        ]);
    });

    it("persists one answer idempotency record by candidate-owned session and record key", async () => {
        const record = {
            recordKey: "answer_submit:candidate_answer_submit:session-1:slot-1:client-key-1",
            operation: "answer_submit" as const,
            scope: "candidate_answer_submit:session-1:slot-1",
            actorId: "22222222-2222-4222-8222-222222222222",
            key: "client-key-1",
            payload: {
                candidatePracticeSessionId: "11111111-1111-4111-8111-111111111111",
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text" as const,
                text: "I would ask a clarifying question first.",
            },
            status: "pending" as const,
            requestedAt: "2026-07-09T20:01:00.000Z",
        };
        const query = vi.fn(async () => ({
            rows: [{
                answer_idempotency_json: {
                    [record.recordKey]: record,
                },
            }],
        }));
        const repository = createCandidatePracticeSessionRepository({ query });

        await expect(repository.saveAnswerIdempotencyRecord({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            candidatePracticeSessionId: "11111111-1111-4111-8111-111111111111",
            record,
        })).resolves.toEqual({
            [record.recordKey]: record,
        });

        expect(query).toHaveBeenCalledWith(expect.stringContaining("answer_idempotency_json = jsonb_set"), [
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222",
            [record.recordKey],
            record,
        ]);
    });

    it("clears one answer idempotency record after an unreplayable failure", async () => {
        const query = vi.fn(async () => ({
            rows: [{
                answer_idempotency_json: {},
            }],
        }));
        const repository = createCandidatePracticeSessionRepository({ query });

        await expect(repository.clearAnswerIdempotencyRecord({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            candidatePracticeSessionId: "11111111-1111-4111-8111-111111111111",
            recordKey: "answer_analysis:candidate_answer_analysis:session-1:slot-1:client-key-1",
        })).resolves.toEqual({});

        expect(query).toHaveBeenCalledWith(expect.stringContaining("answer_idempotency_json = coalesce(answer_idempotency_json, '{}'::jsonb) - $3"), [
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222",
            "answer_analysis:candidate_answer_analysis:session-1:slot-1:client-key-1",
        ]);
    });

    it("persists preview progress by candidate-owned session", async () => {
        const query = vi.fn(async () => ({
            rows: [{
                progress_state_json: {
                    status: "question_preview",
                    currentQuestionIndex: 2,
                },
            }],
        }));
        const repository = createCandidatePracticeSessionRepository({ query });

        await expect(repository.saveProgress({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            candidatePracticeSessionId: "11111111-1111-4111-8111-111111111111",
            progress: {
                status: "question_preview",
                currentQuestionIndex: 2,
            },
        })).resolves.toEqual({
            status: "question_preview",
            currentQuestionIndex: 2,
        });

        expect(query).toHaveBeenCalledWith(expect.stringContaining("progress_state_json = $3::jsonb"), [
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222",
            {
                status: "question_preview",
                currentQuestionIndex: 2,
            },
        ]);
    });

    it("persists live question progress by candidate-owned session", async () => {
        const query = vi.fn(async () => ({
            rows: [{
                progress_state_json: {
                    status: "live_question",
                    currentQuestionIndex: 0,
                },
            }],
        }));
        const repository = createCandidatePracticeSessionRepository({ query });

        await expect(repository.saveProgress({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            candidatePracticeSessionId: "11111111-1111-4111-8111-111111111111",
            progress: {
                status: "live_question",
                currentQuestionIndex: 0,
            },
        })).resolves.toEqual({
            status: "live_question",
            currentQuestionIndex: 0,
        });

        expect(query).toHaveBeenCalledWith(expect.stringContaining("progress_state_json = $3::jsonb"), [
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222",
            {
                status: "live_question",
                currentQuestionIndex: 0,
            },
        ]);
    });

    it("persists a candidate-led completion snapshot and final progress state", async () => {
        const completionSnapshot: CandidateLedSessionCompletionSnapshot = {
            status: "candidate_session_completed",
            audience: "candidate_led",
            sessionId: "11111111-1111-4111-8111-111111111111",
            completedAt: "2026-07-10T22:10:00.000Z",
            finalProgress: {
                status: "completed",
                currentQuestionIndex: 2,
            },
            questionCount: 3,
            answeredCount: 2,
            coachedCount: 1,
            answeredQuestionKeys: ["slot-1", "slot-2"],
            coachedQuestionKeys: ["slot-1"],
            skippedOrUnansweredQuestionKeys: ["slot-3"],
            nextRoute: "/candidate/dashboard",
        };
        const query = vi.fn(async () => ({
            rows: [{
                completion_snapshot_json: completionSnapshot,
                progress_state_json: completionSnapshot.finalProgress,
            }],
        }));
        const repository = createCandidatePracticeSessionRepository({ query });

        await expect(repository.completeSession({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            candidatePracticeSessionId: "11111111-1111-4111-8111-111111111111",
            completionSnapshot,
        })).resolves.toEqual({
            completionSnapshot,
            progress: completionSnapshot.finalProgress,
        });

        expect(query).toHaveBeenCalledWith(expect.stringContaining("status = 'completed'"), [
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222",
            completionSnapshot,
            completionSnapshot.finalProgress,
        ]);
    });
});

function createBaselineInput(
    setupSnapshot: Parameters<typeof createFixtureCandidateQuestionWordingResult>[0]["setupSnapshot"],
) {
    const rigorBaselineSnapshot = createCandidatePracticePlanBaseline(setupSnapshot.interviewStage);
    return {
        rigorBaselineSnapshot,
        rigorBaselineQuestionWordingSnapshot: createFixtureCandidateQuestionWordingResult({
            setupSnapshot: {
                ...setupSnapshot,
                questionCount: rigorBaselineSnapshot.questionCount,
            },
            questionPlanSnapshot: rigorBaselineSnapshot,
        }),
    };
}
