import { once } from "node:events";

import busboy from "busboy";

import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import { createCandidatePostgresQueryClient } from "@/features/candidate-auth-v2/candidate-postgres-runtime";
import {
    CandidateResumeArtifactRepositoryError,
    createCandidateResumeTextArtifactRepository,
    type CandidateResumeTextArtifact,
} from "@/features/candidate-setup-v2/candidate-resume-text-artifact-repository";
import {
    CANDIDATE_RESUME_PHOTO_MAX_BYTES_PER_PAGE,
    CANDIDATE_RESUME_PHOTO_MAX_PAGES,
    CANDIDATE_RESUME_PHOTO_MAX_REQUEST_BYTES,
    CANDIDATE_RESUME_PHOTO_MAX_TOTAL_BYTES,
    CandidateResumePhotoProcessingError,
    processCandidateResumePhotoUpload,
    type CandidateResumePhotoPage,
    type CandidateResumePhotoProcessingErrorCode,
} from "@/features/candidate-setup-v2/candidate-resume-photo-processing";
import {
    CandidateResumePhotoOcrRuntimeError,
    createCandidateResumePhotoOcrRuntimeFromEnvironment,
    type CandidateResumePhotoOcrRuntime,
} from "@/features/candidate-setup-v2/candidate-resume-photo-ocr-runtime";
import {
    resolveCandidateSetupRouteIdentity,
    type CandidateSetupRouteIdentity,
} from "@/features/candidate-setup-v2/candidate-setup-route-identity";
import {
    CANDIDATE_RESUME_SELECTION_OPERATION_HEADER,
    createCandidateSetupResumeSelectionRepository,
    readCandidateResumeSelectionOperationId,
} from "@/features/candidate-setup-v2/candidate-setup-resume-selection-repository";
import { isTrustedSameOriginMutationRequest } from "@/lib/server/trusted-mutation-request";

type CandidateResumeArtifactRepository = Pick<
    ReturnType<typeof createCandidateResumeTextArtifactRepository>,
    "createOrRecoverReviewArtifact"
>;

type CandidateResumeSelectionRepository = Pick<
    ReturnType<typeof createCandidateSetupResumeSelectionRepository>,
    "beginSelectionOperation" | "finalizeSelectionOperation" | "abandonSelectionOperation"
>;

export type CandidateResumePhotoRouteDependencies = {
    now: Date;
    resolveIdentity: (request: Request) => Promise<CandidateSetupRouteIdentity | null>;
    artifactRepository: CandidateResumeArtifactRepository;
    selectionRepository: CandidateResumeSelectionRepository;
    ocrRuntime: CandidateResumePhotoOcrRuntime;
};

export async function handleCandidateResumePhotoProcessRequest(
    request: Request,
    dependencies: CandidateResumePhotoRouteDependencies,
) {
    if (!isTrustedSameOriginMutationRequest(request)) {
        return Response.json({ error: "Resume processing request was not accepted." }, { status: 403 });
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > CANDIDATE_RESUME_PHOTO_MAX_REQUEST_BYTES) {
        return photoFailure("RESUME_TOO_LARGE");
    }

    const identity = await dependencies.resolveIdentity(request);
    if (!identity) {
        return Response.json({ error: "Candidate access could not be verified." }, { status: 401 });
    }

    const contentType = request.headers.get("content-type")?.trim() ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
        return photoFailure("UNSUPPORTED_RESUME_TYPE");
    }

    const sourceResult = await readBoundedResumePhotoRequest(request, contentType);
    if (!sourceResult.success) return photoFailure(sourceResult.code);

    const operationId = readCandidateResumeSelectionOperationId(
        request.headers.get(CANDIDATE_RESUME_SELECTION_OPERATION_HEADER),
    );
    if (!operationId) {
        await sourceResult.dispose();
        return Response.json({ error: "Resume processing request is missing its operation key." }, { status: 400 });
    }

    try {
        await dependencies.selectionRepository.beginSelectionOperation({
            candidateProfileId: identity.candidateProfileId,
            setupOwnerKey: identity.setupOwnerKey,
            operationId,
            now: dependencies.now,
        });
        const artifact = await processCandidateResumePhotoUpload({
            candidateProfileId: identity.candidateProfileId,
            pages: sourceResult.pages,
            now: dependencies.now,
        }, {
            artifactRepository: dependencies.artifactRepository,
            ocrRuntime: dependencies.ocrRuntime,
            disposeSource: sourceResult.dispose,
        });
        const selected = await dependencies.selectionRepository.finalizeSelectionOperation({
            candidateProfileId: identity.candidateProfileId,
            setupOwnerKey: identity.setupOwnerKey,
            operationId,
            artifactId: artifact.artifactId,
            now: dependencies.now,
        });
        if (!selected) {
            return Response.json({
                error: "A newer resume choice replaced this one. Review the current setup selection.",
                code: "RESUME_SELECTION_STALE",
            }, { status: 409 });
        }
        return Response.json({ artifact: toPublicArtifact(artifact) }, {
            status: artifact.reviewState === "accepted" ? 200 : 201,
            headers: { "Cache-Control": "no-store" },
        });
    } catch (error) {
        await dependencies.selectionRepository.abandonSelectionOperation({
            candidateProfileId: identity.candidateProfileId,
            setupOwnerKey: identity.setupOwnerKey,
            operationId,
            now: dependencies.now,
        }).catch(() => undefined);
        if (error instanceof CandidateResumePhotoProcessingError) {
            return photoFailure(error.code);
        }
        if (error instanceof CandidateResumeArtifactRepositoryError && error.code === "NOT_FOUND") {
            return Response.json({
                error: "Resume review could not be found.",
                code: "RESUME_REVIEW_NOT_FOUND",
            }, { status: 404 });
        }
        return Response.json({
            error: "I could not save this resume review. Your setup is still available.",
            code: "RESUME_PERSISTENCE_FAILED",
        }, { status: 503 });
    } finally {
        await sourceResult.dispose().catch(() => undefined);
    }
}

export function createDefaultCandidateResumePhotoRouteDependencies(): CandidateResumePhotoRouteDependencies | null {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) return null;

    let ocrRuntime: CandidateResumePhotoOcrRuntime;
    try {
        ocrRuntime = createCandidateResumePhotoOcrRuntimeFromEnvironment({ env: process.env });
    } catch (error) {
        if (error instanceof CandidateResumePhotoOcrRuntimeError) return null;
        throw error;
    }

    const client = createCandidatePostgresQueryClient(databaseUrl);
    return {
        now: new Date(),
        resolveIdentity: (request) => resolveCandidateSetupRouteIdentity(request, client),
        artifactRepository: createCandidateResumeTextArtifactRepository(client),
        selectionRepository: createCandidateSetupResumeSelectionRepository(client),
        ocrRuntime,
    };
}

async function readBoundedResumePhotoRequest(request: Request, contentType: string): Promise<
    | { success: true; pages: CandidateResumePhotoPage[]; dispose: () => Promise<void> }
    | { success: false; code: CandidateResumePhotoProcessingErrorCode }
> {
    if (!request.body) return { success: false, code: "UNREADABLE_IMAGE" };

    const requestChunks: Buffer[] = [];
    const pageBuffers: Buffer[] = [];
    const pages: CandidateResumePhotoPage[] = [];
    let totalRequestBytes = 0;
    let totalPageBytes = 0;
    let failureCode: CandidateResumePhotoProcessingErrorCode | null = null;

    let parser: ReturnType<typeof busboy>;
    try {
        parser = busboy({
            headers: { "content-type": contentType },
            limits: {
                files: CANDIDATE_RESUME_PHOTO_MAX_PAGES,
                fileSize: CANDIDATE_RESUME_PHOTO_MAX_BYTES_PER_PAGE,
                fields: 0,
                parts: CANDIDATE_RESUME_PHOTO_MAX_PAGES,
                headerPairs: 64,
            },
        });
    } catch {
        return { success: false, code: "UNREADABLE_IMAGE" };
    }

    parser.on("file", (fieldName, stream, info) => {
        const chunks: Buffer[] = [];
        let pageBytes = 0;
        if (fieldName !== "pages") failureCode ??= "UNREADABLE_IMAGE";

        stream.on("data", (value: Buffer) => {
            const chunk = Buffer.from(value);
            chunks.push(chunk);
            pageBuffers.push(chunk);
            pageBytes += chunk.byteLength;
            totalPageBytes += chunk.byteLength;
            if (
                pageBytes > CANDIDATE_RESUME_PHOTO_MAX_BYTES_PER_PAGE
                || totalPageBytes > CANDIDATE_RESUME_PHOTO_MAX_TOTAL_BYTES
            ) {
                failureCode ??= "RESUME_TOO_LARGE";
            }
        });
        stream.on("limit", () => {
            failureCode ??= "RESUME_TOO_LARGE";
        });
        stream.on("end", () => {
            const bytes = Buffer.concat(chunks);
            pageBuffers.push(bytes);
            pages.push({
                bytes,
                declaredMimeType: info.mimeType,
                candidateLabel: info.filename || "Resume photo",
            });
        });
    });
    parser.on("field", () => {
        failureCode ??= "UNREADABLE_IMAGE";
    });
    parser.on("filesLimit", () => {
        failureCode ??= "TOO_MANY_PAGES";
    });
    parser.on("fieldsLimit", () => {
        failureCode ??= "UNREADABLE_IMAGE";
    });
    parser.on("partsLimit", () => {
        failureCode ??= "TOO_MANY_PAGES";
    });
    parser.on("error", () => {
        failureCode ??= "UNREADABLE_IMAGE";
    });

    const parserFinished = once(parser, "close");
    const reader = request.body.getReader();
    try {
        while (true) {
            const result = await reader.read();
            if (result.done) break;
            const chunk = Buffer.from(result.value.buffer, result.value.byteOffset, result.value.byteLength);
            requestChunks.push(chunk);
            totalRequestBytes += chunk.byteLength;
            if (totalRequestBytes > CANDIDATE_RESUME_PHOTO_MAX_REQUEST_BYTES) {
                failureCode = "RESUME_TOO_LARGE";
                await reader.cancel().catch(() => undefined);
                parser.destroy();
                break;
            }
            if (!parser.write(chunk)) await once(parser, "drain");
        }
        if (!failureCode || totalRequestBytes <= CANDIDATE_RESUME_PHOTO_MAX_REQUEST_BYTES) {
            parser.end();
            await parserFinished.catch(() => undefined);
        }
    } catch {
        failureCode ??= "UNREADABLE_IMAGE";
        parser.destroy();
    } finally {
        reader.releaseLock();
        zeroBuffers(requestChunks);
    }

    const dispose = createIdempotentDisposer(pageBuffers);
    if (failureCode || pages.length === 0) {
        await dispose();
        return { success: false, code: failureCode ?? "UNREADABLE_IMAGE" };
    }
    return { success: true, pages, dispose };
}

function createIdempotentDisposer(buffers: Buffer[]) {
    let disposed = false;
    return async () => {
        if (disposed) return;
        disposed = true;
        zeroBuffers(buffers);
    };
}

function zeroBuffers(buffers: Buffer[]) {
    for (const buffer of buffers) buffer.fill(0);
}

function photoFailure(code: CandidateResumePhotoProcessingErrorCode) {
    const response = code === "RESUME_TOO_LARGE"
        ? { status: 413, error: "Keep each photo and the full set of resume photos under 12 MB." }
        : code === "TOO_MANY_PAGES"
            ? { status: 413, error: "Choose up to 4 resume photos." }
            : code === "UNSUPPORTED_RESUME_TYPE"
                ? { status: 415, error: "Choose JPEG, PNG, WebP, HEIC, or HEIF resume photos." }
                : code === "SOURCE_DISPOSAL_FAILED"
                    ? { status: 503, error: "I could not safely finish processing those photos. Choose them again or paste the resume text." }
                    : code === "OCR_NOT_CONFIGURED"
                        ? { status: 503, error: "Photo reading is temporarily unavailable. Upload a document or paste the resume text." }
                        : code === "OCR_TEMPORARILY_UNAVAILABLE"
                            ? { status: 503, error: "I could not read those photos right now. Try again, upload a document, or paste the resume text." }
                            : code === "EMPTY_EXTRACTION"
                                ? { status: 422, error: "I could not find readable resume text on every page. Retake the unclear pages in good light or paste the text." }
                                : code === "EXTRACTED_TEXT_TOO_LARGE"
                                    ? { status: 422, error: "Those photos contain more text than I can safely prepare at once. Upload the PDF or DOCX, or paste the resume text." }
                                : code === "UNREADABLE_IMAGE"
                                    ? { status: 422, error: "I could not open those photos. Choose them again or paste the resume text." }
                                    : { status: 422, error: "I could not read those resume photos. Retake them in good light or paste the text." };
    return Response.json({ error: response.error, code }, {
        status: response.status,
        headers: { "Cache-Control": "no-store" },
    });
}

function toPublicArtifact(artifact: CandidateResumeTextArtifact) {
    return {
        artifactId: artifact.artifactId,
        version: artifact.version,
        revision: artifact.revision,
        source: artifact.source,
        candidateLabel: artifact.candidateLabel,
        normalizedText: artifact.normalizedText,
        piiRedactionCounts: artifact.piiRedactionCounts,
        reviewState: artifact.reviewState,
        createdAt: artifact.createdAt,
        acceptedAt: artifact.acceptedAt,
    };
}
