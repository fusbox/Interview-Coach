import { describe, expect, it, vi } from "vitest";

import { CANDIDATE_SETUP_LIMITS } from "@/features/candidate-setup-v2/candidate-setup-contract";

import { createCandidateQuestionPlan } from "./candidate-question-plan";
import { createCandidateQuestionWordingRequest } from "./candidate-question-wording";
import {
    CANDIDATE_QUESTION_WORDING_PROVIDER_OUTPUT_VERSION,
    createCandidateQuestionWordingRuntime,
    createCandidateQuestionWordingProviderRequest,
    createFaultInjectionCandidateQuestionWordingRuntime,
    createFixtureCandidateQuestionWordingRuntime,
    type CandidateQuestionWordingRuntimeTelemetry,
} from "./candidate-question-wording-runtime";

describe("candidate question wording runtime", () => {
    it("creates one stable bounded request from setup and plan snapshots", () => {
        const first = createProviderRequest({
            targetRole: ` ${"r".repeat(CANDIDATE_SETUP_LIMITS.targetRole + 10)} `,
            jobDescription: ` ${"j".repeat(CANDIDATE_SETUP_LIMITS.jobDescription + 10)} `,
            resumeText: ` ${"x".repeat(CANDIDATE_SETUP_LIMITS.resumeText + 10)} `,
            requestedAt: "2026-07-18T12:00:00.000Z",
        });
        const second = createProviderRequest({
            targetRole: ` ${"r".repeat(CANDIDATE_SETUP_LIMITS.targetRole + 10)} `,
            jobDescription: ` ${"j".repeat(CANDIDATE_SETUP_LIMITS.jobDescription + 10)} `,
            resumeText: ` ${"x".repeat(CANDIDATE_SETUP_LIMITS.resumeText + 10)} `,
            requestedAt: "2026-07-18T12:05:00.000Z",
        });

        expect(first.targetRole).toHaveLength(CANDIDATE_SETUP_LIMITS.targetRole);
        expect(first.jobDescription).toHaveLength(CANDIDATE_SETUP_LIMITS.jobDescription);
        expect(first.resumeText).toHaveLength(CANDIDATE_SETUP_LIMITS.resumeText);
        expect(first.requestFingerprint).toBe(second.requestFingerprint);
        expect(first.slots[0]).toMatchObject({
            slotId: "slot-1",
            index: 0,
            category: "screening",
            definition: expect.any(String),
            answerShape: expect.any(Array),
            watchFor: expect.any(Array),
        });
    });

    it("returns accepted wording with immutable configuration identity and safe telemetry", async () => {
        const telemetry = vi.fn<(event: CandidateQuestionWordingRuntimeTelemetry) => void>();
        const runtime = createFixtureCandidateQuestionWordingRuntime();
        const request = createRequest();
        const instrumentedRuntime = createFixtureCandidateQuestionWordingRuntimeWithTelemetry(telemetry);

        const result = await instrumentedRuntime.wordQuestions(request);

        expect(runtime.metadata.configurationFingerprint).toMatch(/^[a-f0-9]{64}$/);
        expect(result.questions).toHaveLength(5);
        expect(result.generation).toMatchObject({
            status: "candidate_question_wording_generation_v1",
            provider: "candidate_v2_question_wording_fixture",
            configurationFingerprint: runtime.metadata.configurationFingerprint,
            requestFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
            validation: {
                transportAttemptCount: 1,
                rawOutputStored: false,
                promptStored: false,
            },
        });
        expect(telemetry).toHaveBeenCalledTimes(1);
        const event = telemetry.mock.calls[0][0];
        expect(event).toMatchObject({
            status: "candidate_question_wording_runtime_telemetry_v1",
            interviewStage: "screening",
            questionCount: 5,
            outcome: "accepted",
        });
        const serialized = JSON.stringify(event);
        expect(serialized).not.toContain(request.setupSnapshot.targetRole);
        expect(serialized).not.toContain(request.setupSnapshot.jobDescription);
        expect(serialized).not.toContain(request.setupSnapshot.resumeText);
    });

    it.each([
        ["provider_unavailable", "failed", true],
        ["invalid_json", "rejected", true],
        ["invalid_schema", "rejected", true],
        ["fingerprint_mismatch", "rejected", false],
        ["question_mapping_mismatch", "rejected", false],
        ["duplicate_question", "rejected", false],
    ] as const)("fails closed for %s", async (mode, lifecycleState, retryable) => {
        const runtime = createFaultInjectionCandidateQuestionWordingRuntime(mode);
        await expect(runtime.wordQuestions(createRequest())).rejects.toMatchObject({
            kind: mode,
            lifecycleState,
            retryable,
        });
    });
});

function createFixtureCandidateQuestionWordingRuntimeWithTelemetry(
    telemetry: (event: CandidateQuestionWordingRuntimeTelemetry) => void,
) {
    const base = createFixtureCandidateQuestionWordingRuntime();
    return createCandidateQuestionWordingRuntime({
        adapter: {
            metadata: base.metadata,
            async generate(request) {
                return {
                    rawText: JSON.stringify({
                        status: CANDIDATE_QUESTION_WORDING_PROVIDER_OUTPUT_VERSION,
                        requestFingerprint: request.requestFingerprint,
                        questions: request.slots.map((slot) => ({
                            slotId: slot.slotId,
                            category: slot.category,
                            questionText: `Question ${slot.index + 1}: How would you prepare for ${slot.category.replaceAll("_", " ")} work in this role?`,
                        })),
                    }),
                };
            },
        },
        recordTelemetry: telemetry,
        now: () => new Date("2026-07-18T12:00:00.000Z"),
    });
}

function createProviderRequest(input: {
    targetRole: string;
    jobDescription: string;
    resumeText: string;
    requestedAt: string;
}) {
    const plan = createCandidateQuestionPlan({ interviewStage: "screening", questionCount: 5 });
    return createCandidateQuestionWordingProviderRequest({
        status: "question_wording_requested",
        requestedAt: input.requestedAt,
        setupSnapshot: {
            targetRole: input.targetRole,
            jobDescription: input.jobDescription,
            resumeText: input.resumeText,
            interviewStage: "screening",
            questionCount: 5,
            resumeCaptureMode: "pasted_text",
            createdAt: "2026-07-18T11:55:00.000Z",
        },
        questionPlanSnapshot: plan,
    });
}

function createRequest() {
    const plan = createCandidateQuestionPlan({ interviewStage: "screening", questionCount: 5 });
    return createCandidateQuestionWordingRequest({
        setupSnapshot: {
            targetRole: "Material Handler",
            jobDescription: "Move, label, and verify inventory safely.",
            resumeText: "Prepared outbound orders and checked labels.",
            interviewStage: "screening",
            questionCount: 5,
            resumeCaptureMode: "pasted_text",
            createdAt: "2026-07-18T11:55:00.000Z",
        },
        questionPlanSnapshot: plan,
        now: new Date("2026-07-18T12:00:00.000Z"),
    });
}
