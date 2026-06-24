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
        expect(packageJson.scripts["db:seed-candidate-preview"]).toContain("db/seeds/002_candidate_preview_irma_seed.sql");
        expect(packageJson.scripts["db:seed-candidate-preview"]).not.toContain("--smoke-defaults");
        expect(packageJson.scripts["db:smoke-candidate-dev-seed"]).toContain("db/validation/004_candidate_dev_seed_smoke.sql");
        expect(packageJson.scripts["db:smoke-candidate-preview-seed"]).toContain("db/validation/007_candidate_preview_irma_seed_smoke.sql");
        expect(packageJson.scripts["db:smoke-candidate-preview-seed"]).not.toContain("--smoke-defaults");
        expect(packageJson.scripts["db:smoke-candidate-setup-summary"]).toContain("db/validation/005_candidate_setup_to_summary_smoke.sql");
        expect(packageJson.scripts["db:smoke-candidate-setup-summary"]).toContain("--smoke-defaults");
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
        expect(sql).toContain("public.eval_results");
        expect(sql).toContain("Add a measurable outcome to your next answer.");
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

    it("defines a rollback-only smoke validation for the seeded setup-to-summary path", async () => {
        const sql = await readFile(
            path.join(process.cwd(), "db", "validation", "005_candidate_setup_to_summary_smoke.sql"),
            "utf8"
        );

        expect(sql).toContain("expected setup draft fixture");
        expect(sql).toContain("expected in-session fixture");
        expect(sql).toContain("expected completed summary fixture");
        expect(sql).toContain("expected completed answer feedback fixture");
        expect(sql).toContain("rollback");
    });

    it("seeds an Irma Castillo preview candidate for deployed Vercel testing", async () => {
        const sql = await readFile(path.join(process.cwd(), "db", "seeds", "002_candidate_preview_irma_seed.sql"), "utf8");

        expect(sql).toContain("irma.castillo@talentarbor.local");
        expect(sql).toContain("Irma Castillo");
        expect(sql).toContain("interview-coach-preview");
        expect(sql).toContain("dev_mock:interview-coach-preview:irma.castillo@talentarbor.local");
        expect(sql).toContain("Client Services Specialist");
        expect(sql).toContain("Client Services Executive - WWT");
        expect(sql).toContain("questionPlanSnapshot");
        expect(sql).toContain("coachSignal");
        expect(sql).toContain('"focus_relevance":{"score":4.4');
        expect(sql).toContain('"decision_rationale":{"score":4.0');
        expect(sql).toContain('"resilience":{"score":3.6');
        expect(sql).not.toContain('"answer_substance":0.');
        expect(sql).toContain("candidate_role_preparation_profiles");
    });

    it("defines a rollback-only smoke validation for the Irma preview seed", async () => {
        const sql = await readFile(
            path.join(process.cwd(), "db", "validation", "007_candidate_preview_irma_seed_smoke.sql"),
            "utf8"
        );

        expect(sql).toContain("expected Irma Castillo preview candidate profile");
        expect(sql).toContain("expected one Irma preview identity");
        expect(sql).toContain("expected Irma active and completed preview drafts");
        expect(sql).toContain("expected Irma sessions with question plan snapshots");
        expect(sql).toContain("rollback");
    });
});
