import { createHash } from "node:crypto";

import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

import type { CandidateResumeTextArtifact } from "./candidate-resume-text-artifact-repository";

export const CANDIDATE_RESUME_PDF_MIME_TYPE = "application/pdf";
export const CANDIDATE_RESUME_DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const CANDIDATE_RESUME_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
export const CANDIDATE_RESUME_PDF_MAX_PAGES = 50;
export const CANDIDATE_RESUME_DOCX_MAX_ENTRIES = 512;
export const CANDIDATE_RESUME_DOCX_MAX_EXPANDED_BYTES = 32 * 1024 * 1024;
export const CANDIDATE_RESUME_DOCUMENT_EXTRACTION_POLICY_VERSION = "candidate_resume_document_extraction_v1";

export type CandidateResumeDocumentMimeType =
    | typeof CANDIDATE_RESUME_PDF_MIME_TYPE
    | typeof CANDIDATE_RESUME_DOCX_MIME_TYPE;

export type CandidateResumeDocumentProcessingErrorCode =
    | "UNSUPPORTED_RESUME_TYPE"
    | "RESUME_TOO_LARGE"
    | "UNREADABLE_DOCUMENT"
    | "EXTRACTION_FAILED"
    | "EMPTY_EXTRACTION"
    | "SOURCE_DISPOSAL_FAILED";

export class CandidateResumeDocumentProcessingError extends Error {
    readonly code: CandidateResumeDocumentProcessingErrorCode;

    constructor(code: CandidateResumeDocumentProcessingErrorCode) {
        super(code);
        this.name = "CandidateResumeDocumentProcessingError";
        this.code = code;
    }
}

export type CandidateResumeDocumentArtifactRepository = {
    createOrRecoverReviewArtifact(input: {
        candidateProfileId: string;
        source: "document_upload";
        text: string;
        candidateLabel: string;
        sourceFingerprint: string;
        now: Date;
    }): Promise<CandidateResumeTextArtifact>;
};

export type CandidateResumeDocumentProcessingDependencies = {
    artifactRepository: CandidateResumeDocumentArtifactRepository;
    extractPdfText?: (sourceBytes: Uint8Array) => Promise<string>;
    extractDocxText?: (sourceBytes: Uint8Array) => Promise<string>;
    disposeSource?: (sourceBytes: Uint8Array) => Promise<void> | void;
};

export async function processCandidateResumeDocumentUpload(input: {
    candidateProfileId: string;
    sourceBytes: Uint8Array;
    declaredMimeType: CandidateResumeDocumentMimeType;
    candidateLabel: string;
    now: Date;
}, dependencies: CandidateResumeDocumentProcessingDependencies): Promise<CandidateResumeTextArtifact> {
    let extractedText: string | null = null;
    let sourceFingerprint: string | null = null;
    let processingError: unknown = null;

    try {
        validateCandidateResumeDocument(input.sourceBytes, input.declaredMimeType);
        sourceFingerprint = fingerprintCandidateResumeDocument(input.sourceBytes);
        extractedText = input.declaredMimeType === CANDIDATE_RESUME_PDF_MIME_TYPE
            ? await (dependencies.extractPdfText ?? extractPdfResumeText)(input.sourceBytes)
            : await (dependencies.extractDocxText ?? extractDocxResumeText)(input.sourceBytes);

        if (!extractedText.trim()) {
            throw new CandidateResumeDocumentProcessingError("EMPTY_EXTRACTION");
        }
    } catch (error) {
        processingError = normalizeCandidateResumeDocumentError(error);
    }

    try {
        await (dependencies.disposeSource ?? disposeCandidateResumeSource)(input.sourceBytes);
    } catch {
        throw new CandidateResumeDocumentProcessingError("SOURCE_DISPOSAL_FAILED");
    }

    if (processingError) {
        throw processingError;
    }
    if (!extractedText || !sourceFingerprint) {
        throw new CandidateResumeDocumentProcessingError("EXTRACTION_FAILED");
    }

    return dependencies.artifactRepository.createOrRecoverReviewArtifact({
        candidateProfileId: input.candidateProfileId,
        source: "document_upload",
        text: extractedText,
        candidateLabel: input.candidateLabel,
        sourceFingerprint,
        now: input.now,
    });
}

export function validateCandidateResumeDocument(
    sourceBytes: Uint8Array,
    declaredMimeType: CandidateResumeDocumentMimeType,
) {
    if (sourceBytes.byteLength === 0) {
        throw new CandidateResumeDocumentProcessingError("UNREADABLE_DOCUMENT");
    }
    if (sourceBytes.byteLength > CANDIDATE_RESUME_DOCUMENT_MAX_BYTES) {
        throw new CandidateResumeDocumentProcessingError("RESUME_TOO_LARGE");
    }

    if (declaredMimeType === CANDIDATE_RESUME_PDF_MIME_TYPE) {
        if (!hasPdfSignature(sourceBytes)) {
            throw new CandidateResumeDocumentProcessingError("UNSUPPORTED_RESUME_TYPE");
        }
        return;
    }

    if (!hasZipSignature(sourceBytes)) {
        throw new CandidateResumeDocumentProcessingError("UNSUPPORTED_RESUME_TYPE");
    }
    inspectDocxCentralDirectory(sourceBytes);
}

export async function extractPdfResumeText(sourceBytes: Uint8Array) {
    const parserBytes = Uint8Array.from(sourceBytes);
    const parser = new PDFParse({
        data: parserBytes,
        stopAtErrors: true,
        isEvalSupported: false,
        useWasm: false,
        disableFontFace: true,
        enableXfa: false,
        maxImageSize: 1_000_000,
    });
    let disposalFailed = false;

    try {
        const info = await parser.getInfo();
        if (info.total < 1) {
            throw new CandidateResumeDocumentProcessingError("UNREADABLE_DOCUMENT");
        }
        if (info.total > CANDIDATE_RESUME_PDF_MAX_PAGES) {
            throw new CandidateResumeDocumentProcessingError("RESUME_TOO_LARGE");
        }
        const result = await parser.getText({
            first: info.total,
            lineEnforce: true,
            cellSeparator: " ",
            pageJoiner: "\n\n",
            parseHyperlinks: false,
            includeMarkedContent: false,
        });
        return result.text;
    } catch (error) {
        if (error instanceof CandidateResumeDocumentProcessingError) {
            throw error;
        }
        if (readErrorName(error) === "PasswordException") {
            throw new CandidateResumeDocumentProcessingError("UNREADABLE_DOCUMENT");
        }
        throw new CandidateResumeDocumentProcessingError("EXTRACTION_FAILED");
    } finally {
        try {
            await parser.destroy();
        } catch {
            disposalFailed = true;
        }
        try {
            if (parserBytes.byteLength > 0) {
                parserBytes.fill(0);
            }
        } catch {
            disposalFailed = true;
        }
        if (disposalFailed) {
            throw new CandidateResumeDocumentProcessingError("SOURCE_DISPOSAL_FAILED");
        }
    }
}

export async function extractDocxResumeText(sourceBytes: Uint8Array) {
    try {
        const result = await mammoth.extractRawText({
            buffer: Buffer.from(sourceBytes.buffer, sourceBytes.byteOffset, sourceBytes.byteLength),
        });
        return result.value;
    } catch {
        throw new CandidateResumeDocumentProcessingError("EXTRACTION_FAILED");
    }
}

export function disposeCandidateResumeSource(sourceBytes: Uint8Array) {
    sourceBytes.fill(0);
}

function fingerprintCandidateResumeDocument(sourceBytes: Uint8Array) {
    return createHash("sha256")
        .update(CANDIDATE_RESUME_DOCUMENT_EXTRACTION_POLICY_VERSION, "utf8")
        .update("\0", "utf8")
        .update(sourceBytes)
        .digest("hex");
}

function normalizeCandidateResumeDocumentError(error: unknown) {
    return error instanceof CandidateResumeDocumentProcessingError
        ? error
        : new CandidateResumeDocumentProcessingError("EXTRACTION_FAILED");
}

function hasPdfSignature(bytes: Uint8Array) {
    return bytes.byteLength >= 5
        && bytes[0] === 0x25
        && bytes[1] === 0x50
        && bytes[2] === 0x44
        && bytes[3] === 0x46
        && bytes[4] === 0x2d;
}

function hasZipSignature(bytes: Uint8Array) {
    return bytes.byteLength >= 4
        && bytes[0] === 0x50
        && bytes[1] === 0x4b
        && bytes[2] === 0x03
        && bytes[3] === 0x04;
}

function inspectDocxCentralDirectory(bytes: Uint8Array) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const eocdOffset = findEndOfCentralDirectory(view);
    if (eocdOffset < 0) {
        throw new CandidateResumeDocumentProcessingError("UNREADABLE_DOCUMENT");
    }

    const diskNumber = view.getUint16(eocdOffset + 4, true);
    const centralDirectoryDisk = view.getUint16(eocdOffset + 6, true);
    const entriesOnDisk = view.getUint16(eocdOffset + 8, true);
    const entryCount = view.getUint16(eocdOffset + 10, true);
    const centralDirectorySize = view.getUint32(eocdOffset + 12, true);
    const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
    if (
        diskNumber !== 0
        || centralDirectoryDisk !== 0
        || entriesOnDisk !== entryCount
        || entryCount === 0xffff
        || centralDirectorySize === 0xffffffff
        || centralDirectoryOffset === 0xffffffff
        || entryCount < 2
        || entryCount > CANDIDATE_RESUME_DOCX_MAX_ENTRIES
        || centralDirectoryOffset + centralDirectorySize > bytes.byteLength
    ) {
        throw new CandidateResumeDocumentProcessingError("UNREADABLE_DOCUMENT");
    }

    let offset = centralDirectoryOffset;
    let totalExpandedBytes = 0;
    let hasContentTypes = false;
    let hasDocument = false;
    let encryptedPackage = false;

    for (let index = 0; index < entryCount; index += 1) {
        if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== 0x02014b50) {
            throw new CandidateResumeDocumentProcessingError("UNREADABLE_DOCUMENT");
        }
        const flags = view.getUint16(offset + 8, true);
        const compressionMethod = view.getUint16(offset + 10, true);
        const compressedSize = view.getUint32(offset + 20, true);
        const uncompressedSize = view.getUint32(offset + 24, true);
        const fileNameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const diskStart = view.getUint16(offset + 34, true);
        const nextOffset = offset + 46 + fileNameLength + extraLength + commentLength;
        if (
            nextOffset > bytes.byteLength
            || diskStart !== 0
            || (flags & 0x1) !== 0
            || (compressionMethod !== 0 && compressionMethod !== 8)
            || compressedSize === 0xffffffff
            || uncompressedSize === 0xffffffff
        ) {
            throw new CandidateResumeDocumentProcessingError("UNREADABLE_DOCUMENT");
        }

        const fileName = readZipFileName(
            bytes.subarray(offset + 46, offset + 46 + fileNameLength),
            (flags & 0x0800) !== 0,
        );
        if (
            !fileName
            || /[\u0000-\u001f\u007f]/.test(fileName)
            || fileName.includes("\\")
            || fileName.startsWith("/")
            || fileName.split("/").includes("..")
        ) {
            throw new CandidateResumeDocumentProcessingError("UNREADABLE_DOCUMENT");
        }
        if (fileName === "[Content_Types].xml") hasContentTypes = true;
        if (fileName === "word/document.xml") hasDocument = true;
        if (fileName === "EncryptedPackage" || fileName === "EncryptionInfo") encryptedPackage = true;

        totalExpandedBytes += uncompressedSize;
        if (
            totalExpandedBytes > CANDIDATE_RESUME_DOCX_MAX_EXPANDED_BYTES
            || uncompressedSize > 12 * 1024 * 1024
            || (compressedSize > 0 && uncompressedSize > 1024 * 1024 && uncompressedSize / compressedSize > 150)
        ) {
            throw new CandidateResumeDocumentProcessingError("RESUME_TOO_LARGE");
        }
        offset = nextOffset;
    }

    if (offset !== centralDirectoryOffset + centralDirectorySize || !hasContentTypes || !hasDocument || encryptedPackage) {
        throw new CandidateResumeDocumentProcessingError("UNREADABLE_DOCUMENT");
    }
}

function findEndOfCentralDirectory(view: DataView) {
    const minimumOffset = Math.max(0, view.byteLength - 65_557);
    for (let offset = view.byteLength - 22; offset >= minimumOffset; offset -= 1) {
        if (view.getUint32(offset, true) === 0x06054b50) {
            const commentLength = view.getUint16(offset + 20, true);
            if (offset + 22 + commentLength === view.byteLength) {
                return offset;
            }
        }
    }
    return -1;
}

function readZipFileName(bytes: Uint8Array, isUtf8: boolean) {
    try {
        return new TextDecoder(isUtf8 ? "utf-8" : "windows-1252", { fatal: true }).decode(bytes);
    } catch {
        return "";
    }
}

function readErrorName(error: unknown) {
    return error && typeof error === "object" && "name" in error && typeof error.name === "string"
        ? error.name
        : "";
}
