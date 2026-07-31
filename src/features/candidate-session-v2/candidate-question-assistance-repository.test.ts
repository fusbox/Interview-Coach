import { describe, expect, it, vi } from "vitest";

import { createCandidateQuestionAssistanceRepository } from "./candidate-question-assistance-repository";

const ids = {
    session: "10000000-0000-4000-8000-000000000001",
    profile: "10000000-0000-4000-8000-000000000002",
    claim: "10000000-0000-4000-8000-000000000003",
};

describe("candidate question assistance repository", () => {
    it("distinguishes an owned claim from a concurrent pending request", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({
                rows: [{
                    request_fingerprint: "a".repeat(64),
                    lifecycle_state: "pending",
                    claim_token: ids.claim,
                    attempt_count: 1,
                    output_json: null,
                }],
            })
            .mockResolvedValueOnce({
                rows: [{
                    request_fingerprint: "a".repeat(64),
                    lifecycle_state: "pending",
                    claim_token: "10000000-0000-4000-8000-000000000004",
                    attempt_count: 1,
                    output_json: null,
                }],
            });
        const repository = createCandidateQuestionAssistanceRepository({ query });
        const input = {
            practiceSessionId: ids.session,
            ownerId: ids.profile,
            questionKey: "q1",
            assistanceKind: "hints" as const,
            requestFingerprint: "a".repeat(64),
            claimToken: ids.claim,
            claimLeaseMs: 30_000,
        };

        await expect(repository.claim(input)).resolves.toEqual({
            kind: "claimed",
            claimToken: ids.claim,
            attemptCount: 1,
        });
        await expect(repository.claim(input)).resolves.toEqual({ kind: "pending" });
    });

    it("replays a durable successful result", async () => {
        const output = {
            status: "candidate_question_hints_v1",
            doThis: "Choose one relevant example.",
            avoidThis: "Avoid a general claim without evidence.",
        } as const;
        const query = vi.fn().mockResolvedValue({
            rows: [{
                request_fingerprint: "b".repeat(64),
                lifecycle_state: "succeeded",
                claim_token: null,
                attempt_count: 1,
                output_json: output,
            }],
        });
        const repository = createCandidateQuestionAssistanceRepository({ query });

        await expect(repository.claim({
            practiceSessionId: ids.session,
            ownerId: ids.profile,
            questionKey: "q1",
            assistanceKind: "hints",
            requestFingerprint: "b".repeat(64),
            claimToken: ids.claim,
            claimLeaseMs: 30_000,
        })).resolves.toEqual({ kind: "replay", output });
    });

    it("completes only the matching active claim", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [{ candidate_question_assistance_artifact_id: "artifact" }],
        });
        const repository = createCandidateQuestionAssistanceRepository({ query });

        await expect(repository.complete({
            practiceSessionId: ids.session,
            ownerId: ids.profile,
            questionKey: "q1",
            assistanceKind: "strong_response",
            claimToken: ids.claim,
            output: {
                status: "candidate_strong_response_v1",
                strongResponse: "A bounded example response.",
                whyThisWorks: "It answers directly and supports the answer with evidence.",
            },
            provider: "fixture",
            profileId: "fixture_v1",
            promptVersion: "prompt_v1",
            configurationFingerprint: "c".repeat(64),
        })).resolves.toBe(true);
        expect(query.mock.calls[0][0]).toContain("claim_token = $5::uuid");
    });

    it("does not reclaim a failed artifact after the generation cap", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [{
                request_fingerprint: "d".repeat(64),
                lifecycle_state: "failed",
                claim_token: null,
                attempt_count: 3,
                output_json: null,
            }],
        });
        const repository = createCandidateQuestionAssistanceRepository({ query });

        await expect(repository.claim({
            practiceSessionId: ids.session,
            ownerId: ids.profile,
            questionKey: "q1",
            assistanceKind: "hints",
            requestFingerprint: "d".repeat(64),
            claimToken: ids.claim,
            claimLeaseMs: 30_000,
        })).resolves.toEqual({ kind: "exhausted" });
        expect(query.mock.calls[0][0]).toContain("attempt_count < 3");
    });

    it("does not reclaim an expired final claim after a worker interruption", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [{
                request_fingerprint: "e".repeat(64),
                lifecycle_state: "pending",
                claim_token: "10000000-0000-4000-8000-000000000004",
                claim_expires_at: "2026-01-01T00:00:00.000Z",
                attempt_count: 3,
                output_json: null,
            }],
        });
        const repository = createCandidateQuestionAssistanceRepository({ query });

        await expect(repository.claim({
            practiceSessionId: ids.session,
            ownerId: ids.profile,
            questionKey: "q1",
            assistanceKind: "hints",
            requestFingerprint: "e".repeat(64),
            claimToken: ids.claim,
            claimLeaseMs: 30_000,
        })).resolves.toEqual({ kind: "exhausted" });
    });
});
