import { describe, expect, it, vi } from "vitest";

import { createCandidateCoachUpdateArtifactRepository } from "./candidate-coach-update-artifact-repository";

describe("candidate Coach Update artifact repository", () => {
    it("expires an abandoned request before claiming the next generation attempt", async () => {
        const calls: Array<{ sql: string; values: unknown[] }> = [];
        const query = vi.fn(async (sql: string, values: unknown[]) => {
            calls.push({ sql, values });
            return { rows: [] };
        });
        const repository = createCandidateCoachUpdateArtifactRepository({ query });

        await repository.claimArtifact({
            candidateProfileId: "candidate-1",
            roleProfileId: "10000000-0000-4000-8000-000000000001",
            sourceCandidatePracticeSessionId: "session-1",
            sourceCompletionFingerprint: "completion-1",
            sourceAnswerAttemptIds: ["attempt-1"],
            acceptedEvaluationRunIds: ["run-1"],
            synthesisInputFingerprint: "input-1",
            provider: "fixture",
            modelName: "fixture-v1",
            promptVersion: "prompt-v1",
            evaluatorVersion: "evaluator-v1",
            requestedAt: "2026-07-15T12:05:00.000Z",
            staleRequestedBefore: "2026-07-15T12:03:00.000Z",
        });

        const { sql, values } = calls[0] ?? { sql: "", values: [] };
        const normalizedSql = String(sql).replace(/\s+/g, " ").toLowerCase();
        expect(normalizedSql).toContain("select pg_advisory_xact_lock");
        expect(normalizedSql).toContain("expired_requested as (");
        expect(normalizedSql).toContain("error_code = 'stale_coach_update_claim'");
        expect(normalizedSql).toContain("completed_at = $12");
        expect(normalizedSql).toContain("artifact.requested_at < $13");
        expect(values?.[11]).toBe("2026-07-15T12:05:00.000Z");
        expect(values?.[12]).toBe("2026-07-15T12:03:00.000Z");
    });
});
