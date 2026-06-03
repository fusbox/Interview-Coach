import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CandidatePracticeDraft } from "./candidate-practice-draft-repository";
import { createCandidateSessionFromDraft } from "./candidate-session-creation-service";

const { withCandidateMutationBoundaryMock } = vi.hoisted(() => ({
    withCandidateMutationBoundaryMock: vi.fn(async ({ mutate }) => mutate()),
}));

vi.mock("./candidate-mutation-boundary", () => ({
    withCandidateMutationBoundary: withCandidateMutationBoundaryMock,
}));

describe("candidate session creation service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        withCandidateMutationBoundaryMock.mockImplementation(async ({ mutate }) => mutate());
    });

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
                candidate: {
                    displayName: "Fu Chen",
                    email: "fu@example.com",
                },
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
            candidate: {
                firstName: "Fu",
                lastName: "Chen",
                email: "fu@example.com",
                resumeText: "Reduced change failure rate by 25%.",
            },
            intakeData: {
                candidateProfileId: "profile-1",
                roleProfileId: "role-profile-1",
                practiceDraftId: "draft-1",
                questionSetSnapshotId: "snapshot-1",
                practiceConfig: {
                    interviewType: null,
                    questionCount: 5,
                },
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
        expect(withCandidateMutationBoundaryMock).toHaveBeenCalledWith(expect.objectContaining({
            candidateProfileId: "profile-1",
            operation: "practice_generation",
            subjectId: "draft-1",
        }));
        expect(deleteSession).not.toHaveBeenCalled();
    });

    it("passes setup context and lightweight practice configuration to the shared question generator", async () => {
        const generateQuestions = vi.fn().mockResolvedValue([
            {
                id: "question-1",
                text: "Describe a reliability incident you improved.",
                category: "Technical",
                index: 0,
            },
        ]);

        await createCandidateSessionFromDraft(
            {
                candidateProfileId: "profile-1",
                practiceDraftId: "draft-1",
                generationConfig: {
                    questionCount: 7,
                },
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
                    intakeResponses: {
                        confidenceLevel: null,
                        interviewType: "technical",
                        timeline: null,
                        concerns: null,
                        practiceFocus: [],
                    },
                })),
                attachGeneratedSession: vi.fn().mockResolvedValue(practiceDraft({
                    status: "ready",
                    sessionId: "session-1",
                    questionSetSnapshotId: "snapshot-1",
                    resumeTargetScreen: "session_entry",
                })),
                sessionRepository: {
                    create: vi.fn(),
                    delete: vi.fn(),
                },
                generateQuestions,
                createSessionId: () => "session-1",
                createQuestionSetSnapshotId: () => "snapshot-1",
            },
        );

        expect(generateQuestions).toHaveBeenCalledWith({
            role: "Reliability engineer",
            jobDescription: "Own deployment quality.",
            resume: "Reduced change failure rate by 25%.",
            interviewType: "technical",
            questionCount: 7,
        });
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

    it("returns rate-limit feedback after confirming the draft is owned and generating", async () => {
        const createSession = vi.fn();
        withCandidateMutationBoundaryMock.mockResolvedValue({
            ok: false,
            error: "Too many candidate updates. Please wait and try again.",
        });

        await expect(createCandidateSessionFromDraft(
            {
                candidateProfileId: "profile-1",
                practiceDraftId: "draft-1",
            },
            {
                findDraftById: vi.fn().mockResolvedValue(practiceDraft({ status: "generating" })),
                attachGeneratedSession: vi.fn(),
                sessionRepository: {
                    create: createSession,
                    delete: vi.fn(),
                },
                generateQuestions: vi.fn(),
            },
        )).resolves.toEqual({
            ok: false,
            error: "Too many candidate updates. Please wait and try again.",
        });

        expect(createSession).not.toHaveBeenCalled();
    });
});

function practiceDraft(overrides: Partial<CandidatePracticeDraft> = {}): CandidatePracticeDraft {
    return {
        practiceDraftId: "draft-1",
        candidateProfileId: "profile-1",
        roleProfileId: "role-profile-1",
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
        intakeResponses: {
            confidenceLevel: null,
            interviewType: null,
            timeline: null,
            concerns: null,
            practiceFocus: [],
        },
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
