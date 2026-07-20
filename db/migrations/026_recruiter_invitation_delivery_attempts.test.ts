import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "db/migrations/026_recruiter_invitation_delivery_attempts.sql"), "utf8");

describe("recruiter invitation delivery-attempt migration", () => {
    it("defines recipient-owned append-on-retry attempts with a truthful provider lifecycle", () => {
        expect(sql).toContain("create table if not exists public.recruiter_invitation_delivery_attempts");
        expect(sql).toContain("unique (recruiter_invitation_recipient_id, attempt_number)");
        expect(sql).toContain("retry_of_delivery_attempt_id");
        expect(sql).toContain("'provider_accepted'");
        expect(sql).toContain("'outcome_unknown'");
        expect(sql).toContain("claim_recruiter_invitation_delivery_attempt");
        expect(sql).toContain("pg_advisory_xact_lock");
        expect(sql).toContain("queued_claim_expired");
        expect(sql).toContain("sending_lease_expired");
        expect(sql).toContain("prevent_recruiter_invitation_delivery_attempt_mutation");
        expect(sql).not.toContain("raw_action_key");
        expect(sql).not.toContain("invite_link");
        expect(sql).not.toContain("message_body");
    });
});
