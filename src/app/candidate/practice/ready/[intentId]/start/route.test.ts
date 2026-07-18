import { describe, expect, it, vi } from "vitest";

import type { CandidatePracticeIntentRecord } from "@/features/candidate-practice-v2/candidate-follow-up-practice-intent";
import type { CandidatePracticeIntentLaunchResult } from "@/features/candidate-practice-v2/candidate-practice-intent-launch-repository";
import type { CreateCandidatePracticeSessionInput } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import { handleCandidatePracticeIntentStartRequest } from "./route";

const NOW = new Date("2026-07-12T17:00:00.000Z");
type StartRequestDependencies = Omit<
    Parameters<typeof handleCandidatePracticeIntentStartRequest>[0],
    "request" | "intentId" | "now"
>;
type StartRequestOverrides = {
    identity?: { candidateProfileId: string } | null;
    intent?: CandidatePracticeIntentRecord | null;
    startPracticeIntentSession?: StartRequestDependencies["practiceIntentLaunchRepository"]["startPracticeIntentSession"];
    listAllPracticeSessionsForCandidate?: StartRequestDependencies["practiceSessionRepository"]["listAllPracticeSessionsForCandidate"];
    createFollowUpSessionInput?: StartRequestDependencies["createFollowUpSessionInput"];
};

describe("/candidate/practice/ready/[intentId]/start route", () => {
    it("atomically creates a follow-up session and redirects through the entry transition", async () => {
        const startPracticeIntentSession = vi.fn(async () => created("session-2"));
        const createFollowUpSessionInput = vi.fn(() => createSessionInput());

        const response = await startRequest({
            startPracticeIntentSession,
            createFollowUpSessionInput,
        });

        expect(response.status).toBe(303);
        expect(response.headers.get("location")).toBe("/candidate/session/session-2?entry=1");
        expect(startPracticeIntentSession).toHaveBeenCalledWith(expect.objectContaining({
            candidatePracticeIntentId: "intent-1",
            candidateProfileId: "candidate-1",
            expectedLaunchVersion: 1,
            expectedPriorSessionCount: 0,
            sessionInput: expect.objectContaining({
                candidateProfileId: "candidate-1",
            }),
        }));
        expect(createFollowUpSessionInput).toHaveBeenCalledTimes(1);
    });

    it("lets concurrent duplicate starts converge on the same database-selected session", async () => {
        let callCount = 0;
        const startPracticeIntentSession = vi.fn(async (): Promise<CandidatePracticeIntentLaunchResult> => {
            callCount += 1;
            return callCount === 1 ? created("session-2") : replayed("session-2");
        });
        const dependencies = createDependencies({ startPracticeIntentSession });

        const [first, second] = await Promise.all([
            startRequest({}, dependencies),
            startRequest({}, dependencies),
        ]);

        expect(first.status).toBe(303);
        expect(second.status).toBe(303);
        expect(first.headers.get("location")).toBe("/candidate/session/session-2?entry=1");
        expect(second.headers.get("location")).toBe("/candidate/session/session-2?entry=1");
    });

    it("validates and replays the attached session after a consumed response-loss recovery", async () => {
        const startPracticeIntentSession = vi.fn(async () => replayed("session-2"));
        const listAllPracticeSessionsForCandidate = vi.fn();
        const createFollowUpSessionInput = vi.fn();

        const response = await startRequest({
            intent: createIntent({
                lifecycleState: "consumed",
                launchVersion: 2,
                consumedCandidatePracticeSessionId: "session-2",
                consumedAt: "2026-07-12T17:00:01.000Z",
            }),
            startPracticeIntentSession,
            listAllPracticeSessionsForCandidate,
            createFollowUpSessionInput,
        });

        expect(response.status).toBe(303);
        expect(response.headers.get("location")).toBe("/candidate/session/session-2?entry=1");
        expect(startPracticeIntentSession).toHaveBeenCalledWith(expect.objectContaining({
            expectedLaunchVersion: 2,
            expectedPriorSessionCount: 0,
            sessionInput: null,
        }));
        expect(listAllPracticeSessionsForCandidate).not.toHaveBeenCalled();
        expect(createFollowUpSessionInput).not.toHaveBeenCalled();
    });

    it("reloads attempt context once when another intent launches first", async () => {
        const startPracticeIntentSession = vi
            .fn()
            .mockResolvedValueOnce({ outcome: "stale_context", candidatePracticeSessionId: null })
            .mockResolvedValueOnce(created("session-3"));
        const listAllPracticeSessionsForCandidate = vi
            .fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);

        const response = await startRequest({
            startPracticeIntentSession,
            listAllPracticeSessionsForCandidate,
        });

        expect(response.status).toBe(303);
        expect(response.headers.get("location")).toBe("/candidate/session/session-3?entry=1");
        expect(listAllPracticeSessionsForCandidate).toHaveBeenCalledTimes(2);
        expect(startPracticeIntentSession).toHaveBeenCalledTimes(2);
    });

    it("expires a stale ready intent without preparing or inserting a session", async () => {
        const startPracticeIntentSession = vi.fn(async () => ({
            outcome: "expired" as const,
            candidatePracticeSessionId: null,
        }));
        const listAllPracticeSessionsForCandidate = vi.fn();
        const createFollowUpSessionInput = vi.fn();

        const response = await startRequest({
            intent: createIntent({ expiresAt: "2026-07-12T16:59:59.000Z" }),
            startPracticeIntentSession,
            listAllPracticeSessionsForCandidate,
            createFollowUpSessionInput,
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({
            code: "PRACTICE_INTENT_EXPIRED",
            retryable: false,
        });
        expect(startPracticeIntentSession).toHaveBeenCalledWith(expect.objectContaining({
            sessionInput: null,
        }));
        expect(listAllPracticeSessionsForCandidate).not.toHaveBeenCalled();
        expect(createFollowUpSessionInput).not.toHaveBeenCalled();
    });

    it.each([
        ["mismatched", "PRACTICE_INTENT_MISMATCHED"],
        ["consumed_mismatch", "PRACTICE_INTENT_CONSUMED_MISMATCH"],
        ["invalid_session", "PRACTICE_INTENT_INVALID_SESSION"],
    ] as const)("fails closed for %s without inventing a destination", async (outcome, code) => {
        const response = await startRequest({
            startPracticeIntentSession: vi.fn(async () => ({
                outcome,
                candidatePracticeSessionId: null,
            })),
        });

        expect(response.status).toBe(outcome === "invalid_session" ? 503 : 409);
        await expect(response.json()).resolves.toMatchObject({ code, retryable: false });
    });

    it("fails closed when candidate identity or intent ownership cannot be confirmed", async () => {
        const unauthorized = await startRequest({ identity: null });
        expect(unauthorized.status).toBe(401);

        const unowned = await startRequest({ intent: null });
        expect(unowned.status).toBe(404);
        await expect(unowned.json()).resolves.toEqual({
            error: "Practice intent could not be confirmed.",
        });
    });

    it("returns a candidate-safe retryable response when persistence is unavailable", async () => {
        const response = await startRequest({
            startPracticeIntentSession: vi.fn(async () => {
                throw new Error("database detail must not escape");
            }),
        });

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toEqual({
            error: "Focused practice could not be started. Try again.",
            code: "PRACTICE_INTENT_START_UNAVAILABLE",
            retryable: true,
        });
    });
});

function startRequest(
    overrides: StartRequestOverrides = {},
    dependencies = createDependencies(overrides),
) {
    return handleCandidatePracticeIntentStartRequest({
        request: new Request("https://interviewcoach.talentarbor.com/candidate/practice/ready/intent-1/start", {
            method: "POST",
        }),
        intentId: "intent-1",
        now: NOW,
        ...dependencies,
    });
}

function createDependencies(overrides: StartRequestOverrides = {}): StartRequestDependencies {
    return {
        resolveCandidatePracticeIntentStartIdentity: vi.fn(async () => (
            overrides.identity === undefined ? { candidateProfileId: "candidate-1" } : overrides.identity
        )),
        practiceIntentRepository: {
            findPracticeIntent: vi.fn(async () => (
                overrides.intent === undefined ? createIntent() : overrides.intent
            )),
        },
        practiceSessionRepository: {
            listAllPracticeSessionsForCandidate: overrides.listAllPracticeSessionsForCandidate
                ?? vi.fn(async () => []),
        },
        practiceIntentLaunchRepository: {
            startPracticeIntentSession: overrides.startPracticeIntentSession
                ?? vi.fn(async () => created("session-2")),
        },
        createFollowUpSessionInput: overrides.createFollowUpSessionInput
            ?? vi.fn(() => createSessionInput()),
    };
}

function createIntent(overrides: Partial<CandidatePracticeIntentRecord> = {}): CandidatePracticeIntentRecord {
    return {
        status: "candidate_practice_intent_record",
        candidatePracticeIntentId: "intent-1",
        candidateProfileId: "candidate-1",
        source: "practice_builder",
        lifecycleState: "ready",
        launchVersion: 1,
        consumedCandidatePracticeSessionId: null,
        consumedAt: null,
        roleProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        targetInterviewId: "material handler i",
        targetRole: "Material Handler I",
        itemCount: 1,
        setupContext: {
            targetRole: "Material Handler I",
            jobDescription: "Move materials safely.",
            interviewStage: "first_interview",
            questionCount: 3,
            resumeIncluded: false,
        },
        items: [],
        createdAt: "2026-07-12T16:00:00.000Z",
        updatedAt: "2026-07-12T16:00:00.000Z",
        expiresAt: "2026-07-13T16:00:00.000Z",
        ...overrides,
    };
}

function createSessionInput(): CreateCandidatePracticeSessionInput {
    return {
        candidateProfileId: "candidate-1",
        roleProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        setupSnapshot: {
            targetRole: "Material Handler I",
            jobDescription: "Move materials safely.",
            resumeText: null,
            interviewStage: "first_interview",
            questionCount: 1,
            resumeCaptureMode: "none",
            createdAt: NOW.toISOString(),
            followUpPractice: {
                status: "candidate_follow_up_practice_session",
                sourceIntentId: "intent-1",
                source: "practice_builder",
                sessionAttemptNumber: 1,
                itemCount: 1,
                items: [],
            },
        } as CreateCandidatePracticeSessionInput["setupSnapshot"],
        questionPlanSnapshot: {
            interviewStage: "first_interview",
            questionCount: 1,
            categoryCounts: {
                screening: 1,
                behavioral: 0,
                culture_fit: 0,
                case_scenario: 0,
                technical_role_specific: 0,
            },
            slots: [],
        },
        questionWordingSnapshot: {
            status: "questions_worded",
            questions: [],
        },
        progress: {
            status: "live_question",
            currentQuestionIndex: 0,
        },
    };
}

function created(candidatePracticeSessionId: string): CandidatePracticeIntentLaunchResult {
    return { outcome: "created", candidatePracticeSessionId };
}

function replayed(candidatePracticeSessionId: string): CandidatePracticeIntentLaunchResult {
    return { outcome: "replayed", candidatePracticeSessionId };
}
