import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("034 candidate resume photo OCR migration", () => {
    const migration = readFileSync(join(process.cwd(), "db/migrations/034_candidate_resume_photo_ocr.sql"), "utf8");

    it("adds photo_capture without weakening the processed-only source boundary", () => {
        expect(migration).toContain("'photo_capture'");
        expect(migration).toContain("chk_candidate_resume_artifact_source");
        expect(migration).not.toMatch(/bytea|blob|object_key|storage_path/i);
    });
});
