import { Buffer } from "node:buffer";

import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";

import type { CandidateResumeTextArtifact } from "./candidate-resume-text-artifact-repository";
import {
    CANDIDATE_RESUME_DOCX_MIME_TYPE,
    CANDIDATE_RESUME_PDF_MIME_TYPE,
    extractDocxResumeText,
    extractPdfResumeText,
    processCandidateResumeDocumentUpload,
    validateCandidateResumeDocument,
} from "./candidate-resume-document-processing";

const candidateProfileId = "10000000-0000-4000-8000-000000000001";

describe("candidate resume document processing", () => {
    it("commits only extracted text and disposes source bytes before reporting success", async () => {
        const events: string[] = [];
        const sourceBytes = Uint8Array.from(Buffer.from("%PDF-1.4\nfixture", "ascii"));
        const createOrRecoverReviewArtifact = vi.fn(async (input) => {
            events.push("artifact_committed");
            expect(input.text).toBe("Warehouse lead with shipping experience.");
            expect(input.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
            return artifact();
        });

        const result = await processCandidateResumeDocumentUpload({
            candidateProfileId,
            sourceBytes,
            declaredMimeType: CANDIDATE_RESUME_PDF_MIME_TYPE,
            candidateLabel: "resume.pdf",
            now: new Date("2026-07-21T15:00:00.000Z"),
        }, {
            artifactRepository: { createOrRecoverReviewArtifact },
            extractPdfText: vi.fn(async () => {
                events.push("text_extracted");
                return "Warehouse lead with shipping experience.";
            }),
            disposeSource: vi.fn((bytes) => {
                events.push("source_disposed");
                bytes.fill(0);
            }),
        });

        expect(result.source).toBe("document_upload");
        expect(events).toEqual(["text_extracted", "source_disposed", "artifact_committed"]);
        expect(Array.from(sourceBytes).every((value) => value === 0)).toBe(true);
    });

    it("disposes source bytes on extraction failure and never writes an artifact", async () => {
        const sourceBytes = Uint8Array.from(Buffer.from("%PDF-1.4\nfixture", "ascii"));
        const createOrRecoverReviewArtifact = vi.fn();

        await expect(processCandidateResumeDocumentUpload({
            candidateProfileId,
            sourceBytes,
            declaredMimeType: CANDIDATE_RESUME_PDF_MIME_TYPE,
            candidateLabel: "resume.pdf",
            now: new Date("2026-07-21T15:00:00.000Z"),
        }, {
            artifactRepository: { createOrRecoverReviewArtifact },
            extractPdfText: vi.fn(async () => {
                throw new Error("C:\\private\\resume.pdf included candidate content");
            }),
        })).rejects.toMatchObject({ code: "EXTRACTION_FAILED" });

        expect(createOrRecoverReviewArtifact).not.toHaveBeenCalled();
        expect(Array.from(sourceBytes).every((value) => value === 0)).toBe(true);
    });

    it("treats an image-only document as empty extraction and still disposes it", async () => {
        const sourceBytes = Uint8Array.from(Buffer.from("%PDF-1.4\nfixture", "ascii"));
        const createOrRecoverReviewArtifact = vi.fn();

        await expect(processCandidateResumeDocumentUpload({
            candidateProfileId,
            sourceBytes,
            declaredMimeType: CANDIDATE_RESUME_PDF_MIME_TYPE,
            candidateLabel: "scan.pdf",
            now: new Date("2026-07-21T15:00:00.000Z"),
        }, {
            artifactRepository: { createOrRecoverReviewArtifact },
            extractPdfText: vi.fn(async () => "  \n "),
        })).rejects.toMatchObject({ code: "EMPTY_EXTRACTION" });

        expect(createOrRecoverReviewArtifact).not.toHaveBeenCalled();
        expect(Array.from(sourceBytes).every((value) => value === 0)).toBe(true);
    });

    it("fails closed before persistence when source disposal cannot be confirmed", async () => {
        const createOrRecoverReviewArtifact = vi.fn(async () => artifact());
        await expect(processCandidateResumeDocumentUpload({
            candidateProfileId,
            sourceBytes: Uint8Array.from(Buffer.from("%PDF-1.4\nfixture", "ascii")),
            declaredMimeType: CANDIDATE_RESUME_PDF_MIME_TYPE,
            candidateLabel: "resume.pdf",
            now: new Date("2026-07-21T15:00:00.000Z"),
        }, {
            artifactRepository: { createOrRecoverReviewArtifact },
            extractPdfText: vi.fn(async () => "Warehouse lead with shipping experience."),
            disposeSource: vi.fn(() => {
                throw new Error("dispose failed");
            }),
        })).rejects.toMatchObject({ code: "SOURCE_DISPOSAL_FAILED" });

        expect(createOrRecoverReviewArtifact).not.toHaveBeenCalled();
    });

    it("keeps source bytes disposed when processed-artifact persistence fails", async () => {
        const sourceBytes = Uint8Array.from(Buffer.from("%PDF-1.4\nfixture", "ascii"));

        await expect(processCandidateResumeDocumentUpload({
            candidateProfileId,
            sourceBytes,
            declaredMimeType: CANDIDATE_RESUME_PDF_MIME_TYPE,
            candidateLabel: "resume.pdf",
            now: new Date("2026-07-21T15:00:00.000Z"),
        }, {
            artifactRepository: {
                createOrRecoverReviewArtifact: vi.fn(async () => {
                    throw new Error("database unavailable");
                }),
            },
            extractPdfText: vi.fn(async () => "Warehouse lead with shipping experience."),
        })).rejects.toThrow("database unavailable");

        expect(Array.from(sourceBytes).every((value) => value === 0)).toBe(true);
    });

    it("rejects renamed files and malformed DOCX containers before extraction", async () => {
        expect(() => validateCandidateResumeDocument(
            Uint8Array.from(Buffer.from("PK\u0003\u0004not-a-pdf", "binary")),
            CANDIDATE_RESUME_PDF_MIME_TYPE,
        )).toThrow(expect.objectContaining({ code: "UNSUPPORTED_RESUME_TYPE" }));

        expect(() => validateCandidateResumeDocument(
            Uint8Array.from(Buffer.from("PK\u0003\u0004not-a-docx", "binary")),
            CANDIDATE_RESUME_DOCX_MIME_TYPE,
        )).toThrow(expect.objectContaining({ code: "UNREADABLE_DOCUMENT" }));
    });

    it("extracts text with the production PDF and DOCX adapters", async () => {
        const pdfText = await extractPdfResumeText(createTextPdf("Warehouse lead with shipping experience"));
        expect(pdfText).toContain("Warehouse lead with shipping experience");

        const docxBytes = await createTextDocx("Customer support specialist with scheduling experience");
        validateCandidateResumeDocument(docxBytes, CANDIDATE_RESUME_DOCX_MIME_TYPE);
        const docxText = await extractDocxResumeText(docxBytes);
        expect(docxText).toContain("Customer support specialist with scheduling experience");
    });
});

function artifact(overrides: Partial<CandidateResumeTextArtifact> = {}): CandidateResumeTextArtifact {
    return {
        artifactId: "20000000-0000-4000-8000-000000000001",
        candidateProfileId,
        roleProfileId: null,
        version: 1,
        revision: 1,
        source: "document_upload",
        candidateLabel: "resume.pdf",
        normalizedText: "Warehouse lead with shipping experience.",
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
        createdAt: "2026-07-21T15:00:00.000Z",
        acceptedAt: null,
        originalRetained: false,
        ...overrides,
    };
}

function createTextPdf(text: string) {
    const escapedText = text.replace(/([\\()])/g, "\\$1");
    const content = `BT /F1 12 Tf 72 720 Td (${escapedText}) Tj ET`;
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
        offsets.push(Buffer.byteLength(pdf, "ascii"));
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefOffset = Buffer.byteLength(pdf, "ascii");
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    for (let index = 1; index < offsets.length; index += 1) {
        pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Uint8Array.from(Buffer.from(pdf, "ascii"));
}

async function createTextDocx(text: string) {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
          <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
          <Default Extension="xml" ContentType="application/xml"/>
          <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
        </Types>`);
    zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
        </Relationships>`);
    zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body>
        </w:document>`);
    return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
