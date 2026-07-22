import { createHash } from "node:crypto";

import {
    GOOGLE_CANDIDATE_RESUME_PHOTO_OCR_API_KEY_ENV,
    GOOGLE_CANDIDATE_RESUME_PHOTO_OCR_PROFILE_ID,
    GOOGLE_CANDIDATE_RESUME_PHOTO_OCR_PROVIDER,
    createGoogleCandidateResumePhotoOcrRuntime,
    createGoogleCandidateResumePhotoOcrTransport,
    type GoogleCandidateResumePhotoOcrTransport,
} from "./google-candidate-resume-photo-ocr";
import {
    CandidateResumePhotoOcrRuntimeError,
    type CandidateResumePhotoOcrRuntime,
} from "./candidate-resume-photo-ocr-provider";

export {
    CandidateResumePhotoOcrRuntimeError,
    type CandidateResumePhotoOcrFailureClass,
    type CandidateResumePhotoOcrPageInput,
    type CandidateResumePhotoOcrPageResult,
    type CandidateResumePhotoOcrRuntime,
} from "./candidate-resume-photo-ocr-provider";

export const CANDIDATE_RESUME_PHOTO_OCR_PROVIDER_ENV = "CANDIDATE_RESUME_OCR_PROVIDER" as const;
export const CANDIDATE_RESUME_PHOTO_OCR_PROFILE_ENV = "CANDIDATE_RESUME_OCR_PROFILE" as const;
export const CANDIDATE_RESUME_PHOTO_OCR_FIXTURE_ENABLED_ENV = "CANDIDATE_RESUME_OCR_FIXTURE_ENABLED" as const;
export const CANDIDATE_RESUME_PHOTO_OCR_FIXTURE_PROVIDER = "fixture" as const;
export const CANDIDATE_RESUME_PHOTO_OCR_FIXTURE_PROFILE_ID = "fixture_resume_photo_ocr_v1" as const;

export function createCandidateResumePhotoOcrRuntimeFromEnvironment(input: {
    env: NodeJS.ProcessEnv;
    googleTransportFactory?: (apiKey: string) => GoogleCandidateResumePhotoOcrTransport;
}): CandidateResumePhotoOcrRuntime {
    const provider = input.env[CANDIDATE_RESUME_PHOTO_OCR_PROVIDER_ENV]?.trim().toLowerCase();
    const profileId = input.env[CANDIDATE_RESUME_PHOTO_OCR_PROFILE_ENV]?.trim();

    if (provider === GOOGLE_CANDIDATE_RESUME_PHOTO_OCR_PROVIDER) {
        if (profileId !== GOOGLE_CANDIDATE_RESUME_PHOTO_OCR_PROFILE_ID) {
            throw new CandidateResumePhotoOcrRuntimeError("provider_misconfigured");
        }
        const apiKey = input.env[GOOGLE_CANDIDATE_RESUME_PHOTO_OCR_API_KEY_ENV]?.trim();
        if (!apiKey) throw new CandidateResumePhotoOcrRuntimeError("provider_misconfigured");
        return createGoogleCandidateResumePhotoOcrRuntime({
            transport: (input.googleTransportFactory ?? createGoogleCandidateResumePhotoOcrTransport)(apiKey),
        });
    }

    if (
        provider !== CANDIDATE_RESUME_PHOTO_OCR_FIXTURE_PROVIDER
        || profileId !== CANDIDATE_RESUME_PHOTO_OCR_FIXTURE_PROFILE_ID
    ) {
        throw new CandidateResumePhotoOcrRuntimeError("provider_not_configured");
    }
    if (
        input.env[CANDIDATE_RESUME_PHOTO_OCR_FIXTURE_ENABLED_ENV]?.trim().toLowerCase() !== "true"
        || input.env.NODE_ENV === "production"
        || input.env.VERCEL_ENV === "production"
    ) {
        throw new CandidateResumePhotoOcrRuntimeError("fixture_not_allowed");
    }

    const configurationFingerprint = createHash("sha256").update(JSON.stringify({
        contract: "ordered_resume_photo_transcription_only",
        modelName: "deterministic-fixture-resume-ocr",
        profileId,
        provider,
        schemaVersion: 1,
    })).digest("hex");

    return {
        provider,
        profileId,
        modelName: "deterministic-fixture-resume-ocr",
        configurationFingerprint,
        async ocr({ pages }) {
            return {
                pages: pages.map((page) => ({
                    pageNumber: page.pageNumber,
                    text: `Page ${page.pageNumber}: Inventory, shipping, and customer service experience.`,
                })),
            };
        },
    };
}
