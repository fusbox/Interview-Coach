import { Logger } from "@/lib/logger";
import type { AiGenerationRecord } from "./types";
import {
    createAiGenerationRepository,
    type AiGenerationRepository,
} from "./ai-generation-repository";

export type CaptureAiGenerationDependencies = {
    repository?: AiGenerationRepository;
};

export async function captureAiGeneration(
    record: AiGenerationRecord,
    dependencies: CaptureAiGenerationDependencies = {}
): Promise<string | null> {
    const repository = dependencies.repository ?? createAiGenerationRepository();

    try {
        return await repository.create(record);
    } catch (error) {
        Logger.warn("[AIQuality] Failed to capture AI generation", {
            error,
            surface: record.surface,
            status: record.status,
            correlationId: record.correlationId,
        }, "AIQuality");

        try {
            return await repository.create(buildFallbackRecord(record, error));
        } catch (fallbackError) {
            Logger.warn("[AIQuality] Failed to capture fallback AI generation", {
                error: fallbackError,
                originalError: error,
                surface: record.surface,
                status: record.status,
                correlationId: record.correlationId,
            }, "AIQuality");
            return null;
        }
    }
}

function buildFallbackRecord(record: AiGenerationRecord, error: unknown): AiGenerationRecord {
    return {
        appName: record.appName,
        surface: record.surface,
        status: "partial",
        inputSnapshot: {
            captureFallback: true,
            originalStatus: record.status,
            originalInputAvailable: record.inputSnapshot !== undefined && record.inputSnapshot !== null,
            originalPromptAvailable: record.promptSnapshot !== undefined && record.promptSnapshot !== null,
            originalRawOutputAvailable: record.rawOutput !== undefined && record.rawOutput !== null,
            originalParsedOutputAvailable: record.parsedOutput !== undefined && record.parsedOutput !== null,
        },
        contextArtifacts: [],
        promptSnapshot: {
            captureFallback: true,
            promptVersion: record.promptVersion,
        },
        promptVersion: record.promptVersion,
        modelProvider: record.modelProvider,
        modelName: record.modelName,
        modelParams: {},
        rawOutput: null,
        parsedOutput: null,
        latencyMs: record.latencyMs,
        tokenUsage: record.tokenUsage,
        costEstimate: record.costEstimate,
        traceId: record.traceId,
        correlationId: record.correlationId,
        sourceRefs: record.sourceRefs ?? [],
        error: {
            captureError: serializeCaptureError(error),
            originalStatus: record.status,
        },
        privacyFlags: Array.from(new Set([...(record.privacyFlags ?? []), "capture_fallback"])),
        redactionStatus: record.redactionStatus,
        retentionClass: record.retentionClass,
        retentionUntil: record.retentionUntil,
    };
}

function serializeCaptureError(error: unknown) {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
        };
    }

    return { message: String(error) };
}
