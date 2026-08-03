import { describe, expect, it } from "vitest";

import { createFixtureCandidateQuestionWordingResult } from "@/features/candidate-session-v2/candidate-question-wording";
import { createCandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";
import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import { createCandidateAnswerAnalysisProviderResultFixture } from "@/features/candidate-session-v2/candidate-answer-analysis-test-fixture";
import {
    createCandidateFollowUpPracticeIntentRecord,
    parseCandidateFollowUpPracticeIntent,
    resolveCandidateFollowUpPracticeIntent,
} from "./candidate-follow-up-practice-intent";

describe("candidate follow-up practice intent", () => {
    it("parses a coach feedback focus practice intent from stable query params", () => {
        expect(parseCandidateFollowUpPracticeIntent({
            intent: "coach-update-feedback-focus",
            fromSession: "session-1",
            questionKey: "slot-1",
        })).toMatchObject({
            status: "candidate_follow_up_practice_intent_ready",
            kind: "practice_from_feedback",
            source: {
                kind: "coach_update_detail",
                candidatePracticeSessionId: "session-1",
                questionKey: "slot-1",
            },
            display: {
                label: "Practice from coach feedback",
            },
        });
    });

    it("parses a missing evidence practice intent", () => {
        expect(parseCandidateFollowUpPracticeIntent({
            intent: "coach-update-missing-evidence",
            fromSession: "session-1",
            questionKey: "slot-2",
        })).toMatchObject({
            kind: "practice_missing_evidence",
            display: {
                label: "Practice missing evidence",
            },
        });
    });

    it("fails closed for incomplete, repeated, or unstable query params", () => {
        expect(parseCandidateFollowUpPracticeIntent({
            intent: "coach-update-feedback-focus",
            fromSession: "session-1",
        })).toBeNull();
        expect(parseCandidateFollowUpPracticeIntent({
            intent: ["coach-update-feedback-focus", "coach-update-missing-evidence"],
            fromSession: "session-1",
            questionKey: "slot-1",
        })).toBeNull();
        expect(parseCandidateFollowUpPracticeIntent({
            intent: "coach-update-feedback-focus",
            fromSession: "session-1",
            questionKey: "slot-1?answerText=leak",
        })).toBeNull();
    });

    it("does not parse arbitrary content query params into practice state", () => {
        const intent = parseCandidateFollowUpPracticeIntent({
            intent: "coach-update-feedback-focus",
            fromSession: "session-1",
            questionKey: "slot-1",
            answerText: "Do not echo this.",
            jobDescription: "Do not prefill this.",
            coachObservation: "Do not carry this.",
            score: "99",
        });

        expect(JSON.stringify(intent)).not.toContain("Do not");
        expect(JSON.stringify(intent)).not.toContain("99");
    });

    it("resolves a feedback focus intent only from candidate-owned source question facts", () => {
        const parsedIntent = parseCandidateFollowUpPracticeIntent({
            intent: "coach-update-feedback-focus",
            fromSession: "session-1",
            questionKey: "slot-1",
        });

        expect(resolveCandidateFollowUpPracticeIntent({
            intent: parsedIntent,
            candidateProfileId: "candidate-1",
            practiceSessions: [createPracticeSession({
                candidatePracticeSessionId: "session-1",
                candidateProfileId: "candidate-1",
                answeredSlotIds: ["slot-1"],
                analyzedSlotIds: ["slot-1"],
            })],
            selectedLegacyTargetRole: "material handler i",
        })).toMatchObject({
            status: "candidate_follow_up_practice_intent_resolved",
            roleProfileId: null,
            kind: "practice_from_feedback",
            source: {
                kind: "coach_update_detail",
                candidatePracticeSessionId: "session-1",
                questionKey: "slot-1",
                targetInterviewId: "material handler i",
                targetRole: "Material Handler I",
                questionNumber: 1,
                evidenceStatus: "practiced_with_coaching",
            },
            setupContext: {
                targetRole: "Material Handler I",
                jobDescription: "Move materials safely.",
                interviewStage: "first_interview",
                questionCount: 3,
                resumeArtifact: {
                    artifactId: "20000000-0000-4000-8000-000000000001",
                    candidateLabel: "resume.pdf",
                    reviewState: "accepted",
                },
            },
        });
    });

    it("keeps the canonical Plan question number when the source is a follow-up round", () => {
        const parsedIntent = parseCandidateFollowUpPracticeIntent({
            intent: "coach-update-feedback-focus",
            fromSession: "follow-up-session-1",
            questionKey: "slot-1",
        });
        const sourceSession = createPracticeSession({
            candidatePracticeSessionId: "follow-up-session-1",
            candidateProfileId: "candidate-1",
            answeredSlotIds: ["slot-1"],
            analyzedSlotIds: ["slot-1"],
            followUpSourceQuestionNumber: 4,
        });

        expect(resolveCandidateFollowUpPracticeIntent({
            intent: parsedIntent,
            candidateProfileId: "candidate-1",
            practiceSessions: [sourceSession],
        })).toMatchObject({
            source: { questionKey: "slot-1", questionNumber: 4 },
            display: { body: expect.stringContaining("question 4") },
        });
    });

    it("resolves a missing-evidence intent only when the planned question has no answer evidence", () => {
        const parsedIntent = parseCandidateFollowUpPracticeIntent({
            intent: "coach-update-missing-evidence",
            fromSession: "session-1",
            questionKey: "slot-2",
        });

        expect(resolveCandidateFollowUpPracticeIntent({
            intent: parsedIntent,
            candidateProfileId: "candidate-1",
            practiceSessions: [createPracticeSession({
                candidatePracticeSessionId: "session-1",
                candidateProfileId: "candidate-1",
                answeredSlotIds: ["slot-1"],
                analyzedSlotIds: ["slot-1"],
            })],
        })).toMatchObject({
            status: "candidate_follow_up_practice_intent_resolved",
            roleProfileId: null,
            kind: "practice_missing_evidence",
            source: {
                questionKey: "slot-2",
                evidenceStatus: "missing_practice_evidence",
            },
        });
    });

    it("fails closed for cross-candidate, context-mismatched, stale, or semantically wrong intents", () => {
        const feedbackIntent = parseCandidateFollowUpPracticeIntent({
            intent: "coach-update-feedback-focus",
            fromSession: "session-1",
            questionKey: "slot-1",
        });
        const missingEvidenceIntent = parseCandidateFollowUpPracticeIntent({
            intent: "coach-update-missing-evidence",
            fromSession: "session-1",
            questionKey: "slot-1",
        });
        const sourceSession = createPracticeSession({
            candidatePracticeSessionId: "session-1",
            candidateProfileId: "candidate-2",
            answeredSlotIds: ["slot-1"],
            analyzedSlotIds: ["slot-1"],
        });

        expect(resolveCandidateFollowUpPracticeIntent({
            intent: feedbackIntent,
            candidateProfileId: "candidate-1",
            practiceSessions: [sourceSession],
        })).toBeNull();
        expect(resolveCandidateFollowUpPracticeIntent({
            intent: feedbackIntent,
            candidateProfileId: "candidate-2",
            practiceSessions: [sourceSession],
            selectedLegacyTargetRole: "customer service representative",
        })).toBeNull();
        expect(resolveCandidateFollowUpPracticeIntent({
            intent: feedbackIntent,
            candidateProfileId: "candidate-2",
            practiceSessions: [sourceSession],
            selectedRoleProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        })).toBeNull();
        expect(resolveCandidateFollowUpPracticeIntent({
            intent: feedbackIntent,
            candidateProfileId: "candidate-2",
            practiceSessions: [sourceSession],
        })).toMatchObject({
            source: {
                questionKey: "slot-1",
            },
        });
        expect(resolveCandidateFollowUpPracticeIntent({
            intent: parseCandidateFollowUpPracticeIntent({
                intent: "coach-update-feedback-focus",
                fromSession: "session-1",
                questionKey: "slot-99",
            }),
            candidateProfileId: "candidate-2",
            practiceSessions: [sourceSession],
        })).toBeNull();
        expect(resolveCandidateFollowUpPracticeIntent({
            intent: missingEvidenceIntent,
            candidateProfileId: "candidate-2",
            practiceSessions: [sourceSession],
        })).toBeNull();
    });

    it("creates a durable multi-question follow-up intent from resolved candidate-owned items", () => {
        const firstItem = createResolvedFollowUpPracticeIntent({
            questionKey: "slot-1",
            questionNumber: 1,
            category: "Screening",
            questionText: "What interests you about this Material Handler role?",
        });
        const secondItem = createResolvedFollowUpPracticeIntent({
            questionKey: "slot-2",
            questionNumber: 2,
            category: "Behavioral",
            questionText: "Tell me about a time you handled an inventory issue.",
        });

        expect(createCandidateFollowUpPracticeIntentRecord({
            candidatePracticeIntentId: "intent-1",
            candidateProfileId: "candidate-1",
            source: "practice_builder",
            items: [firstItem, secondItem],
            createdAt: "2026-07-12T12:00:00.000Z",
        })).toMatchObject({
            status: "candidate_practice_intent_record",
            candidatePracticeIntentId: "intent-1",
            candidateProfileId: "candidate-1",
            source: "practice_builder",
            lifecycleState: "ready",
            roleProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            targetInterviewId: "material handler i",
            targetRole: "Material Handler I",
            itemCount: 2,
            items: [
                {
                    source: {
                        candidatePracticeSessionId: "session-1",
                        questionKey: "slot-1",
                        questionNumber: 1,
                    },
                },
                {
                    source: {
                        candidatePracticeSessionId: "session-1",
                        questionKey: "slot-2",
                        questionNumber: 2,
                    },
                },
            ],
        });
    });

    it("fails closed when durable follow-up intent items are empty, duplicated, or mixed across role contexts", () => {
        const firstItem = createResolvedFollowUpPracticeIntent({
            questionKey: "slot-1",
            questionNumber: 1,
        });
        const duplicateItem = createResolvedFollowUpPracticeIntent({
            questionKey: "slot-1",
            questionNumber: 1,
        });
        const mixedRoleItem = createResolvedFollowUpPracticeIntent({
            questionKey: "slot-2",
            questionNumber: 2,
            targetRole: "CSR",
            targetInterviewId: "csr",
        });

        expect(createCandidateFollowUpPracticeIntentRecord({
            candidatePracticeIntentId: "intent-1",
            candidateProfileId: "candidate-1",
            source: "practice_builder",
            items: [],
            createdAt: "2026-07-12T12:00:00.000Z",
        })).toBeNull();
        expect(createCandidateFollowUpPracticeIntentRecord({
            candidatePracticeIntentId: "intent-1",
            candidateProfileId: "candidate-1",
            source: "practice_builder",
            items: [firstItem, duplicateItem],
            createdAt: "2026-07-12T12:00:00.000Z",
        })).toBeNull();
        expect(createCandidateFollowUpPracticeIntentRecord({
            candidatePracticeIntentId: "intent-1",
            candidateProfileId: "candidate-1",
            source: "practice_builder",
            items: [firstItem, mixedRoleItem],
            createdAt: "2026-07-12T12:00:00.000Z",
        })).toBeNull();
    });
});

function createResolvedFollowUpPracticeIntent({
    questionKey,
    questionNumber,
    category = "Screening",
    questionText = "What interests you about this Material Handler role?",
    targetRole = "Material Handler I",
    targetInterviewId = "material handler i",
    roleProfileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
}: {
    questionKey: string;
    questionNumber: number;
    category?: string;
    questionText?: string;
    targetRole?: string;
    targetInterviewId?: string;
    roleProfileId?: string | null;
}) {
    return {
        status: "candidate_follow_up_practice_intent_resolved" as const,
        roleProfileId,
        kind: "practice_from_feedback" as const,
        source: {
            kind: "coach_update_detail" as const,
            candidatePracticeSessionId: "session-1",
            questionKey,
            targetInterviewId,
            targetRole,
            questionNumber,
            category,
            questionText,
            evidenceStatus: "practiced_with_coaching" as const,
        },
        setupContext: {
            targetRole,
            jobDescription: "Move materials safely.",
            interviewStage: "first_interview" as const,
            questionCount: 3,
            resumeIncluded: false,
        },
        display: {
            label: "Practice from coach feedback" as const,
            body: `I found the source coach read for ${targetRole}, question ${questionNumber}.`,
        },
    };
}

function createPracticeSession({
    candidatePracticeSessionId,
    candidateProfileId,
    roleProfileId = null,
    answeredSlotIds = [],
    analyzedSlotIds = [],
    followUpSourceQuestionNumber,
}: {
    candidatePracticeSessionId: string;
    candidateProfileId: string;
    roleProfileId?: string | null;
    answeredSlotIds?: string[];
    analyzedSlotIds?: string[];
    followUpSourceQuestionNumber?: number;
}): CandidatePracticeSessionRecord {
    const followUpPractice = followUpSourceQuestionNumber ? {
        status: "candidate_follow_up_practice_session" as const,
        sourceIntentId: "source-intent-1",
        source: "practice_builder" as const,
        sessionAttemptNumber: 2,
        itemCount: 1,
        items: [{
            localSlotId: "slot-1",
            localQuestionNumber: 1,
            candidatePracticeSessionId: "source-session-1",
            questionKey: "slot-4",
            sourceCandidatePracticeSessionId: "source-session-1",
            sourceQuestionKey: "slot-4",
            sourceQuestionNumber: followUpSourceQuestionNumber,
            sourceQuestionText: "What interests you about this Material Handler I role?",
            sourceCategory: "Screening",
            questionAttemptNumber: 2,
            practiceKind: "practice_from_feedback" as const,
        }],
    } : undefined;
    const setupSnapshot = {
        targetRole: "Material Handler I",
        jobDescription: "Move materials safely.",
        resumeText: "Inventory lead with shipping experience.",
        resumeArtifact: {
            artifactId: "20000000-0000-4000-8000-000000000001",
            version: 1,
            revision: 2,
            source: "document_upload" as const,
            candidateLabel: "resume.pdf",
            reviewState: "accepted" as const,
        },
        interviewStage: "first_interview" as const,
        questionCount: 3,
        resumeCaptureMode: "document_upload" as const,
        createdAt: "2026-07-11T12:00:00.000Z",
        ...(followUpPractice ? { followUpPractice } : {}),
    };
    const questionPlanSnapshot = createCandidateQuestionPlan({
        interviewStage: "first_interview",
        questionCount: 3,
    });
    const questionWordingSnapshot = createFixtureCandidateQuestionWordingResult({
        setupSnapshot,
        questionPlanSnapshot,
    });

    return {
        candidatePracticeSessionId,
        candidateProfileId,
        roleProfileId,
        candidateLaunchSessionId: null,
        status: "completed",
        setupSnapshot,
        questionPlanSnapshot,
        questionWordingSnapshot,
        questionWordingStatus: "worded",
        progress: {
            status: "completed",
            currentQuestionIndex: 0,
        },
        answerDrafts: {},
        answerSubmissions: Object.fromEntries(answeredSlotIds.map((slotId) => [slotId, {
            slotId,
            questionIndex: questionWordingSnapshot.questions.find((question) => question.slotId === slotId)?.index ?? 0,
            mode: "text" as const,
            text: "I checked the work area and followed the safety steps.",
            submittedAt: "2026-07-11T12:01:00.000Z",
            status: "pending_analysis" as const,
        }])),
        answerIdempotencyRecords: {},
        answerAnalysisSnapshots: Object.fromEntries(analyzedSlotIds.map((slotId) => [slotId, createCandidateAnswerAnalysisProviderResultFixture({
            analyzedAt: "2026-07-11T12:02:00.000Z",
            answer: {
                slotId,
                questionIndex: questionWordingSnapshot.questions.find((question) => question.slotId === slotId)?.index ?? 0,
            },
            coachFeedback: {
                acknowledgement: "You picked a relevant example.",
                observation: "The answer shows the task but needs a clearer result.",
                nextPracticeFocus: "Add the result of the safety step.",
            },
        })])),
        feedbackActionEvents: {},
        completionSnapshot: {
            status: "candidate_session_completed",
            audience: "candidate_led",
            sessionId: candidatePracticeSessionId,
            completedAt: "2026-07-11T12:03:00.000Z",
            questionCount: 3,
            answeredCount: answeredSlotIds.length,
            coachedCount: analyzedSlotIds.length,
            answeredQuestionKeys: answeredSlotIds,
            skippedOrUnansweredQuestionKeys: questionWordingSnapshot.questions
                .map((question) => question.slotId)
                .filter((slotId) => !answeredSlotIds.includes(slotId)),
            coachedQuestionKeys: analyzedSlotIds,
            finalProgress: {
                status: "completed",
                currentQuestionIndex: 0,
            },
            nextRoute: "/candidate/dashboard",
        },
    };
}
