import { describe, expect, it, vi } from "vitest";

import type { CreateCandidatePracticeSessionInput } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import {
    createCandidatePracticeIntentLaunchRepository,
    toCandidatePracticeIntentLaunchResult,
} from "./candidate-practice-intent-launch-repository";

describe("candidate practice intent launch repository", () => {
    it("calls the atomic database boundary with immutable session snapshots", async () => {
        const query = vi.fn(async () => ({
            rows: [{
                launch_outcome: "created",
                candidate_practice_session_id: "session-2",
            }],
        }));
        const repository = createCandidatePracticeIntentLaunchRepository({ query });

        await expect(repository.startPracticeIntentSession({
            candidatePracticeIntentId: "intent-1",
            candidateProfileId: "candidate-1",
            expectedLaunchVersion: 1,
            expectedPriorSessionCount: 4,
            sessionInput: createSessionInput(),
        })).resolves.toEqual({
            outcome: "created",
            candidatePracticeSessionId: "session-2",
        });

        expect(query).toHaveBeenCalledTimes(1);
        const [sql, values] = query.mock.calls[0] as unknown as [string, unknown[]];
        expect(normalizeSql(sql)).toContain("from public.start_candidate_practice_intent_session(");
        expect(values.slice(0, 6)).toEqual([
            "intent-1",
            "candidate-1",
            1,
            4,
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            null,
        ]);
        expect(values[6]).toMatchObject({
            followUpPractice: {
                sourceIntentId: "intent-1",
            },
        });
        expect(values[9]).toBe("worded");
    });

    it("allows a consumed replay check without rebuilding mutable session input", async () => {
        const query = vi.fn(async () => ({
            rows: [{
                launch_outcome: "replayed",
                candidate_practice_session_id: "session-2",
            }],
        }));
        const repository = createCandidatePracticeIntentLaunchRepository({ query });

        await expect(repository.startPracticeIntentSession({
            candidatePracticeIntentId: "intent-1",
            candidateProfileId: "candidate-1",
            expectedLaunchVersion: 2,
            expectedPriorSessionCount: 0,
            sessionInput: null,
        })).resolves.toEqual({
            outcome: "replayed",
            candidatePracticeSessionId: "session-2",
        });

        const [, values] = query.mock.calls[0] as unknown as [string, unknown[]];
        expect(values.slice(4)).toEqual([
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
        ]);
    });

    it("rejects unavailable wording before calling the launch transaction", async () => {
        const query = vi.fn();
        const repository = createCandidatePracticeIntentLaunchRepository({ query });
        const sessionInput = createSessionInput();
        sessionInput.questionWordingSnapshot = null;

        await expect(repository.startPracticeIntentSession({
            candidatePracticeIntentId: "intent-1",
            candidateProfileId: "candidate-1",
            expectedLaunchVersion: 1,
            expectedPriorSessionCount: 4,
            sessionInput,
        })).resolves.toEqual({
            outcome: "invalid_session",
            candidatePracticeSessionId: null,
        });
        expect(query).not.toHaveBeenCalled();
    });

    it("parses only known outcome and session-id shapes", () => {
        expect(toCandidatePracticeIntentLaunchResult({
            launch_outcome: "expired",
            candidate_practice_session_id: null,
        })).toEqual({ outcome: "expired", candidatePracticeSessionId: null });
        expect(toCandidatePracticeIntentLaunchResult({
            launch_outcome: "created",
            candidate_practice_session_id: null,
        })).toBeNull();
        expect(toCandidatePracticeIntentLaunchResult({
            launch_outcome: "expired",
            candidate_practice_session_id: "unexpected-session",
        })).toBeNull();
        expect(toCandidatePracticeIntentLaunchResult({
            launch_outcome: "unknown",
            candidate_practice_session_id: null,
        })).toBeNull();
    });
});

function createSessionInput(): CreateCandidatePracticeSessionInput {
    return {
        candidateProfileId: "candidate-1",
        roleProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        setupSnapshot: {
            targetRole: "Material Handler I",
            jobDescription: "Move materials safely.",
            resumeText: null,
            interviewStage: "first_interview",
            questionCount: 1,
            resumeCaptureMode: "none",
            createdAt: "2026-07-12T17:00:00.000Z",
            followUpPractice: {
                status: "candidate_follow_up_practice_session",
                sourceIntentId: "intent-1",
                source: "practice_builder",
                sessionAttemptNumber: 5,
                itemCount: 1,
                items: [],
            },
        } as CreateCandidatePracticeSessionInput["setupSnapshot"],
        questionPlanSnapshot: {
            interviewStage: "first_interview",
            questionCount: 1,
            categoryCounts: {
                screening: 1,
                behavioral: 0,
                culture_fit: 0,
                case_scenario: 0,
                technical_role_specific: 0,
            },
            slots: [],
        },
        questionWordingSnapshot: {
            status: "questions_worded",
            questions: [],
        },
        progress: {
            status: "live_question",
            currentQuestionIndex: 0,
        },
    };
}

function normalizeSql(sql: string) {
    return sql.replace(/\s+/g, " ").trim().toLowerCase();
}
