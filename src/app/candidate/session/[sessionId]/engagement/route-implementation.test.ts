import { describe, expect, it, vi } from "vitest";

import {
    handleCandidateEngagementRequest,
    parseCandidateEngagementBatch,
} from "./route-implementation";

const now = new Date("2026-08-05T15:00:20.000Z");
const slice = {
    engagementSliceId: "33333333-3333-4333-8333-333333333333",
    trackerInstanceId: "44444444-4444-4444-8444-444444444444",
    sequenceNumber: 1,
    activeMilliseconds: 9_500,
    clientStartedAt: "2026-08-05T15:00:00.000Z",
    clientEndedAt: "2026-08-05T15:00:09.500Z",
    openedBy: "interaction",
    lastActivity: "answer_input",
    flushReason: "periodic",
};

describe("candidate engagement route", () => {
    it("accepts a strict owned batch and returns the server aggregate", async () => {
        const appendSlices = vi.fn(async () => ({
            sessionOwned: true,
            acceptedSliceCount: 1,
            activeMilliseconds: 9_500,
            sliceCount: 1,
            firstReceivedAt: "2026-08-05T15:00:10.000Z",
            lastReceivedAt: "2026-08-05T15:00:10.000Z",
        }));
        const response = await handleCandidateEngagementRequest({
            request: request({ slices: [slice] }),
            sessionId: "11111111-1111-4111-8111-111111111111",
            reportingEnabled: true,
            now: () => now,
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            engagementRepository: { appendSlices },
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            status: "engagement_saved",
            acceptedSliceCount: 1,
            summary: {
                activeMilliseconds: 9_500,
                sliceCount: 1,
                firstReceivedAt: "2026-08-05T15:00:10.000Z",
                lastReceivedAt: "2026-08-05T15:00:10.000Z",
            },
        });
        expect(appendSlices).toHaveBeenCalledWith(expect.objectContaining({
            candidatePracticeSessionId: "11111111-1111-4111-8111-111111111111",
            slices: [slice],
        }));
    });

    it("keeps production-disabled reporting undiscoverable", async () => {
        const response = await handleCandidateEngagementRequest({
            request: request({ slices: [slice] }),
            sessionId: "session-1",
            reportingEnabled: false,
        });

        expect(response.status).toBe(404);
    });

    it("fails closed for missing identity and foreign-owned sessions", async () => {
        const unauthorized = await handleCandidateEngagementRequest({
            request: request({ slices: [slice] }),
            sessionId: "session-1",
            reportingEnabled: true,
            now: () => now,
            resolveCandidateSessionIdentity: vi.fn(async () => null),
            engagementRepository: { appendSlices: vi.fn() },
        });
        const foreign = await handleCandidateEngagementRequest({
            request: request({ slices: [slice] }),
            sessionId: "session-1",
            reportingEnabled: true,
            now: () => now,
            resolveCandidateSessionIdentity: vi.fn(async () => ({ candidateProfileId: "candidate-2" })),
            engagementRepository: {
                appendSlices: vi.fn(async () => ({
                    sessionOwned: false,
                    acceptedSliceCount: 0,
                    activeMilliseconds: 0,
                    sliceCount: 0,
                    firstReceivedAt: null,
                    lastReceivedAt: null,
                })),
            },
        });

        expect(unauthorized.status).toBe(401);
        expect(foreign.status).toBe(404);
    });

    it("rejects unknown fields, vocabulary, duplicate ids, and implausible intervals", () => {
        expect(parseCandidateEngagementBatch({ slices: [{ ...slice, detail: "typed answer" }] }, now)).toBeNull();
        expect(parseCandidateEngagementBatch({ slices: [{ ...slice, lastActivity: "question_text" }] }, now)).toBeNull();
        expect(parseCandidateEngagementBatch({ slices: [slice, { ...slice, sequenceNumber: 2 }] }, now)).toBeNull();
        expect(parseCandidateEngagementBatch({
            slices: [{
                ...slice,
                activeMilliseconds: 60_000,
                clientStartedAt: "2026-08-05T15:00:00.000Z",
                clientEndedAt: "2026-08-05T15:00:01.000Z",
            }],
        }, now)).toBeNull();
    });
});

function request(body: unknown) {
    return new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}
