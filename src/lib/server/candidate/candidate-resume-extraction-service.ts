import type { CandidatePracticeDraft } from "./candidate-practice-draft-repository";
import {
    completeResumeUploadExtractionForCandidatePracticeDraft,
    markResumeUploadExtractionFailedForCandidatePracticeDraft,
} from "./candidate-practice-draft-repository";
import { normalizeResumeText } from "@/lib/candidate/resume-normalization";

export type CandidateResumeExtractionInput = {
    candidateProfileId: string;
    practiceDraftId: string;
    assetId: string;
    fileBytes: Buffer;
    mimeType: "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
};

export type CandidateResumeExtractor = {
    extractText(input: {
        fileBytes: Buffer;
        mimeType: CandidateResumeExtractionInput["mimeType"];
    }): Promise<string>;
};

export type CandidateResumeExtractionResult =
    | {
        ok: true;
        draft: CandidatePracticeDraft;
    }
    | {
        ok: false;
        error: string;
        code: string;
    };

export async function extractResumeUploadForCandidateDraft(
    input: CandidateResumeExtractionInput,
    extractor: CandidateResumeExtractor,
): Promise<CandidateResumeExtractionResult> {
    let extractedText: string | null = null;

    try {
        extractedText = normalizeResumeText(await extractor.extractText({
            fileBytes: input.fileBytes,
            mimeType: input.mimeType,
        }));
    } catch {
        await markResumeUploadExtractionFailedForCandidatePracticeDraft({
            candidateProfileId: input.candidateProfileId,
            practiceDraftId: input.practiceDraftId,
            assetId: input.assetId,
            errorCode: "EXTRACTION_FAILED",
        });

        return extractionFailure("EXTRACTION_FAILED");
    }

    if (!extractedText) {
        await markResumeUploadExtractionFailedForCandidatePracticeDraft({
            candidateProfileId: input.candidateProfileId,
            practiceDraftId: input.practiceDraftId,
            assetId: input.assetId,
            errorCode: "EMPTY_EXTRACTION",
        });

        return extractionFailure("EMPTY_EXTRACTION");
    }

    const draft = await completeResumeUploadExtractionForCandidatePracticeDraft({
        candidateProfileId: input.candidateProfileId,
        practiceDraftId: input.practiceDraftId,
        assetId: input.assetId,
        extractedText,
    });

    if (!draft) {
        return {
            ok: false,
            error: "Resume upload could not be matched to an editable practice draft.",
            code: "DRAFT_UPLOAD_NOT_FOUND",
        };
    }

    return { ok: true, draft };
}

function extractionFailure(code: "EXTRACTION_FAILED" | "EMPTY_EXTRACTION"): CandidateResumeExtractionResult {
    return {
        ok: false,
        error: "Resume content could not be extracted. Please try another file or include resume content instead.",
        code,
    };
}
