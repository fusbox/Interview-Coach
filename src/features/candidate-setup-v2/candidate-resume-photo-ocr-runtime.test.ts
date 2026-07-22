import { describe, expect, it } from "vitest";

import {
    CANDIDATE_RESUME_PHOTO_OCR_FIXTURE_ENABLED_ENV,
    CANDIDATE_RESUME_PHOTO_OCR_FIXTURE_PROFILE_ID,
    CANDIDATE_RESUME_PHOTO_OCR_FIXTURE_PROVIDER,
    CANDIDATE_RESUME_PHOTO_OCR_PROFILE_ENV,
    CANDIDATE_RESUME_PHOTO_OCR_PROVIDER_ENV,
    CandidateResumePhotoOcrRuntimeError,
    createCandidateResumePhotoOcrRuntimeFromEnvironment,
} from "./candidate-resume-photo-ocr-runtime";
import {
    GOOGLE_CANDIDATE_RESUME_PHOTO_OCR_PROFILE_ID,
    GOOGLE_CANDIDATE_RESUME_PHOTO_OCR_PROVIDER,
} from "./google-candidate-resume-photo-ocr";

describe("candidate resume photo OCR runtime selection", () => {
    it("selects only the exact credentialed Google profile", () => {
        const runtime = createCandidateResumePhotoOcrRuntimeFromEnvironment({
            env: {
                NODE_ENV: "test",
                [CANDIDATE_RESUME_PHOTO_OCR_PROVIDER_ENV]: GOOGLE_CANDIDATE_RESUME_PHOTO_OCR_PROVIDER,
                [CANDIDATE_RESUME_PHOTO_OCR_PROFILE_ENV]: GOOGLE_CANDIDATE_RESUME_PHOTO_OCR_PROFILE_ID,
                GEMINI_API_KEY: "server-key",
            },
            googleTransportFactory: () => ({ generateContent: async () => ({}) as never }),
        });
        expect(runtime.provider).toBe("google_genai");
        expect(runtime.profileId).toBe(GOOGLE_CANDIDATE_RESUME_PHOTO_OCR_PROFILE_ID);
    });

    it("allows the fixture only behind an explicit non-production gate", async () => {
        const runtime = createCandidateResumePhotoOcrRuntimeFromEnvironment({
            env: {
                NODE_ENV: "development",
                [CANDIDATE_RESUME_PHOTO_OCR_PROVIDER_ENV]: CANDIDATE_RESUME_PHOTO_OCR_FIXTURE_PROVIDER,
                [CANDIDATE_RESUME_PHOTO_OCR_PROFILE_ENV]: CANDIDATE_RESUME_PHOTO_OCR_FIXTURE_PROFILE_ID,
                [CANDIDATE_RESUME_PHOTO_OCR_FIXTURE_ENABLED_ENV]: "true",
            },
        });
        await expect(runtime.ocr({
            pages: [{ pageNumber: 1, bytes: Uint8Array.of(1), mimeType: "image/jpeg" }],
        })).resolves.toEqual({
            pages: [{ pageNumber: 1, text: "Page 1: Inventory, shipping, and customer service experience." }],
        });

        expect(() => createCandidateResumePhotoOcrRuntimeFromEnvironment({
            env: {
                NODE_ENV: "production",
                [CANDIDATE_RESUME_PHOTO_OCR_PROVIDER_ENV]: CANDIDATE_RESUME_PHOTO_OCR_FIXTURE_PROVIDER,
                [CANDIDATE_RESUME_PHOTO_OCR_PROFILE_ENV]: CANDIDATE_RESUME_PHOTO_OCR_FIXTURE_PROFILE_ID,
                [CANDIDATE_RESUME_PHOTO_OCR_FIXTURE_ENABLED_ENV]: "true",
            },
        })).toThrowError(expect.objectContaining({ failureClass: "fixture_not_allowed" }));
    });

    it("fails closed for missing or mismatched configuration", () => {
        expect(() => createCandidateResumePhotoOcrRuntimeFromEnvironment({ env: { NODE_ENV: "test" } }))
            .toThrowError(CandidateResumePhotoOcrRuntimeError);
        expect(() => createCandidateResumePhotoOcrRuntimeFromEnvironment({
            env: {
                NODE_ENV: "test",
                [CANDIDATE_RESUME_PHOTO_OCR_PROVIDER_ENV]: GOOGLE_CANDIDATE_RESUME_PHOTO_OCR_PROVIDER,
                [CANDIDATE_RESUME_PHOTO_OCR_PROFILE_ENV]: "wrong-profile",
                GEMINI_API_KEY: "server-key",
            },
        })).toThrowError(expect.objectContaining({ failureClass: "provider_misconfigured" }));
    });
});
