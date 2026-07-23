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
        expect(packageJson.scripts["db:seed"]).toBe(
            "npm run db:seed-candidate-dev && npm run db:seed-recruiter-dev"
        );
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
        expect(sql).toContain("Client Services Representative");
        expect(sql).toContain("questionPlanSnapshot");
        expect(sql).toContain("rigorBaselineSnapshot");
        expect(sql).toContain('"questionPlanSnapshot":{"interviewStage":"initial_interview","questionCount":3');
        expect(sql).toContain('"rigorBaselineSnapshot":{"interviewStage":"initial_interview","questionCount":7');
        expect(sql).toContain('"categoryCounts":{"screening":2,"behavioral":2,"culture_fit":1,"case_scenario":1,"technical_role_specific":1}');
        expect(sql).toContain('"questionPlanSnapshot":{"interviewStage":"follow_up_final","questionCount":3');
        expect(sql).toContain('"rigorBaselineSnapshot":{"interviewStage":"follow_up_final","questionCount":10');
        expect(sql).toContain('"categoryCounts":{"screening":0,"behavioral":3,"culture_fit":3,"case_scenario":2,"technical_role_specific":2}');
        expect(sql).toContain('"questionCount":3');
        expect(sql).toContain("coachSignal");
        expect(sql).toContain('"modality":"voice"');
        expect(sql).toContain("I have supported customers by keeping account notes current");
        expect(sql).toContain("I would usually check what information was missing");
        expect(sql).toContain("I do best on a team where people document decisions");
        expect(sql).toContain('"expectedDimensionCounts":{"null":1,"emerging":1,"clear":5,"strong":2}');
        expect(sql).toContain('"expectedDimensionCounts":{"null":0,"emerging":4,"clear":5,"strong":0}');
        expect(sql).toContain('"expectedQuestionRead":"emerging"');
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
        expect(sql).toContain("expected 3 Irma preview role profiles");
        expect(sql).toContain("expected Irma active and completed preview drafts");
        expect(sql).toContain("expected Irma sessions with question plan snapshots");
        expect(sql).toContain("expected 6 Irma completed answers with coach signals");
        expect(sql).toContain("expected Representative first-interview baseline questions");
        expect(sql).toContain("expected 3 Representative voice answers");
        expect(sql).toContain("expected Representative emerging practiced answer");
        expect(sql).toContain("rollback");
    });
});
