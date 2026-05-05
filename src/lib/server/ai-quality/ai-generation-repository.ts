import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import type { AiGenerationRecord } from "./types";

export interface AiGenerationRepository {
    create(record: AiGenerationRecord): Promise<string>;
}

export class SupabaseAiGenerationRepository implements AiGenerationRepository {
    async create(record: AiGenerationRecord): Promise<string> {
        const supabase = createAdminClient();
        const generationId = record.generationId ?? randomUUID();

        const { error } = await supabase.from("ai_generations").insert({
            generation_id: generationId,
            app_name: record.appName,
            surface: record.surface,
            status: record.status,
            input_snapshot: record.inputSnapshot,
            context_artifacts: record.contextArtifacts ?? [],
            prompt_snapshot: record.promptSnapshot ?? null,
            prompt_version: record.promptVersion,
            model_provider: record.modelProvider,
            model_name: record.modelName,
            model_params: record.modelParams ?? {},
            raw_output: record.rawOutput ?? null,
            parsed_output: record.parsedOutput ?? null,
            latency_ms: record.latencyMs,
            token_usage: record.tokenUsage ?? null,
            cost_estimate: record.costEstimate ?? null,
            trace_id: record.traceId ?? null,
            correlation_id: record.correlationId ?? null,
            source_refs: record.sourceRefs ?? [],
            created_by: record.createdBy ?? null,
            session_id: record.sessionId ?? null,
            invite_batch_id: record.inviteBatchId ?? null,
            candidate_id: record.candidateId ?? null,
            error_json: record.error ?? null,
            privacy_flags: record.privacyFlags ?? [],
            redaction_status: record.redactionStatus,
            retention_class: record.retentionClass ?? "eval_redacted",
            retention_until: record.retentionUntil ?? null,
        });

        if (error) {
            throw new Error(`Supabase AI Generation Create Error: ${error.message}`);
        }

        return generationId;
    }
}
