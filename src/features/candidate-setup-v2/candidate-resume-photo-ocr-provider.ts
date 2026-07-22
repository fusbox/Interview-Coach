import type { CandidateResumePhotoMimeType } from "./candidate-resume-photo-processing";

export type CandidateResumePhotoOcrPageInput = {
    pageNumber: number;
    bytes: Uint8Array;
    mimeType: CandidateResumePhotoMimeType;
};

export type CandidateResumePhotoOcrPageResult = {
    pageNumber: number;
    text: string;
};

export type CandidateResumePhotoOcrRuntime = {
    provider: string;
    profileId: string;
    modelName: string;
    configurationFingerprint: string;
    ocr: (input: { pages: CandidateResumePhotoOcrPageInput[] }) => Promise<{
        pages: CandidateResumePhotoOcrPageResult[];
    }>;
};

export type CandidateResumePhotoOcrFailureClass =
    | "provider_not_configured"
    | "provider_misconfigured"
    | "fixture_not_allowed"
    | "provider_timeout"
    | "provider_rate_limited"
    | "provider_unavailable"
    | "provider_request_rejected"
    | "provider_safety_blocked"
    | "provider_output_invalid";

export class CandidateResumePhotoOcrRuntimeError extends Error {
    readonly failureClass: CandidateResumePhotoOcrFailureClass;

    constructor(failureClass: CandidateResumePhotoOcrFailureClass) {
        super(failureClass);
        this.name = "CandidateResumePhotoOcrRuntimeError";
        this.failureClass = failureClass;
    }
}
