import { describe, expect, it, vi } from "vitest";

import type { CandidateCompletedRoundAnalysisRepairResult } from "@/features/candidate-session-v2/candidate-completed-round-analysis-repair";

import { handleCandidateCompletedRoundRepairRequest } from "./route-implementation";

describe("/candidate/session/[sessionId]/coach-update/repair route", () => {
    it("requires a candidate-owned completed session", async () => {
        const response = await handleCandidateCompletedRoundRepairRequest({
            request: createRequest(),
            sessionId: "session-1",
        });

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({ error: "Candidate session identity is required." });
    });

    it("rejects repair before the round is completed", async () => {
        const response = await handleCandidateCompletedRoundRepairRequest({
            request: createRequest(),
            sessionId: "session-1",
            resolveCandidateSessionIdentity: vi.fn(async () => ({ candidateProfileId: "candidate-1" })),
            findCandidateSession: vi.fn(async () => ({ status: "in_progress" })),
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            error: "Coach Update repair requires a completed round.",
        });
    });

    it("repairs legacy completed-session evaluator evidence without creating a new session-level artifact", async () => {
        const coachingRepair = createRepairResult({
            status: "repaired",
            acceptedCount: 1,
            attemptedCount: 1,
            repairedCount: 1,
            allAnsweredOccurrencesAccepted: true,
        });
        const repairCompletedRoundAnalysis = vi.fn(async () => coachingRepair);
        const ensureCoachUpdateArtifact = vi.fn(async () => ({
            status: "coach_update_completed" as const,
            artifact: {} as never,
        }));
        const recordCompletedRoundRepairDiagnostic = vi.fn();

        const response = await handleCandidateCompletedRoundRepairRequest({
            request: createRequest(),
            sessionId: "session-1",
            resolveCandidateSessionIdentity: vi.fn(async () => ({ candidateProfileId: "candidate-1" })),
            findCandidateSession: vi.fn(async () => ({ status: "completed" })),
            repairCompletedRoundAnalysis,
            ensureCoachUpdateArtifact,
            recordCompletedRoundRepairDiagnostic,
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect(response.headers.get("X-Interview-Coach-Request-Id")).toMatch(/^[0-9a-f-]{36}$/);
        await expect(response.json()).resolves.toEqual({
            status: "candidate_completed_round_coaching_repair",
            coachingRepair,
            coachUpdateStatus: "not_attempted",
        });
        expect(repairCompletedRoundAnalysis).toHaveBeenCalledWith({
            request: expect.any(Request),
            candidateProfileId: "candidate-1",
            sourceCandidatePracticeSessionId: "session-1",
        });
        expect(ensureCoachUpdateArtifact).not.toHaveBeenCalled();
        expect(recordCompletedRoundRepairDiagnostic).toHaveBeenCalledWith(expect.objectContaining({
            event: "candidate_completed_round_coaching_repair",
            outcome: "repaired",
            attemptedCount: 1,
            repairedCount: 1,
            coachUpdateStatus: "not_attempted",
        }));
        expect(JSON.stringify(recordCompletedRoundRepairDiagnostic.mock.calls)).not.toMatch(/candidate-1|session-1/);
    });

    it("keeps partial artifacts forbidden while more evaluator repair remains", async () => {
        const coachingRepair = createRepairResult({
            status: "partial",
            acceptedCount: 2,
            attemptedCount: 2,
            repairedCount: 2,
            retryableCount: 1,
            allAnsweredOccurrencesAccepted: false,
            answeredCount: 3,
        });
        const ensureCoachUpdateArtifact = vi.fn();

        const response = await handleCandidateCompletedRoundRepairRequest({
            request: createRequest(),
            sessionId: "session-1",
            resolveCandidateSessionIdentity: vi.fn(async () => ({ candidateProfileId: "candidate-1" })),
            findCandidateSession: vi.fn(async () => ({ status: "completed" })),
            repairCompletedRoundAnalysis: vi.fn(async () => coachingRepair),
            ensureCoachUpdateArtifact,
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            coachingRepair: { status: "partial", allAnsweredOccurrencesAccepted: false },
            coachUpdateStatus: "not_attempted",
        });
        expect(ensureCoachUpdateArtifact).not.toHaveBeenCalled();
    });

    it("does not let diagnostic delivery change a valid repair response", async () => {
        const response = await handleCandidateCompletedRoundRepairRequest({
            request: createRequest(),
            sessionId: "session-1",
            resolveCandidateSessionIdentity: vi.fn(async () => ({ candidateProfileId: "candidate-1" })),
            findCandidateSession: vi.fn(async () => ({ status: "completed" })),
            repairCompletedRoundAnalysis: vi.fn(async () => createRepairResult({
                status: "ready",
                acceptedCount: 1,
                allAnsweredOccurrencesAccepted: true,
            })),
            ensureCoachUpdateArtifact: vi.fn(async () => ({
                status: "coach_update_completed" as const,
                artifact: {} as never,
            })),
            recordCompletedRoundRepairDiagnostic: vi.fn(() => {
                throw new Error("diagnostic sink unavailable");
            }),
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            status: "candidate_completed_round_coaching_repair",
            coachUpdateStatus: "not_attempted",
        });
    });

    it("keeps completed-session Coach Update synthesis read-only after evaluator repair", async () => {
        const response = await handleCandidateCompletedRoundRepairRequest({
            request: createRequest(),
            sessionId: "session-1",
            resolveCandidateSessionIdentity: vi.fn(async () => ({ candidateProfileId: "candidate-1" })),
            findCandidateSession: vi.fn(async () => ({ status: "completed" })),
            repairCompletedRoundAnalysis: vi.fn(async () => createRepairResult({
                status: "ready",
                acceptedCount: 1,
                allAnsweredOccurrencesAccepted: true,
            })),
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            coachingRepair: { status: "ready", allAnsweredOccurrencesAccepted: true },
            coachUpdateStatus: "not_attempted",
        });
    });

    it("retries synthesis only for an exact question checkpoint", async () => {
        const ensureCoachUpdateArtifact = vi.fn(async () => ({
            status: "coach_update_completed" as const,
            artifact: {} as never,
        }));
        const response = await handleCandidateCompletedRoundRepairRequest({
            request: new Request(
                "https://interviewcoach.talentarbor.com/candidate/session/session-1/coach-update/repair?question=slot-1",
                { method: "POST" },
            ),
            sessionId: "session-1",
            resolveCandidateSessionIdentity: vi.fn(async () => ({ candidateProfileId: "candidate-1" })),
            findCandidateSession: vi.fn(async () => ({ status: "in_progress" })),
            ensureCoachUpdateArtifact,
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            status: "candidate_question_coach_update_repair",
            coachUpdateStatus: "coach_update_completed",
        });
        expect(ensureCoachUpdateArtifact).toHaveBeenCalledWith({
            candidateProfileId: "candidate-1",
            sourceCandidatePracticeSessionId: "session-1",
            sourceQuestionKey: "slot-1",
            settledAt: expect.any(String),
        });
    });
});

function createRequest() {
    return new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/coach-update/repair", {
        method: "POST",
    });
}

function createRepairResult(
    overrides: Partial<CandidateCompletedRoundAnalysisRepairResult> = {},
): CandidateCompletedRoundAnalysisRepairResult {
    return {
        status: "unavailable",
        answeredCount: 1,
        acceptedCount: 0,
        attemptedCount: 0,
        repairedCount: 0,
        pendingCount: 0,
        retryableCount: 0,
        unavailableCount: 0,
        invalidLineageCount: 0,
        allAnsweredOccurrencesAccepted: false,
        ...overrides,
    };
}
