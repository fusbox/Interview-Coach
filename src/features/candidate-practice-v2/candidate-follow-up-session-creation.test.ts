import { describe, expect, it } from "vitest";

import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import {
    type CandidateFollowUpPracticeSessionMetadata,
    type CandidateFollowUpQuestionWordingResult,
    createCandidateFollowUpSessionInputFromIntent,
} from "./candidate-follow-up-session-creation";
import type { CandidatePracticeIntentRecord } from "./candidate-follow-up-practice-intent";

describe("candidate follow-up session creation", () => {
    it("creates a normal practice-session input from a one-or-many question practice intent", () => {
        const input = createCandidateFollowUpSessionInputFromIntent({
            candidateProfileId: "candidate-1",
            intent: createPracticeIntentRecord(),
            existingPracticeSessions: [
                createSourceSession({
                    candidatePracticeSessionId: "source-session-1",
                    answeredSlotIds: ["slot-1"],
                }),
            ],
            now: new Date("2026-07-12T17:00:00.000Z"),
        });

        expect(input).toMatchObject({
            candidateProfileId: "candidate-1",
            setupSnapshot: {
                targetRole: "Material Handler I",
                jobDescription: "Move materials safely.",
                resumeText: "I moved inventory and checked labels.",
                interviewStage: "first_interview",
                questionCount: 2,
                resumeCaptureMode: "pasted_text",
                createdAt: "2026-07-12T17:00:00.000Z",
                followUpPractice: {
                    status: "candidate_follow_up_practice_session",
                    sourceIntentId: "intent-1",
                    source: "practice_builder",
                    sessionAttemptNumber: 2,
                    itemCount: 2,
                },
            },
            questionPlanSnapshot: {
                interviewStage: "first_interview",
                questionCount: 2,
                categoryCounts: {
                    screening: 1,
                    behavioral: 1,
                    culture_fit: 0,
                    case_scenario: 0,
                    technical_role_specific: 0,
                },
                followUpPractice: {
                    sourceIntentId: "intent-1",
                    sessionAttemptNumber: 2,
                },
            },
            questionWordingSnapshot: {
                status: "questions_worded",
                followUpPractice: {
                    sourceIntentId: "intent-1",
                    sessionAttemptNumber: 2,
                },
            },
            progress: {
                status: "planned",
                currentQuestionIndex: 0,
            },
        });
        expect(input?.questionPlanSnapshot.slots).toMatchObject([
            {
                id: "slot-1",
                index: 0,
                category: "screening",
                sourceQuestion: {
                    candidatePracticeSessionId: "source-session-1",
                    questionKey: "slot-1",
                    questionAttemptNumber: 2,
                    sourceQuestionNumber: 1,
                },
            },
            {
                id: "slot-2",
                index: 1,
                category: "behavioral",
                sourceQuestion: {
                    candidatePracticeSessionId: "source-session-1",
                    questionKey: "slot-2",
                    questionAttemptNumber: 1,
                    sourceQuestionNumber: 2,
                },
            },
        ]);
        const questionWordingSnapshot = input?.questionWordingSnapshot as CandidateFollowUpQuestionWordingResult | null | undefined;
        expect(questionWordingSnapshot?.questions).toMatchObject([
            {
                slotId: "slot-1",
                index: 0,
                category: "screening",
                questionText: "What interests you about this Material Handler I role?",
                sourceQuestion: {
                    questionAttemptNumber: 2,
                },
            },
            {
                slotId: "slot-2",
                index: 1,
                category: "behavioral",
                questionText: "Tell me about a time you handled an inventory issue.",
                sourceQuestion: {
                    questionAttemptNumber: 1,
                },
            },
        ]);
    });

    it("increments question attempt numbers from previous follow-up sessions with the same source question lineage", () => {
        const previousFollowUp = createSourceSession({
            candidatePracticeSessionId: "follow-up-session-1",
            answeredSlotIds: ["slot-1"],
            followUpItems: [{
                localSlotId: "slot-1",
                sourceCandidatePracticeSessionId: "source-session-1",
                sourceQuestionKey: "slot-1",
                questionAttemptNumber: 2,
            }],
        });

        const input = createCandidateFollowUpSessionInputFromIntent({
            candidateProfileId: "candidate-1",
            intent: createPracticeIntentRecord({ itemKeys: ["slot-1"] }),
            existingPracticeSessions: [
                createSourceSession({
                    candidatePracticeSessionId: "source-session-1",
                    answeredSlotIds: ["slot-1"],
                }),
                previousFollowUp,
            ],
            now: new Date("2026-07-12T17:00:00.000Z"),
        });

        expect((input?.setupSnapshot as { followUpPractice?: CandidateFollowUpPracticeSessionMetadata }).followUpPractice).toMatchObject({
            sessionAttemptNumber: 3,
        });
        expect(input?.questionPlanSnapshot.slots[0]).toMatchObject({
            sourceQuestion: {
                questionAttemptNumber: 3,
            },
        });
    });

    it("fails closed when the source session for inherited setup context is unavailable", () => {
        expect(createCandidateFollowUpSessionInputFromIntent({
            candidateProfileId: "candidate-1",
            intent: createPracticeIntentRecord(),
            existingPracticeSessions: [],
            now: new Date("2026-07-12T17:00:00.000Z"),
        })).toBeNull();
    });
});

function createPracticeIntentRecord({
    itemKeys = ["slot-1", "slot-2"],
}: {
    itemKeys?: string[];
} = {}): CandidatePracticeIntentRecord {
    const items = itemKeys.map((questionKey, index) => {
        const questionNumber = questionKey === "slot-1" ? 1 : 2;
        const category = questionKey === "slot-1" ? "Screening" : "Behavioral";
        const questionText = questionKey === "slot-1"
            ? "What interests you about this Material Handler I role?"
            : "Tell me about a time you handled an inventory issue.";

        return {
            kind: questionKey === "slot-1" ? "practice_from_feedback" as const : "practice_missing_evidence" as const,
            source: {
                kind: "coach_update_detail" as const,
                candidatePracticeSessionId: "source-session-1",
                questionKey,
                targetInterviewId: "material handler i",
                targetRole: "Material Handler I",
                questionNumber,
                category,
                questionText,
                evidenceStatus: questionKey === "slot-1" ? "practiced_with_coaching" as const : "missing_practice_evidence" as const,
            },
            display: {
                label: questionKey === "slot-1" ? "Practice from coach feedback" as const : "Practice missing evidence" as const,
                body: `Practice question ${questionNumber}.`,
            },
            sortKey: index,
        };
    });

    return {
        status: "candidate_practice_intent_record",
        candidatePracticeIntentId: "intent-1",
        candidateProfileId: "candidate-1",
        source: "practice_builder",
        lifecycleState: "ready",
        targetInterviewId: "material handler i",
        targetRole: "Material Handler I",
        itemCount: items.length,
        setupContext: {
            targetRole: "Material Handler I",
            jobDescription: "Move materials safely.",
            interviewStage: "first_interview",
            questionCount: 3,
            resumeIncluded: true,
        },
        items,
        createdAt: "2026-07-12T16:00:00.000Z",
        updatedAt: "2026-07-12T16:00:00.000Z",
    };
}

function createSourceSession({
    candidatePracticeSessionId,
    answeredSlotIds = [],
    followUpItems = [],
}: {
    candidatePracticeSessionId: string;
    answeredSlotIds?: string[];
    followUpItems?: Array<{
        localSlotId: string;
        sourceCandidatePracticeSessionId: string;
        sourceQuestionKey: string;
        questionAttemptNumber: number;
    }>;
}): CandidatePracticeSessionRecord {
    const followUpPractice = followUpItems.length > 0
        ? {
            status: "candidate_follow_up_practice_session",
            sourceIntentId: "previous-intent",
            source: "practice_builder",
            sessionAttemptNumber: 2,
            itemCount: followUpItems.length,
            items: followUpItems.map((item) => ({
                localSlotId: item.localSlotId,
                sourceCandidatePracticeSessionId: item.sourceCandidatePracticeSessionId,
                sourceQuestionKey: item.sourceQuestionKey,
                questionAttemptNumber: item.questionAttemptNumber,
            })),
        }
        : undefined;

    return {
        candidatePracticeSessionId,
        candidateProfileId: "candidate-1",
        roleProfileId: null,
        candidateLaunchSessionId: null,
        status: "completed",
        setupSnapshot: {
            targetRole: "Material Handler I",
            jobDescription: "Move materials safely.",
            resumeText: "I moved inventory and checked labels.",
            interviewStage: "first_interview",
            questionCount: 2,
            resumeCaptureMode: "pasted_text",
            createdAt: "2026-07-12T15:00:00.000Z",
            ...(followUpPractice ? { followUpPractice } : {}),
        },
        questionPlanSnapshot: {
            interviewStage: "first_interview",
            questionCount: 2,
            categoryCounts: {
                screening: 1,
                behavioral: 1,
                culture_fit: 0,
                case_scenario: 0,
                technical_role_specific: 0,
            },
            slots: [
                { id: "slot-1", index: 0, category: "screening", label: "Screening", purpose: "Basic fit." },
                { id: "slot-2", index: 1, category: "behavioral", label: "Behavioral", purpose: "Past examples." },
            ],
            ...(followUpPractice ? { followUpPractice } : {}),
        },
        questionWordingSnapshot: {
            status: "questions_worded",
            questions: [
                {
                    slotId: "slot-1",
                    index: 0,
                    category: "screening",
                    questionText: "What interests you about this Material Handler I role?",
                },
                {
                    slotId: "slot-2",
                    index: 1,
                    category: "behavioral",
                    questionText: "Tell me about a time you handled an inventory issue.",
                },
            ],
        },
        questionWordingStatus: "worded",
        progress: {
            status: "completed",
            currentQuestionIndex: 0,
        },
        answerDrafts: {},
        answerSubmissions: Object.fromEntries(answeredSlotIds.map((slotId) => [slotId, {
            slotId,
            questionIndex: slotId === "slot-1" ? 0 : 1,
            mode: "text" as const,
            text: "My answer.",
            submittedAt: "2026-07-12T15:05:00.000Z",
            status: "pending_analysis" as const,
        }])),
        answerIdempotencyRecords: {},
        answerAnalysisSnapshots: {},
        feedbackActionEvents: {},
        completionSnapshot: null,
    };
}
