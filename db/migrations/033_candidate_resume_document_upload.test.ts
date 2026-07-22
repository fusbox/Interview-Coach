import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
    join(process.cwd(), "db/migrations/033_candidate_resume_document_upload.sql"),
    "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("candidate resume document upload migration", () => {
    it("widens only the processed artifact source contract", () => {
        expect(migration).toContain("drop constraint if exists chk_candidate_resume_artifact_source");
        expect(migration).toContain("source in ('pasted_text', 'document_upload', 'photo_capture', 'trusted_host')");
        expect(migration).not.toContain("source_bytes");
        expect(migration).not.toContain("source_path");
        expect(migration).not.toContain("source_url");
    });
});
