import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(process.cwd(), "db", "migrations", "005_backfill_answer_modality_from_analysis.sql");

function migrationSql() {
    return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();
}

describe("answer modality analysis backfill migration", () => {
    it("repairs default text answers when completed analysis proves voice input", () => {
        const sql = migrationSql();

        expect(sql).toContain("update public.answers a");
        expect(sql).toContain("set modality = 'voice'::public.modality_type");
        expect(sql).toContain("from public.eval_results er");
        expect(sql).toContain("er.session_id = a.session_id");
        expect(sql).toContain("er.question_id = a.question_id");
        expect(sql).toContain("a.modality = 'text'::public.modality_type");
        expect(sql).toContain("er.feedback_json -> 'meta' ->> 'modality' = 'voice'");
    });
});
