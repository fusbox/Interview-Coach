import type { CandidateSetupRouteIdentity } from "./candidate-setup-route-identity";
import type { createCandidateSetupResumeSelectionRepository } from "./candidate-setup-resume-selection-repository";
import type {
    CandidateResumeTextArtifact,
    createCandidateResumeTextArtifactRepository,
} from "./candidate-resume-text-artifact-repository";
import {
    classifyCandidateResumeInputSize,
    createCandidateResumeIngestionDiagnostic,
    emitCandidateResumeIngestionDiagnostic,
    type CandidateResumeIngestionDiagnostic,
    type CandidateResumeIngestionDiagnosticReason,
    type CandidateResumeIngestionSizeClass,
    type CandidateResumeIngestionSource,
    type CandidateResumeIngestionTerminalReason,
    type createCandidateResumeIngestionOperationRepository,
} from "./candidate-resume-ingestion-operation-repository";

type OperationRepository = Pick<
    ReturnType<typeof createCandidateResumeIngestionOperationRepository>,
    "claimOperation" | "completeOperationAndPublish" | "failOperation"
>;

type ArtifactRepository = Pick<
    ReturnType<typeof createCandidateResumeTextArtifactRepository>,
    "recoverSelectedArtifact"
>;

type SelectionRepository = Pick<
    ReturnType<typeof createCandidateSetupResumeSelectionRepository>,
    "beginSelectionOperation" | "abandonSelectionOperation"
>;

export type CandidateResumeIngestionRouteDependencies = {
    now: Date;
    clock?: () => number;
    operationRepository: OperationRepository;
    artifactRepository: ArtifactRepository;
    selectionRepository: SelectionRepository;
    onDiagnostic?: (event: CandidateResumeIngestionDiagnostic) => void;
};

export type CandidateResumeIngestionContext = {
    operationId: string;
    identity: CandidateSetupRouteIdentity;
    source: CandidateResumeIngestionSource;
    claimGeneration: number;
    startedAtMs: number;
};

export async function beginCandidateResumeIngestion(input: {
    operationId: string;
    identity: CandidateSetupRouteIdentity;
    source: CandidateResumeIngestionSource;
    dependencies: CandidateResumeIngestionRouteDependencies;
}): Promise<
    | { kind: "acquired"; context: CandidateResumeIngestionContext }
    | { kind: "replayed"; artifact: CandidateResumeTextArtifact }
    | { kind: "denied"; response: Response }
> {
    const now = currentDate(input.dependencies);
    const startedAtMs = now.getTime();
    let claim: Awaited<ReturnType<OperationRepository["claimOperation"]>>;
    try {
        claim = await input.dependencies.operationRepository.claimOperation({
            operationId: input.operationId,
            candidateProfileId: input.identity.candidateProfileId,
            setupOwnerKey: input.identity.setupOwnerKey,
            source: input.source,
            now,
        });
    } catch {
        const response = ingestionResponse(503, "Resume processing is temporarily unavailable. Try again.", "RESUME_ADMISSION_UNAVAILABLE", 10);
        emit(input.dependencies, input.source, "failed", "persistence_failed", response.status, 0, startedAtMs, "unknown", 0);
        return { kind: "denied", response };
    }

    if (claim.outcome === "replayed" && claim.artifactId) {
        const artifact = await input.dependencies.artifactRepository.recoverSelectedArtifact({
            candidateProfileId: input.identity.candidateProfileId,
            setupOwnerKey: input.identity.setupOwnerKey,
            artifactId: claim.artifactId,
        }).catch(() => null);
        if (artifact) {
            emit(input.dependencies, input.source, "replayed", "completed_replay", 200, claim.claimGeneration, startedAtMs, "unknown", 0);
            return { kind: "replayed", artifact };
        }
        const response = ingestionResponse(409, "That resume request no longer matches the current setup. Choose the resume again.", "RESUME_OPERATION_CONFLICT");
        emit(input.dependencies, input.source, "denied", "replay_selection_missing", response.status, claim.claimGeneration, startedAtMs, "unknown", 0);
        return { kind: "denied", response };
    }

    if (claim.outcome !== "acquired") {
        const response = claim.outcome === "in_progress" || claim.outcome === "owner_busy"
            ? ingestionResponse(409, "Resume processing is already in progress. Wait a moment and try again.", "RESUME_PROCESSING_IN_PROGRESS", 3)
            : claim.outcome === "rate_limited"
                ? ingestionResponse(429, "Too many resume requests were started. Wait a minute and try again.", "RESUME_RATE_LIMITED", 60)
                : claim.outcome === "capacity_limited"
                    ? ingestionResponse(503, "Resume processing is busy. Wait a moment and try again.", "RESUME_CAPACITY_LIMITED", 10)
                    : ingestionResponse(409, "That resume request cannot be continued. Choose the resume again.", "RESUME_OPERATION_CONFLICT");
        emit(input.dependencies, input.source, "denied", claim.outcome, response.status, claim.claimGeneration, startedAtMs, "unknown", 0);
        return { kind: "denied", response };
    }

    const context: CandidateResumeIngestionContext = {
        operationId: input.operationId,
        identity: input.identity,
        source: input.source,
        claimGeneration: claim.claimGeneration,
        startedAtMs,
    };
    try {
        await input.dependencies.selectionRepository.beginSelectionOperation({
            candidateProfileId: input.identity.candidateProfileId,
            setupOwnerKey: input.identity.setupOwnerKey,
            operationId: input.operationId,
            now,
        });
        return { kind: "acquired", context };
    } catch {
        const response = ingestionResponse(503, "I could not prepare this resume request. Your setup is still available.", "RESUME_PERSISTENCE_FAILED");
        await failCandidateResumeIngestion({
            context,
            dependencies: input.dependencies,
            terminalReason: "persistence_failed",
            statusCode: response.status,
            inputBytes: 0,
            pageCount: 0,
        });
        return { kind: "denied", response };
    }
}

export async function completeCandidateResumeIngestion(input: {
    context: CandidateResumeIngestionContext;
    dependencies: CandidateResumeIngestionRouteDependencies;
    artifact: CandidateResumeTextArtifact;
    inputBytes: number;
    pageCount: number;
}) {
    const now = currentDate(input.dependencies);
    const durationMs = elapsed(input.context.startedAtMs, now.getTime());
    const inputSizeClass = classifyCandidateResumeInputSize(input.inputBytes);
    let outcome: Awaited<ReturnType<OperationRepository["completeOperationAndPublish"]>>;
    try {
        outcome = await input.dependencies.operationRepository.completeOperationAndPublish({
            operationId: input.context.operationId,
            candidateProfileId: input.context.identity.candidateProfileId,
            setupOwnerKey: input.context.identity.setupOwnerKey,
            source: input.context.source,
            claimGeneration: input.context.claimGeneration,
            artifactId: input.artifact.artifactId,
            inputSizeClass,
            pageCount: input.pageCount,
            durationMs,
            now,
        });
    } catch {
        await failCurrentOperation({
            context: input.context,
            dependencies: input.dependencies,
            terminalReason: "persistence_failed",
            inputSizeClass,
            pageCount: input.pageCount,
            durationMs,
            now,
        });
        const response = ingestionResponse(503, "I could not save this resume review. Your setup is still available.", "RESUME_PERSISTENCE_FAILED");
        emit(input.dependencies, input.context.source, "failed", "persistence_failed", response.status, input.context.claimGeneration, input.context.startedAtMs, inputSizeClass, input.pageCount);
        return response;
    }

    if (outcome === "completed" || outcome === "replayed") {
        emit(input.dependencies, input.context.source, outcome === "completed" ? "accepted" : "replayed", outcome, 200, input.context.claimGeneration, input.context.startedAtMs, inputSizeClass, input.pageCount);
        return null;
    }

    const response = outcome === "superseded"
        ? ingestionResponse(409, "A newer resume choice replaced this one. Review the current setup selection.", "RESUME_SELECTION_STALE")
        : ingestionResponse(409, "Resume processing took too long to finish safely. Choose the resume again.", "RESUME_OPERATION_STALE");
    emit(input.dependencies, input.context.source, outcome === "superseded" ? "superseded" : "failed", outcome, response.status, input.context.claimGeneration, input.context.startedAtMs, inputSizeClass, input.pageCount);
    return response;
}

export async function failCandidateResumeIngestion(input: {
    context: CandidateResumeIngestionContext;
    dependencies: CandidateResumeIngestionRouteDependencies;
    terminalReason: CandidateResumeIngestionTerminalReason;
    statusCode: number;
    inputBytes: number;
    pageCount: number;
}) {
    const now = currentDate(input.dependencies);
    const durationMs = elapsed(input.context.startedAtMs, now.getTime());
    const inputSizeClass = classifyCandidateResumeInputSize(input.inputBytes);
    await failCurrentOperation({
        context: input.context,
        dependencies: input.dependencies,
        terminalReason: input.terminalReason,
        inputSizeClass,
        pageCount: input.pageCount,
        durationMs,
        now,
    });
    emit(input.dependencies, input.context.source, "failed", input.terminalReason, input.statusCode, input.context.claimGeneration, input.context.startedAtMs, inputSizeClass, input.pageCount);
}

async function failCurrentOperation(input: {
    context: CandidateResumeIngestionContext;
    dependencies: CandidateResumeIngestionRouteDependencies;
    terminalReason: CandidateResumeIngestionTerminalReason;
    inputSizeClass: CandidateResumeIngestionSizeClass;
    pageCount: number;
    durationMs: number;
    now: Date;
}) {
    const outcome = await input.dependencies.operationRepository.failOperation({
        operationId: input.context.operationId,
        candidateProfileId: input.context.identity.candidateProfileId,
        setupOwnerKey: input.context.identity.setupOwnerKey,
        source: input.context.source,
        claimGeneration: input.context.claimGeneration,
        terminalReason: input.terminalReason,
        inputSizeClass: input.inputSizeClass,
        pageCount: input.pageCount,
        durationMs: input.durationMs,
        now: input.now,
    }).catch(() => "stale_claim" as const);

    if (outcome === "failed") {
        await input.dependencies.selectionRepository.abandonSelectionOperation({
            candidateProfileId: input.context.identity.candidateProfileId,
            setupOwnerKey: input.context.identity.setupOwnerKey,
            operationId: input.context.operationId,
            now: input.now,
        }).catch(() => false);
    }
    return outcome;
}

function emit(
    dependencies: CandidateResumeIngestionRouteDependencies,
    source: CandidateResumeIngestionSource,
    outcome: CandidateResumeIngestionDiagnostic["outcome"],
    reason: CandidateResumeIngestionDiagnosticReason,
    statusCode: number,
    claimGeneration: number,
    startedAtMs: number,
    inputSizeClass: CandidateResumeIngestionSizeClass,
    pageCount: number,
) {
    const nowMs = currentDate(dependencies).getTime();
    emitCandidateResumeIngestionDiagnostic(createCandidateResumeIngestionDiagnostic({
        source,
        outcome,
        reason,
        statusCode,
        claimGeneration,
        durationMs: elapsed(startedAtMs, nowMs),
        inputSizeClass,
        pageCount,
    }), dependencies.onDiagnostic);
}

function ingestionResponse(status: number, error: string, code: string, retryAfterSeconds?: number) {
    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    if (retryAfterSeconds) headers["Retry-After"] = String(retryAfterSeconds);
    return Response.json({ error, code }, { status, headers });
}

function currentDate(dependencies: Pick<CandidateResumeIngestionRouteDependencies, "now" | "clock">) {
    return new Date(dependencies.clock ? dependencies.clock() : dependencies.now.getTime());
}

function elapsed(startedAtMs: number, endedAtMs: number) {
    return Math.min(300000, Math.max(0, Math.floor(endedAtMs - startedAtMs)));
}
