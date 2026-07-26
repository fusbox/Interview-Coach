import { describe, expect, it } from "vitest";

import type { CandidateAnswerAnalysisProviderResult } from "@/features/candidate-session-v2/candidate-answer-analysis-adapter";
import { createCandidateAnswerAnalysisProviderResultFixture } from "@/features/candidate-session-v2/candidate-answer-analysis-test-fixture";
import {
    candidateAnswerAnalysisFixtureRunMetadata,
    runFixtureEvidenceFirstEvaluator,
} from "@/features/candidate-session-v2/candidate-answer-analysis-fixture";
import type {
    CandidateAnswerAttemptRecord,
    CandidateAnswerEvaluationRunRecord,
} from "@/features/candidate-session-v2/candidate-answer-history";
import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import { createCandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";

import {
    createCandidateCoachUpdateSynthesisInput,
    createFixtureCandidateCoachUpdateContent,
    normalizeCandidateCoachUpdateArtifactRecord,
    validateCandidateCoachUpdateContent,
    type CandidateCoachUpdateContent,
} from "./candidate-coach-update-artifact";

describe("candidate Coach Update artifact input", () => {
    it("uses the latest immutable attempt and accepted run while excluding unanswered questions", () => {
        const session = createCompletedSession();
        const firstAttempt = createAttempt({ id: "attempt-1", attemptNumber: 1, submittedAt: "2026-07-15T12:01:00.000Z" });
        const latestAttempt = createAttempt({
            id: "attempt-2",
            attemptNumber: 2,
            submittedAt: "2026-07-15T12:02:00.000Z",
            supersedesId: "attempt-1",
        });
        session.answerSubmissions["slot-1"] = {
            ...session.answerSubmissions["slot-1"],
            answerAttemptId: "attempt-2",
            attemptNumber: 2,
            trigger: "feedback_retry",
            supersedesAnswerAttemptId: "attempt-1",
        };
        const rejectedRun = createRun({ id: "run-rejected", attemptId: "attempt-2", lifecycleState: "rejected" });
        const acceptedRun = createRun({ id: "run-accepted", attemptId: "attempt-2" });

        const input = createCandidateCoachUpdateSynthesisInput({
            sourceSession: session,
            sessionEvidence: [{
                session,
                answerAttempts: [firstAttempt, latestAttempt],
                evaluationRuns: [createRun({ id: "run-prior", attemptId: "attempt-1" }), rejectedRun, acceptedRun],
            }],
        });

        expect(input).toMatchObject({
            candidateProfileId: "candidate-1",
            roleProfileId: "10000000-0000-4000-8000-000000000001",
            sourceCandidatePracticeSessionId: "session-1",
            answeredCount: 1,
        });
        expect(input?.questions).toHaveLength(1);
        expect(input?.questions[0]?.answerAttempt.candidateAnswerAttemptId).toBe("attempt-2");
        expect(input?.questions[0]?.acceptedEvaluationRun.candidateAnswerEvaluationRunId).toBe("run-accepted");
        expect(input?.questions[0]?.priorComparableAttempts).toHaveLength(1);
        expect(createFixtureCandidateCoachUpdateContent(input!).questions.map((question) => question.questionKey)).toEqual([
            "slot-1",
        ]);
    });

    it("fails closed when an answered latest attempt lacks an accepted matching evaluator run", () => {
        const session = createCompletedSession();
        const attempt = createAttempt({ id: "attempt-1", attemptNumber: 1, submittedAt: "2026-07-15T12:01:00.000Z" });

        expect(createCandidateCoachUpdateSynthesisInput({
            sourceSession: session,
            sessionEvidence: [{
                session,
                answerAttempts: [attempt],
                evaluationRuns: [createRun({ id: "run-1", attemptId: "attempt-1", disposition: "rejected" })],
            }],
        })).toBeNull();
    });

    it("derives Coach Update input from the internal accepted evaluator run without session-hidden facts", async () => {
        const session = createCompletedSession();
        const attempt = createAttempt({
            id: "attempt-1",
            attemptNumber: 1,
            submittedAt: "2026-07-15T12:01:00.000Z",
        });
        const accepted = await runFixtureEvidenceFirstEvaluator({
            status: "answer_analysis_provider_requested",
            provider: "candidate_v2_answer_evaluator",
            requestedAt: "2026-07-15T12:02:00.000Z",
            answer: {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text",
                text: attempt.answerText,
                submittedAt: attempt.submittedAt,
                answerAttemptId: attempt.candidateAnswerAttemptId,
                attemptNumber: attempt.attemptNumber,
                trigger: attempt.trigger,
            },
            question: {
                slotId: "slot-1",
                questionIndex: 0,
                category: "screening",
                questionText: "What interests you about this role?",
                plannedPurpose: "Basic fit, interest, background, availability, and role alignment.",
            },
            setupContext: {
                targetRole: session.setupSnapshot.targetRole,
                jobDescription: session.setupSnapshot.jobDescription,
                resumeText: null,
                interviewStage: session.setupSnapshot.interviewStage,
                questionCount: session.setupSnapshot.questionCount,
            },
        }, { evaluationRunId: "run-internal" });
        const run: CandidateAnswerEvaluationRunRecord = {
            ...createRun({ id: "run-internal", attemptId: "attempt-1" }),
            inputFingerprint: accepted.inputFingerprint,
            result: JSON.parse(JSON.stringify(accepted)) as Record<string, unknown>,
            validation: { disposition: "accepted", inputFingerprint: accepted.inputFingerprint },
        };

        const input = createCandidateCoachUpdateSynthesisInput({
            sourceSession: session,
            sessionEvidence: [{ session, answerAttempts: [attempt], evaluationRuns: [run] }],
        });

        expect(input?.questions[0]).toMatchObject({
            acceptedEvaluationRun: { candidateAnswerEvaluationRunId: "run-internal" },
            acceptedAnalysis: {
                coachFeedback: { acknowledgement: "You gave me a direct starting point to work with." },
            },
            transcriptCanvas: {
                status: "candidate_transcript_canvas_v1",
                answerAttemptId: "attempt-1",
                evaluationRunId: "run-internal",
                annotations: [expect.objectContaining({
                    markerIds: ["direct_answer"],
                })],
            },
        });
        expect(input?.questions[0]?.acceptedAnalysis.evidenceFirst).not.toHaveProperty("feedbackPlan");
        expect(createFixtureCandidateCoachUpdateContent(input!)).toMatchObject({
            status: "candidate_coach_update_content_v3",
            questions: [expect.objectContaining({
                transcriptCanvas: expect.objectContaining({ evaluationRunId: "run-internal" }),
            })],
        });
    });

    it("compares only prior accepted attempts with the same prep context and source plan question", () => {
        const originalSession = createCompletedSession();
        const priorAttempt = createAttempt({ id: "attempt-prior", attemptNumber: 1, submittedAt: "2026-07-15T12:01:00.000Z" });
        const followUpSession = createCompletedSession({
            sessionId: "session-2",
            completedAt: "2026-07-15T13:05:00.000Z",
            followUpSourceSessionId: "session-1",
            followUpSourceQuestionKey: "slot-1",
        });
        const currentAttempt = createAttempt({
            id: "attempt-current",
            sessionId: "session-2",
            attemptNumber: 1,
            submittedAt: "2026-07-15T13:01:00.000Z",
        });
        followUpSession.answerSubmissions["slot-1"] = {
            ...followUpSession.answerSubmissions["slot-1"],
            answerAttemptId: "attempt-current",
        };

        const input = createCandidateCoachUpdateSynthesisInput({
            sourceSession: followUpSession,
            sessionEvidence: [
                {
                    session: originalSession,
                    answerAttempts: [priorAttempt],
                    evaluationRuns: [createRun({ id: "run-prior", attemptId: "attempt-prior" })],
                },
                {
                    session: followUpSession,
                    answerAttempts: [currentAttempt],
                    evaluationRuns: [createRun({ id: "run-current", attemptId: "attempt-current" })],
                },
            ],
        });

        expect(input?.questions[0]?.priorComparableAttempts.map((item) => item.answerAttempt.candidateAnswerAttemptId)).toEqual([
            "attempt-prior",
        ]);
        expect(createFixtureCandidateCoachUpdateContent(input!).questions[0]?.comparison).toMatchObject({
            kind: "repeat_practice",
            priorComparableAttemptCount: 1,
        });
    });

    it("rejects candidate-facing content with an undeclared score-like field", () => {
        const session = createCompletedSession();
        const attempt = createAttempt({ id: "attempt-1", attemptNumber: 1, submittedAt: "2026-07-15T12:01:00.000Z" });
        const input = createCandidateCoachUpdateSynthesisInput({
            sourceSession: session,
            sessionEvidence: [{
                session,
                answerAttempts: [attempt],
                evaluationRuns: [createRun({ id: "run-1", attemptId: "attempt-1" })],
            }],
        })!;
        const content = createFixtureCandidateCoachUpdateContent(input);
        const unsafeContent = {
            ...content,
            questions: content.questions.map((question, index) => index === 0 ? {
                ...question,
                coaching: { ...question.coaching, score: 4 },
            } : question),
        } as unknown as CandidateCoachUpdateContent;

        expect(validateCandidateCoachUpdateContent({ input, content: unsafeContent })).toBe(false);
    });

    it("rejects score-like generated prose without rejecting the candidate's own quoted answer", () => {
        const session = createCompletedSession();
        const attempt = createAttempt({ id: "attempt-1", attemptNumber: 1, submittedAt: "2026-07-15T12:01:00.000Z" });
        const input = createCandidateCoachUpdateSynthesisInput({
            sourceSession: session,
            sessionEvidence: [{
                session,
                answerAttempts: [attempt],
                evaluationRuns: [createRun({ id: "run-1", attemptId: "attempt-1" })],
            }],
        })!;
        const content = createFixtureCandidateCoachUpdateContent(input);

        expect(validateCandidateCoachUpdateContent({
            input,
            content: { ...content, summary: "You scored 90% in this round." },
        })).toBe(false);
        expect(validateCandidateCoachUpdateContent({
            input,
            content: {
                ...content,
                questions: content.questions.map((question, index) => index === 0 ? {
                    ...question,
                    answer: { ...question.answer, text: "I scored 95% on the safety audit." },
                } : question),
            },
        })).toBe(true);
    });

    it("rejects a completed artifact whose validation or candidate-safe content is not acceptable", () => {
        const session = createCompletedSession();
        const attempt = createAttempt({ id: "attempt-1", attemptNumber: 1, submittedAt: "2026-07-15T12:01:00.000Z" });
        const input = createCandidateCoachUpdateSynthesisInput({
            sourceSession: session,
            sessionEvidence: [{
                session,
                answerAttempts: [attempt],
                evaluationRuns: [createRun({ id: "run-1", attemptId: "attempt-1" })],
            }],
        })!;

        const content = createFixtureCandidateCoachUpdateContent(input);
        const artifact = {
            candidateCoachUpdateArtifactId: "artifact-1",
            candidateProfileId: "candidate-1",
            roleProfileId: "10000000-0000-4000-8000-000000000001",
            sourceCandidatePracticeSessionId: "session-1",
            sourceCompletionFingerprint: input.sourceCompletionFingerprint,
            sourceAnswerAttemptIds: ["attempt-1"],
            acceptedEvaluationRunIds: ["run-1"],
            synthesisInputFingerprint: input.synthesisInputFingerprint,
            provider: "fixture",
            modelName: "fixture-v1",
            promptVersion: "prompt-v1",
            evaluatorVersion: "evaluator-v1",
            generationAttempt: 1,
            lifecycleState: "completed",
            candidateSafeContent: content,
            validation: { disposition: "accepted" },
            errorCode: null,
            requestedAt: "2026-07-15T12:05:01.000Z",
            completedAt: "2026-07-15T12:05:02.000Z",
            createdAt: "2026-07-15T12:05:01.000Z",
            updatedAt: "2026-07-15T12:05:02.000Z",
        };

        expect(normalizeCandidateCoachUpdateArtifactRecord({
            ...artifact,
            validation: { disposition: "rejected" },
        })).toBeNull();
        expect(normalizeCandidateCoachUpdateArtifactRecord({
            ...artifact,
            candidateSafeContent: { ...content, primaryFocus: "Raise your score next time." },
        })).toBeNull();
    });
});

function createCompletedSession({
    sessionId = "session-1",
    completedAt = "2026-07-15T12:05:00.000Z",
    followUpSourceSessionId,
    followUpSourceQuestionKey,
}: {
    sessionId?: string;
    completedAt?: string;
    followUpSourceSessionId?: string;
    followUpSourceQuestionKey?: string;
} = {}): CandidatePracticeSessionRecord {
    const followUpPractice = followUpSourceSessionId && followUpSourceQuestionKey ? {
        status: "candidate_follow_up_practice_session" as const,
        sourceIntentId: "intent-1",
        source: "practice_builder" as const,
        sessionAttemptNumber: 2,
        itemCount: 1,
        items: [{
            localSlotId: "slot-1",
            sourceCandidatePracticeSessionId: followUpSourceSessionId,
            sourceQuestionKey: followUpSourceQuestionKey,
            sourceQuestionNumber: 1,
            sourceQuestionText: "What interests you about this role?",
            sourceCategory: "Screening",
            questionAttemptNumber: 2,
            practiceKind: "practice_from_feedback" as const,
        }],
    } : undefined;
    return {
        candidatePracticeSessionId: sessionId,
        candidateProfileId: "candidate-1",
        roleProfileId: "10000000-0000-4000-8000-000000000001",
        candidateLaunchSessionId: null,
        status: "completed",
        setupSnapshot: {
            targetRole: "Material Handler",
            jobDescription: "Move materials safely.",
            resumeText: null,
            interviewStage: "first_interview",
            questionCount: 2,
            resumeCaptureMode: "none",
            createdAt: "2026-07-15T12:00:00.000Z",
            ...(followUpPractice ? { followUpPractice } : {}),
        },
        questionPlanSnapshot: createCandidateQuestionPlan({ interviewStage: "first_interview", questionCount: 2 }),
        questionWordingSnapshot: {
            status: "questions_worded",
            questions: [
                { slotId: "slot-1", index: 0, category: "screening", questionText: "What interests you about this role?" },
                { slotId: "slot-2", index: 1, category: "behavioral", questionText: "Tell me about a time you met a deadline." },
            ],
        },
        questionWordingStatus: "worded",
        progress: { status: "completed", currentQuestionIndex: 1 },
        answerDrafts: {},
        answerSubmissions: {
            "slot-1": {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text",
                text: "I like keeping materials organized.",
                submittedAt: "2026-07-15T12:01:00.000Z",
                status: "pending_analysis",
                answerAttemptId: sessionId === "session-1" ? "attempt-1" : "attempt-current",
                attemptNumber: 1,
                trigger: "initial_submit",
                supersedesAnswerAttemptId: null,
            },
        },
        answerIdempotencyRecords: {},
        answerAnalysisSnapshots: {},
        feedbackActionEvents: {},
        completionSnapshot: {
            status: "candidate_session_completed",
            audience: "candidate_led",
            sessionId,
            completedAt,
            finalProgress: { status: "completed", currentQuestionIndex: 1 },
            questionCount: 2,
            answeredCount: 1,
            coachedCount: 1,
            answeredQuestionKeys: ["slot-1"],
            coachedQuestionKeys: ["slot-1"],
            skippedOrUnansweredQuestionKeys: ["slot-2"],
            nextRoute: "/candidate/dashboard?prep=10000000-0000-4000-8000-000000000001",
        },
    };
}

function createAttempt({
    id,
    sessionId = "session-1",
    attemptNumber,
    submittedAt,
    supersedesId = null,
}: {
    id: string;
    sessionId?: string;
    attemptNumber: number;
    submittedAt: string;
    supersedesId?: string | null;
}): CandidateAnswerAttemptRecord {
    return {
        candidateAnswerAttemptId: id,
        candidatePracticeSessionId: sessionId,
        candidateProfileId: "candidate-1",
        questionSlotId: "slot-1",
        questionIndex: 0,
        attemptNumber,
        trigger: attemptNumber === 1 ? "initial_submit" : "feedback_retry",
        supersedesCandidateAnswerAttemptId: supersedesId,
        mode: "text",
        answerText: `Answer ${attemptNumber}`,
        submittedAt,
        idempotencyKey: `key-${id}`,
        payloadFingerprint: `payload-${id}`,
        sourceVoiceTranscriptionRunId: null,
        voiceSubmissionPath: null,
        voiceTranscriptEdited: null,
        createdAt: submittedAt,
    };
}

function createRun({
    id,
    attemptId,
    lifecycleState = "completed",
    disposition = "accepted",
}: {
    id: string;
    attemptId: string;
    lifecycleState?: CandidateAnswerEvaluationRunRecord["lifecycleState"];
    disposition?: "accepted" | "rejected";
}): CandidateAnswerEvaluationRunRecord {
    const inputFingerprint = `input-${attemptId}`;
    return {
        candidateAnswerEvaluationRunId: id,
        candidateAnswerAttemptId: attemptId,
        purpose: "candidate_coaching",
        provider: candidateAnswerAnalysisFixtureRunMetadata.provider,
        modelName: candidateAnswerAnalysisFixtureRunMetadata.modelName,
        promptVersion: candidateAnswerAnalysisFixtureRunMetadata.promptVersion,
        evaluatorVersion: candidateAnswerAnalysisFixtureRunMetadata.evaluatorVersion,
        configurationManifest: candidateAnswerAnalysisFixtureRunMetadata.configurationManifest,
        configurationFingerprint: candidateAnswerAnalysisFixtureRunMetadata.configurationFingerprint,
        inputFingerprint,
        idempotencyKey: `run-key-${id}`,
        generationAttempt: 1,
        lifecycleState,
        result: lifecycleState === "completed" ? createAnalysis(attemptId, inputFingerprint) as unknown as Record<string, unknown> : null,
        validation: lifecycleState === "completed" ? { disposition, inputFingerprint } : disposition === "rejected" ? { disposition } : null,
        errorCode: lifecycleState === "failed" || lifecycleState === "rejected" ? "TEST_FAILURE" : null,
        requestedAt: "2026-07-15T12:02:00.000Z",
        claimExpiresAt: "2026-07-15T12:03:00.000Z",
        completedAt: lifecycleState === "requested" ? null : "2026-07-15T12:02:01.000Z",
        createdAt: "2026-07-15T12:02:00.000Z",
        updatedAt: "2026-07-15T12:02:01.000Z",
    };
}

function createAnalysis(attemptId: string, inputFingerprint: string): CandidateAnswerAnalysisProviderResult {
    return createCandidateAnswerAnalysisProviderResultFixture({
        analyzedAt: "2026-07-15T12:02:01.000Z",
        answer: {
            slotId: "slot-1",
            questionIndex: 0,
            answerAttemptId: attemptId,
            attemptNumber: 1,
            trigger: "initial_submit",
        },
        coachFeedback: {
            acknowledgement: "You gave me a direct starting point.",
            observation: "Your answer is direct and could use one concrete detail.",
            nextPracticeFocus: "Add one concrete detail and its result.",
        },
        evidenceFirst: {
            inputFingerprint,
            candidateFeedback: {
                acknowledgement: "You gave me a direct starting point.",
                primaryStrength: "Your response is direct.",
                biggestUpgrade: "Add one concrete detail.",
                redoPrompt: "Try it again with one result.",
            },
            intervention: "revise_answer",
        },
    });
}
