import { describe, expect, it, vi } from "vitest";

import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import type { CandidateNextRoundDraftRecord } from "./candidate-next-round-draft";
import type { CandidatePracticeIntentRecord } from "./candidate-follow-up-practice-intent";
import { launchCandidateNextRoundDraft } from "./candidate-next-round-draft-launch";

describe("candidate next-round draft launch", () => {
    it("resolves every source item and snapshots the exact ordered draft version", async () => {
        const snapshotDraftToIntent = vi.fn(async () => ({
            outcome: "created" as const,
            candidatePracticeIntentId: "intent-created",
            currentVersion: 5,
        }));

        await expect(launchCandidateNextRoundDraft({
            candidateNextRoundDraftId: "draft-1",
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
            expectedVersion: 4,
            practiceSessions: [createSourceSession()],
            draftRepository: {
                findDraft: vi.fn(async () => createDraft()),
            },
            launchRepository: {
                findIntentForDraftVersion: vi.fn(async () => null),
                snapshotDraftToIntent,
            },
        })).resolves.toEqual({
            status: "candidate_next_round_draft_launched",
            outcome: "created",
            candidatePracticeIntentId: "intent-created",
            redirectTo: "/candidate/practice/ready/intent-created",
        });

        expect(snapshotDraftToIntent).toHaveBeenCalledWith(expect.objectContaining({
            candidateNextRoundDraftId: "draft-1",
            expectedVersion: 4,
            items: [
                expect.objectContaining({
                    kind: "practice_from_feedback",
                    assembly: {
                        source: "next_round_draft",
                        candidateNextRoundDraftItemId: "item-1",
                        provenance: "coach_update",
                        displayPosition: 0,
                    },
                }),
                expect.objectContaining({
                    kind: "practice_missing_evidence",
                    assembly: {
                        source: "next_round_draft",
                        candidateNextRoundDraftItemId: "item-2",
                        provenance: "coach_plan",
                        displayPosition: 1,
                    },
                }),
            ],
        }));
    });

    it("replays a previously created ready or consumed intent without reading mutable draft state", async () => {
        const findDraft = vi.fn();
        const ready = await launchCandidateNextRoundDraft({
            candidateNextRoundDraftId: "draft-1",
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
            expectedVersion: 4,
            practiceSessions: [],
            draftRepository: { findDraft },
            launchRepository: {
                findIntentForDraftVersion: vi.fn(async () => createExistingIntent()),
                snapshotDraftToIntent: vi.fn(),
            },
        });
        const consumed = await launchCandidateNextRoundDraft({
            candidateNextRoundDraftId: "draft-1",
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
            expectedVersion: 4,
            practiceSessions: [],
            draftRepository: { findDraft },
            launchRepository: {
                findIntentForDraftVersion: vi.fn(async () => createExistingIntent({
                    lifecycleState: "consumed",
                    consumedCandidatePracticeSessionId: "session-created",
                })),
                snapshotDraftToIntent: vi.fn(),
            },
        });

        expect(ready).toMatchObject({
            outcome: "replayed",
            redirectTo: "/candidate/practice/ready/intent-existing",
        });
        expect(consumed).toMatchObject({
            outcome: "replayed",
            redirectTo: "/candidate/session/session-created",
        });
        expect(findDraft).not.toHaveBeenCalled();
    });

    it("fails closed for a stale version or source evidence that no longer matches", async () => {
        const findIntentForDraftVersion = vi.fn(async () => null);
        const snapshotDraftToIntent = vi.fn();
        const conflict = await launchCandidateNextRoundDraft({
            candidateNextRoundDraftId: "draft-1",
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
            expectedVersion: 3,
            practiceSessions: [createSourceSession()],
            draftRepository: { findDraft: vi.fn(async () => createDraft()) },
            launchRepository: { findIntentForDraftVersion, snapshotDraftToIntent },
        });
        const invalid = await launchCandidateNextRoundDraft({
            candidateNextRoundDraftId: "draft-1",
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
            expectedVersion: 4,
            practiceSessions: [],
            draftRepository: { findDraft: vi.fn(async () => createDraft()) },
            launchRepository: { findIntentForDraftVersion, snapshotDraftToIntent },
        });

        expect(conflict).toEqual({
            status: "candidate_next_round_draft_not_launched",
            reason: "version_conflict",
            currentVersion: 4,
        });
        expect(invalid).toEqual({
            status: "candidate_next_round_draft_not_launched",
            reason: "invalid_items",
            currentVersion: 4,
        });
        expect(snapshotDraftToIntent).not.toHaveBeenCalled();
    });
});

function createDraft(): CandidateNextRoundDraftRecord {
    return {
        status: "candidate_next_round_draft",
        candidateNextRoundDraftId: "draft-1",
        candidateProfileId: "candidate-1",
        roleProfileId: "role-1",
        version: 4,
        itemCount: 2,
        items: [
            {
                candidateNextRoundDraftItemId: "item-1",
                sourceCandidatePracticeSessionId: "session-source",
                sourceQuestionKey: "slot-1",
                practiceKind: "practice_from_feedback",
                provenance: "coach_update",
                displayPosition: 0,
                createdAt: "2026-07-15T12:00:00.000Z",
                updatedAt: "2026-07-15T12:00:00.000Z",
            },
            {
                candidateNextRoundDraftItemId: "item-2",
                sourceCandidatePracticeSessionId: "session-source",
                sourceQuestionKey: "slot-2",
                practiceKind: "practice_missing_evidence",
                provenance: "coach_plan",
                displayPosition: 1,
                createdAt: "2026-07-15T12:00:00.000Z",
                updatedAt: "2026-07-15T12:00:00.000Z",
            },
        ],
        createdAt: "2026-07-15T12:00:00.000Z",
        updatedAt: "2026-07-15T12:00:00.000Z",
    };
}

function createExistingIntent({
    lifecycleState = "ready",
    consumedCandidatePracticeSessionId = null,
}: {
    lifecycleState?: CandidatePracticeIntentRecord["lifecycleState"];
    consumedCandidatePracticeSessionId?: string | null;
} = {}): CandidatePracticeIntentRecord {
    return {
        status: "candidate_practice_intent_record",
        candidatePracticeIntentId: "intent-existing",
        candidateProfileId: "candidate-1",
        source: "practice_builder",
        lifecycleState,
        launchVersion: lifecycleState === "consumed" ? 2 : 1,
        consumedCandidatePracticeSessionId,
        consumedAt: lifecycleState === "consumed" ? "2026-07-15T12:01:00.000Z" : null,
        sourceNextRoundDraftId: "draft-1",
        sourceNextRoundDraftVersion: 4,
        roleProfileId: "role-1",
        targetInterviewId: "quality inspector",
        targetRole: "Quality Inspector",
        itemCount: 1,
        setupContext: {
            targetRole: "Quality Inspector",
            jobDescription: "Inspect finished goods.",
            interviewStage: "screening",
            questionCount: 2,
            resumeIncluded: false,
        },
        items: [{
            kind: "practice_from_feedback",
            source: {
                kind: "coach_update_detail",
                candidatePracticeSessionId: "session-source",
                questionKey: "slot-1",
                targetInterviewId: "quality inspector",
                targetRole: "Quality Inspector",
                questionNumber: 1,
                category: "Screening",
                questionText: "Why this role?",
                evidenceStatus: "practiced_with_coaching",
            },
            display: { label: "Practice from coach feedback", body: "Practice question 1." },
            assembly: {
                source: "next_round_draft",
                candidateNextRoundDraftItemId: "item-1",
                provenance: "coach_update",
                displayPosition: 0,
            },
        }],
        createdAt: "2026-07-15T12:00:00.000Z",
        updatedAt: "2026-07-15T12:00:00.000Z",
        expiresAt: "2026-07-16T12:00:00.000Z",
    };
}

function createSourceSession(): CandidatePracticeSessionRecord {
    return {
        candidatePracticeSessionId: "session-source",
        candidateProfileId: "candidate-1",
        roleProfileId: "role-1",
        candidateLaunchSessionId: null,
        status: "completed",
        setupSnapshot: {
            targetRole: "Quality Inspector",
            jobDescription: "Inspect finished goods.",
            resumeText: "",
            interviewStage: "screening",
            questionCount: 2,
            resumeCaptureMode: "none",
            createdAt: "2026-07-15T11:00:00.000Z",
        },
        questionPlanSnapshot: {
            interviewStage: "screening",
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
                { id: "slot-2", index: 1, category: "behavioral", label: "Behavioral", purpose: "Past evidence." },
            ],
        },
        questionWordingSnapshot: {
            status: "questions_worded",
            questions: [
                { slotId: "slot-1", index: 0, category: "screening", questionText: "Why this role?" },
                { slotId: "slot-2", index: 1, category: "behavioral", questionText: "Tell me about finding a defect." },
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
                text: "I care about quality.",
                submittedAt: "2026-07-15T11:01:00.000Z",
                status: "pending_analysis",
                answerAttemptId: "attempt-1",
                attemptNumber: 1,
                trigger: "initial_submit",
                supersedesAnswerAttemptId: null,
            },
        },
        answerIdempotencyRecords: {},
        answerAnalysisSnapshots: {
            "slot-1": {
                status: "answer_analysis_provider_result",
                provider: "candidate_v2_answer_evaluator",
                analyzedAt: "2026-07-15T11:02:00.000Z",
                answer: {
                    slotId: "slot-1",
                    questionIndex: 0,
                    answerAttemptId: "attempt-1",
                    attemptNumber: 1,
                    trigger: "initial_submit",
                },
                coachFeedback: {
                    acknowledgement: "You answered directly.",
                    observation: "Your role interest is clear.",
                    nextPracticeFocus: "Add one supporting example.",
                },
                evidence: [],
            },
        },
        feedbackActionEvents: {},
        completionSnapshot: null,
    };
}
