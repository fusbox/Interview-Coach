import { describe, expect, it } from "vitest";

import {
    CANDIDATE_RESUME_DIRECT_PII_POLICY_VERSION,
    CANDIDATE_RESUME_TEXT_PROCESSING_POLICY_VERSION,
    CANDIDATE_RESUME_TEXT_SOURCE_MAX_LENGTH,
    CandidateResumeTextProcessingError,
    processCandidateResumeText,
} from "./candidate-resume-text-processing";

describe("candidate resume text processing", () => {
    it("normalizes and removes deterministic direct identifiers while preserving work evidence", () => {
        const result = processCandidateResumeText({
            source: "pasted_text",
            candidateLabel: "C:\\Users\\irma\\resume.txt",
            knownIdentityAliases: ["Irma Castillo", "irma.castillo@example.com"],
            text: `Irma Castillo
irma.castillo@example.com | (312) 555-0199 | @irmac
123 Main Street, Chicago, IL 60601
DOB: 02/14/1990
SSN: 123-45-6789
https://linkedin.com/in/irma-castillo

Warehouse Lead, Acme Logistics | 2022-2026
Reduced picking errors by 18% and trained 12 associates.
Forklift certification and inventory cycle counting.`,
        });

        expect(result).toMatchObject({
            source: "pasted_text",
            candidateLabel: "resume.txt",
            processingPolicyVersion: CANDIDATE_RESUME_TEXT_PROCESSING_POLICY_VERSION,
            piiPolicyVersion: CANDIDATE_RESUME_DIRECT_PII_POLICY_VERSION,
            policyChangedText: true,
            piiRedactionCounts: {
                known_name: 1,
                personal_detail: 0,
                email: 1,
                phone: 1,
                address: 1,
                date_of_birth: 1,
                government_identifier: 1,
                personal_url_or_handle: 2,
            },
        });
        expect(result.normalizedText).toContain("Warehouse Lead, Acme Logistics | 2022-2026");
        expect(result.normalizedText).toContain("Reduced picking errors by 18%");
        expect(result.normalizedText).not.toContain("Irma Castillo");
        expect(result.normalizedText).not.toContain("312");
        expect(result.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
        expect(result.normalizedTextFingerprint).toMatch(/^[a-f0-9]{64}$/);
    });

    it("uses the same policy for trusted-host text without treating provenance as safe", () => {
        const result = processCandidateResumeText({
            source: "trusted_host",
            knownIdentityAliases: ["Dev Candidate"],
            text: "Dev Candidate\ndev@example.com\nMaterial handler with five years of shipping experience.",
        });

        expect(result.source).toBe("trusted_host");
        expect(result.candidateLabel).toBe("Resume from connected account");
        expect(result.normalizedText).toBe(
            "[Name removed]\n[Email removed]\nMaterial handler with five years of shipping experience.",
        );
    });

    it("uses the same scrub policy for extracted document text and preserves its source fingerprint", () => {
        const sourceFingerprint = "c".repeat(64);
        const result = processCandidateResumeText({
            source: "document_upload",
            candidateLabel: "C:\\private\\resume.pdf",
            sourceFingerprint,
            text: "Jordan Example | 717 Example St. New Haven, CT 06519 | jordan@example.com\nQuality inspector with four years of manufacturing experience.",
        });

        expect(result).toMatchObject({
            source: "document_upload",
            candidateLabel: "resume.pdf",
            sourceFingerprint,
        });
        expect(result.normalizedText).toContain("[Name removed] | [Address removed] | [Email removed]");
    });

    it("scrubs known non-Latin names and common international contact formats", () => {
        const result = processCandidateResumeText({
            source: "pasted_text",
            knownIdentityAliases: ["李明"],
            text: `李明
Address: Flat 2B, 123 MG Road, Bengaluru 560001
+91 98765 43210
Quality inspector with four years of manufacturing experience.`,
        });

        expect(result.normalizedText).toBe(
            "[Name removed]\n[Address removed]\n[Phone removed]\nQuality inspector with four years of manufacturing experience.",
        );
        expect(result.piiRedactionCounts).toMatchObject({
            known_name: 1,
            address: 1,
            phone: 1,
        });
    });

    it("scrubs identity-derived abbreviated and surname-first name variants", () => {
        const result = processCandidateResumeText({
            source: "pasted_text",
            knownIdentityAliases: ["Jane Doe"],
            text: `Jane D.
J. Doe
Doe, Jane

Quality inspector with four years of manufacturing experience.`,
        });

        expect(result.normalizedText).toBe(
            "[Name removed]\n[Name removed]\n[Name removed]\n\nQuality inspector with four years of manufacturing experience.",
        );
        expect(result.piiRedactionCounts.known_name).toBe(3);
    });

    it("scrubs an unknown name and inline street address from a contact header", () => {
        const result = processCandidateResumeText({
            source: "pasted_text",
            text: `Jordan Example | 717 Example St. New Haven, CT 06519 | jordan@example.com | (312) 555-0199

Customer support specialist with six years of service experience.`,
        });

        expect(result.normalizedText).toContain(
            "[Name removed] | [Address removed] | [Email removed] | [Phone removed]",
        );
        expect(result.piiRedactionCounts).toMatchObject({
            known_name: 1,
            address: 1,
            email: 1,
            phone: 1,
        });
    });

    it("scrubs an unknown header name when email is the only corroborating contact signal", () => {
        const result = processCandidateResumeText({
            source: "document_upload",
            text: `Jordan E.
jordan@example.com

Inspected finished assemblies and documented nonconforming material.`,
        });

        expect(result.normalizedText).toContain("[Name removed]");
        expect(result.normalizedText).toContain("[Email removed]");
        expect(result.normalizedText).not.toContain("Jordan E.");
        expect(result.piiRedactionCounts).toMatchObject({ known_name: 1, email: 1 });
    });

    it("scrubs an unknown header name when phone is the only corroborating contact signal", () => {
        const result = processCandidateResumeText({
            source: "document_upload",
            text: `Jordan E.
(312) 555-0199

Inspected finished assemblies and documented nonconforming material.`,
        });

        expect(result.normalizedText).toContain("[Name removed]");
        expect(result.normalizedText).toContain("[Phone removed]");
        expect(result.normalizedText).not.toContain("Jordan E.");
        expect(result.piiRedactionCounts).toMatchObject({ known_name: 1, phone: 1 });
    });

    it("uses a generic placeholder for an ambiguous first span on a delimited contact line", () => {
        const result = processCandidateResumeText({
            source: "document_upload",
            text: `Jordan Example (they/them) | jordan@example.com

Inspected finished assemblies and documented nonconforming material.`,
        });

        expect(result.normalizedText).toContain("[Personal detail removed] | [Email removed]");
        expect(result.normalizedText).not.toContain("Jordan Example");
        expect(result.piiRedactionCounts).toMatchObject({
            known_name: 0,
            personal_detail: 1,
            email: 1,
        });
    });

    it("scrubs a document-style multiline contact block while preserving the role title", () => {
        const result = processCandidateResumeText({
            source: "document_upload",
            text: `RESUME
DOE, JANE
Quality Control Inspector
717 Example St.
New Haven, CT 06519
jane.doe@example.com
(312) 555-0199

Inspected finished assemblies and documented nonconforming material.`,
        });

        expect(result.normalizedText).toContain("[Name removed]");
        expect(result.normalizedText).toContain("[Address removed]");
        expect(result.normalizedText).toContain("Quality Control Inspector");
        expect(result.normalizedText).toContain("New Haven, CT [Postal code removed]");
        expect(result.normalizedText).not.toContain("06519");
        expect(result.normalizedText).not.toContain("DOE, JANE");
        expect(result.normalizedText).not.toContain("717 Example St.");
        expect(result.piiRedactionCounts).toMatchObject({
            known_name: 1,
            address: 2,
            email: 1,
            phone: 1,
        });
    });

    it("scrubs real bullet-delimited document headers", () => {
        const result = processCandidateResumeText({
            source: "document_upload",
            text: `Jordan Example • 717 Example St. New Haven, CT 06519 • jordan@example.com • (312) 555-0199

Customer support specialist with six years of service experience.`,
        });

        expect(result.normalizedText).toContain(
            "[Name removed] | [Address removed] | [Email removed] | [Phone removed]",
        );
    });

    it("does not mistake a role-first header for an unknown candidate name", () => {
        const result = processCandidateResumeText({
            source: "document_upload",
            text: `Quality Control Inspector
quality@example.com
(312) 555-0199

Inspected finished assemblies and documented nonconforming material.`,
        });

        expect(result.normalizedText).toContain("Quality Control Inspector");
        expect(result.piiRedactionCounts.known_name).toBe(0);
    });

    it("preserves a role-first delimited header with one email signal", () => {
        const result = processCandidateResumeText({
            source: "document_upload",
            text: `Customer Success Leader | quality@example.com

Improved response quality and coached new team members.`,
        });

        expect(result.normalizedText).toContain("Customer Success Leader | [Email removed]");
        expect(result.piiRedactionCounts).toMatchObject({
            known_name: 0,
            personal_detail: 0,
            email: 1,
        });
    });

    it("does not mistake an organization-first header for an unknown candidate name", () => {
        const result = processCandidateResumeText({
            source: "document_upload",
            text: `Acme Logistics
operations@example.com
(312) 555-0199

Warehouse associate responsible for cycle counting and shipping.`,
        });

        expect(result.normalizedText).toContain("Acme Logistics");
        expect(result.piiRedactionCounts.known_name).toBe(0);
    });

    it("scrubs an unknown header name and postal code when coarse location is the only contact signal", () => {
        const result = processCandidateResumeText({
            source: "document_upload",
            text: `Jordan E.
Chicago, IL 60601

Inspected finished assemblies and documented nonconforming material.`,
        });

        expect(result.normalizedText).toContain("[Name removed]");
        expect(result.normalizedText).toContain("Chicago, IL [Postal code removed]");
        expect(result.normalizedText).not.toContain("Jordan E.");
        expect(result.normalizedText).not.toContain("60601");
        expect(result.piiRedactionCounts).toMatchObject({ known_name: 1, address: 1 });
    });

    it("preserves a role-first header while removing its adjacent postal code", () => {
        const result = processCandidateResumeText({
            source: "document_upload",
            text: `Quality Control Inspector
Chicago, IL 60601

Inspected finished assemblies and documented nonconforming material.`,
        });

        expect(result.normalizedText).toContain("Quality Control Inspector");
        expect(result.normalizedText).toContain("Chicago, IL [Postal code removed]");
        expect(result.piiRedactionCounts).toMatchObject({ known_name: 0, address: 1 });
    });

    it("upgrades a partially scrubbed contact header during candidate review", () => {
        const result = processCandidateResumeText({
            source: "pasted_text",
            text: `Jordan Example | 717 Example St. New Haven, CT 06519 | [Email removed] | [Phone removed]

Customer support specialist with six years of service experience.`,
        });

        expect(result.normalizedText).toContain(
            "[Name removed] | [Address removed] | [Email removed] | [Phone removed]",
        );
        expect(result.piiRedactionCounts).toMatchObject({ known_name: 1, address: 1 });
    });

    it("does not remove employers, schools, employment dates, or ordinary numeric work evidence", () => {
        const result = processCandidateResumeText({
            source: "pasted_text",
            text: `Rangam Consultants, Client Services Executive, 2021-2026
University of Illinois, BS Business Administration, 2017
Managed 25 accounts and improved response time by 32%.`,
        });

        expect(result.policyChangedText).toBe(false);
        expect(result.normalizedText).toContain("Rangam Consultants");
        expect(result.normalizedText).toContain("University of Illinois");
        expect(result.normalizedText).toContain("25 accounts");
        expect(Object.values(result.piiRedactionCounts).every((count) => count === 0)).toBe(true);
    });

    it("fails closed for oversized, empty, and identifier-only content", () => {
        expect(() => processCandidateResumeText({
            source: "pasted_text",
            text: "a".repeat(CANDIDATE_RESUME_TEXT_SOURCE_MAX_LENGTH + 1),
        })).toThrowError(expect.objectContaining({ code: "RESUME_TOO_LARGE" }));
        expect(() => processCandidateResumeText({
            source: "pasted_text",
            text: "   ",
        })).toThrowError(expect.objectContaining({ code: "EMPTY_EXTRACTION" }));
        expect(() => processCandidateResumeText({
            source: "pasted_text",
            text: "irma@example.com\n(312) 555-0199",
        })).toThrow(CandidateResumeTextProcessingError);
    });
});
