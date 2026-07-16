import { describe, expect, it } from "vitest";

import type { CandidateCoachPlanReference } from "@/features/candidate-dashboard-v2/candidate-coach-plan-reference";
import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";

import { createCandidateNextRoundBuilderModel } from "./candidate-next-round-builder";
import type { CandidateNextRoundDraftRecord } from "./candidate-next-round-draft";

describe("candidate next-round builder model", () => {
    it("joins the exact selected-context draft to canonical plan questions", () => {
        const sessions = createSessions();
        const model = createCandidateNextRoundBuilderModel({
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
            coachPlan: createCoachPlan(),
            practiceSessions: sessions,
            draft: createDraft(),
        });

        expect(model).toMatchObject({
            candidateNextRoundDraftId: "draft-1",
            version: 3,
            itemCount: 1,
            capacity: 20,
            targetRole: "Quality Inspector",
            items: [{
                rootCandidatePracticeSessionId: "session-baseline",
                rootQuestionKey: "slot-1",
                questionNumber: 1,
                evidenceLabel: "Coach feedback",
            }],
        });
        expect(model?.choices).toEqual([
            expect.objectContaining({
                sourceCandidatePracticeSessionId: "session-follow-up",
                sourceQuestionKey: "slot-1",
                rootQuestionKey: "slot-1",
                practiceKind: "practice_from_feedback",
                isQueued: true,
            }),
            expect.objectContaining({
                sourceCandidatePracticeSessionId: "session-baseline",
                sourceQuestionKey: "slot-2",
                rootQuestionKey: "slot-2",
                practiceKind: "practice_missing_evidence",
                isQueued: false,
            }),
        ]);
    });

    it("uses the newest matching coached occurrence and does not offer stale analysis", () => {
        const sessions = createSessions();
        sessions.push({
            ...sessions[1],
            candidatePracticeSessionId: "session-stale-latest",
            setupSnapshot: {
                ...sessions[1].setupSnapshot,
                createdAt: "2026-07-15T14:00:00.000Z",
                followUpPractice: {
                    ...(sessions[1].setupSnapshot as CandidatePracticeSessionRecord["setupSnapshot"] & {
                        followUpPractice: Record<string, unknown>;
                    }).followUpPractice,
                    sourceIntentId: "intent-2",
                },
            } as CandidatePracticeSessionRecord["setupSnapshot"],
            answerSubmissions: {
                "slot-1": createSubmission("attempt-latest", "2026-07-15T14:01:00.000Z"),
            },
            answerAnalysisSnapshots: {
                "slot-1": createAnalysis("attempt-older", "2026-07-15T14:02:00.000Z"),
            },
        });

        const model = createCandidateNextRoundBuilderModel({
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
            coachPlan: createCoachPlan(),
            practiceSessions: sessions,
            draft: { ...createDraft(), items: [], itemCount: 0 },
        });

        expect(model?.choices[0]).toMatchObject({
            sourceCandidatePracticeSessionId: "session-follow-up",
            practiceKind: "practice_from_feedback",
        });
    });

    it("fails closed when candidate, prep-context, or queued lineage does not match", () => {
        const input = {
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
            coachPlan: createCoachPlan(),
            practiceSessions: createSessions(),
            draft: createDraft(),
        };

        expect(createCandidateNextRoundBuilderModel({
            ...input,
            draft: { ...input.draft, candidateProfileId: "candidate-2" },
        })).toBeNull();
        expect(createCandidateNextRoundBuilderModel({
            ...input,
            draft: {
                ...input.draft,
                items: [{ ...input.draft.items[0], sourceQuestionKey: "missing-slot" }],
            },
        })).toBeNull();
    });
});

function createCoachPlan(): CandidateCoachPlanReference {
    return {
        status: "candidate_coach_plan_reference_ready",
        source: {
            kind: "initial_session_plan",
            baselineCandidatePracticeSessionId: "session-baseline",
            roleProfileId: "role-1",
        },
        targetRole: "Quality Inspector",
        stage: { id: "screening", label: "Screening", detail: "An early conversation." },
        questionCount: 2,
        practicedQuestionCount: 1,
        missingEvidenceCount: 1,
        categories: [],
        questions: [
            {
                questionKey: "slot-1",
                questionNumber: 1,
                category: "screening",
                categoryLabel: "Screening",
                questionText: "Why this role?",
                evidenceStatus: "practiced",
            },
            {
                questionKey: "slot-2",
                questionNumber: 2,
                category: "behavioral",
                categoryLabel: "Behavioral",
                questionText: "Tell me about finding a defect.",
                evidenceStatus: "missing_evidence",
            },
        ],
    };
}

function createDraft(): CandidateNextRoundDraftRecord {
    return {
        status: "candidate_next_round_draft",
        candidateNextRoundDraftId: "draft-1",
        candidateProfileId: "candidate-1",
        roleProfileId: "role-1",
        version: 3,
        itemCount: 1,
        items: [{
            candidateNextRoundDraftItemId: "item-1",
            sourceCandidatePracticeSessionId: "session-follow-up",
            sourceQuestionKey: "slot-1",
            practiceKind: "practice_from_feedback",
            provenance: "coach_update",
            displayPosition: 0,
            createdAt: "2026-07-15T13:03:00.000Z",
            updatedAt: "2026-07-15T13:03:00.000Z",
        }],
        createdAt: "2026-07-15T12:00:00.000Z",
        updatedAt: "2026-07-15T13:03:00.000Z",
    };
}

function createSessions(): CandidatePracticeSessionRecord[] {
    const baseline = createSession({
        candidatePracticeSessionId: "session-baseline",
        createdAt: "2026-07-15T12:00:00.000Z",
        questions: [
            { slotId: "slot-1", index: 0, category: "screening", questionText: "Why this role?" },
            { slotId: "slot-2", index: 1, category: "behavioral", questionText: "Tell me about finding a defect." },
        ],
        answerSubmissions: {
            "slot-1": createSubmission("attempt-baseline", "2026-07-15T12:01:00.000Z"),
        },
        answerAnalysisSnapshots: {
            "slot-1": createAnalysis("attempt-baseline", "2026-07-15T12:02:00.000Z"),
        },
    });
    const followUp = createSession({
        candidatePracticeSessionId: "session-follow-up",
        createdAt: "2026-07-15T13:00:00.000Z",
        questions: [{ slotId: "slot-1", index: 0, category: "screening", questionText: "Why this role?" }],
        answerSubmissions: {
            "slot-1": createSubmission("attempt-follow-up", "2026-07-15T13:01:00.000Z"),
        },
        answerAnalysisSnapshots: {
            "slot-1": createAnalysis("attempt-follow-up", "2026-07-15T13:02:00.000Z"),
        },
        followUpPractice: {
            status: "candidate_follow_up_practice_session",
            sourceIntentId: "intent-1",
            source: "practice_builder",
            sessionAttemptNumber: 2,
            itemCount: 1,
            items: [{
                localSlotId: "slot-1",
                localQuestionNumber: 1,
                candidatePracticeSessionId: "session-follow-up",
                questionKey: "slot-1",
                sourceCandidatePracticeSessionId: "session-baseline",
                sourceQuestionKey: "slot-1",
                rootSourceCandidatePracticeSessionId: "session-baseline",
                rootSourceQuestionKey: "slot-1",
                sourceQuestionNumber: 1,
                sourceQuestionText: "Why this role?",
                sourceCategory: "Screening",
                questionAttemptNumber: 2,
                practiceKind: "practice_from_feedback",
            }],
        },
    });
    return [baseline, followUp];
}

function createSession({
    candidatePracticeSessionId,
    createdAt,
    questions,
    answerSubmissions,
    answerAnalysisSnapshots,
    followUpPractice,
}: {
    candidatePracticeSessionId: string;
    createdAt: string;
    questions: NonNullable<CandidatePracticeSessionRecord["questionWordingSnapshot"]>["questions"];
    answerSubmissions: CandidatePracticeSessionRecord["answerSubmissions"];
    answerAnalysisSnapshots: CandidatePracticeSessionRecord["answerAnalysisSnapshots"];
    followUpPractice?: Record<string, unknown>;
}): CandidatePracticeSessionRecord {
    return {
        candidatePracticeSessionId,
        candidateProfileId: "candidate-1",
        roleProfileId: "role-1",
        candidateLaunchSessionId: null,
        status: "completed",
        setupSnapshot: {
            targetRole: "Quality Inspector",
            jobDescription: "Inspect finished goods.",
            resumeText: "",
            interviewStage: "screening",
            questionCount: questions.length,
            resumeCaptureMode: "none",
            createdAt,
            ...(followUpPractice ? { followUpPractice } : {}),
        } as CandidatePracticeSessionRecord["setupSnapshot"],
        questionPlanSnapshot: {
            interviewStage: "screening",
            questionCount: questions.length,
            categoryCounts: {
                screening: questions.filter((question) => question.category === "screening").length,
                behavioral: questions.filter((question) => question.category === "behavioral").length,
                culture_fit: 0,
                case_scenario: 0,
                technical_role_specific: 0,
            },
            slots: questions.map((question) => ({
                id: question.slotId,
                index: question.index,
                category: question.category,
                label: question.category,
                purpose: "Practice purpose.",
            })),
        },
        questionWordingSnapshot: { status: "questions_worded", questions },
        questionWordingStatus: "worded",
        progress: { status: "completed", currentQuestionIndex: Math.max(0, questions.length - 1) },
        answerDrafts: {},
        answerSubmissions,
        answerIdempotencyRecords: {},
        answerAnalysisSnapshots,
        feedbackActionEvents: {},
        completionSnapshot: null,
    };
}

function createSubmission(answerAttemptId: string, submittedAt: string) {
    return {
        slotId: "slot-1",
        questionIndex: 0,
        mode: "text" as const,
        text: "I care about quality.",
        submittedAt,
        status: "pending_analysis" as const,
        answerAttemptId,
        attemptNumber: 1,
        trigger: "initial_submit" as const,
        supersedesAnswerAttemptId: null,
    };
}

function createAnalysis(answerAttemptId: string, analyzedAt: string) {
    return {
        status: "answer_analysis_provider_result" as const,
        provider: "candidate_v2_answer_evaluator" as const,
        analyzedAt,
        answer: {
            slotId: "slot-1",
            questionIndex: 0,
            answerAttemptId,
            attemptNumber: 1,
            trigger: "initial_submit" as const,
        },
        coachFeedback: {
            acknowledgement: "You answered directly.",
            observation: "Your role interest is clear.",
            nextPracticeFocus: "Add one example.",
        },
        evidence: [],
    };
}
