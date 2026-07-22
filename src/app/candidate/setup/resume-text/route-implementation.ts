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
    CANDIDATE_RESUME_TEXT_SOURCE_MAX_LENGTH,
    CandidateResumeTextProcessingError,
} from "@/features/candidate-setup-v2/candidate-resume-text-processing";
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

const CANDIDATE_RESUME_TEXT_REQUEST_MAX_BYTES = CANDIDATE_RESUME_TEXT_SOURCE_MAX_LENGTH * 2;

type CandidateResumeArtifactRepository = Pick<
    ReturnType<typeof createCandidateResumeTextArtifactRepository>,
    "createOrRecoverReviewArtifact" | "acceptReview" | "recoverSelectedArtifact"
>;

type CandidateResumeSelectionRepository = Pick<
    ReturnType<typeof createCandidateSetupResumeSelectionRepository>,
    "beginSelectionOperation" | "abandonSelectionOperation" | "clearSelection"
>;

export type CandidateResumeTextRouteDependencies = CandidateResumeIngestionRouteDependencies & {
    now: Date;
    resolveIdentity: (request: Request) => Promise<CandidateSetupRouteIdentity | null>;
    artifactRepository: CandidateResumeArtifactRepository;
    selectionRepository: CandidateResumeSelectionRepository;
};

export async function handleCandidateResumeTextProcessRequest(
    request: Request,
    dependencies: CandidateResumeTextRouteDependencies,
) {
    const guard = await guardCandidateResumeMutation(request, dependencies.resolveIdentity);
    if (guard instanceof Response) {
        return guard;
    }

    const operationId = readCandidateResumeSelectionOperationId(
        request.headers.get(CANDIDATE_RESUME_SELECTION_OPERATION_HEADER),
    );
    if (!operationId) {
        return Response.json({ error: "Resume processing request is missing its operation key." }, { status: 400 });
    }

    const admission = await beginCandidateResumeIngestion({
        operationId,
        identity: guard,
        source: "pasted_text",
        dependencies,
    });
    if (admission.kind === "denied") return admission.response;
    if (admission.kind === "replayed") {
        return Response.json({ artifact: toPublicArtifact(admission.artifact) }, {
            status: admission.artifact.reviewState === "accepted" ? 200 : 201,
            headers: { "Cache-Control": "no-store" },
        });
    }

    const bodyResult = await readBoundedJsonRequest(request);
    if (!bodyResult.success) {
        const status = bodyResult.reason === "too_large" ? 413 : 400;
        await failCandidateResumeIngestion({
            context: admission.context,
            dependencies,
            terminalReason: bodyResult.reason === "too_large" ? "too_large" : "invalid_request",
            statusCode: status,
            inputBytes: bodyResult.byteCount,
            pageCount: 0,
        });
        if (bodyResult.reason === "too_large") {
            return Response.json({ error: "Resume text is too large.", code: "RESUME_TOO_LARGE" }, { status: 413 });
        }
        return Response.json({ error: "Resume text could not be read.", code: "INVALID_RESUME_TEXT" }, { status: 400 });
    }
    const record = toRecord(bodyResult.value);
    if (record.source !== "pasted_text") {
        await failCandidateResumeIngestion({
            context: admission.context,
            dependencies,
            terminalReason: "invalid_request",
            statusCode: 400,
            inputBytes: bodyResult.byteCount,
            pageCount: 0,
        });
        return Response.json({ error: "That resume source is not available here.", code: "INVALID_RESUME_TEXT" }, { status: 400 });
    }

    try {
        const artifact = await dependencies.artifactRepository.createOrRecoverReviewArtifact({
            candidateProfileId: guard.candidateProfileId,
            source: "pasted_text",
            text: record.text,
            candidateLabel: "Pasted resume",
            now: dependencies.now,
        });
        const completionFailure = await completeCandidateResumeIngestion({
            context: admission.context,
            dependencies,
            artifact,
            inputBytes: bodyResult.byteCount,
            pageCount: 0,
        });
        if (completionFailure) return completionFailure;
        return Response.json({ artifact: toPublicArtifact(artifact) }, {
            status: artifact.reviewState === "accepted" ? 200 : 201,
            headers: { "Cache-Control": "no-store" },
        });
    } catch (error) {
        const response = createCandidateResumeTextFailureResponse(error);
        await failCandidateResumeIngestion({
            context: admission.context,
            dependencies,
            terminalReason: classifyTextFailure(error),
            statusCode: response.status,
            inputBytes: bodyResult.byteCount,
            pageCount: 0,
        });
        return response;
    }
}

export async function handleCandidateResumeTextAcceptRequest(
    request: Request,
    artifactId: string,
    dependencies: CandidateResumeTextRouteDependencies,
) {
    const guard = await guardCandidateResumeMutation(request, dependencies.resolveIdentity);
    if (guard instanceof Response) {
        return guard;
    }

    const bodyResult = await readBoundedJsonRequest(request);
    if (!bodyResult.success) {
        if (bodyResult.reason === "too_large") {
            return Response.json({ error: "Resume text is too large.", code: "RESUME_TOO_LARGE" }, { status: 413 });
        }
        return Response.json({ error: "Resume review could not be read.", code: "INVALID_RESUME_TEXT" }, { status: 400 });
    }
    const record = toRecord(bodyResult.value);
    const version = readPositiveInteger(record.version);
    const revision = readPositiveInteger(record.revision);
    if (!version || !revision || typeof record.reviewedText !== "string") {
        return Response.json({ error: "Resume review details are invalid.", code: "INVALID_RESUME_TEXT" }, { status: 400 });
    }

    try {
        const result = await dependencies.artifactRepository.acceptReview({
            candidateProfileId: guard.candidateProfileId,
            setupOwnerKey: guard.setupOwnerKey,
            artifactId,
            expectedVersion: version,
            expectedRevision: revision,
            reviewedText: record.reviewedText,
            now: dependencies.now,
        });
        return Response.json({
            outcome: result.outcome,
            artifact: toPublicArtifact(result.artifact),
        }, {
            status: 200,
            headers: { "Cache-Control": "no-store" },
        });
    } catch (error) {
        return createCandidateResumeTextFailureResponse(error);
    }
}

export async function handleCandidateResumeSelectionClearRequest(
    request: Request,
    dependencies: CandidateResumeTextRouteDependencies,
) {
    const guard = await guardCandidateResumeMutation(request, dependencies.resolveIdentity);
    if (guard instanceof Response) return guard;

    try {
        await dependencies.selectionRepository.clearSelection({
            candidateProfileId: guard.candidateProfileId,
            setupOwnerKey: guard.setupOwnerKey,
            now: dependencies.now,
        });
        return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    } catch {
        return Response.json({
            error: "I could not clear that resume selection. Try again.",
            code: "RESUME_PERSISTENCE_FAILED",
        }, { status: 503 });
    }
}

export function createDefaultCandidateResumeTextRouteDependencies(): CandidateResumeTextRouteDependencies | null {
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

async function guardCandidateResumeMutation(
    request: Request,
    resolveIdentity: CandidateResumeTextRouteDependencies["resolveIdentity"],
): Promise<CandidateSetupRouteIdentity | Response> {
    if (!isTrustedSameOriginMutationRequest(request)) {
        return Response.json({ error: "Resume processing request was not accepted." }, { status: 403 });
    }
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > CANDIDATE_RESUME_TEXT_REQUEST_MAX_BYTES) {
        return Response.json({ error: "Resume text is too large.", code: "RESUME_TOO_LARGE" }, { status: 413 });
    }
    const identity = await resolveIdentity(request);
    if (!identity) {
        return Response.json({ error: "Candidate access could not be verified." }, { status: 401 });
    }
    return identity;
}

async function readBoundedJsonRequest(request: Request): Promise<
    | { success: true; value: unknown; byteCount: number }
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
            if (totalBytes > CANDIDATE_RESUME_TEXT_REQUEST_MAX_BYTES) {
                await reader.cancel().catch(() => undefined);
                return { success: false, reason: "too_large", byteCount: totalBytes };
            }
            chunks.push(result.value);
        }

        const bytes = new Uint8Array(totalBytes);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
        }
        const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        return { success: true, value: JSON.parse(text) as unknown, byteCount: totalBytes };
    } catch {
        return { success: false, reason: "invalid", byteCount: totalBytes };
    } finally {
        reader.releaseLock();
    }
}

function classifyTextFailure(error: unknown) {
    if (error instanceof CandidateResumeTextProcessingError) {
        if (error.code === "RESUME_TOO_LARGE") return "too_large" as const;
        if (error.code === "EMPTY_EXTRACTION") return "empty_extraction" as const;
        return "extraction_failed" as const;
    }
    return "persistence_failed" as const;
}

function createCandidateResumeTextFailureResponse(error: unknown) {
    if (error instanceof CandidateResumeTextProcessingError) {
        const status = error.code === "RESUME_TOO_LARGE" ? 413 : 422;
        return Response.json({
            error: error.code === "EMPTY_EXTRACTION"
                ? "I could not find enough resume content to review."
                : error.code === "RESUME_TOO_LARGE"
                    ? "Resume text is too large."
                    : "I could not prepare that resume text for review.",
            code: error.code,
        }, { status });
    }
    if (error instanceof CandidateResumeArtifactRepositoryError) {
        if (error.code === "NOT_FOUND") {
            return Response.json({ error: "Resume review could not be found.", code: "RESUME_REVIEW_NOT_FOUND" }, { status: 404 });
        }
        if (error.code === "STALE_REVISION") {
            return Response.json({
                error: "This resume review changed in another tab. Review the latest version and try again.",
                code: "RESUME_REVIEW_STALE",
            }, { status: 409 });
        }
        if (error.code === "STALE_POLICY") {
            return Response.json({
                error: "Resume protection has been updated. Review this text again before using it.",
                code: "RESUME_REVIEW_POLICY_CHANGED",
            }, { status: 409 });
        }
    }
    return Response.json({
        error: "I could not save this resume review. Your setup is still available.",
        code: "RESUME_PERSISTENCE_FAILED",
    }, { status: 503 });
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

function toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readPositiveInteger(value: unknown) {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
