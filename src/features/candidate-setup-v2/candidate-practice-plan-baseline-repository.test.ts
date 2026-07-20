import { describe, expect, it } from "vitest";

import {
    createCandidateFollowUpPracticeIntentRecord,
    resolveCandidateFollowUpPracticeIntent,
} from "@/features/candidate-practice-v2/candidate-follow-up-practice-intent";
import { createCandidateFollowUpSessionInputFromIntent } from "@/features/candidate-practice-v2/candidate-follow-up-session-creation";
import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import { createFixtureCandidateQuestionWordingResult } from "@/features/candidate-session-v2/candidate-question-wording";
import {
    createCandidatePracticePlanBaseline,
    createCandidateQuestionGenerationPlan,
    deriveCandidateBaselineWording,
    deriveCandidateInitialRoundPlan,
    deriveCandidateInitialRoundWording,
} from "./candidate-practice-plan-baseline";
import {
    createCandidateBaselineAwarePracticeSessions,
    type CandidatePracticePlanBaselineRecord,
} from "./candidate-practice-plan-baseline-repository";

const CANDIDATE_PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const ROLE_PROFILE_ID = "33333333-3333-4333-8333-333333333333";
const SESSION_ID = "11111111-1111-4111-8111-111111111111";

describe("candidate practice-plan baseline session projection", () => {
    it("retains supplemental source wording without expanding the baseline plan", () => {
        const { session, baseline } = createThreeQuestionFirstRoundWithSevenQuestionBaseline();
        session.questionWordingSnapshot?.questions.push({
            slotId: "slot-8",
            index: 7,
            category: "culture_fit",
            questionText: "What else would help you succeed in this role?",
            coverageKind: "supplemental",
        });

        const [projected] = createCandidateBaselineAwarePracticeSessions({
            practiceSessions: [session],
            baseline,
        });

        expect(projected.questionPlanSnapshot.questionCount).toBe(7);
        expect(projected.questionWordingSnapshot?.questions.some((question) => question.slotId === "slot-8")).toBe(true);
    });

    it("makes an unexposed baseline question executable as follow-up practice", () => {
        const { session, baseline } = createThreeQuestionFirstRoundWithSevenQuestionBaseline();
        const practiceSessions = createCandidateBaselineAwarePracticeSessions({
            practiceSessions: [session],
            baseline,
        });
        const resolved = resolveCandidateFollowUpPracticeIntent({
            intent: {
                status: "candidate_follow_up_practice_intent_ready",
                kind: "practice_missing_evidence",
                source: {
                    kind: "coach_update_detail",
                    candidatePracticeSessionId: SESSION_ID,
                    questionKey: "slot-7",
                },
                display: {
                    label: "Practice missing evidence",
                    body: "Include this planned question in the next round.",
                },
            },
            candidateProfileId: CANDIDATE_PROFILE_ID,
            practiceSessions,
            selectedRoleProfileId: ROLE_PROFILE_ID,
        });

        expect(resolved).toMatchObject({
            roleProfileId: ROLE_PROFILE_ID,
            source: {
                candidatePracticeSessionId: SESSION_ID,
                questionKey: "slot-7",
                questionNumber: 7,
                evidenceStatus: "missing_practice_evidence",
            },
        });
        const intent = resolved && createCandidateFollowUpPracticeIntentRecord({
            candidatePracticeIntentId: "44444444-4444-4444-8444-444444444444",
            candidateProfileId: CANDIDATE_PROFILE_ID,
            source: "practice_builder",
            items: [resolved],
            createdAt: "2026-07-19T19:00:00.000Z",
        });
        expect(intent).toBeTruthy();

        const followUp = intent && createCandidateFollowUpSessionInputFromIntent({
            candidateProfileId: CANDIDATE_PROFILE_ID,
            intent,
            existingPracticeSessions: practiceSessions,
            now: new Date("2026-07-19T19:05:00.000Z"),
        });
        expect(followUp).toMatchObject({
            roleProfileId: ROLE_PROFILE_ID,
            setupSnapshot: { questionCount: 1 },
            questionPlanSnapshot: {
                questionCount: 1,
                slots: [{
                    sourceQuestion: {
                        rootSourceCandidatePracticeSessionId: SESSION_ID,
                        rootSourceQuestionKey: "slot-7",
                    },
                }],
            },
        });
    });
});

function createThreeQuestionFirstRoundWithSevenQuestionBaseline(): {
    session: CandidatePracticeSessionRecord;
    baseline: CandidatePracticePlanBaselineRecord;
} {
    const setupSnapshot = {
        targetRole: "Warehouse lead",
        jobDescription: "Coordinate safety workflows and daily operations.",
        resumeText: null,
        interviewStage: "first_interview" as const,
        questionCount: 3,
        resumeCaptureMode: "none" as const,
        createdAt: "2026-07-19T18:00:00.000Z",
    };
    const snapshot = createCandidatePracticePlanBaseline("first_interview");
    const generationPlan = createCandidateQuestionGenerationPlan({ baseline: snapshot, selectedQuestionCount: 3 });
    const roundPlan = deriveCandidateInitialRoundPlan({
        baseline: snapshot,
        generationPlan,
        selectedQuestionCount: 3,
    });
    const generatedWording = createFixtureCandidateQuestionWordingResult({
        setupSnapshot: { ...setupSnapshot, questionCount: generationPlan.questionCount },
        questionPlanSnapshot: generationPlan,
    });
    const baseline = {
        candidateProfileId: CANDIDATE_PROFILE_ID,
        roleProfileId: ROLE_PROFILE_ID,
        snapshot,
        questionWordingSnapshot: deriveCandidateBaselineWording({ baseline: snapshot, generatedWording }),
    };
    return {
        baseline,
        session: {
            candidatePracticeSessionId: SESSION_ID,
            candidateProfileId: CANDIDATE_PROFILE_ID,
            roleProfileId: ROLE_PROFILE_ID,
            candidateLaunchSessionId: null,
            status: "completed",
            setupSnapshot,
            questionPlanSnapshot: roundPlan,
            questionWordingSnapshot: deriveCandidateInitialRoundWording({ roundPlan, generatedWording }),
            questionWordingStatus: "worded",
            progress: { status: "completed", currentQuestionIndex: 2 },
            answerDrafts: {},
            answerSubmissions: {},
            answerIdempotencyRecords: {},
            answerAnalysisSnapshots: {},
            feedbackActionEvents: {},
            completionSnapshot: null,
        },
    };
}
