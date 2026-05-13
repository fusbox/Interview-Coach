import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const seedPath = path.join(process.cwd(), "db", "seeds", "001_candidate_dev_seed.sql");
const packagePath = path.join(process.cwd(), "package.json");

describe("candidate dev seed", () => {
    it("exposes local candidate seed commands", async () => {
        const packageJson = JSON.parse(await readFile(packagePath, "utf8"));

        expect(packageJson.scripts["db:seed-candidate-dev"]).toContain("db/seeds/001_candidate_dev_seed.sql");
        expect(packageJson.scripts["db:seed-candidate-dev"]).toContain("--smoke-defaults");
        expect(packageJson.scripts["db:smoke-candidate-dev-seed"]).toContain("db/validation/004_candidate_dev_seed_smoke.sql");
        expect(packageJson.scripts["db:seed"]).toBe("npm run db:seed-candidate-dev");
    });

    it("seeds deterministic candidates, identities, drafts, and sessions for local ownership testing", async () => {
        const sql = await readFile(seedPath, "utf8");

        expect(sql).toContain("candidate-dev-primary@talentarbor.local");
        expect(sql).toContain("candidate-dev-alt@talentarbor.local");
        expect(sql).toContain("CANDIDATE_DEV_EMAIL=candidate-dev-primary@talentarbor.local");
        expect(sql).toContain("CANDIDATE_DEV_EMAIL=candidate-dev-alt@talentarbor.local");
        expect(sql).toContain("provider, issuer, subject");
        expect(sql).toContain("on conflict (auth_subject)");
        expect(sql).toContain("on conflict (provider, issuer, subject)");
        expect(sql).toContain("candidate_practice_drafts");
        expect(sql).toContain("'draft'");
        expect(sql).toContain("'in_session'");
        expect(sql).toContain("'completed'");
        expect(sql).toContain("public.sessions");
        expect(sql).toContain("public.questions");
        expect(sql).toContain("public.answers");
    });

    it("defines a rollback-only smoke validation for seeded ownership data", async () => {
        const sql = await readFile(
            path.join(process.cwd(), "db", "validation", "004_candidate_dev_seed_smoke.sql"),
            "utf8"
        );

        expect(sql).toContain("candidate-dev-primary@talentarbor.local");
        expect(sql).toContain("candidate-dev-alt@talentarbor.local");
        expect(sql).toContain("expected primary candidate dev drafts");
        expect(sql).toContain("expected alternate candidate ownership fixture");
        expect(sql).toContain("rollback");
    });
});
