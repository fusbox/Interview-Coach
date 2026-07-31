import { describe, expect, it } from "vitest";

import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import { hydrateCandidateQuestionAssistance } from "@/features/candidate-session-v2/candidate-question-assistance";
import {
    type CandidateFollowUpPracticeSessionMetadata,
    type CandidateFollowUpQuestionWordingResult,
    createCandidateFollowUpSessionInputFromIntent,
} from "./candidate-follow-up-session-creation";
import type { CandidatePracticeIntentRecord } from "./candidate-follow-up-practice-intent";

describe("candidate follow-up session creation", () => {
    it("creates a normal practice-session input from a one-or-many question practice intent", () => {
        const sourceSession = createSourceSession({
            candidatePracticeSessionId: "source-session-1",
            answeredSlotIds: ["slot-1"],
        });
        const input = createCandidateFollowUpSessionInputFromIntent({
            candidateProfileId: "candidate-1",
            intent: createPracticeIntentRecord(),
            existingPracticeSessions: [sourceSession],
            now: new Date("2026-07-12T17:00:00.000Z"),
        });

        expect(input).toMatchObject({
            candidateProfileId: "candidate-1",
            roleProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            setupSnapshot: {
                targetRole: "Material Handler I",
                jobDescription: "Move materials safely.",
                resumeText: "I moved inventory and checked labels.",
                interviewStage: "first_interview",
                questionCount: 2,
                resumeCaptureMode: "pasted_text",
                resumeArtifact: {
                    artifactId: "20000000-0000-4000-8000-000000000001",
                    candidateLabel: "Pasted resume",
                    reviewState: "accepted",
                },
                createdAt: "2026-07-12T17:00:00.000Z",
                followUpPractice: {
                    status: "candidate_follow_up_practice_session",
                    sourceIntentId: "intent-1",
                    source: "practice_builder",
                    sourceNextRoundDraftId: "draft-1",
                    sourceNextRoundDraftVersion: 4,
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
                status: "live_question",
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
                    rootSourceCandidatePracticeSessionId: "source-session-1",
                    rootSourceQuestionKey: "slot-1",
                    assembly: {
                        source: "next_round_draft",
                        candidateNextRoundDraftItemId: "draft-item-1",
                        provenance: "coach_update",
                        displayPosition: 0,
                    },
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
        expect(questionWordingSnapshot?.questions[0]).not.toHaveProperty("assistance");
        expect(questionWordingSnapshot?.questions[0]).not.toHaveProperty("contentFingerprint");
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

    it("keeps a canonical question root when follow-up practice starts from a prior follow-up", () => {
        const originalSession = createSourceSession({
            candidatePracticeSessionId: "source-session-1",
            answeredSlotIds: ["slot-1"],
        });
        const firstFollowUp = createSourceSession({
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
            intent: createPracticeIntentRecord({
                itemKeys: ["slot-1"],
                sourceSessionId: "follow-up-session-1",
            }),
            existingPracticeSessions: [originalSession, firstFollowUp],
            now: new Date("2026-07-12T17:00:00.000Z"),
        });

        expect(input?.questionPlanSnapshot.slots[0]).toMatchObject({
            sourceQuestion: {
                questionAttemptNumber: 3,
                sourceCandidatePracticeSessionId: "follow-up-session-1",
                sourceQuestionKey: "slot-1",
                rootSourceCandidatePracticeSessionId: "source-session-1",
                rootSourceQuestionKey: "slot-1",
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

    it("fails closed when a same-title source belongs to another prep context", () => {
        expect(createCandidateFollowUpSessionInputFromIntent({
            candidateProfileId: "candidate-1",
            intent: createPracticeIntentRecord({ itemKeys: ["slot-1"] }),
            existingPracticeSessions: [createSourceSession({
                candidatePracticeSessionId: "source-session-1",
                roleProfileId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                answeredSlotIds: ["slot-1"],
            })],
            now: new Date("2026-07-12T17:00:00.000Z"),
        })).toBeNull();
    });
});

function createPracticeIntentRecord({
    itemKeys = ["slot-1", "slot-2"],
    sourceSessionId = "source-session-1",
}: {
    itemKeys?: string[];
    sourceSessionId?: string;
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
                candidatePracticeSessionId: sourceSessionId,
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
            assembly: {
                source: "next_round_draft" as const,
                candidateNextRoundDraftItemId: `draft-item-${index + 1}`,
                provenance: questionKey === "slot-1" ? "coach_update" as const : "coach_plan" as const,
                displayPosition: index,
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
        launchVersion: 1,
        consumedCandidatePracticeSessionId: null,
        consumedAt: null,
        sourceNextRoundDraftId: "draft-1",
        sourceNextRoundDraftVersion: 4,
        roleProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        targetInterviewId: "material handler i",
        targetRole: "Material Handler I",
        itemCount: items.length,
        setupContext: {
            targetRole: "Material Handler I",
            jobDescription: "Move materials safely.",
            interviewStage: "first_interview",
            questionCount: 3,
            resumeIncluded: true,
            resumeArtifact: {
                artifactId: "20000000-0000-4000-8000-000000000001",
                version: 1,
                revision: 2,
                source: "pasted_text",
                candidateLabel: "Pasted resume",
                reviewState: "accepted",
            },
        },
        items,
        createdAt: "2026-07-12T16:00:00.000Z",
        updatedAt: "2026-07-12T16:00:00.000Z",
        expiresAt: "2026-07-13T16:00:00.000Z",
    };
}

function createSourceSession({
    candidatePracticeSessionId,
    roleProfileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    answeredSlotIds = [],
    followUpItems = [],
}: {
    candidatePracticeSessionId: string;
    roleProfileId?: string | null;
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
    const screeningQuestionText = "What interests you about this Material Handler I role?";
    const behavioralQuestionText = "Tell me about a time you handled an inventory issue.";
    const screeningAssistance = hydrateCandidateQuestionAssistance({
        category: "screening",
        questionText: screeningQuestionText,
        assistancePlan: {
            evidenceFocus: ["answer_first", "role_connection"],
            resumeAnchorId: null,
        },
        resumeAnchors: [],
    });
    const behavioralAssistance = hydrateCandidateQuestionAssistance({
        category: "behavioral",
        questionText: behavioralQuestionText,
        assistancePlan: {
            evidenceFocus: ["brief_context", "personal_action", "observable_result"],
            resumeAnchorId: null,
        },
        resumeAnchors: [],
    });

    return {
        candidatePracticeSessionId,
        candidateProfileId: "candidate-1",
        roleProfileId,
        candidateLaunchSessionId: null,
        status: "completed",
        setupSnapshot: {
            targetRole: "Material Handler I",
            jobDescription: "Move materials safely.",
            resumeText: "I moved inventory and checked labels.",
            resumeArtifact: {
                artifactId: "20000000-0000-4000-8000-000000000001",
                version: 1,
                revision: 2,
                source: "pasted_text",
                candidateLabel: "Pasted resume",
                reviewState: "accepted",
            },
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
                    questionText: screeningQuestionText,
                    ...screeningAssistance,
                },
                {
                    slotId: "slot-2",
                    index: 1,
                    category: "behavioral",
                    questionText: behavioralQuestionText,
                    ...behavioralAssistance,
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
