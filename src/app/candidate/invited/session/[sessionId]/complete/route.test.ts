import { describe, expect, it, vi } from "vitest";

import { handleInvitedPracticeSessionCompleteRequest } from "./route-implementation";

describe("invited practice completion route", () => {
    it("completes the exact invite-owned session without candidate dashboard work", async () => {
        const sessionRepository = repository(session());
        const response = await handleInvitedPracticeSessionCompleteRequest({
            request: new Request("http://localhost/candidate/invited/session/session-1/complete", { method: "POST" }),
            sessionId: "session-1",
            now: new Date("2026-07-20T12:00:00.000Z"),
            resolveInvitedIdentity: async () => ({ recruiterInvitationRecipientId: "recipient-1" }),
            sessionRepository,
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            status: "invited_session_completed",
            nextRoute: "/candidate/invited",
            completionSnapshot: {
                audience: "invited_candidate",
                answeredCount: 1,
                coachedCount: 0,
            },
        });
        expect(sessionRepository.completeSession).toHaveBeenCalledWith(expect.objectContaining({
            invitedPracticeSessionId: "session-1",
            recruiterInvitationRecipientId: "recipient-1",
        }));
    });

    it("fails closed when the invite cookie does not own the requested session", async () => {
        const sessionRepository = repository(session());
        const response = await handleInvitedPracticeSessionCompleteRequest({
            request: new Request("http://localhost/candidate/invited/session/session-1/complete", { method: "POST" }),
            sessionId: "session-1",
            now: new Date("2026-07-20T12:00:00.000Z"),
            resolveInvitedIdentity: async () => null,
            sessionRepository,
        });

        expect(response.status).toBe(401);
        expect(sessionRepository.findSession).not.toHaveBeenCalled();
        expect(sessionRepository.completeSession).not.toHaveBeenCalled();
    });

    it("replays the existing invited completion without mutating it", async () => {
        const completedSession = session({
            status: "completed",
            completionSnapshot: {
                status: "invited_session_completed",
                audience: "invited_candidate",
                sessionId: "session-1",
                completedAt: "2026-07-20T11:00:00.000Z",
                finalProgress: { status: "completed", currentQuestionIndex: 0 },
                questionCount: 1,
                answeredCount: 1,
                coachedCount: 0,
                answeredQuestionKeys: ["slot-1"],
                coachedQuestionKeys: [],
                skippedOrUnansweredQuestionKeys: [],
                nextRoute: "/candidate/invited",
            },
        });
        const sessionRepository = repository(completedSession);
        const response = await handleInvitedPracticeSessionCompleteRequest({
            request: new Request("http://localhost/candidate/invited/session/session-1/complete", { method: "POST" }),
            sessionId: "session-1",
            now: new Date("2026-07-20T12:00:00.000Z"),
            resolveInvitedIdentity: async () => ({ recruiterInvitationRecipientId: "recipient-1" }),
            sessionRepository,
        });

        expect(response.status).toBe(200);
        expect(sessionRepository.completeSession).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toMatchObject({
            completionSnapshot: { completedAt: "2026-07-20T11:00:00.000Z" },
        });
    });
});

function repository(record: ReturnType<typeof session>) {
    return {
        findSession: vi.fn().mockResolvedValue(record),
        saveAnswerDraft: vi.fn(),
        saveAnswerSubmission: vi.fn(),
        saveAnswerIdempotencyRecord: vi.fn(),
        clearAnswerIdempotencyRecord: vi.fn(),
        saveAnswerAnalysisSnapshot: vi.fn(),
        saveFeedbackActionEvent: vi.fn(),
        saveProgress: vi.fn(),
        completeSession: vi.fn().mockImplementation(async ({ completionSnapshot }) => ({
            completionSnapshot,
            progress: completionSnapshot.finalProgress,
        })),
    };
}

function session(overrides: Record<string, unknown> = {}) {
    return {
        invitedPracticeSessionId: "session-1",
        recruiterInvitationRecipientId: "recipient-1",
        recruiterId: "recruiter-1",
        status: "in_progress" as const,
        setupSnapshot: {
            targetRole: "Quality Inspector",
            jobDescription: "Inspect finished goods.",
            resumeText: null,
            interviewStage: "screening" as const,
            questionCount: 1,
            resumeCaptureMode: "none" as const,
            createdAt: "2026-07-20T10:00:00.000Z",
        },
        questionPlanSnapshot: {
            interviewStage: "screening" as const,
            questionCount: 1,
            categoryCounts: {
                screening: 1,
                behavioral: 0,
                culture_fit: 0,
                case_scenario: 0,
                technical_role_specific: 0,
            },
            slots: [{ id: "slot-1", index: 0, category: "screening" as const, label: "Screening" }],
        },
        questionWordingSnapshot: {
            status: "questions_worded" as const,
            questionCount: 1,
            questions: [{
                slotId: "slot-1",
                index: 0,
                category: "screening" as const,
                questionText: "Why are you interested in this role?",
            }],
            generatedAt: "2026-07-20T10:00:00.000Z",
        },
        progress: { status: "live_question" as const, currentQuestionIndex: 0 },
        answerDrafts: {},
        answerSubmissions: {
            "slot-1": {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text" as const,
                text: "I care about careful, consistent work.",
                status: "pending_analysis" as const,
                submittedAt: "2026-07-20T11:00:00.000Z",
                answerAttemptId: "attempt-1",
            },
        },
        answerIdempotencyRecords: {},
        answerAnalysisSnapshots: {},
        feedbackActionEvents: {},
        completionSnapshot: null,
        ...overrides,
    };
}
