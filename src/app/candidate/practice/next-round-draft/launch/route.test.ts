import { describe, expect, it, vi } from "vitest";

import type { CandidateNextRoundBuilderModel } from "@/features/candidate-practice-v2/candidate-next-round-builder";

import { handleCandidateNextRoundDraftLaunchRequest } from "./route-implementation";

const roleProfileId = "10000000-0000-4000-8000-000000000001";

describe("candidate next-round draft launch route", () => {
    it("returns the durable ready landing created by atomic launch", async () => {
        const launchBuilder = vi.fn(async () => ({
            status: "candidate_next_round_draft_launched" as const,
            outcome: "created" as const,
            candidatePracticeIntentId: "intent-1",
            redirectTo: "/candidate/practice/ready/intent-1",
        }));
        const response = await handleCandidateNextRoundDraftLaunchRequest({
            request: createRequest(),
            resolveIdentity: async () => ({ candidateProfileId: "candidate-1" }),
            launchBuilder,
            loadBuilder: vi.fn(),
        });

        expect(response.status).toBe(201);
        expect(launchBuilder).toHaveBeenCalledWith({
            candidateProfileId: "candidate-1",
            roleProfileId,
            candidateNextRoundDraftId: "draft-1",
            expectedVersion: 3,
        });
        await expect(response.json()).resolves.toMatchObject({
            outcome: "created",
            redirectTo: "/candidate/practice/ready/intent-1",
        });
    });

    it("returns the authoritative draft instead of launching stale contents", async () => {
        const loadBuilder = vi.fn(async () => createBuilder(8));
        const response = await handleCandidateNextRoundDraftLaunchRequest({
            request: createRequest(),
            resolveIdentity: async () => ({ candidateProfileId: "candidate-1" }),
            launchBuilder: async () => ({
                status: "candidate_next_round_draft_not_launched",
                reason: "version_conflict",
                currentVersion: 8,
            }),
            loadBuilder,
        });

        expect(response.status).toBe(409);
        expect(loadBuilder).toHaveBeenCalledWith({ candidateProfileId: "candidate-1", roleProfileId });
        await expect(response.json()).resolves.toMatchObject({
            reason: "version_conflict",
            builder: { version: 8 },
        });
    });

    it("fails before launch for malformed payload or unconfirmed identity", async () => {
        const launchBuilder = vi.fn();
        const malformed = await handleCandidateNextRoundDraftLaunchRequest({
            request: new Request("http://localhost/candidate/practice/next-round-draft/launch", {
                method: "POST",
                body: "{}",
            }),
            resolveIdentity: async () => ({ candidateProfileId: "candidate-1" }),
            launchBuilder,
            loadBuilder: vi.fn(),
        });
        const unauthorized = await handleCandidateNextRoundDraftLaunchRequest({
            request: createRequest(),
            resolveIdentity: async () => null,
            launchBuilder,
            loadBuilder: vi.fn(),
        });

        expect(malformed.status).toBe(400);
        expect(unauthorized.status).toBe(401);
        expect(launchBuilder).not.toHaveBeenCalled();
    });
});

function createRequest() {
    return new Request("http://localhost/candidate/practice/next-round-draft/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            roleProfileId,
            candidateNextRoundDraftId: "draft-1",
            expectedVersion: 3,
        }),
    });
}

function createBuilder(version: number): CandidateNextRoundBuilderModel {
    return {
        status: "candidate_next_round_builder_ready",
        candidateProfileId: "candidate-1",
        roleProfileId,
        targetRole: "Quality Inspector",
        candidateNextRoundDraftId: "draft-1",
        version,
        itemCount: 2,
        capacity: 20,
        items: [],
        choices: [],
    };
}
