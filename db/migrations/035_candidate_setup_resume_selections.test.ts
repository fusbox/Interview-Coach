import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("035 candidate setup resume selections migration", () => {
    const migration = readFileSync(join(process.cwd(), "db/migrations/035_candidate_setup_resume_selections.sql"), "utf8");

    it("keeps setup recovery candidate-owned, text-free, and lifecycle constrained", () => {
        expect(migration).toContain("create table if not exists public.candidate_setup_resume_selections");
        expect(migration).toContain("primary key (candidate_profile_id, setup_owner_key)");
        expect(migration).toContain("lifecycle_state in ('pending', 'active', 'cleared', 'consumed')");
        expect(migration).toContain("fk_candidate_setup_resume_selection_artifact");
        expect(migration).toContain("fk_candidate_setup_resume_selection_session");
        expect(migration).not.toMatch(/normalized_text|source_fingerprint|bytea|blob|object_key|storage_path/i);
    });

    it("stores operation, artifact, prep-context, and session pointers in disjoint lifecycle shapes", () => {
        expect(migration).toContain("pending_operation_id uuid");
        expect(migration).toContain("candidate_resume_artifact_id uuid");
        expect(migration).toContain("consumed_role_profile_id uuid");
        expect(migration).toContain("consumed_candidate_practice_session_id uuid");
        expect(migration).toContain("chk_candidate_setup_resume_shape");
    });
});
