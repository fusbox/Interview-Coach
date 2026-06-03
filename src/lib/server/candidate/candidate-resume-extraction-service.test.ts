import { describe, expect, it, vi } from "vitest";

import { extractResumeUploadForCandidateDraft } from "./candidate-resume-extraction-service";

const {
    completeExtractionMock,
    markExtractionFailedMock,
} = vi.hoisted(() => ({
    completeExtractionMock: vi.fn(),
    markExtractionFailedMock: vi.fn(),
}));

vi.mock("./candidate-practice-draft-repository", () => ({
    completeResumeUploadExtractionForCandidatePracticeDraft: completeExtractionMock,
    markResumeUploadExtractionFailedForCandidatePracticeDraft: markExtractionFailedMock,
}));

describe("candidate resume extraction service", () => {
    it("extracts PDF/DOCX text and stores normalized processed resume context", async () => {
        const draft = {
            practiceDraftId: "draft-upload",
            resumeContext: {
                extractedText: "Built weekly forecast dashboards.",
                captureMode: "file_upload",
            },
        };
        completeExtractionMock.mockResolvedValue(draft);

        await expect(extractResumeUploadForCandidateDraft(
            {
                candidateProfileId: "profile-upload",
                practiceDraftId: "draft-upload",
                assetId: "asset-1",
                fileBytes: Buffer.from("fake-pdf"),
                mimeType: "application/pdf",
            },
            {
                extractText: vi.fn().mockResolvedValue(" Built\tweekly forecast dashboards. "),
            },
        )).resolves.toEqual({ ok: true, draft });

        expect(completeExtractionMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-upload",
            practiceDraftId: "draft-upload",
            assetId: "asset-1",
            extractedText: "Built weekly forecast dashboards.",
        });
        expect(markExtractionFailedMock).not.toHaveBeenCalled();
    });

    it("records a safe extraction failure code without preserving raw parser details", async () => {
        markExtractionFailedMock.mockResolvedValue(null);

        await expect(extractResumeUploadForCandidateDraft(
            {
                candidateProfileId: "profile-upload",
                practiceDraftId: "draft-upload",
                assetId: "asset-1",
                fileBytes: Buffer.from("fake-docx"),
                mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            },
            {
                extractText: vi.fn().mockRejectedValue(new Error("C:\\Users\\fusbo\\resume.docx contained SSN 123-45-6789")),
            },
        )).resolves.toEqual({
            ok: false,
            error: "Resume content could not be extracted. Please try another file or include resume content instead.",
            code: "EXTRACTION_FAILED",
        });

        expect(markExtractionFailedMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-upload",
            practiceDraftId: "draft-upload",
            assetId: "asset-1",
            errorCode: "EXTRACTION_FAILED",
        });
    });
});
