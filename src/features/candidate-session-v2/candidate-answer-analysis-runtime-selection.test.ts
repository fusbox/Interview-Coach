import { describe, expect, it } from "vitest";

import { isCandidateAnswerAnalysisRuntimeAvailable } from "./candidate-answer-analysis-runtime-selection";

describe("candidate answer-analysis runtime selection", () => {
    it("recognizes only explicitly enabled local fixture runtimes", () => {
        expect(isCandidateAnswerAnalysisRuntimeAvailable({
            NODE_ENV: "development",
            CANDIDATE_HOST_LAUNCH_DEV_MODE: "true",
            CANDIDATE_HOST_LAUNCH_DEV_SECRET: "local-secret",
            CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "fixture",
        })).toBe(true);

        expect(isCandidateAnswerAnalysisRuntimeAvailable({
            NODE_ENV: "development",
            CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "fixture",
        })).toBe(false);
    });

    it("recognizes a complete Google runtime and fails closed for missing configuration", () => {
        expect(isCandidateAnswerAnalysisRuntimeAvailable({
            CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "google_genai",
            CANDIDATE_ANSWER_ANALYSIS_PROFILE: "google_gemini_2_5_flash_v1",
            GEMINI_API_KEY: "server-secret",
        })).toBe(true);

        expect(isCandidateAnswerAnalysisRuntimeAvailable({
            CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "google_genai",
            CANDIDATE_ANSWER_ANALYSIS_PROFILE: "google_gemini_2_5_flash_v1",
        })).toBe(false);
        expect(isCandidateAnswerAnalysisRuntimeAvailable({})).toBe(false);
    });
});
