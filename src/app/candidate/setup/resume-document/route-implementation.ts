import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import { createCandidatePostgresQueryClient } from "@/features/candidate-auth-v2/candidate-postgres-runtime";
import {
    CandidateResumeArtifactRepositoryError,
    createCandidateResumeTextArtifactRepository,
    type CandidateResumeTextArtifact,
} from "@/features/candidate-setup-v2/candidate-resume-text-artifact-repository";
import { createCandidateResumeIngestionOperationRepository } from "@/features/candidate-setup-v2/candidate-resume-ingestion-operation-repository";
import {
    beginCandidateResumeIngestion,
    completeCandidateResumeIngestion,
    failCandidateResumeIngestion,
    type CandidateResumeIngestionRouteDependencies,
} from "@/features/candidate-setup-v2/candidate-resume-ingestion-route";
import {
    CANDIDATE_RESUME_DOCUMENT_MAX_BYTES,
    CANDIDATE_RESUME_DOCX_MIME_TYPE,
    CANDIDATE_RESUME_PDF_MIME_TYPE,
    CandidateResumeDocumentProcessingError,
    processCandidateResumeDocumentUpload,
    type CandidateResumeDocumentMimeType,
    type CandidateResumeDocumentProcessingDependencies,
} from "@/features/candidate-setup-v2/candidate-resume-document-processing";
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

const CANDIDATE_RESUME_DOCUMENT_NAME_HEADER = "x-resume-document-name";
const CANDIDATE_RESUME_DOCUMENT_NAME_MAX_BYTES = 512;

type CandidateResumeArtifactRepository = Pick<
    ReturnType<typeof createCandidateResumeTextArtifactRepository>,
    "createOrRecoverReviewArtifact" | "recoverSelectedArtifact"
>;

type CandidateResumeSelectionRepository = Pick<
    ReturnType<typeof createCandidateSetupResumeSelectionRepository>,
    "beginSelectionOperation" | "abandonSelectionOperation"
>;

export type CandidateResumeDocumentRouteDependencies = CandidateResumeIngestionRouteDependencies & {
    now: Date;
    resolveIdentity: (request: Request) => Promise<CandidateSetupRouteIdentity | null>;
    artifactRepository: CandidateResumeArtifactRepository;
    selectionRepository: CandidateResumeSelectionRepository;
    extractPdfText?: CandidateResumeDocumentProcessingDependencies["extractPdfText"];
    extractDocxText?: CandidateResumeDocumentProcessingDependencies["extractDocxText"];
    disposeSource?: CandidateResumeDocumentProcessingDependencies["disposeSource"];
};

export async function handleCandidateResumeDocumentProcessRequest(
    request: Request,
    dependencies: CandidateResumeDocumentRouteDependencies,
) {
    if (!isTrustedSameOriginMutationRequest(request)) {
        return Response.json({ error: "Resume processing request was not accepted." }, { status: 403 });
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > CANDIDATE_RESUME_DOCUMENT_MAX_BYTES) {
        return documentFailure("RESUME_TOO_LARGE");
    }

    const identity = await dependencies.resolveIdentity(request);
    if (!identity) {
        return Response.json({ error: "Candidate access could not be verified." }, { status: 401 });
    }

    const declaredMimeType = readDocumentMimeType(request.headers.get("content-type"));
    if (!declaredMimeType) {
        return documentFailure("UNSUPPORTED_RESUME_TYPE");
    }

    const operationId = readCandidateResumeSelectionOperationId(
        request.headers.get(CANDIDATE_RESUME_SELECTION_OPERATION_HEADER),
    );
    if (!operationId) {
        return Response.json({ error: "Resume processing request is missing its operation key." }, { status: 400 });
    }

    const admission = await beginCandidateResumeIngestion({
        operationId,
        identity,
        source: "document_upload",
        dependencies,
    });
    if (admission.kind === "denied") return admission.response;
    if (admission.kind === "replayed") {
        return Response.json({ artifact: toPublicArtifact(admission.artifact) }, {
            status: admission.artifact.reviewState === "accepted" ? 200 : 201,
            headers: { "Cache-Control": "no-store" },
        });
    }

    const sourceResult = await readBoundedDocumentRequest(request);
    if (!sourceResult.success) {
        const response = documentFailure(sourceResult.reason === "too_large" ? "RESUME_TOO_LARGE" : "UNREADABLE_DOCUMENT");
        await failCandidateResumeIngestion({
            context: admission.context,
            dependencies,
            terminalReason: sourceResult.reason === "too_large" ? "too_large" : "unreadable_source",
            statusCode: response.status,
            inputBytes: sourceResult.byteCount,
            pageCount: 0,
        });
        return response;
    }

    const inputBytes = sourceResult.byteCount;
    try {
        const artifact = await processCandidateResumeDocumentUpload({
            candidateProfileId: identity.candidateProfileId,
            sourceBytes: sourceResult.bytes,
            declaredMimeType,
            candidateLabel: readCandidateDocumentLabel(request.headers.get(CANDIDATE_RESUME_DOCUMENT_NAME_HEADER)),
            now: dependencies.now,
        }, {
            artifactRepository: dependencies.artifactRepository,
            extractPdfText: dependencies.extractPdfText,
            extractDocxText: dependencies.extractDocxText,
            disposeSource: dependencies.disposeSource,
        });

        const completionFailure = await completeCandidateResumeIngestion({
            context: admission.context,
            dependencies,
            artifact,
            inputBytes,
            pageCount: 0,
        });
        if (completionFailure) return completionFailure;

        return Response.json({ artifact: toPublicArtifact(artifact) }, {
            status: artifact.reviewState === "accepted" ? 200 : 201,
            headers: { "Cache-Control": "no-store" },
        });
    } catch (error) {
        let response: Response;
        if (error instanceof CandidateResumeDocumentProcessingError) {
            response = documentFailure(error.code);
        } else if (error instanceof CandidateResumeArtifactRepositoryError && error.code === "NOT_FOUND") {
            response = Response.json({ error: "Resume review could not be found.", code: "RESUME_REVIEW_NOT_FOUND" }, { status: 404 });
        } else {
            response = Response.json({
                error: "I could not save this resume review. Your setup is still available.",
                code: "RESUME_PERSISTENCE_FAILED",
            }, { status: 503 });
        }
        await failCandidateResumeIngestion({
            context: admission.context,
            dependencies,
            terminalReason: classifyDocumentFailure(error),
            statusCode: response.status,
            inputBytes,
            pageCount: 0,
        });
        return response;
    }
}

export function createDefaultCandidateResumeDocumentRouteDependencies(): CandidateResumeDocumentRouteDependencies | null {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return null;
    }
    const client = createCandidatePostgresQueryClient(databaseUrl);
    return {
        now: new Date(),
        resolveIdentity: (request) => resolveCandidateSetupRouteIdentity(request, client),
        artifactRepository: createCandidateResumeTextArtifactRepository(client),
        selectionRepository: createCandidateSetupResumeSelectionRepository(client),
        operationRepository: createCandidateResumeIngestionOperationRepository(client),
        clock: Date.now,
        onDiagnostic: (event) => console.info("candidate_resume_ingestion", event),
    };
}

async function readBoundedDocumentRequest(request: Request): Promise<
    | { success: true; bytes: Uint8Array; byteCount: number }
    | { success: false; reason: "invalid" | "too_large"; byteCount: number }
> {
    if (!request.body) {
        return { success: false, reason: "invalid", byteCount: 0 };
    }

    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
        while (true) {
            const result = await reader.read();
            if (result.done) break;
            totalBytes += result.value.byteLength;
            if (totalBytes > CANDIDATE_RESUME_DOCUMENT_MAX_BYTES) {
                result.value.fill(0);
                zeroChunks(chunks);
                await reader.cancel().catch(() => undefined);
                return { success: false, reason: "too_large", byteCount: totalBytes };
            }
            chunks.push(result.value);
        }

        if (totalBytes === 0) {
            return { success: false, reason: "invalid", byteCount: 0 };
        }
        const bytes = new Uint8Array(totalBytes);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            chunk.fill(0);
            offset += chunk.byteLength;
        }
        return { success: true, bytes, byteCount: totalBytes };
    } catch {
        zeroChunks(chunks);
        return { success: false, reason: "invalid", byteCount: totalBytes };
    } finally {
        reader.releaseLock();
    }
}

function classifyDocumentFailure(error: unknown) {
    if (error instanceof CandidateResumeDocumentProcessingError) {
        if (error.code === "UNSUPPORTED_RESUME_TYPE") return "unsupported_type" as const;
        if (error.code === "RESUME_TOO_LARGE") return "too_large" as const;
        if (error.code === "UNREADABLE_DOCUMENT") return "unreadable_source" as const;
        if (error.code === "EMPTY_EXTRACTION") return "empty_extraction" as const;
        if (error.code === "SOURCE_DISPOSAL_FAILED") return "disposal_failed" as const;
        return "extraction_failed" as const;
    }
    return "persistence_failed" as const;
}

function readDocumentMimeType(value: string | null): CandidateResumeDocumentMimeType | null {
    const normalized = value?.split(";", 1)[0]?.trim().toLowerCase();
    if (normalized === CANDIDATE_RESUME_PDF_MIME_TYPE || normalized === CANDIDATE_RESUME_DOCX_MIME_TYPE) {
        return normalized;
    }
    return null;
}

function readCandidateDocumentLabel(value: string | null) {
    if (!value || Buffer.byteLength(value, "utf8") > CANDIDATE_RESUME_DOCUMENT_NAME_MAX_BYTES) {
        return "Uploaded resume";
    }
    try {
        return decodeURIComponent(value) || "Uploaded resume";
    } catch {
        return "Uploaded resume";
    }
}

function documentFailure(code: CandidateResumeDocumentProcessingError["code"]) {
    const response = code === "RESUME_TOO_LARGE"
        ? { status: 413, error: "That resume is too large. Choose a PDF or DOCX under 5 MB." }
        : code === "UNSUPPORTED_RESUME_TYPE"
            ? { status: 415, error: "Choose a PDF or DOCX resume." }
            : code === "SOURCE_DISPOSAL_FAILED"
                ? { status: 503, error: "I could not safely finish processing that file. Choose it again or paste the resume text." }
                : code === "EMPTY_EXTRACTION"
                    ? { status: 422, error: "I could not find readable text in that file. Paste the text or take photos instead." }
                    : code === "UNREADABLE_DOCUMENT"
                        ? { status: 422, error: "I could not open that document. Try another PDF or DOCX, or paste the resume text." }
                        : { status: 422, error: "I could not extract that resume. Try another file or paste the resume text." };
    return Response.json({ error: response.error, code }, {
        status: response.status,
        headers: { "Cache-Control": "no-store" },
    });
}

function zeroChunks(chunks: Uint8Array[]) {
    for (const chunk of chunks) {
        chunk.fill(0);
    }
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
