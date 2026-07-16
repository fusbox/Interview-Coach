import {
    EVIDENCE_FIRST_RUNTIME_POLICY,
    UNIVERSAL_CRITERION_IDS,
    createEvaluatorFingerprint,
    createEvaluatorRunDescriptor,
    type EvidenceFirstEvaluationCase,
    type EvidenceFirstEvaluatorProfile,
} from "./evidence-first-evaluator-contract";
import {
    EvidenceFirstEvaluatorRuntimeError,
    type AcceptedEvidenceFirstEvaluatorRun,
    type EvidenceFirstEvaluatorRuntimeAdapters,
} from "./evidence-first-evaluator-runtime";
import {
    CANDIDATE_EVALUATOR_GOLDEN_SUITE_VERSION,
    candidateEvaluatorGoldenCases,
    type CandidateEvaluatorGoldenCase,
} from "./candidate-evaluator-golden-suite";
import {
    CANDIDATE_EVALUATOR_LIVE_TEST_ENV,
    containsForbiddenCandidateLanguage,
    createCandidateEvaluatorLiveComparison,
    findProhibitedLiveArtifactKeys,
    runCandidateEvaluatorLiveValidation,
} from "./candidate-evaluator-live-validation";
import {
    GOOGLE_EVIDENCE_FIRST_PROFILE_ID,
    GOOGLE_EVIDENCE_FIRST_PROVIDER,
    GOOGLE_GENAI_API_KEY_ENV,
    createGoogleGemini25FlashEvaluatorProfile,
} from "./google-evidence-first-evaluator";
import { describe, expect, it, vi } from "vitest";

const liveEnvironment = {
    [CANDIDATE_EVALUATOR_LIVE_TEST_ENV]: "true",
    CANDIDATE_ANSWER_ANALYSIS_PROVIDER: GOOGLE_EVIDENCE_FIRST_PROVIDER,
    CANDIDATE_ANSWER_ANALYSIS_PROFILE: GOOGLE_EVIDENCE_FIRST_PROFILE_ID,
    [GOOGLE_GENAI_API_KEY_ENV]: "test-live-secret-that-must-not-appear",
};

describe("candidate evaluator live validation", () => {
    it.each([
        ["missing CLI confirmation", { confirmedLiveProvider: false }],
        ["missing live flag", { env: { [CANDIDATE_EVALUATOR_LIVE_TEST_ENV]: undefined } }],
        ["wrong provider", { env: { CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "fixture" } }],
        ["wrong profile", { env: { CANDIDATE_ANSWER_ANALYSIS_PROFILE: "other_profile" } }],
        ["missing credential", { env: { [GOOGLE_GENAI_API_KEY_ENV]: "" } }],
    ])("makes zero evaluator assemblies when %s", async (_label, override) => {
        const createEvaluator = vi.fn(() => createPinnedAssembly());
        const env = { ...liveEnvironment, ...("env" in override ? override.env : {}) };

        await expect(runCandidateEvaluatorLiveValidation({
            env,
            confirmedLiveProvider: "confirmedLiveProvider" in override
                ? override.confirmedLiveProvider
                : true,
            dependencies: { createEvaluator },
        })).rejects.toMatchObject({
            name: "CandidateEvaluatorLiveValidationGuardError",
        });
        expect(createEvaluator).not.toHaveBeenCalled();
    });

    it("captures the complete synthetic golden suite without provider inputs or credentials", async () => {
        const artifact = await createPassingArtifact();
        const serialized = JSON.stringify(artifact);

        expect(artifact.suiteVersion).toBe(CANDIDATE_EVALUATOR_GOLDEN_SUITE_VERSION);
        expect(artifact.summary).toMatchObject({
            requestedCases: 7,
            acceptedCases: 7,
            passedCases: 7,
            gatePassed: true,
        });
        expect(artifact.suiteValidations.every((fact) => fact.passed)).toBe(true);
        expect(findProhibitedLiveArtifactKeys(artifact)).toEqual([]);
        expect(serialized).not.toContain(liveEnvironment[GOOGLE_GENAI_API_KEY_ENV]);

        for (const goldenCase of candidateEvaluatorGoldenCases) {
            expect(serialized).not.toContain(goldenCase.evaluationCase.answerAttemptId);
            expect(serialized).not.toContain(goldenCase.evaluationCase.providerInput.answer.text);
            expect(serialized).not.toContain(goldenCase.evaluationCase.providerInput.question.questionText);
            expect(serialized).not.toContain(goldenCase.evaluationCase.providerInput.roleContext.jobDescription);
            if (goldenCase.evaluationCase.providerInput.roleContext.resumeText) {
                expect(serialized).not.toContain(goldenCase.evaluationCase.providerInput.roleContext.resumeText);
            }
        }
    });

    it("records a safe terminal failure and preserves the rest of the review artifact", async () => {
        const artifact = await runCandidateEvaluatorLiveValidation({
            env: liveEnvironment,
            confirmedLiveProvider: true,
            dependencies: {
                now: fixedNow,
                createEvaluator: () => createPinnedAssembly(),
                runEvaluator: async (input) => {
                    const goldenCase = findGoldenCase(input.evaluationCase);
                    if (goldenCase.caseId === "confidently_wrong_database_indexing") {
                        throw new EvidenceFirstEvaluatorRuntimeError({
                            disposition: "failed",
                            errorCode: "GOOGLE_PROVIDER_UNAVAILABLE",
                            stage: "verification",
                            retryableByNewRun: true,
                            attempts: [{
                                stage: "verification",
                                attempt: 1,
                                timeoutMs: 12_000,
                                outcome: "failed",
                                latencyMs: 100,
                                errorCode: "GOOGLE_PROVIDER_UNAVAILABLE",
                                failureClass: "provider_5xx",
                            }],
                        });
                    }
                    return createAcceptedRun(goldenCase, input.profile, input.evaluationRunId, input.requestedAt);
                },
            },
        });

        expect(artifact.summary).toMatchObject({
            acceptedCases: 6,
            failedCases: 1,
            gatePassed: false,
        });
        expect(artifact.cases.find((item) => item.caseId === "confidently_wrong_database_indexing"))
            .toMatchObject({
                outcome: "failed",
                goldenPassed: false,
                failure: {
                    stage: "verification",
                    errorCode: "GOOGLE_PROVIDER_UNAVAILABLE",
                    retryableByNewRun: true,
                },
            });
    });

    it("normalizes unknown runtime exceptions without retaining their messages", async () => {
        const artifact = await runCandidateEvaluatorLiveValidation({
            env: liveEnvironment,
            confirmedLiveProvider: true,
            dependencies: {
                now: fixedNow,
                createEvaluator: () => createPinnedAssembly(),
                runEvaluator: async () => {
                    throw new Error("provider-body-secret");
                },
            },
        });

        expect(artifact.cases.every((item) => (
            item.outcome === "failed"
            && item.failure.errorCode === "LIVE_EVALUATOR_UNCLASSIFIED_FAILURE"
        ))).toBe(true);
        expect(JSON.stringify(artifact)).not.toContain("provider-body-secret");
    });

    it("creates a same-input repeatability artifact without making another evaluator call", async () => {
        const runEvaluator = vi.fn(async (input) => {
            const goldenCase = findGoldenCase(input.evaluationCase);
            return createAcceptedRun(goldenCase, input.profile, input.evaluationRunId, input.requestedAt);
        });
        const baseline = await runCandidateEvaluatorLiveValidation({
            env: liveEnvironment,
            confirmedLiveProvider: true,
            dependencies: { now: fixedNow, createEvaluator: () => createPinnedAssembly(), runEvaluator },
        });
        const callsAfterLiveRuns = runEvaluator.mock.calls.length;
        const comparison = createCandidateEvaluatorLiveComparison({
            baseline,
            candidate: baseline,
            generatedAt: "2026-07-16T13:00:00.000Z",
        });

        expect(runEvaluator).toHaveBeenCalledTimes(callsAfterLiveRuns);
        expect(comparison.mode).toBe("same_profile_repeatability");
        expect(comparison.summary).toMatchObject({
            comparableCases: 7,
            totalCases: 7,
            comparisonReady: true,
            preference: "not_reviewed",
        });
        expect(comparison.summary.flags).toContain("needs_human_review");
        expect(findProhibitedLiveArtifactKeys(comparison)).toEqual([]);
    });

    it("keeps a fingerprint mismatch visible and blocks comparison readiness", async () => {
        const baseline = await createPassingArtifact();
        const candidate = structuredClone(baseline);
        candidate.cases[0].inputFingerprint = "f".repeat(64);
        if (candidate.cases[0].outcome === "accepted") {
            candidate.cases[0].acceptedSummary.candidateProjection.inputFingerprint = "f".repeat(64);
        }
        const comparison = createCandidateEvaluatorLiveComparison({
            baseline,
            candidate,
            generatedAt: "2026-07-16T13:00:00.000Z",
        });

        expect(comparison.summary.comparisonReady).toBe(false);
        expect(comparison.summary.flags).toContain("different_case_input");
        expect(comparison.cases.find((item) => item.caseId === candidate.cases[0].caseId)).toMatchObject({
            comparable: false,
            flags: expect.arrayContaining(["different_case_input", "needs_human_review"]),
        });
    });

    it("supports future different-profile A/B review without weakening the pinned live command", async () => {
        const baseline = await createPassingArtifact();
        const candidate = structuredClone(baseline);
        candidate.artifactId = `live_eval_${"a".repeat(16)}`;
        candidate.profile.profileId = "google_future_flash_qa_v1";
        candidate.profile.model = "future-flash-model";
        candidate.profile.configurationManifest.profileId = "google_future_flash_qa_v1";
        candidate.profile.configurationManifest.adapterVersion = "google_future_flash_qa_adapter_v1";
        candidate.profile.configurationManifest.stages = candidate.profile.configurationManifest.stages.map((stage) => ({
            ...stage,
            model: "future-flash-model",
        }));
        candidate.profile.configurationFingerprint = createEvaluatorFingerprint(
            candidate.profile.configurationManifest,
        );

        const comparison = createCandidateEvaluatorLiveComparison({
            baseline,
            candidate,
            generatedAt: "2026-07-16T13:00:00.000Z",
        });

        expect(comparison.mode).toBe("profile_ab");
        expect(comparison.summary).toMatchObject({
            comparableCases: 7,
            comparisonReady: true,
            preference: "not_reviewed",
        });
    });

    it("reports prohibited artifact fields for privacy review", () => {
        expect(findProhibitedLiveArtifactKeys({
            safe: { value: true },
            providerInput: { answerText: "do not retain" },
            nested: [{ candidateProfileId: "candidate" }],
        })).toEqual(["answerText", "candidateProfileId", "providerInput"]);
    });

    it("distinguishes ordinary problem diagnosis from prohibited candidate or medical diagnosis", () => {
        expect(containsForbiddenCandidateLanguage(
            "Diagnose the inventory problem before choosing an action.",
        )).toBe(false);
        expect(containsForbiddenCandidateLanguage("I can diagnose you from this answer.")).toBe(true);
        expect(containsForbiddenCandidateLanguage("This amounts to a medical diagnosis.")).toBe(true);
    });
});

describe("candidate evaluator golden suite", () => {
    it("contains the first required edge cases with unique stable fingerprints", () => {
        expect(candidateEvaluatorGoldenCases.map((item) => item.caseId)).toEqual([
            "thin_screening_answer",
            "polished_off_topic_answer",
            "sensitive_health_disclosure",
            "transferable_school_leadership",
            "strong_content_typed",
            "strong_content_voice_with_fillers",
            "confidently_wrong_database_indexing",
        ]);
        expect(new Set(candidateEvaluatorGoldenCases.map((item) => item.evaluationCase.inputFingerprint)).size)
            .toBe(candidateEvaluatorGoldenCases.length);
        expect(candidateEvaluatorGoldenCases.filter((item) => item.fairnessPair)).toHaveLength(2);
    });
});

async function createPassingArtifact() {
    return runCandidateEvaluatorLiveValidation({
        env: liveEnvironment,
        confirmedLiveProvider: true,
        dependencies: {
            now: fixedNow,
            createEvaluator: () => createPinnedAssembly(),
            runEvaluator: async (input) => {
                const goldenCase = findGoldenCase(input.evaluationCase);
                return createAcceptedRun(goldenCase, input.profile, input.evaluationRunId, input.requestedAt);
            },
        },
    });
}

function createPinnedAssembly() {
    const profile = createGoogleGemini25FlashEvaluatorProfile();
    return {
        profile,
        runMetadata: createEvaluatorRunDescriptor(profile),
        adapters: {} as EvidenceFirstEvaluatorRuntimeAdapters,
    };
}

function findGoldenCase(evaluationCase: EvidenceFirstEvaluationCase) {
    const goldenCase = candidateEvaluatorGoldenCases.find((item) => (
        item.evaluationCase.inputFingerprint === evaluationCase.inputFingerprint
    ));
    if (!goldenCase) throw new Error("Missing golden case fixture.");
    return goldenCase;
}

function createAcceptedRun(
    goldenCase: CandidateEvaluatorGoldenCase,
    profile: EvidenceFirstEvaluatorProfile,
    evaluationRunId: string,
    requestedAt: string,
): AcceptedEvidenceFirstEvaluatorRun {
    const expectation = goldenCase.expectation;
    const fingerprint = goldenCase.evaluationCase.inputFingerprint;
    const answer = goldenCase.evaluationCase.providerInput.answer.text;
    const quote = answer.slice(0, Math.min(answer.length, 16));
    const spanId = "golden-span-1";
    const verificationRequired = expectation.verificationRequired ?? false;
    const primaryStrength = expectation.primaryStrength === "present"
        ? "Your response gives a concrete, relevant example."
        : null;
    const deliveryNote = expectation.deliveryNote === "present"
        ? { status: "light_note" as const, message: "A short pause can make the same strong content easier to follow." }
        : null;
    const criteria = UNIVERSAL_CRITERION_IDS.map((criterionId) => ({
        criterionId,
        applicability: "observed" as const,
        band: expectation.criterionBands?.[criterionId]?.[0] ?? "clear" as const,
        evidenceSpanIds: [spanId],
        reasonCode: `golden_${criterionId}`,
    }));
    const intervention = expectation.allowedInterventions?.[0] ?? "polish_then_continue";
    const candidateProjection = {
        status: "candidate_safe_feedback" as const,
        schemaVersion: 1 as const,
        inputFingerprint: fingerprint,
        acknowledgement: "You gave me an answer I can review with you.",
        primaryStrength,
        biggestUpgrade: primaryStrength ? null : "Add one relevant example that directly answers the question.",
        redoPrompt: primaryStrength ? null : "Try again with one situation, what you did, and what happened.",
        patternSuggestion: null,
        deliveryNote,
    };
    const completedAt = new Date(Date.parse(requestedAt) + 200).toISOString();
    const stages = [
        acceptedStage("evidence_extraction", 100),
        ...(verificationRequired ? [acceptedStage("verification", 50)] : []),
        acceptedStage("feedback_composition", 50),
    ];

    return {
        status: "evidence_first_evaluator_run_accepted",
        schemaVersion: 1,
        contractVersion: profile.evaluatorVersion,
        evaluationRunId,
        inputFingerprint: fingerprint,
        requestedAt,
        completedAt,
        profile,
        accepted: {
            extraction: {
                status: "evidence_extraction_output",
                schemaVersion: 1,
                inputFingerprint: fingerprint,
                questionCategory: goldenCase.evaluationCase.providerInput.question.category,
                answerUsability: {
                    status: expectation.allowedUsability[0],
                    reasonCode: `golden_${goldenCase.caseId}`,
                },
                observableMarkers: {
                    answeredQuestion: true,
                    hasDirectAnswer: true,
                    hasExample: false,
                    hasSpecificDetails: false,
                    hasPersonalAction: false,
                    hasOutcomeOrTakeaway: false,
                    hasTradeoffOrConstraint: false,
                    hasRoleRelevantSkillSignal: false,
                    isOverlyLong: false,
                    isVeryShort: false,
                    ...expectation.markerValues,
                },
                evidenceSpans: [{
                    id: spanId,
                    marker: "direct_answer",
                    quote,
                    start: 0,
                    end: quote.length,
                }],
                categorySignals: [],
                technicalAccuracy: {
                    status: expectation.technicalAccuracy ?? "not_assessed",
                    referenceConceptIds: expectation.technicalAccuracy ? ["index_lookup_structure"] : [],
                    evidenceSpanIds: expectation.technicalAccuracy ? [spanId] : [],
                },
                missingEvidence: [],
                sensitiveContentFlags: [...(expectation.requiredSensitiveFlags ?? [])],
                unsafeInferenceFlags: [],
            },
            criteria,
            patternGap: {
                id: "golden_pattern_gap",
                severity: primaryStrength ? "low" : "medium",
                upgrade: "Add one concrete supporting detail.",
                redoPattern: ["Situation", "Action", "Result"],
                source: "criterion_appraisal",
            },
            verification: {
                required: verificationRequired,
                reasons: verificationRequired ? ["technical_accuracy_requires_reference_check"] : [],
                output: verificationRequired ? {
                    status: "evidence_verification_output",
                    schemaVersion: 1,
                    inputFingerprint: fingerprint,
                    supported: true,
                    issueCodes: [],
                    recommendedAction: "accept",
                } : null,
            },
            feedback: {
                status: "feedback_composition_output",
                schemaVersion: 1,
                inputFingerprint: fingerprint,
                feedbackPlan: {
                    centralRead: "This is a synthetic accepted coaching result for artifact tests.",
                    signal: { valence: primaryStrength ? "strength" : "growth", detectability: "clear" },
                    primaryAnchor: primaryStrength
                        ? { kind: "criterion", id: "answer_focus" }
                        : { kind: "pattern_gap", id: "golden_pattern_gap" },
                    intervention,
                },
                candidateFeedback: {
                    acknowledgement: candidateProjection.acknowledgement,
                    primaryStrength: candidateProjection.primaryStrength,
                    biggestUpgrade: candidateProjection.biggestUpgrade,
                    redoPrompt: candidateProjection.redoPrompt,
                    patternSuggestion: null,
                    deliveryNote,
                },
                claimEvidence: {
                    acknowledgementSpanIds: [spanId],
                    primaryStrengthSpanIds: primaryStrength ? [spanId] : [],
                },
            },
            candidateProjection,
        },
        stages,
        metrics: {
            latencyMs: 200,
            tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        },
        retention: { assembledPrompt: "not_captured", rawProviderOutput: "not_captured" },
    };
}

function acceptedStage(
    stage: "evidence_extraction" | "verification" | "feedback_composition",
    latencyMs: number,
) {
    return {
        stage,
        attempt: 1,
        timeoutMs: EVIDENCE_FIRST_RUNTIME_POLICY.stages[stage === "evidence_extraction"
            ? "evidenceExtraction"
            : stage === "feedback_composition"
                ? "feedbackComposition"
                : "verification"].timeoutMs,
        outcome: "accepted" as const,
        latencyMs,
        tokenUsage: { inputTokens: 50, outputTokens: 25, totalTokens: 75 },
    };
}

function fixedNow() {
    return new Date("2026-07-16T12:30:00.000Z");
}
