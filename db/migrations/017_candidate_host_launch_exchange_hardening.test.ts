import { readFileSync } from "fs";
import { join } from "path";

import { describe, expect, it } from "vitest";

describe("candidate host launch exchange hardening migration", () => {
    const sql = readFileSync(
        join(process.cwd(), "db/migrations/017_candidate_host_launch_exchange_hardening.sql"),
        "utf8",
    ).replace(/\s+/g, " ").toLowerCase();

    it("stores replay-safe token metadata without retaining the raw token", () => {
        expect(sql).toContain("add column if not exists launch_token_id text");
        expect(sql).toContain("add column if not exists launch_token_fingerprint text");
        expect(sql).toContain("add column if not exists launch_token_expires_at timestamptz");
        expect(sql).toContain("create unique index if not exists uq_candidate_launch_sessions_token_fingerprint");
        expect(sql).toContain("create unique index if not exists uq_candidate_launch_sessions_issuer_token_id");
        expect(sql).not.toContain("raw_token");
    });

    it("allows identity-only dashboard launches while rejecting blank job ids", () => {
        expect(sql).toContain("alter column job_collection_id drop not null");
        expect(sql).toContain("job_collection_id is null or length(trim(job_collection_id)) > 0");
    });
});
