import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
    process.cwd(),
    "db",
    "migrations",
    "019_candidate_coach_update_configuration_identity.sql",
);

function migrationSql() {
    return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();
}

describe("candidate Coach Update configuration identity migration", () => {
    it("adds paired profile and configuration fingerprint metadata", () => {
        const sql = migrationSql();
        expect(sql).toContain("add column if not exists profile_id text");
        expect(sql).toContain("add column if not exists configuration_fingerprint text");
        expect(sql).toContain("profile_id is not null");
        expect(sql).toContain("configuration_fingerprint is not null");
        expect(sql).toContain("configuration_fingerprint ~ '^[a-f0-9]{64}$'");
        expect(sql).toContain(") not valid");
    });

    it("indexes configuration-aware replay and freezes both fields at terminal transition", () => {
        const sql = migrationSql();
        expect(sql).toContain("idx_candidate_coach_update_source_configuration");
        expect(sql).toContain("new.profile_id");
        expect(sql).toContain("old.profile_id");
        expect(sql).toContain("new.configuration_fingerprint");
        expect(sql).toContain("old.configuration_fingerprint");
    });
});
