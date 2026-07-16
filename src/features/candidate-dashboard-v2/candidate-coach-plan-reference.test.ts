import { describe, expect, it } from "vitest";

import type { CandidateFollowUpPracticeSessionMetadata } from "@/features/candidate-practice-v2/candidate-follow-up-session-creation";
import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import { createCandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";
import { createFixtureCandidateQuestionWordingResult } from "@/features/candidate-session-v2/candidate-question-wording";
import { createCandidateCoachPlanReference } from "./candidate-coach-plan-reference";

const CANDIDATE_PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const ROLE_PROFILE_ID = "33333333-3333-4333-8333-333333333333";
const BASELINE_SESSION_ID = "11111111-1111-4111-8111-111111111111";

describe("candidate Coach Plan reference", () => {
    it("keeps the initial plan as the baseline and counts distinct root-question evidence", () => {
        const baseline = createBaselineSession({ answeredQuestionKeys: ["slot-1"] });
        baseline.answerDrafts["slot-3"] = {
            slotId: "slot-3",
            questionIndex: 2,
            mode: "text",
            text: "A draft that is not evidence.",
            updatedAt: "2026-07-15T12:04:00.000Z",
        };
        const firstFollowUp = createFollowUpSession({
            sessionId: "44444444-4444-4444-8444-444444444444",
            sourceSessionId: BASELINE_SESSION_ID,
            sourceQuestionKey: "slot-2",
            rootSessionId: BASELINE_SESSION_ID,
            rootQuestionKey: "slot-2",
            createdAt: "2026-07-15T12:10:00.000Z",
        });
        const repeatedFollowUp = createFollowUpSession({
            sessionId: "55555555-5555-4555-8555-555555555555",
            sourceSessionId: firstFollowUp.candidatePracticeSessionId,
            sourceQuestionKey: "slot-1",
            rootSessionId: BASELINE_SESSION_ID,
            rootQuestionKey: "slot-2",
            createdAt: "2026-07-15T12:20:00.000Z",
        });

        const reference = createCandidateCoachPlanReference({
            candidateProfileId: CANDIDATE_PROFILE_ID,
            roleProfileId: ROLE_PROFILE_ID,
            practiceSessions: [repeatedFollowUp, firstFollowUp, baseline],
        });

        expect(reference).toMatchObject({
            source: {
                baselineCandidatePracticeSessionId: BASELINE_SESSION_ID,
                roleProfileId: ROLE_PROFILE_ID,
            },
            targetRole: "Quality Control Inspector",
            stage: {
                id: "screening",
                label: "Screening call",
            },
            questionCount: 3,
            practicedQuestionCount: 2,
            missingEvidenceCount: 1,
            questions: [
                { questionKey: "slot-1", evidenceStatus: "practiced" },
                { questionKey: "slot-2", evidenceStatus: "practiced" },
                { questionKey: "slot-3", evidenceStatus: "missing_evidence" },
            ],
        });
        expect(reference?.categories).toEqual([
            expect.objectContaining({ category: "screening", plannedCount: 1, practicedCount: 1 }),
            expect.objectContaining({ category: "behavioral", plannedCount: 1, practicedCount: 1 }),
            expect.objectContaining({ category: "culture_fit", plannedCount: 1, practicedCount: 0 }),
        ]);
        expect(reference?.categories[1]?.teaching.answerShape).toContain("Describe the action you personally took.");
    });

    it("fails closed when follow-up lineage declares a conflicting root", () => {
        const baseline = createBaselineSession({ answeredQuestionKeys: [] });
        const malformedFollowUp = createFollowUpSession({
            sessionId: "66666666-6666-4666-8666-666666666666",
            sourceSessionId: BASELINE_SESSION_ID,
            sourceQuestionKey: "slot-2",
            rootSessionId: BASELINE_SESSION_ID,
            rootQuestionKey: "slot-3",
            createdAt: "2026-07-15T12:10:00.000Z",
        });

        const reference = createCandidateCoachPlanReference({
            candidateProfileId: CANDIDATE_PROFILE_ID,
            roleProfileId: ROLE_PROFILE_ID,
            practiceSessions: [baseline, malformedFollowUp],
        });

        expect(reference?.practicedQuestionCount).toBe(0);
        expect(reference?.questions.every((question) => question.evidenceStatus === "missing_evidence")).toBe(true);
    });

    it("ignores sessions outside the candidate-owned prep context", () => {
        const baseline = createBaselineSession({ answeredQuestionKeys: [] });
        const otherContext = {
            ...createBaselineSession({ answeredQuestionKeys: ["slot-1"] }),
            candidatePracticeSessionId: "77777777-7777-4777-8777-777777777777",
            roleProfileId: "88888888-8888-4888-8888-888888888888",
        };

        const reference = createCandidateCoachPlanReference({
            candidateProfileId: CANDIDATE_PROFILE_ID,
            roleProfileId: ROLE_PROFILE_ID,
            practiceSessions: [baseline, otherContext],
        });

        expect(reference?.practicedQuestionCount).toBe(0);
    });

    it("does not reinterpret a follow-up session as a profile-backed baseline", () => {
        const followUpOnly = createFollowUpSession({
            sessionId: "99999999-9999-4999-8999-999999999999",
            sourceSessionId: BASELINE_SESSION_ID,
            sourceQuestionKey: "slot-1",
            rootSessionId: BASELINE_SESSION_ID,
            rootQuestionKey: "slot-1",
            createdAt: "2026-07-15T12:10:00.000Z",
        });

        expect(createCandidateCoachPlanReference({
            candidateProfileId: CANDIDATE_PROFILE_ID,
            roleProfileId: ROLE_PROFILE_ID,
            practiceSessions: [followUpOnly],
        })).toBeNull();
    });
});

function createBaselineSession({
    answeredQuestionKeys,
}: {
    answeredQuestionKeys: string[];
}): CandidatePracticeSessionRecord {
    const setupSnapshot = {
        targetRole: "Quality Control Inspector",
        jobDescription: "Inspect finished products and document quality findings.",
        resumeText: null,
        interviewStage: "screening" as const,
        questionCount: 3,
        resumeCaptureMode: "none" as const,
        createdAt: "2026-07-15T12:00:00.000Z",
    };
    const questionPlanSnapshot = createCandidateQuestionPlan({
        interviewStage: setupSnapshot.interviewStage,
        questionCount: setupSnapshot.questionCount,
    });
    const questionWordingSnapshot = createFixtureCandidateQuestionWordingResult({
        setupSnapshot,
        questionPlanSnapshot,
    });

    return {
        candidatePracticeSessionId: BASELINE_SESSION_ID,
        candidateProfileId: CANDIDATE_PROFILE_ID,
        roleProfileId: ROLE_PROFILE_ID,
        candidateLaunchSessionId: null,
        status: answeredQuestionKeys.length > 0 ? "in_progress" : "planned",
        setupSnapshot,
        questionPlanSnapshot,
        questionWordingSnapshot,
        questionWordingStatus: "worded",
        progress: { status: "live_question", currentQuestionIndex: answeredQuestionKeys.length },
        answerDrafts: {},
        answerSubmissions: Object.fromEntries(answeredQuestionKeys.map((questionKey, index) => [
            questionKey,
            createAnswerSubmission(questionKey, index),
        ])),
        answerIdempotencyRecords: {},
        answerAnalysisSnapshots: {},
        feedbackActionEvents: {},
        completionSnapshot: null,
    };
}

function createFollowUpSession({
    sessionId,
    sourceSessionId,
    sourceQuestionKey,
    rootSessionId,
    rootQuestionKey,
    createdAt,
}: {
    sessionId: string;
    sourceSessionId: string;
    sourceQuestionKey: string;
    rootSessionId: string;
    rootQuestionKey: string;
    createdAt: string;
}): CandidatePracticeSessionRecord {
    const followUpPractice: CandidateFollowUpPracticeSessionMetadata = {
        status: "candidate_follow_up_practice_session",
        sourceIntentId: `intent-${sessionId}`,
        source: "practice_builder",
        sessionAttemptNumber: 2,
        itemCount: 1,
        items: [{
            localSlotId: "slot-1",
            localQuestionNumber: 1,
            candidatePracticeSessionId: sessionId,
            questionKey: "slot-1",
            sourceCandidatePracticeSessionId: sourceSessionId,
            sourceQuestionKey,
            rootSourceCandidatePracticeSessionId: rootSessionId,
            rootSourceQuestionKey: rootQuestionKey,
            sourceQuestionNumber: 2,
            sourceQuestionText: "Tell me about a time you caught a quality issue.",
            sourceCategory: "Behavioral",
            questionAttemptNumber: 2,
            practiceKind: "practice_from_feedback",
        }],
    };
    const questionPlanSnapshot = createCandidateQuestionPlan({
        interviewStage: "screening",
        questionCount: 1,
    });

    return {
        candidatePracticeSessionId: sessionId,
        candidateProfileId: CANDIDATE_PROFILE_ID,
        roleProfileId: ROLE_PROFILE_ID,
        candidateLaunchSessionId: null,
        status: "completed",
        setupSnapshot: {
            targetRole: "Quality Control Inspector",
            jobDescription: "Inspect finished products and document quality findings.",
            resumeText: null,
            interviewStage: "screening",
            questionCount: 1,
            resumeCaptureMode: "none",
            createdAt,
            followUpPractice,
        } as CandidatePracticeSessionRecord["setupSnapshot"] & {
            followUpPractice: CandidateFollowUpPracticeSessionMetadata;
        },
        questionPlanSnapshot,
        questionWordingSnapshot: {
            status: "questions_worded",
            questions: [{
                slotId: "slot-1",
                index: 0,
                category: "behavioral",
                questionText: "Tell me about a time you caught a quality issue.",
            }],
        },
        questionWordingStatus: "worded",
        progress: { status: "completed", currentQuestionIndex: 0 },
        answerDrafts: {},
        answerSubmissions: { "slot-1": createAnswerSubmission("slot-1", 0) },
        answerIdempotencyRecords: {},
        answerAnalysisSnapshots: {},
        feedbackActionEvents: {},
        completionSnapshot: null,
    };
}

function createAnswerSubmission(slotId: string, questionIndex: number) {
    return {
        slotId,
        questionIndex,
        mode: "text" as const,
        text: "I inspected the batch, isolated the issue, and documented the result.",
        submittedAt: "2026-07-15T12:05:00.000Z",
        status: "pending_analysis" as const,
    };
}
