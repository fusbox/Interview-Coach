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
            sourceQuestionKey: "slot-1",
            sourceAnswerAttemptId: "11111111-1111-4111-8111-111111111111",
            sourceAcceptedEvaluationRunId: "22222222-2222-4222-8222-222222222222",
            sourceCompletionFingerprint: "completion-1",
            sourceAnswerAttemptIds: ["attempt-1"],
            acceptedEvaluationRunIds: ["run-1"],
            synthesisInputFingerprint: "input-1",
            provider: "fixture",
            modelName: "fixture-v1",
            promptVersion: "prompt-v1",
            evaluatorVersion: "evaluator-v1",
            profileId: "fixture-profile-v1",
            configurationFingerprint: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            requestedAt: "2026-07-15T12:05:00.000Z",
            staleRequestedBefore: "2026-07-15T12:03:00.000Z",
        });

        const { sql, values } = calls[0] ?? { sql: "", values: [] };
        const normalizedSql = String(sql).replace(/\s+/g, " ").toLowerCase();
        expect(normalizedSql).toContain("select pg_advisory_xact_lock");
        expect(normalizedSql).toContain("expired_requested as (");
        expect(normalizedSql).toContain("error_code = 'stale_coach_update_claim'");
        expect(normalizedSql).toContain("artifact.profile_id = $15");
        expect(normalizedSql).toContain("artifact.configuration_fingerprint = $16");
        expect(normalizedSql).toContain("completed_at = $17");
        expect(normalizedSql).toContain("artifact.requested_at < $18");
        expect(values?.[14]).toBe("fixture-profile-v1");
        expect(values?.[15]).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        expect(values?.[16]).toBe("2026-07-15T12:05:00.000Z");
        expect(values?.[17]).toBe("2026-07-15T12:03:00.000Z");
    });

    it("lists only the newest lifecycle attempt per source round for candidate-owned dashboard projection", async () => {
        const calls: Array<{ sql: string; values: unknown[] }> = [];
        const query = vi.fn(async (sql: string, values: unknown[]) => {
            calls.push({ sql, values });
            return { rows: [] };
        });
        const repository = createCandidateCoachUpdateArtifactRepository({ query });

        await repository.listLatestArtifactAttempts({ candidateProfileId: "candidate-1" });

        const { sql, values } = calls[0] ?? { sql: "", values: [] };
        const normalizedSql = String(sql).replace(/\s+/g, " ").toLowerCase();
        expect(normalizedSql).toContain("coalesce(artifact.source_question_key, '')");
        expect(normalizedSql).toContain("where artifact.candidate_profile_id = $1");
        expect(normalizedSql).not.toContain("artifact.lifecycle_state = 'completed'");
        expect(normalizedSql).toContain("artifact.generation_attempt desc");
        expect(normalizedSql).toContain("artifact.updated_at desc");
        expect(values).toEqual(["candidate-1"]);
    });
});
