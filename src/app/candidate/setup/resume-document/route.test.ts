import { Buffer } from "node:buffer";

import { describe, expect, it, vi } from "vitest";

import type { CandidateResumeTextArtifact } from "@/features/candidate-setup-v2/candidate-resume-text-artifact-repository";
import { CANDIDATE_RESUME_DOCUMENT_MAX_BYTES } from "@/features/candidate-setup-v2/candidate-resume-document-processing";
import {
    handleCandidateResumeDocumentProcessRequest,
    type CandidateResumeDocumentRouteDependencies,
} from "./route-implementation";

const origin = "https://interviewcoach.talentarbor.com";
const candidateProfileId = "10000000-0000-4000-8000-000000000001";
const setupOwnerKey = `candidate:${candidateProfileId}`;
const operationId = "30000000-0000-4000-8000-000000000001";

describe("candidate resume document route", () => {
    it("proves same-origin candidate identity, extracts a PDF, and exposes only the review artifact", async () => {
        const createOrRecoverReviewArtifact = vi.fn(async () => artifact());
        const sourceBytes = pdfBytes("private source bytes");
        let processorBytes: Uint8Array | null = null;
        const response = await handleCandidateResumeDocumentProcessRequest(
            request(sourceBytes, "application/pdf", "Resume July.pdf"),
            dependencies({
                createOrRecoverReviewArtifact,
                extractPdfText: vi.fn(async (bytes) => {
                    processorBytes = bytes;
                    return "Inventory lead. candidate@example.com";
                }),
            }),
        );

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toEqual({
            artifact: expect.objectContaining({
                artifactId: artifact().artifactId,
                source: "document_upload",
                candidateLabel: "Resume July.pdf",
                normalizedText: "Inventory lead. [Email removed]",
                reviewState: "awaiting_review",
            }),
        });
        expect(createOrRecoverReviewArtifact).toHaveBeenCalledWith(expect.objectContaining({
            candidateProfileId,
            source: "document_upload",
            text: "Inventory lead. candidate@example.com",
            candidateLabel: "Resume July.pdf",
            sourceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        }));
        expect(processorBytes).not.toBeNull();
        expect(Array.from(processorBytes ?? []).every((value) => value === 0)).toBe(true);
    });

    it("rejects cross-origin and unauthorized requests before consuming the body", async () => {
        const crossOriginRequest = request(pdfBytes("private content"), "application/pdf", "resume.pdf", "https://malicious.example");
        const crossOrigin = await handleCandidateResumeDocumentProcessRequest(crossOriginRequest, dependencies());
        expect(crossOrigin.status).toBe(403);
        expect(crossOriginRequest.bodyUsed).toBe(false);

        const unauthorizedRequest = new Request(`${origin}/candidate/setup/resume-document`, {
            method: "POST",
            headers: { Origin: origin, "Content-Type": "application/pdf" },
            body: pdfBytes("private content"),
            duplex: "half",
        } as RequestInit & { duplex: "half" });
        const unauthorized = await handleCandidateResumeDocumentProcessRequest(
            unauthorizedRequest,
            dependencies({ resolveIdentity: vi.fn(async () => null) }),
        );
        expect(unauthorized.status).toBe(401);
        expect(unauthorizedRequest.bodyUsed).toBe(false);
    });

    it("denies exhausted durable capacity before consuming document bytes", async () => {
        const deniedRequest = request(pdfBytes("private content"), "application/pdf", "resume.pdf");
        const response = await handleCandidateResumeDocumentProcessRequest(deniedRequest, dependencies({
            claimOperation: vi.fn(async () => ({
                outcome: "capacity_limited" as const,
                claimGeneration: 0,
                artifactId: null,
                claimExpiresAt: null,
            })),
        }));

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toMatchObject({ code: "RESUME_CAPACITY_LIMITED" });
        expect(deniedRequest.bodyUsed).toBe(false);
    });

    it("bounds the actual stream without relying on Content-Length", async () => {
        const createOrRecoverReviewArtifact = vi.fn();
        const oversized = new Uint8Array(CANDIDATE_RESUME_DOCUMENT_MAX_BYTES + 1);
        oversized.set(Buffer.from("%PDF-", "ascii"));
        const response = await handleCandidateResumeDocumentProcessRequest(
            request(oversized, "application/pdf", "resume.pdf"),
            dependencies({ createOrRecoverReviewArtifact }),
        );

        expect(response.status).toBe(413);
        await expect(response.json()).resolves.toMatchObject({ code: "RESUME_TOO_LARGE" });
        expect(createOrRecoverReviewArtifact).not.toHaveBeenCalled();
    });

    it("rejects an extension or MIME disguise using the actual signature", async () => {
        const createOrRecoverReviewArtifact = vi.fn();
        const response = await handleCandidateResumeDocumentProcessRequest(
            request(Uint8Array.from(Buffer.from("not a PDF", "utf8")), "application/pdf", "resume.pdf"),
            dependencies({ createOrRecoverReviewArtifact }),
        );

        expect(response.status).toBe(415);
        await expect(response.json()).resolves.toMatchObject({ code: "UNSUPPORTED_RESUME_TYPE" });
        expect(createOrRecoverReviewArtifact).not.toHaveBeenCalled();
    });

    it("maps parser and disposal failures to safe responses without candidate content", async () => {
        const parserFailure = await handleCandidateResumeDocumentProcessRequest(
            request(pdfBytes("candidate secret"), "application/pdf", "resume.pdf"),
            dependencies({
                extractPdfText: vi.fn(async () => {
                    throw new Error("candidate secret from C:\\private\\resume.pdf");
                }),
            }),
        );
        expect(parserFailure.status).toBe(422);
        expect(JSON.stringify(await parserFailure.json())).not.toContain("candidate secret");

        const disposalFailure = await handleCandidateResumeDocumentProcessRequest(
            request(pdfBytes("candidate secret"), "application/pdf", "resume.pdf"),
            dependencies({
                extractPdfText: vi.fn(async () => "Inventory lead."),
                disposeSource: vi.fn(() => {
                    throw new Error("candidate secret");
                }),
            }),
        );
        expect(disposalFailure.status).toBe(503);
        await expect(disposalFailure.json()).resolves.toMatchObject({ code: "SOURCE_DISPOSAL_FAILED" });
    });
});

function dependencies(overrides: {
    resolveIdentity?: CandidateResumeDocumentRouteDependencies["resolveIdentity"];
    createOrRecoverReviewArtifact?: CandidateResumeDocumentRouteDependencies["artifactRepository"]["createOrRecoverReviewArtifact"];
    extractPdfText?: CandidateResumeDocumentRouteDependencies["extractPdfText"];
    disposeSource?: CandidateResumeDocumentRouteDependencies["disposeSource"];
    claimOperation?: CandidateResumeDocumentRouteDependencies["operationRepository"]["claimOperation"];
} = {}): CandidateResumeDocumentRouteDependencies {
    return {
        now: new Date("2026-07-21T15:00:00.000Z"),
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
            claimOperation: overrides.claimOperation ?? vi.fn(async () => ({
                outcome: "acquired" as const,
                claimGeneration: 1,
                artifactId: null,
                claimExpiresAt: "2026-07-21T15:02:00.000Z",
            })),
            completeOperationAndPublish: vi.fn(async () => "completed" as const),
            failOperation: vi.fn(async () => "failed" as const),
        },
        extractPdfText: overrides.extractPdfText,
        disposeSource: overrides.disposeSource,
    };
}

function request(bytes: Uint8Array, contentType: string, name: string, requestOrigin = origin) {
    return new Request(`${origin}/candidate/setup/resume-document`, {
        method: "POST",
        headers: {
            Origin: requestOrigin,
            "Content-Type": contentType,
            "X-Resume-Document-Name": encodeURIComponent(name),
            "X-Candidate-Resume-Selection-Operation": operationId,
        },
        body: bytes,
        duplex: "half",
    } as RequestInit & { duplex: "half" });
}

function pdfBytes(content: string) {
    return Uint8Array.from(Buffer.from(`%PDF-1.4\n${content}`, "utf8"));
}

function artifact(): CandidateResumeTextArtifact {
    return {
        artifactId: "20000000-0000-4000-8000-000000000001",
        candidateProfileId,
        roleProfileId: null,
        version: 1,
        revision: 1,
        source: "document_upload",
        candidateLabel: "Resume July.pdf",
        normalizedText: "Inventory lead. [Email removed]",
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
        createdAt: "2026-07-21T15:00:00.000Z",
        acceptedAt: null,
        originalRetained: false,
    };
}
