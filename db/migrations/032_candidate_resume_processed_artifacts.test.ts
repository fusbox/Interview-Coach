import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
    join(process.cwd(), "db/migrations/032_candidate_resume_processed_artifacts.sql"),
    "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("candidate resume processed artifacts migration", () => {
    it("stores only candidate-owned processed text and exact policy provenance", () => {
        expect(migration).toContain("create table if not exists public.candidate_resume_processed_artifacts");
        expect(migration).toContain("foreign key (candidate_profile_id, role_profile_id)");
        expect(migration).toContain("source_fingerprint text not null");
        expect(migration).toContain("processing_policy_version text not null");
        expect(migration).toContain("pii_policy_version text not null");
        expect(migration).toContain("original_retained boolean not null default false");
        expect(migration).not.toContain("source_text");
        expect(migration).not.toContain("source_path");
        expect(migration).not.toContain("source_bytes");
    });

    it("fences review acceptance and keeps accepted text immutable", () => {
        expect(migration).toContain("review_state in ('awaiting_review', 'accepted', 'replaced')");
        expect(migration).toContain("candidate resume review permits one revision-fenced review or acceptance step");
        expect(migration).toContain("accepted candidate resume text is immutable");
        expect(migration).toContain("replaced candidate resume artifacts are immutable");
    });
});
