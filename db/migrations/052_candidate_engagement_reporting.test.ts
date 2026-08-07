import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
    resolve(process.cwd(), "db/migrations/052_candidate_engagement_reporting.sql"),
    "utf8",
);

describe("candidate engagement reporting migration", () => {
    it("creates an append-only candidate-session-owned slice ledger", () => {
        expect(migration).toContain("create table if not exists public.candidate_engagement_slices");
        expect(migration).toContain("foreign key (candidate_practice_session_id, candidate_profile_id)");
        expect(migration).toContain("create unique index if not exists uq_candidate_practice_session_owner");
        expect(migration).toContain("on delete cascade");
        expect(migration).toContain("unique (");
        expect(migration).toContain("tracker_instance_id");
        expect(migration).toContain("sequence_number");
    });

    it("bounds telemetry vocabulary, duration, and runtime access", () => {
        expect(migration).toContain("active_milliseconds between 1 and 60000");
        expect(migration).toContain("chk_candidate_engagement_opened_by");
        expect(migration).toContain("chk_candidate_engagement_last_activity");
        expect(migration).toContain("chk_candidate_engagement_flush_reason");
        expect(migration).toContain("enable row level security");
        expect(migration).toContain("grant select, insert");
        expect(migration).toContain("revoke all privileges");
        expect(migration).not.toContain("grant update");
        expect(migration).not.toContain("grant delete");
    });
});
