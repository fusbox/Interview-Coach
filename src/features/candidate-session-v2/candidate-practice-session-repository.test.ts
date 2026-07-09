import { describe, expect, it, vi } from "vitest";

import { createCandidatePracticeSessionRepository } from "./candidate-practice-session-repository";
import { createCandidateQuestionPlan } from "./candidate-question-plan";
import { createFixtureCandidateQuestionWordingResult } from "./candidate-question-wording";

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

        await expect(repository.createSetupSession({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            roleProfileId: "33333333-3333-4333-8333-333333333333",
            candidateLaunchSessionId: "44444444-4444-4444-8444-444444444444",
            setupSnapshot,
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
        ]);
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
});
