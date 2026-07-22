import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const sql = readFileSync("db/migrations/036_candidate_resume_ingestion_operations.sql", "utf8");

describe("candidate resume ingestion operations migration", () => {
    it("creates metadata-only admission state without resume content columns", () => {
        expect(sql).toContain("create table if not exists public.candidate_resume_ingestion_operations");
        expect(sql).toContain("source text not null");
        expect(sql).toContain("claim_generation integer not null");
        expect(sql).toContain("input_size_class text not null");
        expect(sql).not.toMatch(/raw_(?:text|bytes)|resume_text|ocr_output|source_path/);
    });

    it("serializes cross-instance claims and fences generation-bound publication", () => {
        expect(sql).toContain("pg_advisory_xact_lock");
        expect(sql).toContain("claim_candidate_resume_ingestion_operation");
        expect(sql).toContain("complete_candidate_resume_ingestion_operation");
        expect(sql).toContain("fail_candidate_resume_ingestion_operation");
        expect(sql).toContain("v_operation.claim_generation <> p_claim_generation");
        expect(sql).toContain("selection.pending_operation_id = p_operation_id");
        expect(sql).toContain("return 'superseded'");
    });

    it("supports replay, active-owner/global limits, and bounded stale recovery", () => {
        expect(sql).toContain("'replayed'");
        expect(sql).toContain("'owner_busy'");
        expect(sql).toContain("'rate_limited'");
        expect(sql).toContain("'capacity_limited'");
        expect(sql).toContain("claim_generation = operation.claim_generation + 1");
        expect(sql).toContain("claim_generation between 1 and 3");
    });
});
