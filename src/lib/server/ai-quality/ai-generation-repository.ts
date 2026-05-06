import { randomUUID } from "crypto";
import type { Pool } from "pg";
import type { AiGenerationRecord } from "./types";
import { getOptionalServerEnv } from "@/lib/server/config/server-env";
import { getPostgresPool } from "@/lib/server/db/postgres";

export interface AiGenerationRepository {
    create(record: AiGenerationRecord): Promise<string>;
}

export type AiGenerationRepositoryBackend = "postgres";

export function getAiGenerationRepositoryBackend(): AiGenerationRepositoryBackend {
    const configured = getOptionalServerEnv("AI_GENERATION_REPOSITORY_BACKEND")?.toLowerCase();
    if (!configured) {
        return "postgres";
    }

    if (configured === "postgres") {
        return configured;
    }

    throw new Error(`Unsupported AI_GENERATION_REPOSITORY_BACKEND value "${configured}". Expected "postgres".`);
}

export function createAiGenerationRepository(): AiGenerationRepository {
    getAiGenerationRepositoryBackend();
    return new PostgresAiGenerationRepository();
}

export class PostgresAiGenerationRepository implements AiGenerationRepository {
    constructor(private readonly pool: Pool = getPostgresPool()) {}

    async create(record: AiGenerationRecord): Promise<string> {
        const generationId = record.generationId ?? randomUUID();

        try {
            await this.pool.query(
                `
                    insert into public.ai_generations (
                        generation_id,
                        app_name,
                        surface,
                        status,
                        input_snapshot,
                        context_artifacts,
                        prompt_snapshot,
                        prompt_version,
                        model_provider,
                        model_name,
                        model_params,
                        raw_output,
                        parsed_output,
                        latency_ms,
                        token_usage,
                        cost_estimate,
                        trace_id,
                        correlation_id,
                        source_refs,
                        created_by,
                        session_id,
                        invite_batch_id,
                        candidate_id,
                        error_json,
                        privacy_flags,
                        redaction_status,
                        retention_class,
                        retention_until
                    )
                    values (
                        $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10,
                        $11::jsonb, $12::jsonb, $13::jsonb, $14, $15::jsonb, $16, $17, $18,
                        $19::jsonb, $20, $21, $22, $23, $24::jsonb, $25::text[], $26, $27, $28
                    )
                `,
                [
                    generationId,
                    record.appName,
                    record.surface,
                    record.status,
                    JSON.stringify(record.inputSnapshot ?? {}),
                    JSON.stringify(record.contextArtifacts ?? []),
                    record.promptSnapshot === undefined ? null : JSON.stringify(record.promptSnapshot),
                    record.promptVersion,
                    record.modelProvider,
                    record.modelName,
                    JSON.stringify(record.modelParams ?? {}),
                    record.rawOutput === undefined ? null : JSON.stringify(record.rawOutput),
                    record.parsedOutput === undefined ? null : JSON.stringify(record.parsedOutput),
                    record.latencyMs,
                    record.tokenUsage === undefined ? null : JSON.stringify(record.tokenUsage),
                    record.costEstimate ?? null,
                    record.traceId ?? null,
                    record.correlationId ?? null,
                    JSON.stringify(record.sourceRefs ?? []),
                    record.createdBy ?? null,
                    record.sessionId ?? null,
                    record.inviteBatchId ?? null,
                    record.candidateId ?? null,
                    record.error === undefined ? null : JSON.stringify(record.error),
                    record.privacyFlags ?? [],
                    record.redactionStatus,
                    record.retentionClass ?? "eval_redacted",
                    record.retentionUntil ?? null,
                ]
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Postgres AI Generation Create Error: ${message}`);
        }

        return generationId;
    }
}
