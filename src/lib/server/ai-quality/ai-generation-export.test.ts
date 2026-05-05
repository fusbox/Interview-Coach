import { describe, expect, it } from "vitest";
import type { AiGenerationListItem } from "./ai-generation-read-repository";
import {
    buildAiGenerationExportFilename,
    buildAiGenerationExportPayload,
    formatAiGenerationsCsv,
} from "./ai-generation-export";

function record(overrides: Partial<AiGenerationListItem> = {}): AiGenerationListItem {
    return {
        generation_id: "generation-1",
        app_name: "recruiter_app",
        surface: "answer_feedback",
        status: "success",
        input_snapshot: { answer: "I improved pick accuracy." },
        context_artifacts: [],
        prompt_snapshot: { promptVersion: "answer-feedback-v1" },
        prompt_version: "answer-feedback-v1",
        model_provider: "gemini",
        model_name: "gemini-2.5-flash",
        model_params: {},
        raw_output: { text: "raw" },
        parsed_output: { ack: "Nice setup." },
        latency_ms: 1200,
        token_usage: null,
        cost_estimate: null,
        trace_id: null,
        correlation_id: null,
        source_refs: [],
        created_by: null,
        session_id: "session-1",
        invite_batch_id: null,
        candidate_id: null,
        error_json: null,
        privacy_flags: ["contains_answer"],
        redaction_status: "redacted",
        retention_class: "eval_redacted",
        retention_until: null,
        created_at: "2026-05-02T12:00:00.000Z",
        ...overrides,
    };
}

describe("AI generation exports", () => {
    it("builds a JSON export payload with filters and count", () => {
        const payload = buildAiGenerationExportPayload({
            records: [record()],
            filters: { surface: "answer_feedback", status: "success", limit: 25 },
            exportedAt: "2026-05-02T12:30:00.000Z",
        });

        expect(payload).toMatchObject({
            exported_at: "2026-05-02T12:30:00.000Z",
            filters: {
                surface: "answer_feedback",
                status: "success",
                limit: 25,
            },
            count: 1,
        });
    });

    it("formats CSV with JSON fields, escaped quotes, and spreadsheet formula protection", () => {
        const csv = formatAiGenerationsCsv([
            record({
                generation_id: "=danger",
                parsed_output: { ack: 'He said "hello".' },
            }),
        ]);

        expect(csv).toContain("\"generation_id\"");
        expect(csv).toContain("\"'=danger\"");
        expect(csv).toContain("\"{\"\"ack\"\":\"\"He said \\\"\"hello\\\"\".\"\"}\"");
    });

    it("builds deterministic export filenames", () => {
        expect(buildAiGenerationExportFilename({
            format: "csv",
            surface: "hint",
            status: "failed",
            exportedAt: "2026-05-02T12:30:00.000Z",
        })).toBe("ai-generations_hint_failed_2026-05-02T12-30-00-000Z.csv");
    });
});
