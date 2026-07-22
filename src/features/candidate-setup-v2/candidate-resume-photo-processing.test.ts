import { Buffer } from "node:buffer";

import { describe, expect, it, vi } from "vitest";

import type { CandidateResumeTextArtifact } from "./candidate-resume-text-artifact-repository";
import {
    CandidateResumePhotoOcrRuntimeError,
    type CandidateResumePhotoOcrRuntime,
} from "./candidate-resume-photo-ocr-provider";
import {
    detectCandidateResumePhotoMimeType,
    processCandidateResumePhotoUpload,
    validateCandidateResumePhotoPages,
} from "./candidate-resume-photo-processing";

describe("candidate resume photo processing", () => {
    it("preserves page order, disposes source bytes, then creates one photo review artifact", async () => {
        const events: string[] = [];
        const pages = [
            page(jpegBytes("page-one"), "one.jpg"),
            page(pngBytes("page-two"), "two.png", "image/png"),
        ];
        const ocr = vi.fn(async (input: Parameters<CandidateResumePhotoOcrRuntime["ocr"]>[0]) => {
            events.push("ocr");
            expect(input.pages.map((item) => [item.pageNumber, item.mimeType])).toEqual([
                [1, "image/jpeg"],
                [2, "image/png"],
            ]);
            return {
                pages: [
                    { pageNumber: 1, text: "Inventory lead." },
                    { pageNumber: 2, text: "candidate@example.com\nShipping coordinator." },
                ],
            };
        });
        const createOrRecoverReviewArtifact = vi.fn(async (input) => {
            events.push("persist");
            expect(pages.every((item) => Array.from(item.bytes).every((value) => value === 0))).toBe(true);
            expect(input).toMatchObject({
                source: "photo_capture",
                text: "Inventory lead.\n\ncandidate@example.com\nShipping coordinator.",
                candidateLabel: "2 resume photos",
                sourceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
            });
            return artifact();
        });

        const result = await processCandidateResumePhotoUpload({
            candidateProfileId: artifact().candidateProfileId,
            pages,
            now: new Date("2026-07-21T18:00:00.000Z"),
        }, {
            artifactRepository: { createOrRecoverReviewArtifact },
            ocrRuntime: runtime(ocr),
            disposeSource: (sourcePages) => {
                events.push("dispose");
                sourcePages.forEach((item) => item.bytes.fill(0));
            },
        });

        expect(result.source).toBe("photo_capture");
        expect(events).toEqual(["ocr", "dispose", "persist"]);
    });

    it("recognizes the five ratified image containers and rejects a MIME disguise", () => {
        expect(detectCandidateResumePhotoMimeType(jpegBytes())).toBe("image/jpeg");
        expect(detectCandidateResumePhotoMimeType(pngBytes())).toBe("image/png");
        expect(detectCandidateResumePhotoMimeType(webpBytes())).toBe("image/webp");
        expect(detectCandidateResumePhotoMimeType(heifBytes("heic"))).toBe("image/heic");
        expect(detectCandidateResumePhotoMimeType(heifBytes("mif1"))).toBe("image/heif");
        expect(() => validateCandidateResumePhotoPages([
            page(jpegBytes(), "fake.png", "image/png"),
        ])).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_RESUME_TYPE" }));
    });

    it("rejects empty and surplus page sets before OCR", () => {
        expect(() => validateCandidateResumePhotoPages([])).toThrowError(
            expect.objectContaining({ code: "UNREADABLE_IMAGE" }),
        );
        expect(() => validateCandidateResumePhotoPages(Array.from({ length: 5 }, (_, index) => (
            page(jpegBytes(String(index)), `${index}.jpg`)
        )))).toThrowError(expect.objectContaining({ code: "TOO_MANY_PAGES" }));
    });

    it("allows one modern camera image above 5 MiB while preserving the 12 MiB batch ceiling", () => {
        const cameraBytes = new Uint8Array(6 * 1024 * 1024);
        cameraBytes.set([0xff, 0xd8, 0xff], 0);
        expect(validateCandidateResumePhotoPages([
            page(cameraBytes, "camera.jpg"),
        ])).toHaveLength(1);

        const oversizedBytes = new Uint8Array((12 * 1024 * 1024) + 1);
        oversizedBytes.set([0xff, 0xd8, 0xff], 0);
        expect(() => validateCandidateResumePhotoPages([
            page(oversizedBytes, "too-large.jpg"),
        ])).toThrowError(expect.objectContaining({ code: "RESUME_TOO_LARGE" }));
    });

    it("disposes every source and performs no persistence when OCR fails", async () => {
        const pages = [page(jpegBytes("private"), "resume.jpg")];
        const createOrRecoverReviewArtifact = vi.fn();

        await expect(processCandidateResumePhotoUpload({
            candidateProfileId: artifact().candidateProfileId,
            pages,
            now: new Date(),
        }, {
            artifactRepository: { createOrRecoverReviewArtifact },
            ocrRuntime: runtime(async () => {
                throw new CandidateResumePhotoOcrRuntimeError("provider_timeout");
            }),
            disposeSource: (sourcePages) => sourcePages.forEach((item) => item.bytes.fill(0)),
        })).rejects.toEqual(expect.objectContaining({ code: "OCR_TEMPORARILY_UNAVAILABLE" }));

        expect(pages.every((item) => Array.from(item.bytes).every((value) => value === 0))).toBe(true);
        expect(createOrRecoverReviewArtifact).not.toHaveBeenCalled();
    });

    it("rejects a missing page transcription and an oversized combined transcript before persistence", async () => {
        const createOrRecoverReviewArtifact = vi.fn();
        const input = {
            candidateProfileId: artifact().candidateProfileId,
            pages: [
                page(jpegBytes("page-one"), "one.jpg"),
                page(pngBytes("page-two"), "two.png", "image/png"),
            ],
            now: new Date(),
        };

        await expect(processCandidateResumePhotoUpload(input, {
            artifactRepository: { createOrRecoverReviewArtifact },
            ocrRuntime: runtime(async () => ({
                pages: [
                    { pageNumber: 1, text: "Inventory lead." },
                    { pageNumber: 2, text: "" },
                ],
            })),
            disposeSource: (sourcePages) => sourcePages.forEach((item) => item.bytes.fill(0)),
        })).rejects.toEqual(expect.objectContaining({ code: "EMPTY_EXTRACTION" }));

        const oversizedPages = [page(jpegBytes("page-one"), "one.jpg")];
        await expect(processCandidateResumePhotoUpload({ ...input, pages: oversizedPages }, {
            artifactRepository: { createOrRecoverReviewArtifact },
            ocrRuntime: runtime(async () => ({
                pages: [{ pageNumber: 1, text: "a".repeat(64_001) }],
            })),
            disposeSource: (sourcePages) => sourcePages.forEach((item) => item.bytes.fill(0)),
        })).rejects.toEqual(expect.objectContaining({ code: "EXTRACTED_TEXT_TOO_LARGE" }));

        expect(createOrRecoverReviewArtifact).not.toHaveBeenCalled();
    });

    it("fails closed before persistence when disposal cannot be proven", async () => {
        const createOrRecoverReviewArtifact = vi.fn();
        await expect(processCandidateResumePhotoUpload({
            candidateProfileId: artifact().candidateProfileId,
            pages: [page(jpegBytes(), "resume.jpg")],
            now: new Date(),
        }, {
            artifactRepository: { createOrRecoverReviewArtifact },
            ocrRuntime: runtime(async () => ({ pages: [{ pageNumber: 1, text: "Inventory lead." }] })),
            disposeSource: () => {
                throw new Error("disposal failed");
            },
        })).rejects.toEqual(expect.objectContaining({ code: "SOURCE_DISPOSAL_FAILED" }));
        expect(createOrRecoverReviewArtifact).not.toHaveBeenCalled();
    });
});

function runtime(ocr: CandidateResumePhotoOcrRuntime["ocr"]): CandidateResumePhotoOcrRuntime {
    return {
        provider: "fixture",
        profileId: "fixture_resume_photo_ocr_v1",
        modelName: "fixture",
        configurationFingerprint: "f".repeat(64),
        ocr,
    };
}

function page(bytes: Uint8Array, candidateLabel: string, declaredMimeType = "image/jpeg") {
    return { bytes, candidateLabel, declaredMimeType };
}

function jpegBytes(content = "resume") {
    return Uint8Array.from(Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff]),
        Buffer.from(content),
    ]));
}

function pngBytes(content = "resume") {
    return Uint8Array.from(Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from(content),
    ]));
}

function webpBytes() {
    return Uint8Array.from(Buffer.from("RIFF\u0004\u0000\u0000\u0000WEBPdata", "binary"));
}

function heifBytes(brand: "heic" | "mif1") {
    const bytes = Buffer.alloc(24);
    bytes.writeUInt32BE(24, 0);
    bytes.write("ftyp", 4, "ascii");
    bytes.write(brand, 8, "ascii");
    bytes.writeUInt32BE(0, 12);
    bytes.write(brand, 16, "ascii");
    bytes.write("mif1", 20, "ascii");
    return Uint8Array.from(bytes);
}

function artifact(): CandidateResumeTextArtifact {
    return {
        artifactId: "20000000-0000-4000-8000-000000000001",
        candidateProfileId: "10000000-0000-4000-8000-000000000001",
        roleProfileId: null,
        version: 1,
        revision: 1,
        source: "photo_capture",
        candidateLabel: "2 resume photos",
        normalizedText: "Inventory lead.",
        sourceFingerprint: "a".repeat(64),
        normalizedTextFingerprint: "b".repeat(64),
        processingPolicyVersion: "candidate_resume_text_processing_v1",
        piiPolicyVersion: "candidate_resume_direct_pii_v5",
        piiRedactionCounts: {
            known_name: 0,
            personal_detail: 0,
            email: 0,
            phone: 0,
            address: 0,
            date_of_birth: 0,
            government_identifier: 0,
            personal_url_or_handle: 0,
        },
        reviewState: "awaiting_review",
        createdAt: "2026-07-21T18:00:00.000Z",
        acceptedAt: null,
        originalRetained: false,
    };
}
