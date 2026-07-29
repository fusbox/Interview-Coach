import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const seedPath = path.join(process.cwd(), "db", "seeds", "004_candidate_app_account_dev_seed.sql");
const packagePath = path.join(process.cwd(), "package.json");

describe("candidate app-account development seed", () => {
    it("provides two deterministic, verified, candidate-only browser identities", async () => {
        const sql = await readFile(seedPath, "utf8");

        expect(sql).toContain("candidate-account-primary@talentarbor.local");
        expect(sql).toContain("candidate-account-alt@talentarbor.local");
        expect(sql).toContain("local-only-candidate");
        expect(sql).toContain("'candidate'");
        expect(sql).toContain("'interview_coach'");
        expect(sql).toContain("email_verified_at");
        expect(sql).toContain("candidate_consent_receipts");
        expect(sql).not.toContain("'recruiter'");
    });

    it("keeps the seed and recovery smoke explicit and local-only", async () => {
        const packageJson = JSON.parse(await readFile(packagePath, "utf8"));

        expect(packageJson.scripts["db:seed-candidate-app-account-dev"]).toContain(
            "004_candidate_app_account_dev_seed.sql",
        );
        expect(packageJson.scripts["db:seed-candidate-app-account-dev"]).toContain("--local-smoke-only");
        expect(packageJson.scripts["db:smoke-candidate-account-recovery"]).toContain(
            "031_candidate_account_recovery_smoke.sql",
        );
    });
});
