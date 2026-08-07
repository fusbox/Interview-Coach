import { describe, expect, it, vi } from "vitest";

import type { CandidateAnswerAnalysisProviderResult } from "./candidate-answer-analysis-adapter";
import { createCandidateAnswerAnalysisProviderResultFixture } from "./candidate-answer-analysis-test-fixture";
import {
    candidateAnswerAnalysisFixtureRunMetadata,
    runFixtureEvidenceFirstEvaluator,
} from "./candidate-answer-analysis-fixture";
import type {
    CandidateAnswerAttemptRecord,
    CandidateAnswerEvaluationRunRecord,
} from "./candidate-answer-history";
import { createCandidateQuestionPlan } from "./candidate-question-plan";
import type { CandidatePracticeSessionRecord } from "./candidate-practice-session-repository";
import { repairCandidateCompletedRoundAnalysis } from "./candidate-completed-round-analysis-repair";

const NOW = new Date("2026-07-17T18:00:00.000Z");

describe("completed-round answer-analysis repair", () => {
    it("repairs the exact missing latest attempt and makes the round artifact-eligible", async () => {
        const evidence = createEvidence(1);
        const repairSlot = vi.fn(async (slotId: string) => {
            const attempt = evidence.answerAttempts.find((candidate) => candidate.questionSlotId === slotId)!;
            evidence.evaluationRuns.push(await createAcceptedRun(attempt));
        });

        const result = await repairCandidateCompletedRoundAnalysis({
            loadEvidence: async () => evidence,
            repairSlot,
            runtimeAvailable: true,
            now: NOW,
        });

        expect(repairSlot).toHaveBeenCalledWith("slot-1");
        expect(result).toMatchObject({
            status: "repaired",
            answeredCount: 1,
            acceptedCount: 1,
            attemptedCount: 1,
            repairedCount: 1,
            allAnsweredOccurrencesAccepted: true,
        });
    });

    it("restores an accepted run's missing candidate projection without requiring a provider runtime", async () => {
        const evidence = createEvidence(1);
        evidence.evaluationRuns.push(await createAcceptedRun(evidence.answerAttempts[0]));
        const repairSlot = vi.fn(async (slotId: string) => {
            evidence.session.answerAnalysisSnapshots[slotId] = createProjection(evidence.answerAttempts[0]);
        });

        const result = await repairCandidateCompletedRoundAnalysis({
            loadEvidence: async () => evidence,
            repairSlot,
            runtimeAvailable: false,
            now: NOW,
        });

        expect(repairSlot).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({
            status: "repaired",
            acceptedCount: 1,
            repairedCount: 0,
            allAnsweredOccurrencesAccepted: true,
        });
    });

    it("recognizes an allowlisted historical accepted run without rerunning the retired prompt", async () => {
        const evidence = createEvidence(1);
        const historical = await createAcceptedRun(evidence.answerAttempts[0]);
        const storedResult = historical.result as {
            profile: { promptBundleVersion: string };
        };
        storedResult.profile.promptBundleVersion = "candidate_evidence_first_prompts_v14";
        evidence.evaluationRuns.push(historical);
        const repairSlot = vi.fn(async (slotId: string) => {
            evidence.session.answerAnalysisSnapshots[slotId] = createProjection(evidence.answerAttempts[0]);
        });

        const result = await repairCandidateCompletedRoundAnalysis({
            loadEvidence: async () => evidence,
            repairSlot,
            runtimeAvailable: false,
            now: NOW,
        });

        expect(repairSlot).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({
            status: "repaired",
            acceptedCount: 1,
            repairedCount: 0,
            allAnsweredOccurrencesAccepted: true,
        });
    });

    it("does not auto-retry a nonretryable terminal evaluator result", async () => {
        const evidence = createEvidence(1);
        evidence.evaluationRuns.push(createRejectedRun(evidence.answerAttempts[0]));
        const repairSlot = vi.fn();

        const result = await repairCandidateCompletedRoundAnalysis({
            loadEvidence: async () => evidence,
            repairSlot,
            runtimeAvailable: true,
            now: NOW,
        });

        expect(repairSlot).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            status: "unavailable",
            acceptedCount: 0,
            unavailableCount: 1,
            allAnsweredOccurrencesAccepted: false,
        });
    });

    it("does not reinterpret a malformed completed run as retryable coaching", async () => {
        const evidence = createEvidence(1);
        evidence.evaluationRuns.push({
            ...createRejectedRun(evidence.answerAttempts[0]),
            lifecycleState: "completed",
            result: { status: "unexpected_completed_shape" },
            validation: {
                disposition: "accepted",
                inputFingerprint: `input-${evidence.answerAttempts[0].candidateAnswerAttemptId}`,
                candidateSafeProjection: true,
            },
            errorCode: null,
        });
        const repairSlot = vi.fn();

        const result = await repairCandidateCompletedRoundAnalysis({
            loadEvidence: async () => evidence,
            repairSlot,
            runtimeAvailable: true,
            now: NOW,
        });

        expect(repairSlot).not.toHaveBeenCalled();
        expect(result).toMatchObject({ status: "unavailable", unavailableCount: 1 });
    });

    it("bounds one repair request to two answer occurrences and leaves the artifact ineligible", async () => {
        const evidence = createEvidence(3);
        const repairSlot = vi.fn(async (slotId: string) => {
            const attempt = evidence.answerAttempts.find((candidate) => candidate.questionSlotId === slotId)!;
            evidence.evaluationRuns.push(await createAcceptedRun(attempt));
        });

        const result = await repairCandidateCompletedRoundAnalysis({
            loadEvidence: async () => evidence,
            repairSlot,
            runtimeAvailable: true,
            now: NOW,
            repairLimit: 10,
        });

        expect(repairSlot).toHaveBeenCalledTimes(2);
        expect(result).toMatchObject({
            status: "partial",
            answeredCount: 3,
            acceptedCount: 2,
            attemptedCount: 2,
            repairedCount: 2,
            retryableCount: 1,
            allAnsweredOccurrencesAccepted: false,
        });
    });

    it("fails closed when the session projection does not identify the latest immutable attempt", async () => {
        const evidence = createEvidence(1);
        evidence.session.answerSubmissions["slot-1"].answerAttemptId = "different-attempt";
        const repairSlot = vi.fn();

        const result = await repairCandidateCompletedRoundAnalysis({
            loadEvidence: async () => evidence,
            repairSlot,
            runtimeAvailable: true,
            now: NOW,
        });

        expect(repairSlot).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            status: "unavailable",
            invalidLineageCount: 1,
            allAnsweredOccurrencesAccepted: false,
        });
    });
});

function createEvidence(answeredCount: number) {
    const session = createCompletedSession(answeredCount);
    return {
        session,
        answerAttempts: Array.from({ length: answeredCount }, (_, index) => createAttempt(index)),
        evaluationRuns: [] as CandidateAnswerEvaluationRunRecord[],
    };
}

function createCompletedSession(answeredCount: number): CandidatePracticeSessionRecord {
    const questions = Array.from({ length: 3 }, (_, index) => ({
        slotId: `slot-${index + 1}`,
        index,
        category: index === 0 ? "screening" as const : "behavioral" as const,
        questionText: `Question ${index + 1}?`,
    }));
    const answeredQuestionKeys = questions.slice(0, answeredCount).map((question) => question.slotId);
    return {
        candidatePracticeSessionId: "session-1",
        candidateProfileId: "candidate-1",
        roleProfileId: "10000000-0000-4000-8000-000000000001",
        candidateLaunchSessionId: null,
        status: "completed",
        setupSnapshot: {
            targetRole: "Quality Inspector",
            jobDescription: "Inspect products and document findings.",
            resumeText: null,
            interviewStage: "first_interview",
            questionCount: 3,
            resumeCaptureMode: "none",
            createdAt: "2026-07-17T17:00:00.000Z",
        },
        questionPlanSnapshot: createCandidateQuestionPlan({ interviewStage: "first_interview", questionCount: 3 }),
        questionWordingSnapshot: { status: "questions_worded", questions },
        questionWordingStatus: "worded",
        progress: { status: "completed", currentQuestionIndex: 2 },
        answerDrafts: {},
        answerSubmissions: Object.fromEntries(answeredQuestionKeys.map((slotId, index) => [slotId, {
            slotId,
            questionIndex: index,
            mode: "text" as const,
            text: `Answer ${index + 1}`,
            submittedAt: `2026-07-17T17:0${index + 1}:00.000Z`,
            status: "pending_analysis" as const,
            answerAttemptId: `attempt-${index + 1}`,
            attemptNumber: 1,
            trigger: "initial_submit" as const,
            supersedesAnswerAttemptId: null,
        }])),
        answerIdempotencyRecords: {},
        answerAnalysisSnapshots: {},
        feedbackActionEvents: {},
        completionSnapshot: {
            status: "candidate_session_completed",
            audience: "candidate_led",
            sessionId: "session-1",
            completedAt: "2026-07-17T17:30:00.000Z",
            finalProgress: { status: "completed", currentQuestionIndex: 2 },
            questionCount: 3,
            answeredCount,
            coachedCount: 0,
            answeredQuestionKeys,
            coachedQuestionKeys: [],
            skippedOrUnansweredQuestionKeys: questions.slice(answeredCount).map((question) => question.slotId),
            nextRoute: "/candidate/dashboard?prep=10000000-0000-4000-8000-000000000001",
        },
    };
}

function createAttempt(index: number): CandidateAnswerAttemptRecord {
    return {
        candidateAnswerAttemptId: `attempt-${index + 1}`,
        candidatePracticeSessionId: "session-1",
        candidateProfileId: "candidate-1",
        questionSlotId: `slot-${index + 1}`,
        questionIndex: index,
        attemptNumber: 1,
        trigger: "initial_submit",
        supersedesCandidateAnswerAttemptId: null,
        mode: "text",
        answerText: `Answer ${index + 1}`,
        submittedAt: `2026-07-17T17:0${index + 1}:00.000Z`,
        idempotencyKey: `answer-${index + 1}`,
        payloadFingerprint: `payload-${index + 1}`,
        sourceVoiceTranscriptionRunId: null,
        voiceSubmissionPath: null,
        voiceTranscriptEdited: null,
        createdAt: `2026-07-17T17:0${index + 1}:00.000Z`,
    };
}

async function createAcceptedRun(attempt: CandidateAnswerAttemptRecord): Promise<CandidateAnswerEvaluationRunRecord> {
    const accepted = await runFixtureEvidenceFirstEvaluator({
        status: "answer_analysis_provider_requested",
        provider: "candidate_v2_answer_evaluator",
        requestedAt: "2026-07-17T17:10:00.000Z",
        answer: {
            slotId: attempt.questionSlotId,
            questionIndex: attempt.questionIndex,
            mode: "text",
            text: attempt.answerText,
            submittedAt: attempt.submittedAt,
            answerAttemptId: attempt.candidateAnswerAttemptId,
            attemptNumber: attempt.attemptNumber,
            trigger: attempt.trigger,
        },
        question: {
            slotId: attempt.questionSlotId,
            questionIndex: attempt.questionIndex,
            category: attempt.questionIndex === 0 ? "screening" : "behavioral",
            questionText: `Question ${attempt.questionIndex + 1}?`,
            plannedPurpose: "Gather grounded practice evidence.",
        },
        setupContext: {
            targetRole: "Quality Inspector",
            jobDescription: "Inspect products and document findings.",
            resumeText: null,
            interviewStage: "first_interview",
            questionCount: 3,
        },
    }, { evaluationRunId: `run-${attempt.candidateAnswerAttemptId}` });

    return {
        candidateAnswerEvaluationRunId: accepted.evaluationRunId,
        candidateAnswerAttemptId: attempt.candidateAnswerAttemptId,
        purpose: "candidate_coaching",
        ...candidateAnswerAnalysisFixtureRunMetadata,
        inputFingerprint: accepted.inputFingerprint,
        idempotencyKey: `analysis-${attempt.candidateAnswerAttemptId}`,
        generationAttempt: 1,
        lifecycleState: "completed",
        result: JSON.parse(JSON.stringify(accepted)) as Record<string, unknown>,
        validation: {
            disposition: "accepted",
            inputFingerprint: accepted.inputFingerprint,
            candidateSafeProjection: true,
        },
        errorCode: null,
        requestedAt: "2026-07-17T17:10:00.000Z",
        claimExpiresAt: "2026-07-17T17:11:00.000Z",
        completedAt: accepted.completedAt,
        createdAt: "2026-07-17T17:10:00.000Z",
        updatedAt: accepted.completedAt,
    };
}

function createRejectedRun(attempt: CandidateAnswerAttemptRecord): CandidateAnswerEvaluationRunRecord {
    return {
        candidateAnswerEvaluationRunId: `run-${attempt.candidateAnswerAttemptId}`,
        candidateAnswerAttemptId: attempt.candidateAnswerAttemptId,
        purpose: "candidate_coaching",
        ...candidateAnswerAnalysisFixtureRunMetadata,
        inputFingerprint: `input-${attempt.candidateAnswerAttemptId}`,
        idempotencyKey: `analysis-${attempt.candidateAnswerAttemptId}`,
        generationAttempt: 1,
        lifecycleState: "rejected",
        result: null,
        validation: { disposition: "rejected", retryableByNewRun: false },
        errorCode: "INVALID_CANDIDATE_COACHING_RESULT",
        requestedAt: "2026-07-17T17:10:00.000Z",
        claimExpiresAt: "2026-07-17T17:11:00.000Z",
        completedAt: "2026-07-17T17:10:05.000Z",
        createdAt: "2026-07-17T17:10:00.000Z",
        updatedAt: "2026-07-17T17:10:05.000Z",
    };
}

function createProjection(attempt: CandidateAnswerAttemptRecord): CandidateAnswerAnalysisProviderResult {
    return createCandidateAnswerAnalysisProviderResultFixture({
        analyzedAt: "2026-07-17T17:10:05.000Z",
        answer: {
            slotId: attempt.questionSlotId,
            questionIndex: attempt.questionIndex,
            answerAttemptId: attempt.candidateAnswerAttemptId,
            attemptNumber: attempt.attemptNumber,
            trigger: attempt.trigger,
        },
        coachFeedback: {
            acknowledgement: "You gave me a useful starting point.",
            observation: "Your answer names the main idea.",
            nextPracticeFocus: "Add one concrete example.",
        },
    });
}
