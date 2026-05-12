import { describe, expect, it, vi } from "vitest";

import type { CandidatePracticeDraft } from "./candidate-practice-draft-repository";
import { createCandidateSessionFromDraft } from "./candidate-session-creation-service";

describe("candidate session creation service", () => {
    it("creates an owned practice session from a generating draft and attaches it back to the draft", async () => {
        const generatedQuestions = [
            {
                id: "question-1",
                text: "Tell me about a time you improved release reliability.",
                category: "Behavioral",
                index: 0,
            },
        ];
        const createdSessions: unknown[] = [];
        const deleteSession = vi.fn();
        const attachGeneratedSession = vi.fn().mockResolvedValue(practiceDraft({
            status: "ready",
            sessionId: "session-1",
            questionSetSnapshotId: "snapshot-1",
            resumeTargetScreen: "session_entry",
        }));

        await expect(createCandidateSessionFromDraft(
            {
                candidateProfileId: "profile-1",
                practiceDraftId: "draft-1",
            },
            {
                findDraftById: vi.fn().mockResolvedValue(practiceDraft({
                    status: "generating",
                    targetRole: "Reliability engineer",
                    jobDescription: "Own deployment quality.",
                    resumeContext: {
                        sourceAssets: [],
                        pastedText: "Reduced change failure rate by 25%.",
                        extractedText: "Reduced change failure rate by 25%.",
                        captureMode: "pasted_text",
                        processedArtifact: {
                            text: "Reduced change failure rate by 25%.",
                            source: "pasted_text",
                            originalRetained: false,
                        },
                    },
                })),
                attachGeneratedSession,
                sessionRepository: {
                    create: vi.fn(async (session) => {
                        createdSessions.push(session);
                    }),
                    delete: deleteSession,
                },
                generateQuestions: vi.fn().mockResolvedValue(generatedQuestions),
                createSessionId: () => "session-1",
                createQuestionSetSnapshotId: () => "snapshot-1",
            },
        )).resolves.toEqual({
            ok: true,
            practiceDraftId: "draft-1",
            sessionId: "session-1",
            questionSetSnapshotId: "snapshot-1",
            resumeTargetScreen: "session_entry",
        });

        expect(createdSessions).toHaveLength(1);
        expect(createdSessions[0]).toMatchObject({
            id: "session-1",
            status: "NOT_STARTED",
            role: "Reliability engineer",
            jobDescription: "Own deployment quality.",
            questions: generatedQuestions,
            initialsRequired: false,
            intakeData: {
                candidateProfileId: "profile-1",
                practiceDraftId: "draft-1",
                questionSetSnapshotId: "snapshot-1",
                resumeContext: {
                    captureMode: "pasted_text",
                    extractedText: "Reduced change failure rate by 25%.",
                },
            },
        });
        expect(attachGeneratedSession).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            practiceDraftId: "draft-1",
            sessionId: "session-1",
            questionSetSnapshotId: "snapshot-1",
        });
        expect(deleteSession).not.toHaveBeenCalled();
    });

    it("does not create a session when the draft is not in generation state", async () => {
        const createSession = vi.fn();

        await expect(createCandidateSessionFromDraft(
            {
                candidateProfileId: "profile-1",
                practiceDraftId: "draft-1",
            },
            {
                findDraftById: vi.fn().mockResolvedValue(practiceDraft({ status: "draft" })),
                attachGeneratedSession: vi.fn(),
                sessionRepository: {
                    create: createSession,
                    delete: vi.fn(),
                },
                generateQuestions: vi.fn(),
            },
        )).resolves.toEqual({
            ok: false,
            error: "Practice draft is not ready for session creation.",
        });

        expect(createSession).not.toHaveBeenCalled();
    });

    it("removes the generated session when attaching it to the draft fails", async () => {
        const deleteSession = vi.fn();

        await expect(createCandidateSessionFromDraft(
            {
                candidateProfileId: "profile-1",
                practiceDraftId: "draft-1",
            },
            {
                findDraftById: vi.fn().mockResolvedValue(practiceDraft({ status: "generating" })),
                attachGeneratedSession: vi.fn().mockResolvedValue(null),
                sessionRepository: {
                    create: vi.fn(),
                    delete: deleteSession,
                },
                generateQuestions: vi.fn().mockResolvedValue([
                    {
                        id: "question-cleanup",
                        text: "Question text",
                        category: "Behavioral",
                        index: 0,
                    },
                ]),
                createSessionId: () => "session-cleanup",
                createQuestionSetSnapshotId: () => "snapshot-cleanup",
            },
        )).resolves.toEqual({
            ok: false,
            error: "Practice draft could not be attached to the generated session.",
        });

        expect(deleteSession).toHaveBeenCalledWith("session-cleanup");
    });
});

function practiceDraft(overrides: Partial<CandidatePracticeDraft> = {}): CandidatePracticeDraft {
    return {
        practiceDraftId: "draft-1",
        candidateProfileId: "profile-1",
        status: "draft",
        targetRole: "Target role",
        jobDescription: null,
        resumeContext: {
            sourceAssets: [],
            pastedText: null,
            extractedText: "",
            captureMode: "none",
            processedArtifact: null,
        },
        customQuestions: [],
        intakeResponses: [],
        questionSetSnapshotId: null,
        sessionId: null,
        resumeTargetScreen: "practice_setup",
        generationStartedAt: null,
        generationFinishedAt: null,
        generationError: null,
        lastActivityAt: "2026-05-12T10:00:00.000Z",
        createdAt: "2026-05-12T10:00:00.000Z",
        updatedAt: "2026-05-12T10:00:00.000Z",
        ...overrides,
    };
}
