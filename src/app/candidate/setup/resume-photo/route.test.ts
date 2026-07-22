import { Buffer } from "node:buffer";

import { describe, expect, it, vi } from "vitest";

import type { CandidateResumeTextArtifact } from "@/features/candidate-setup-v2/candidate-resume-text-artifact-repository";
import type { CandidateResumePhotoOcrRuntime } from "@/features/candidate-setup-v2/candidate-resume-photo-ocr-provider";
import { CandidateResumePhotoOcrRuntimeError } from "@/features/candidate-setup-v2/candidate-resume-photo-ocr-runtime";
import {
    CANDIDATE_RESUME_PHOTO_MAX_REQUEST_BYTES,
} from "@/features/candidate-setup-v2/candidate-resume-photo-processing";
import {
    handleCandidateResumePhotoProcessRequest,
    type CandidateResumePhotoRouteDependencies,
} from "./route-implementation";

const origin = "https://interviewcoach.talentarbor.com";
const candidateProfileId = "10000000-0000-4000-8000-000000000001";
const setupOwnerKey = `candidate:${candidateProfileId}`;
const operationId = "30000000-0000-4000-8000-000000000001";

describe("candidate resume photo route", () => {
    it("proves identity, preserves multipart page order, disposes bytes, and exposes only review text", async () => {
        let observedPages: Array<{ pageNumber: number; bytes: Uint8Array; mimeType: string }> = [];
        const createOrRecoverReviewArtifact = vi.fn(async (input) => {
            expect(observedPages.every((page) => Array.from(page.bytes).every((value) => value === 0))).toBe(true);
            expect(input).toMatchObject({
                candidateProfileId,
                source: "photo_capture",
                text: "Inventory lead.\n\ncandidate@example.com\nShipping coordinator.",
                candidateLabel: "2 resume photos",
            });
            return artifact();
        });
        const response = await handleCandidateResumePhotoProcessRequest(
            photoRequest([
                photoFile(jpegBytes("first-private-page"), "page-1.jpg", "image/jpeg"),
                photoFile(pngBytes("second-private-page"), "page-2.png", "image/png"),
            ]),
            dependencies({
                createOrRecoverReviewArtifact,
                ocr: vi.fn(async ({ pages }) => {
                    observedPages = pages;
                    return {
                        pages: [
                            { pageNumber: 1, text: "Inventory lead." },
                            { pageNumber: 2, text: "candidate@example.com\nShipping coordinator." },
                        ],
                    };
                }),
            }),
        );

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toEqual({
            artifact: expect.objectContaining({
                source: "photo_capture",
                candidateLabel: "2 resume photos",
                normalizedText: "Inventory lead.\n\n[Email removed]\nShipping coordinator.",
            }),
        });
        expect(observedPages.map((page) => [page.pageNumber, page.mimeType])).toEqual([
            [1, "image/jpeg"],
            [2, "image/png"],
        ]);
    });

    it("rejects cross-origin and unauthorized requests before consuming image bytes", async () => {
        const crossOriginRequest = photoRequest([
            photoFile(jpegBytes(), "resume.jpg", "image/jpeg"),
        ], "https://malicious.example");
        const crossOrigin = await handleCandidateResumePhotoProcessRequest(crossOriginRequest, dependencies());
        expect(crossOrigin.status).toBe(403);
        expect(crossOriginRequest.bodyUsed).toBe(false);

        const unauthorizedRequest = photoRequest([
            photoFile(jpegBytes(), "resume.jpg", "image/jpeg"),
        ]);
        const unauthorized = await handleCandidateResumePhotoProcessRequest(
            unauthorizedRequest,
            dependencies({ resolveIdentity: vi.fn(async () => null) }),
        );
        expect(unauthorized.status).toBe(401);
        expect(unauthorizedRequest.bodyUsed).toBe(false);
    });

    it("rejects surplus pages, MIME disguises, and declared oversized requests before persistence", async () => {
        const createOrRecoverReviewArtifact = vi.fn();
        const surplus = await handleCandidateResumePhotoProcessRequest(
            photoRequest(Array.from({ length: 5 }, (_, index) => (
                photoFile(jpegBytes(String(index)), `${index}.jpg`, "image/jpeg")
            ))),
            dependencies({ createOrRecoverReviewArtifact }),
        );
        expect(surplus.status).toBe(413);
        await expect(surplus.json()).resolves.toMatchObject({ code: "TOO_MANY_PAGES" });

        const disguise = await handleCandidateResumePhotoProcessRequest(
            photoRequest([photoFile(Buffer.from("not an image"), "resume.png", "image/png")]),
            dependencies({ createOrRecoverReviewArtifact }),
        );
        expect(disguise.status).toBe(415);
        await expect(disguise.json()).resolves.toMatchObject({ code: "UNSUPPORTED_RESUME_TYPE" });

        const declaredLarge = photoRequest([photoFile(jpegBytes(), "resume.jpg", "image/jpeg")]);
        declaredLarge.headers.set("content-length", String(CANDIDATE_RESUME_PHOTO_MAX_REQUEST_BYTES + 1));
        const large = await handleCandidateResumePhotoProcessRequest(declaredLarge, dependencies({ createOrRecoverReviewArtifact }));
        expect(large.status).toBe(413);
        expect(declaredLarge.bodyUsed).toBe(false);
        expect(createOrRecoverReviewArtifact).not.toHaveBeenCalled();
    });

    it("maps OCR failures to safe responses without provider or candidate detail", async () => {
        const response = await handleCandidateResumePhotoProcessRequest(
            photoRequest([photoFile(jpegBytes("candidate secret"), "private.jpg", "image/jpeg")]),
            dependencies({
                ocr: vi.fn(async () => {
                    throw new CandidateResumePhotoOcrRuntimeError("provider_timeout");
                }),
            }),
        );
        expect(response.status).toBe(503);
        const body = JSON.stringify(await response.json());
        expect(body).toContain("OCR_TEMPORARILY_UNAVAILABLE");
        expect(body).not.toContain("candidate secret");
        expect(body).not.toContain("provider_timeout");
    });
});

function dependencies(overrides: {
    resolveIdentity?: CandidateResumePhotoRouteDependencies["resolveIdentity"];
    createOrRecoverReviewArtifact?: CandidateResumePhotoRouteDependencies["artifactRepository"]["createOrRecoverReviewArtifact"];
    ocr?: CandidateResumePhotoRouteDependencies["ocrRuntime"]["ocr"];
} = {}): CandidateResumePhotoRouteDependencies {
    return {
        now: new Date("2026-07-21T18:00:00.000Z"),
        resolveIdentity: overrides.resolveIdentity ?? vi.fn(async () => ({ candidateProfileId, setupOwnerKey })),
        artifactRepository: {
            createOrRecoverReviewArtifact: overrides.createOrRecoverReviewArtifact ?? vi.fn(async () => artifact()),
            recoverSelectedArtifact: vi.fn(async () => artifact()),
        },
        selectionRepository: {
            beginSelectionOperation: vi.fn(async () => ({ revision: 1 })),
            abandonSelectionOperation: vi.fn(async () => false),
        },
        operationRepository: {
            claimOperation: vi.fn(async () => ({
                outcome: "acquired" as const,
                claimGeneration: 1,
                artifactId: null,
                claimExpiresAt: "2026-07-21T18:01:00.000Z",
            })),
            completeOperationAndPublish: vi.fn(async () => "completed" as const),
            failOperation: vi.fn(async () => "failed" as const),
        },
        ocrRuntime: {
            provider: "fixture",
            profileId: "fixture_resume_photo_ocr_v1",
            modelName: "fixture",
            configurationFingerprint: "f".repeat(64),
            ocr: overrides.ocr ?? vi.fn(async ({ pages }: Parameters<CandidateResumePhotoOcrRuntime["ocr"]>[0]) => ({
                pages: pages.map((page) => ({ pageNumber: page.pageNumber, text: "Inventory lead." })),
            })),
        },
    };
}

function photoRequest(files: Array<{ bytes: Uint8Array; name: string; type: string }>, requestOrigin = origin) {
    const boundary = "candidate-resume-photo-test-boundary";
    const chunks: Buffer[] = [];
    files.forEach((file) => {
        chunks.push(Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="pages"; filename="${file.name}"\r\n`
            + `Content-Type: ${file.type}\r\n\r\n`,
            "utf8",
        ));
        chunks.push(Buffer.from(file.bytes));
        chunks.push(Buffer.from("\r\n", "ascii"));
    });
    chunks.push(Buffer.from(`--${boundary}--\r\n`, "ascii"));
    return new Request(`${origin}/candidate/setup/resume-photo`, {
        method: "POST",
        headers: {
            Origin: requestOrigin,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "X-Candidate-Resume-Selection-Operation": operationId,
        },
        body: Buffer.concat(chunks),
        duplex: "half",
    } as RequestInit & { duplex: "half" });
}

function photoFile(bytes: Uint8Array, name: string, type: string) {
    return { bytes, name, type };
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

function artifact(): CandidateResumeTextArtifact {
    return {
        artifactId: "20000000-0000-4000-8000-000000000001",
        candidateProfileId,
        roleProfileId: null,
        version: 1,
        revision: 1,
        source: "photo_capture",
        candidateLabel: "2 resume photos",
        normalizedText: "Inventory lead.\n\n[Email removed]\nShipping coordinator.",
        sourceFingerprint: "a".repeat(64),
        normalizedTextFingerprint: "b".repeat(64),
        processingPolicyVersion: "candidate_resume_text_processing_v1",
        piiPolicyVersion: "candidate_resume_direct_pii_v5",
        piiRedactionCounts: {
            known_name: 0,
            personal_detail: 0,
            email: 1,
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
