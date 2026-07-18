import { readFileSync } from "fs";
import { join } from "path";

import { describe, expect, it } from "vitest";

describe("candidate host launch setup context migration", () => {
    const sql = readFileSync(
        join(process.cwd(), "db/migrations/018_candidate_host_launch_setup_context.sql"),
        "utf8",
    ).replace(/\s+/g, " ").toLowerCase();

    it("stores one expiring trusted setup context per launch session", () => {
        expect(sql).toContain("create table if not exists public.candidate_launch_setup_contexts");
        expect(sql).toContain("candidate_launch_session_id uuid primary key");
        expect(sql).toContain("foreign key (candidate_launch_session_id, candidate_profile_id)");
        expect(sql).toContain("job_description_snapshot text not null");
        expect(sql).toContain("expires_at timestamptz not null");
        expect(sql).toContain("add column if not exists setup_context_consumed_at timestamptz");
        expect(sql).not.toContain("resume");
    });

    it("separates manual role/JD identity from host job identity", () => {
        expect(sql).toContain("create unique index if not exists ux_candidate_role_profiles_manual_role_jd_path");
        expect(sql).toContain("create unique index if not exists ux_candidate_role_profiles_host_job_path");
        expect(sql).toContain("source_job_collection_id text");
        expect(sql).toContain("source_launch_session_id uuid");
    });
});
