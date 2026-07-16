import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function migrationSql() {
    const migrationPath = path.join(
        process.cwd(),
        "db",
        "migrations",
        "016_candidate_answer_evaluator_configuration_manifest.sql",
    );
    return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();
}

describe("candidate answer evaluator configuration manifest migration", () => {
    it("backfills only pre-manifest V2 rows without inventing effective settings", () => {
        const sql = migrationSql();

        expect(sql).toContain("add column if not exists configuration_manifest_json jsonb");
        expect(sql).toContain("add column if not exists configuration_fingerprint text");
        expect(sql).toContain("'configurationstatus', 'pre_manifest_v2'");
        expect(sql).toContain("'servicemode', 'unknown'");
        expect(sql).toContain("'adapterversion', 'unknown'");
        expect(sql).toContain("digest(convert_to(configuration_manifest_json::text, 'utf8'), 'sha256')");
        expect(sql).not.toContain("legacy_v1");
    });

    it("requires aligned immutable configuration identity on future evaluator runs", () => {
        const sql = migrationSql();

        expect(sql).toContain("alter column configuration_manifest_json set not null");
        expect(sql).toContain("alter column configuration_fingerprint set not null");
        expect(sql).toContain("configuration_manifest_json ->> 'profileid' = model_name");
        expect(sql).toContain("configuration_manifest_json ->> 'pipelineprovider' = provider");
        expect(sql).toContain("configuration_fingerprint ~ '^[a-f0-9]{64}$'");
        expect(sql).toContain("new candidate answer evaluator runs require resolved configuration");
        expect(sql).toContain("before insert on public.candidate_answer_evaluation_runs");
        expect(sql).toContain("new.configuration_manifest_json");
        expect(sql).toContain("new.configuration_fingerprint");
        expect(sql).toContain("identity, configuration, generation, lease, and input metadata are immutable");
    });
});
