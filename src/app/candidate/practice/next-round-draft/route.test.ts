import { describe, expect, it, vi } from "vitest";

import type { CandidateNextRoundBuilderModel } from "@/features/candidate-practice-v2/candidate-next-round-builder";

import {
    handleCandidateNextRoundDraftGetRequest,
    handleCandidateNextRoundDraftMutationRequest,
} from "./route";

const roleProfileId = "10000000-0000-4000-8000-000000000001";

describe("candidate next-round draft route", () => {
    it("loads only a valid candidate-owned opaque prep context", async () => {
        const loadBuilder = vi.fn(async () => createBuilder());
        const response = await handleCandidateNextRoundDraftGetRequest({
            request: new Request(`http://localhost/candidate/practice/next-round-draft?prep=${roleProfileId}`),
            resolveIdentity: async () => ({ candidateProfileId: "candidate-1" }),
            loadBuilder,
        });

        expect(response.status).toBe(200);
        expect(loadBuilder).toHaveBeenCalledWith({
            candidateProfileId: "candidate-1",
            roleProfileId,
        });
        await expect(response.json()).resolves.toMatchObject({
            builder: { roleProfileId, candidateNextRoundDraftId: "draft-1" },
        });
    });

    it("rejects malformed context and missing identity before persistence", async () => {
        const loadBuilder = vi.fn();
        const invalid = await handleCandidateNextRoundDraftGetRequest({
            request: new Request("http://localhost/candidate/practice/next-round-draft?prep=quality-inspector"),
            resolveIdentity: async () => ({ candidateProfileId: "candidate-1" }),
            loadBuilder,
        });
        const unauthorized = await handleCandidateNextRoundDraftGetRequest({
            request: new Request(`http://localhost/candidate/practice/next-round-draft?prep=${roleProfileId}`),
            resolveIdentity: async () => null,
            loadBuilder,
        });

        expect(invalid.status).toBe(400);
        expect(unauthorized.status).toBe(401);
        expect(loadBuilder).not.toHaveBeenCalled();
    });

    it("passes only stable add pointers and returns the authoritative mutation model", async () => {
        const mutateBuilder = vi.fn(async () => ({
            status: "candidate_next_round_builder_mutation" as const,
            outcome: "updated" as const,
            builder: createBuilder(2, 4),
        }));
        const response = await handleCandidateNextRoundDraftMutationRequest({
            request: createMutationRequest({
                kind: "add",
                sourceCandidatePracticeSessionId: "session-2",
                sourceQuestionKey: "slot-2",
                practiceKind: "practice_from_feedback",
                provenance: "forged",
            }),
            resolveIdentity: async () => ({ candidateProfileId: "candidate-1" }),
            mutateBuilder,
        });

        expect(response.status).toBe(200);
        expect(mutateBuilder).toHaveBeenCalledWith({
            candidateProfileId: "candidate-1",
            roleProfileId,
            candidateNextRoundDraftId: "draft-1",
            expectedVersion: 3,
            mutation: {
                kind: "add",
                sourceCandidatePracticeSessionId: "session-2",
                sourceQuestionKey: "slot-2",
            },
        });
        await expect(response.json()).resolves.toMatchObject({
            outcome: "updated",
            builder: { version: 4, itemCount: 2 },
        });
    });

    it("returns the latest builder with an optimistic version conflict", async () => {
        const response = await handleCandidateNextRoundDraftMutationRequest({
            request: createMutationRequest({ kind: "clear" }),
            resolveIdentity: async () => ({ candidateProfileId: "candidate-1" }),
            mutateBuilder: async () => ({
                status: "candidate_next_round_builder_mutation",
                outcome: "version_conflict",
                builder: createBuilder(2, 7),
            }),
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({
            outcome: "version_conflict",
            builder: { version: 7, itemCount: 2 },
        });
    });
});

function createMutationRequest(mutation: Record<string, unknown>) {
    return new Request("http://localhost/candidate/practice/next-round-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            roleProfileId,
            candidateNextRoundDraftId: "draft-1",
            expectedVersion: 3,
            mutation,
        }),
    });
}

function createBuilder(itemCount = 1, version = 3): CandidateNextRoundBuilderModel {
    return {
        status: "candidate_next_round_builder_ready",
        candidateProfileId: "candidate-1",
        roleProfileId,
        targetRole: "Quality Inspector",
        candidateNextRoundDraftId: "draft-1",
        version,
        itemCount,
        capacity: 20,
        items: [],
        choices: [],
    };
}
