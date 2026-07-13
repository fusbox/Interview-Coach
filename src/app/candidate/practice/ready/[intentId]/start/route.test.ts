import { describe, expect, it, vi } from "vitest";

import type { CandidatePracticeIntentRecord } from "@/features/candidate-practice-v2/candidate-follow-up-practice-intent";
import type { CreateCandidatePracticeSessionInput } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import { handleCandidatePracticeIntentStartRequest } from "./route";

describe("/candidate/practice/ready/[intentId]/start route", () => {
    it("creates a follow-up practice session from a ready intent, consumes the intent, and redirects to the session", async () => {
        const practiceIntent = {
            status: "candidate_practice_intent_record" as const,
            candidatePracticeIntentId: "intent-1",
            candidateProfileId: "candidate-1",
            source: "practice_builder" as const,
            lifecycleState: "ready" as const,
            targetInterviewId: "material handler i",
            targetRole: "Material Handler I",
            itemCount: 1,
            setupContext: {
                targetRole: "Material Handler I",
                jobDescription: "Move materials safely.",
                interviewStage: "first_interview" as const,
                questionCount: 3,
                resumeIncluded: false,
            },
            items: [],
            createdAt: "2026-07-12T16:00:00.000Z",
            updatedAt: "2026-07-12T16:00:00.000Z",
        };
        const createSetupSession = vi.fn(async () => ({
            candidatePracticeSessionId: "session-2",
        }));
        const markPracticeIntentConsumed = vi.fn(async () => ({
            candidatePracticeIntentId: "intent-1",
            lifecycleState: "consumed" as const,
            consumedCandidatePracticeSessionId: "session-2",
        }));

        const response = await handleCandidatePracticeIntentStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/practice/ready/intent-1/start", {
                method: "POST",
            }),
            intentId: "intent-1",
            now: new Date("2026-07-12T17:00:00.000Z"),
            resolveCandidatePracticeIntentStartIdentity: vi.fn(async () => ({
                candidateProfileId: "candidate-1",
            })),
            practiceIntentRepository: {
                findPracticeIntent: vi.fn(async () => practiceIntent),
                markPracticeIntentConsumed,
            },
            practiceSessionRepository: {
                listPracticeSessionsForCandidate: vi.fn(async () => []),
                createSetupSession,
            },
            createFollowUpSessionInput: vi.fn((): CreateCandidatePracticeSessionInput => ({
                candidateProfileId: "candidate-1",
                setupSnapshot: {
                    targetRole: "Material Handler I",
                    jobDescription: "Move materials safely.",
                    resumeText: null,
                    interviewStage: "first_interview" as const,
                    questionCount: 1,
                    resumeCaptureMode: "none" as const,
                    createdAt: "2026-07-12T17:00:00.000Z",
                    followUpPractice: {
                        status: "candidate_follow_up_practice_session",
                        sourceIntentId: "intent-1",
                        source: "practice_builder",
                        sessionAttemptNumber: 2,
                        itemCount: 1,
                    },
                } as CreateCandidatePracticeSessionInput["setupSnapshot"],
                questionPlanSnapshot: {
                    interviewStage: "first_interview" as const,
                    questionCount: 1,
                    categoryCounts: {
                        screening: 1,
                        behavioral: 0,
                        culture_fit: 0,
                        case_scenario: 0,
                        technical_role_specific: 0,
                    },
                    slots: [{
                        id: "slot-1",
                        index: 0,
                        category: "screening",
                        label: "Screening",
                        purpose: "Basic fit.",
                    }],
                },
                questionWordingSnapshot: {
                    status: "questions_worded",
                    questions: [{
                        slotId: "slot-1",
                        index: 0,
                        category: "screening",
                        questionText: "What interests you about this Material Handler I role?",
                    }],
                },
                progress: {
                    status: "planned",
                    currentQuestionIndex: 0,
                },
            })),
        });

        expect(response.status).toBe(303);
        expect(response.headers.get("location")).toBe("https://interviewcoach.talentarbor.com/candidate/session/session-2");
        expect(createSetupSession).toHaveBeenCalledWith(expect.objectContaining({
            candidateProfileId: "candidate-1",
            setupSnapshot: expect.objectContaining({
                followUpPractice: expect.objectContaining({
                    sourceIntentId: "intent-1",
                    sessionAttemptNumber: 2,
                }),
            }),
        }));
        expect(markPracticeIntentConsumed).toHaveBeenCalledWith({
            candidatePracticeIntentId: "intent-1",
            candidateProfileId: "candidate-1",
            consumedCandidatePracticeSessionId: "session-2",
        });
    });

    it("redirects to an already-created session when a consumed intent has a linked session", async () => {
        const response = await handleCandidatePracticeIntentStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/practice/ready/intent-1/start", {
                method: "POST",
            }),
            intentId: "intent-1",
            now: new Date("2026-07-12T17:00:00.000Z"),
            resolveCandidatePracticeIntentStartIdentity: vi.fn(async () => ({
                candidateProfileId: "candidate-1",
            })),
            practiceIntentRepository: {
                findPracticeIntent: vi.fn(async (): Promise<CandidatePracticeIntentRecord> => ({
                    status: "candidate_practice_intent_record" as const,
                    candidatePracticeIntentId: "intent-1",
                    candidateProfileId: "candidate-1",
                    source: "practice_builder" as const,
                    lifecycleState: "consumed" as const,
                    consumedCandidatePracticeSessionId: "session-2",
                    targetInterviewId: "material handler i",
                    targetRole: "Material Handler I",
                    itemCount: 1,
                    setupContext: {
                        targetRole: "Material Handler I",
                        jobDescription: "Move materials safely.",
                        interviewStage: "first_interview" as const,
                        questionCount: 3,
                        resumeIncluded: false,
                    },
                    items: [],
                    createdAt: "2026-07-12T16:00:00.000Z",
                    updatedAt: "2026-07-12T16:00:00.000Z",
                })),
                markPracticeIntentConsumed: vi.fn(),
            },
            practiceSessionRepository: {
                listPracticeSessionsForCandidate: vi.fn(),
                createSetupSession: vi.fn(),
            },
            createFollowUpSessionInput: vi.fn(),
        });

        expect(response.status).toBe(303);
        expect(response.headers.get("location")).toBe("https://interviewcoach.talentarbor.com/candidate/session/session-2");
    });

    it("fails closed when candidate identity or ready intent ownership cannot be confirmed", async () => {
        const response = await handleCandidatePracticeIntentStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/practice/ready/intent-1/start", {
                method: "POST",
            }),
            intentId: "intent-1",
            now: new Date("2026-07-12T17:00:00.000Z"),
            resolveCandidatePracticeIntentStartIdentity: vi.fn(async () => null),
            practiceIntentRepository: {
                findPracticeIntent: vi.fn(),
                markPracticeIntentConsumed: vi.fn(),
            },
            practiceSessionRepository: {
                listPracticeSessionsForCandidate: vi.fn(),
                createSetupSession: vi.fn(),
            },
            createFollowUpSessionInput: vi.fn(),
        });

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
            error: "Candidate identity could not be confirmed.",
        });
    });
});
