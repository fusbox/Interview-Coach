import { describe, expect, it } from "vitest";

import type { CandidateAnswerAttemptRecord } from "@/features/candidate-session-v2/candidate-answer-history";
import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import type {
    CriterionAppraisal,
    EvidenceExtractionOutput,
    UniversalCriterionId,
} from "@/features/evaluation-v2/evidence-first-evaluator-contract";
import { createCandidateSetupSessionTransition } from "@/features/candidate-setup-v2/candidate-setup-session-creation";

import type { CandidateCoachPlanReference } from "./candidate-coach-plan-reference";
import {
    createCandidateQuestionPreparednessProgress,
    type CandidateQuestionPreparednessAcceptedRun,
} from "./candidate-question-preparedness-progress";

const candidateProfileId = "candidate-1";
const sessionId = "session-1";
const criterionIds: UniversalCriterionId[] = [
    "answer_focus",
    "organization",
    "evidence_specificity",
    "role_skill_signal",
    "impact_judgment_takeaway",
];

describe("candidate question preparedness progress", () => {
    it("keeps highest-earned bands monotonic while preserving latest-attempt state and neutral coverage", () => {
        const practiceSessions = [createSession()];
        const attempts = [
            createAttempt("attempt-1", "slot-1", 0, 1, "2026-07-25T10:00:00.000Z"),
            createAttempt("attempt-2", "slot-1", 0, 2, "2026-07-25T11:00:00.000Z"),
            createAttempt("attempt-3", "slot-2", 1, 1, "2026-07-25T12:00:00.000Z"),
        ];
        const acceptedRuns = [
            createAcceptedRun("attempt-1", "run-1", ratedCriteria("strong")),
            createAcceptedRun("attempt-2", "run-2", ratedCriteria("emerging")),
            createAcceptedRun("attempt-3", "run-3", incompleteCriteria()),
        ];

        const progress = createCandidateQuestionPreparednessProgress({
            candidateProfileId,
            practiceSessions,
            coachPlan: createCoachPlan(),
            answerAttempts: attempts,
            acceptedRuns,
        });

        expect(progress).toMatchObject({
            coverage: {
                canonicalQuestionCount: 3,
                unpracticedQuestionCount: 1,
                attemptedQuestionCount: 2,
                evaluatedQuestionCount: 2,
                incompleteQuestionCount: 1,
                evaluationUnavailableQuestionCount: 0,
            },
            achievement: {
                emerging: 0,
                clear: 0,
                strong: 1,
            },
        });
        expect(progress?.questions[0]).toMatchObject({
            questionKey: "slot-1",
            state: "rated",
            band: "strong",
            highestEarnedAttemptId: "attempt-1",
            latestAttempt: {
                candidateAnswerAttemptId: "attempt-2",
                result: {
                    status: "rated",
                    band: "emerging",
                },
            },
        });
        expect(progress?.questions[1]).toMatchObject({
            questionKey: "slot-2",
            state: "incomplete",
            band: null,
        });
        expect(progress?.questions[2]).toMatchObject({
            questionKey: "slot-3",
            state: "not_practiced",
            band: null,
            latestAttempt: null,
        });
    });

    it("keeps a submitted question distinct from an accepted evaluator result", () => {
        const progress = createCandidateQuestionPreparednessProgress({
            candidateProfileId,
            practiceSessions: [createSession()],
            coachPlan: createCoachPlan(),
            answerAttempts: [createAttempt("attempt-1", "slot-1", 0, 1, "2026-07-25T10:00:00.000Z")],
            acceptedRuns: [],
        });

        expect(progress?.questions[0]).toMatchObject({
            state: "evaluation_unavailable",
            attemptCount: 1,
            evaluatedAttemptCount: 0,
            latestAttempt: {
                result: { status: "evaluation_unavailable" },
            },
        });
        expect(progress?.coverage.evaluationUnavailableQuestionCount).toBe(1);
    });

    it("attributes follow-up attempts to their canonical baseline question", () => {
        const followUpSession = createFollowUpSession();
        const attempt = createAttempt(
            "follow-up-attempt",
            "slot-1",
            0,
            1,
            "2026-07-25T14:00:00.000Z",
            followUpSession.candidatePracticeSessionId,
        );
        const progress = createCandidateQuestionPreparednessProgress({
            candidateProfileId,
            practiceSessions: [createSession(), followUpSession],
            coachPlan: createCoachPlan(),
            answerAttempts: [attempt],
            acceptedRuns: [createAcceptedRun(
                "follow-up-attempt",
                "follow-up-run",
                ratedCriteria("strong"),
            )],
        });

        expect(progress?.questions[0]).toMatchObject({
            questionKey: "slot-1",
            state: "rated",
            band: "strong",
            highestEarnedAttemptId: "follow-up-attempt",
        });
        expect(progress?.coverage.canonicalQuestionCount).toBe(3);
    });
});

function createSession(): CandidatePracticeSessionRecord {
    const created = createCandidateSetupSessionTransition({
        payload: {
            targetRole: "Quality Inspector",
            jobDescription: "Inspect finished products and document defects.",
            resumeText: null,
            interviewStage: "screening",
            questionCount: 3,
            resumeCaptureMode: "none",
        },
        now: new Date("2026-07-25T09:00:00.000Z"),
        createSessionId: () => sessionId,
    });
    return {
        candidatePracticeSessionId: sessionId,
        candidateProfileId,
        roleProfileId: "role-1",
        candidateLaunchSessionId: "launch-1",
        status: "completed",
        setupSnapshot: created.setupSnapshot,
        questionPlanSnapshot: created.questionPlanSnapshot,
        questionWordingSnapshot: created.questionWordingSnapshot,
        questionWordingStatus: "worded",
        progress: { status: "completed", currentQuestionIndex: 2 },
        answerDrafts: {},
        answerSubmissions: {},
        answerIdempotencyRecords: {},
        answerAnalysisSnapshots: {},
        feedbackActionEvents: {},
        completionSnapshot: null,
    };
}

function createCoachPlan(): CandidateCoachPlanReference {
    return {
        status: "candidate_coach_plan_reference_ready",
        source: {
            kind: "prep_context_baseline",
            baselineCandidatePracticeSessionId: sessionId,
            roleProfileId: "role-1",
        },
        targetRole: "Quality Inspector",
        stage: {
            id: "screening",
            label: "Screening call",
            detail: "A first conversation.",
        },
        questionCount: 3,
        practicedQuestionCount: 2,
        missingEvidenceCount: 1,
        categories: [],
        questions: [
            createQuestion("slot-1", 1),
            createQuestion("slot-2", 2),
            createQuestion("slot-3", 3),
        ],
    };
}

function createFollowUpSession(): CandidatePracticeSessionRecord {
    const baseline = createSession();
    const followUpPractice = {
        status: "candidate_follow_up_practice_session" as const,
        sourceIntentId: "intent-1",
        source: "coach_update_detail" as const,
        sessionAttemptNumber: 1,
        itemCount: 1,
        items: [{
            localSlotId: "slot-1",
            localQuestionNumber: 1,
            candidatePracticeSessionId: sessionId,
            questionKey: "slot-1",
            sourceCandidatePracticeSessionId: sessionId,
            sourceQuestionKey: "slot-1",
            rootSourceCandidatePracticeSessionId: sessionId,
            rootSourceQuestionKey: "slot-1",
            sourceQuestionNumber: 1,
            sourceQuestionText: "Question 1",
            sourceCategory: "Screening",
            questionAttemptNumber: 2,
            practiceKind: "practice_from_feedback" as const,
        }],
    };
    return {
        ...baseline,
        candidatePracticeSessionId: "follow-up-session",
        status: "completed",
        setupSnapshot: {
            ...baseline.setupSnapshot,
            questionCount: 1,
            createdAt: "2026-07-25T13:30:00.000Z",
            followUpPractice,
        } as CandidatePracticeSessionRecord["setupSnapshot"],
        questionPlanSnapshot: {
            ...baseline.questionPlanSnapshot,
            questionCount: 1,
            slots: [baseline.questionPlanSnapshot.slots[0]],
        },
        questionWordingSnapshot: {
            status: "questions_worded",
            questions: [baseline.questionWordingSnapshot!.questions[0]],
        },
    };
}

function createQuestion(questionKey: string, questionNumber: number) {
    return {
        questionKey,
        questionNumber,
        category: "screening" as const,
        categoryLabel: "Screening",
        questionText: `Question ${questionNumber}`,
        evidenceStatus: questionNumber < 3 ? "practiced" as const : "missing_evidence" as const,
    };
}

function createAttempt(
    candidateAnswerAttemptId: string,
    questionSlotId: string,
    questionIndex: number,
    attemptNumber: number,
    submittedAt: string,
    candidatePracticeSessionId = sessionId,
): CandidateAnswerAttemptRecord {
    return {
        candidateAnswerAttemptId,
        candidatePracticeSessionId,
        candidateProfileId,
        questionSlotId,
        questionIndex,
        attemptNumber,
        trigger: attemptNumber === 1 ? "initial_submit" : "feedback_retry",
        supersedesCandidateAnswerAttemptId: attemptNumber === 1 ? null : "attempt-1",
        mode: "text",
        answerText: `Answer ${candidateAnswerAttemptId}`,
        submittedAt,
        idempotencyKey: `key-${candidateAnswerAttemptId}`,
        payloadFingerprint: "a".repeat(64),
        sourceVoiceTranscriptionRunId: null,
        voiceSubmissionPath: null,
        voiceTranscriptEdited: null,
        createdAt: submittedAt,
    };
}

function createAcceptedRun(
    candidateAnswerAttemptId: string,
    candidateAnswerEvaluationRunId: string,
    criteria: CriterionAppraisal[],
): CandidateQuestionPreparednessAcceptedRun {
    return {
        candidateAnswerAttemptId,
        candidateAnswerEvaluationRunId,
        completedAt: "2026-07-25T13:00:00.000Z",
        extraction: {
            answerUsability: usability("usable"),
            technicalAccuracy: {
                status: "not_assessed",
                referenceConceptIds: [],
                evidenceSpanIds: [],
            },
        },
        criteria,
    };
}

function ratedCriteria(band: "emerging" | "clear" | "strong"): CriterionAppraisal[] {
    return criterionIds.map((criterionId) => ({
        criterionId,
        applicability: "observed",
        band,
        evidenceSpanIds: [],
        reasonCode: `fixture_${criterionId}`,
    }));
}

function incompleteCriteria(): CriterionAppraisal[] {
    return criterionIds.map((criterionId, index) => index < 2
        ? {
            criterionId,
            applicability: "insufficient_data",
            evidenceSpanIds: [],
            reasonCode: "fixture_insufficient",
        }
        : {
            criterionId,
            applicability: "observed",
            band: "clear",
            evidenceSpanIds: [],
            reasonCode: "fixture_clear",
        });
}

function usability(
    status: EvidenceExtractionOutput["answerUsability"]["status"],
): EvidenceExtractionOutput["answerUsability"] {
    return { status, reasonCode: `fixture_${status}` };
}
