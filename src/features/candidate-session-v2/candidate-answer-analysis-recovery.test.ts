import { describe, expect, it } from "vitest";

import { candidateAnswerAnalysisFixtureRunMetadata } from "./candidate-answer-analysis-fixture";
import type { CandidateAnswerEvaluationRunRecord } from "./candidate-answer-history";
import {
    createCandidateAnswerAnalysisRecovery,
    parseCandidateAnswerAnalysisRecovery,
    resolveCandidateAnswerAnalysisRecovery,
} from "./candidate-answer-analysis-recovery";

describe("candidate answer-analysis recovery", () => {
    it("keeps missing configuration unavailable across refresh when no run exists", () => {
        expect(resolveCandidateAnswerAnalysisRecovery({
            runs: [],
            now: new Date("2026-07-16T18:00:30.000Z"),
            runtimeAvailable: false,
        })).toEqual(createCandidateAnswerAnalysisRecovery("unavailable"));
    });

    it("keeps a fresh requested generation pending", () => {
        expect(resolveCandidateAnswerAnalysisRecovery({
            runs: [createRun({ lifecycleState: "requested" })],
            now: new Date("2026-07-16T18:00:30.000Z"),
        })).toEqual(createCandidateAnswerAnalysisRecovery("pending"));
    });

    it("makes an expired claim and retryable terminal failure explicitly retryable", () => {
        expect(resolveCandidateAnswerAnalysisRecovery({
            runs: [createRun({
                lifecycleState: "requested",
                claimExpiresAt: "2026-07-16T18:00:20.000Z",
            })],
            now: new Date("2026-07-16T18:00:30.000Z"),
        })).toEqual(createCandidateAnswerAnalysisRecovery("retryable"));

        expect(resolveCandidateAnswerAnalysisRecovery({
            runs: [createRun({
                lifecycleState: "failed",
                validation: { retryableByNewRun: true },
                errorCode: "GOOGLE_PROVIDER_UNAVAILABLE",
            })],
            now: new Date("2026-07-16T18:00:30.000Z"),
        })).toEqual(createCandidateAnswerAnalysisRecovery("retryable"));
    });

    it("makes nonretryable and three-in-window terminal outcomes unavailable", () => {
        expect(resolveCandidateAnswerAnalysisRecovery({
            runs: [createRun({
                lifecycleState: "rejected",
                validation: { retryableByNewRun: false },
                errorCode: "PROVIDER_SAFETY_BLOCKED",
            })],
            now: new Date("2026-07-16T18:00:30.000Z"),
        })).toEqual(createCandidateAnswerAnalysisRecovery("unavailable"));

        expect(resolveCandidateAnswerAnalysisRecovery({
            runs: [1, 2, 3].map((generationAttempt) => createRun({
                generationAttempt,
                lifecycleState: "failed",
                validation: { retryableByNewRun: true },
                errorCode: "GOOGLE_PROVIDER_UNAVAILABLE",
                requestedAt: `2026-07-16T18:00:0${generationAttempt}.000Z`,
            })),
            now: new Date("2026-07-16T18:00:30.000Z"),
        })).toEqual(createCandidateAnswerAnalysisRecovery("unavailable"));
    });

    it("restores completed internal coaching without asking for another provider run", () => {
        expect(resolveCandidateAnswerAnalysisRecovery({
            runs: [createRun({ lifecycleState: "completed" })],
            now: new Date("2026-07-16T18:00:30.000Z"),
        })).toEqual(createCandidateAnswerAnalysisRecovery("recoverable"));
    });

    it("does not offer restore for a completed row without an accepted candidate-safe result", () => {
        expect(resolveCandidateAnswerAnalysisRecovery({
            runs: [createRun({
                lifecycleState: "completed",
                validation: { disposition: "accepted", candidateSafeProjection: false },
            })],
            now: new Date("2026-07-16T18:00:30.000Z"),
        })).toEqual(createCandidateAnswerAnalysisRecovery("unavailable"));
    });

    it("rejects recovery payloads whose capabilities do not match their state", () => {
        expect(parseCandidateAnswerAnalysisRecovery({
            status: "answer_analysis_recovery",
            state: "unavailable",
            canRetryAnalysis: true,
            canContinueWithoutCoaching: true,
        })).toBeNull();
    });
});

function createRun(overrides: Partial<CandidateAnswerEvaluationRunRecord>): CandidateAnswerEvaluationRunRecord {
    const lifecycleState = overrides.lifecycleState ?? "failed";
    return {
        candidateAnswerEvaluationRunId: `run-${overrides.generationAttempt ?? 1}`,
        candidateAnswerAttemptId: "attempt-1",
        purpose: "candidate_coaching",
        provider: candidateAnswerAnalysisFixtureRunMetadata.provider,
        modelName: candidateAnswerAnalysisFixtureRunMetadata.modelName,
        promptVersion: candidateAnswerAnalysisFixtureRunMetadata.promptVersion,
        evaluatorVersion: candidateAnswerAnalysisFixtureRunMetadata.evaluatorVersion,
        configurationManifest: candidateAnswerAnalysisFixtureRunMetadata.configurationManifest,
        configurationFingerprint: candidateAnswerAnalysisFixtureRunMetadata.configurationFingerprint,
        inputFingerprint: "input-1",
        idempotencyKey: "analysis-1",
        generationAttempt: overrides.generationAttempt ?? 1,
        lifecycleState,
        result: lifecycleState === "completed" ? { status: "accepted" } : null,
        validation: lifecycleState === "requested"
            ? null
            : overrides.validation ?? (lifecycleState === "completed"
                ? { disposition: "accepted", candidateSafeProjection: true }
                : null),
        errorCode: lifecycleState === "failed" || lifecycleState === "rejected"
            ? overrides.errorCode ?? "TEST_FAILURE"
            : null,
        requestedAt: overrides.requestedAt ?? "2026-07-16T18:00:00.000Z",
        claimExpiresAt: overrides.claimExpiresAt ?? "2026-07-16T18:01:00.000Z",
        completedAt: lifecycleState === "requested" ? null : "2026-07-16T18:00:10.000Z",
        createdAt: overrides.createdAt ?? "2026-07-16T18:00:00.000Z",
        updatedAt: overrides.updatedAt ?? "2026-07-16T18:00:10.000Z",
    };
}
