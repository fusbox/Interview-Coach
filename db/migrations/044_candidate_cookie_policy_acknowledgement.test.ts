import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
    resolve(process.cwd(), "db/migrations/044_candidate_cookie_policy_acknowledgement.sql"),
    "utf8",
);

describe("candidate Cookie Policy acknowledgement migration", () => {
    it("adds a distinct immutable receipt type", () => {
        expect(migration).toContain("'cookie_policy_acknowledgement'");
        expect(migration).toContain("'talentarbor_cookie_policy'");
        expect(migration).toContain("p_cookie_version");
        expect(migration).toContain("p_cookie_uri");
    });

    it("keeps registration atomic by wrapping the existing transaction function", () => {
        expect(migration).toContain("register_candidate_app_account_v2");
        expect(migration).toContain("register_candidate_app_account_v1");
        expect(migration).toContain("if v_registration.registration_outcome = 'created'");
    });
});
