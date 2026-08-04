import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
    resolve(process.cwd(), "db/migrations/051_question_assistance_generation_revision.sql"),
    "utf8",
);

describe("question assistance generation revision migration", () => {
    it("adds one positive code-owned revision to both audience artifacts", () => {
        expect(migration).toContain("alter table public.candidate_question_assistance_artifacts");
        expect(migration).toContain("alter table public.invited_question_assistance_artifacts");
        expect(migration.match(/generation_revision integer not null default 1/g)).toHaveLength(2);
        expect(migration).toContain("check (generation_revision >= 1)");
    });
});
