import { createHash } from "node:crypto";

import type { CandidateResumeTextArtifact } from "./candidate-resume-text-artifact-repository";
import {
    CandidateResumePhotoOcrRuntimeError,
    type CandidateResumePhotoOcrRuntime,
} from "./candidate-resume-photo-ocr-provider";
import { CANDIDATE_RESUME_TEXT_SOURCE_MAX_LENGTH } from "./candidate-resume-text-processing";

export const CANDIDATE_RESUME_PHOTO_MAX_PAGES = 4;
export const CANDIDATE_RESUME_PHOTO_MAX_BYTES_PER_PAGE = 12 * 1024 * 1024;
export const CANDIDATE_RESUME_PHOTO_MAX_TOTAL_BYTES = 12 * 1024 * 1024;
export const CANDIDATE_RESUME_PHOTO_MAX_REQUEST_BYTES = CANDIDATE_RESUME_PHOTO_MAX_TOTAL_BYTES + 128 * 1024;
export const CANDIDATE_RESUME_PHOTO_OCR_POLICY_VERSION = "candidate_resume_photo_ocr_v1";

export const CANDIDATE_RESUME_PHOTO_MIME_TYPES = Object.freeze([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
] as const);

export type CandidateResumePhotoMimeType = typeof CANDIDATE_RESUME_PHOTO_MIME_TYPES[number];

export type CandidateResumePhotoPage = {
    bytes: Uint8Array;
    declaredMimeType: string;
    candidateLabel: string;
};

export type CandidateResumePhotoProcessingErrorCode =
    | "UNSUPPORTED_RESUME_TYPE"
    | "RESUME_TOO_LARGE"
    | "TOO_MANY_PAGES"
    | "UNREADABLE_IMAGE"
    | "OCR_NOT_CONFIGURED"
    | "OCR_TEMPORARILY_UNAVAILABLE"
    | "OCR_FAILED"
    | "EMPTY_EXTRACTION"
    | "EXTRACTED_TEXT_TOO_LARGE"
    | "SOURCE_DISPOSAL_FAILED";

export class CandidateResumePhotoProcessingError extends Error {
    readonly code: CandidateResumePhotoProcessingErrorCode;

    constructor(code: CandidateResumePhotoProcessingErrorCode) {
        super(code);
        this.name = "CandidateResumePhotoProcessingError";
        this.code = code;
    }
}

export type CandidateResumePhotoArtifactRepository = {
    createOrRecoverReviewArtifact(input: {
        candidateProfileId: string;
        source: "photo_capture";
        text: string;
        candidateLabel: string;
        sourceFingerprint: string;
        now: Date;
    }): Promise<CandidateResumeTextArtifact>;
};

export type CandidateResumePhotoProcessingDependencies = {
    artifactRepository: CandidateResumePhotoArtifactRepository;
    ocrRuntime: CandidateResumePhotoOcrRuntime;
    disposeSource: (pages: CandidateResumePhotoPage[]) => Promise<void> | void;
};

export async function processCandidateResumePhotoUpload(input: {
    candidateProfileId: string;
    pages: CandidateResumePhotoPage[];
    now: Date;
}, dependencies: CandidateResumePhotoProcessingDependencies): Promise<CandidateResumeTextArtifact> {
    let combinedText: string | null = null;
    let sourceFingerprint: string | null = null;
    let processingError: unknown = null;

    try {
        const validatedPages = validateCandidateResumePhotoPages(input.pages);
        sourceFingerprint = fingerprintCandidateResumePhotoPages(
            validatedPages,
            dependencies.ocrRuntime.configurationFingerprint,
        );
        const result = await dependencies.ocrRuntime.ocr({
            pages: validatedPages.map((page, index) => ({
                pageNumber: index + 1,
                bytes: page.bytes,
                mimeType: page.mimeType,
            })),
        });
        if (
            result.pages.length !== validatedPages.length
            || result.pages.some((page, index) => (
                page.pageNumber !== index + 1
                || typeof page.text !== "string"
                || !page.text.trim()
            ))
        ) {
            throw new CandidateResumePhotoProcessingError("EMPTY_EXTRACTION");
        }
        combinedText = result.pages.map((page) => page.text.trim()).join("\n\n").trim();
        if (!combinedText) {
            throw new CandidateResumePhotoProcessingError("EMPTY_EXTRACTION");
        }
        if (combinedText.length > CANDIDATE_RESUME_TEXT_SOURCE_MAX_LENGTH) {
            throw new CandidateResumePhotoProcessingError("EXTRACTED_TEXT_TOO_LARGE");
        }
    } catch (error) {
        processingError = normalizeCandidateResumePhotoError(error);
    }

    try {
        await dependencies.disposeSource(input.pages);
    } catch {
        throw new CandidateResumePhotoProcessingError("SOURCE_DISPOSAL_FAILED");
    }

    if (processingError) throw processingError;
    if (!combinedText || !sourceFingerprint) {
        throw new CandidateResumePhotoProcessingError("OCR_FAILED");
    }

    return dependencies.artifactRepository.createOrRecoverReviewArtifact({
        candidateProfileId: input.candidateProfileId,
        source: "photo_capture",
        text: combinedText,
        candidateLabel: input.pages.length === 1
            ? input.pages[0]?.candidateLabel || "Resume photo"
            : `${input.pages.length} resume photos`,
        sourceFingerprint,
        now: input.now,
    });
}

export function validateCandidateResumePhotoPages(pages: CandidateResumePhotoPage[]) {
    if (pages.length === 0) {
        throw new CandidateResumePhotoProcessingError("UNREADABLE_IMAGE");
    }
    if (pages.length > CANDIDATE_RESUME_PHOTO_MAX_PAGES) {
        throw new CandidateResumePhotoProcessingError("TOO_MANY_PAGES");
    }

    let totalBytes = 0;
    return pages.map((page) => {
        if (page.bytes.byteLength === 0) {
            throw new CandidateResumePhotoProcessingError("UNREADABLE_IMAGE");
        }
        if (page.bytes.byteLength > CANDIDATE_RESUME_PHOTO_MAX_BYTES_PER_PAGE) {
            throw new CandidateResumePhotoProcessingError("RESUME_TOO_LARGE");
        }
        totalBytes += page.bytes.byteLength;
        if (totalBytes > CANDIDATE_RESUME_PHOTO_MAX_TOTAL_BYTES) {
            throw new CandidateResumePhotoProcessingError("RESUME_TOO_LARGE");
        }

        const actualMimeType = detectCandidateResumePhotoMimeType(page.bytes);
        const declaredMimeType = page.declaredMimeType.split(";", 1)[0]?.trim().toLowerCase();
        if (!actualMimeType || !declaredTypeMatchesActual(declaredMimeType, actualMimeType)) {
            throw new CandidateResumePhotoProcessingError("UNSUPPORTED_RESUME_TYPE");
        }
        return { ...page, mimeType: actualMimeType };
    });
}

export function detectCandidateResumePhotoMimeType(bytes: Uint8Array): CandidateResumePhotoMimeType | null {
    if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
    if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
    if (
        bytes.byteLength >= 12
        && readAscii(bytes, 0, 4) === "RIFF"
        && readAscii(bytes, 8, 12) === "WEBP"
    ) {
        return "image/webp";
    }
    return detectIsoImageMimeType(bytes);
}

function detectIsoImageMimeType(bytes: Uint8Array): CandidateResumePhotoMimeType | null {
    if (bytes.byteLength < 16 || readAscii(bytes, 4, 8) !== "ftyp") return null;
    const boxSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, false);
    if (boxSize < 16 || boxSize > bytes.byteLength) return null;
    const brands: string[] = [];
    for (let offset = 8; offset + 4 <= boxSize; offset += 4) {
        if (offset === 12) continue;
        brands.push(readAscii(bytes, offset, offset + 4));
    }
    if (brands.some((brand) => ["heic", "heix", "hevc", "hevx", "heim", "heis"].includes(brand))) {
        return "image/heic";
    }
    if (brands.some((brand) => ["mif1", "msf1"].includes(brand))) {
        return "image/heif";
    }
    return null;
}

function fingerprintCandidateResumePhotoPages(
    pages: ReturnType<typeof validateCandidateResumePhotoPages>,
    configurationFingerprint: string,
) {
    const hash = createHash("sha256")
        .update(CANDIDATE_RESUME_PHOTO_OCR_POLICY_VERSION, "utf8")
        .update("\0", "utf8")
        .update(configurationFingerprint, "utf8");
    for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index]!;
        hash.update("\0", "utf8")
            .update(String(index + 1), "utf8")
            .update("\0", "utf8")
            .update(page.mimeType, "utf8")
            .update("\0", "utf8")
            .update(page.bytes);
    }
    return hash.digest("hex");
}

function normalizeCandidateResumePhotoError(error: unknown) {
    if (error instanceof CandidateResumePhotoProcessingError) return error;
    if (error instanceof CandidateResumePhotoOcrRuntimeError) {
        if (["provider_not_configured", "provider_misconfigured", "fixture_not_allowed"].includes(error.failureClass)) {
            return new CandidateResumePhotoProcessingError("OCR_NOT_CONFIGURED");
        }
        if (["provider_timeout", "provider_rate_limited", "provider_unavailable"].includes(error.failureClass)) {
            return new CandidateResumePhotoProcessingError("OCR_TEMPORARILY_UNAVAILABLE");
        }
        return new CandidateResumePhotoProcessingError("OCR_FAILED");
    }
    return new CandidateResumePhotoProcessingError("OCR_FAILED");
}

function declaredTypeMatchesActual(declared: string, actual: CandidateResumePhotoMimeType) {
    if (!declared || declared === "application/octet-stream") return true;
    if (declared === actual) return true;
    return (declared === "image/heic" || declared === "image/heif")
        && (actual === "image/heic" || actual === "image/heif");
}

function hasPrefix(bytes: Uint8Array, prefix: number[]) {
    return bytes.byteLength >= prefix.length && prefix.every((value, index) => bytes[index] === value);
}

function readAscii(bytes: Uint8Array, start: number, end: number) {
    let value = "";
    for (let index = start; index < end; index += 1) {
        value += String.fromCharCode(bytes[index] ?? 0);
    }
    return value;
}
