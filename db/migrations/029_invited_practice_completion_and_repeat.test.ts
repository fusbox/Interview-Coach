import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
    join(process.cwd(), "db/migrations/029_invited_practice_completion_and_repeat.sql"),
    "utf8",
);

describe("invited practice completion and repeat migration", () => {
    it("enforces one direct child and copies immutable question sources", () => {
        expect(migration).toContain("uq_invited_practice_session_direct_child");
        expect(migration).toContain("parent_invited_practice_session_id");
        expect(migration).toContain("v_latest.setup_snapshot_json");
        expect(migration).toContain("v_latest.question_plan_snapshot_json");
        expect(migration).toContain("v_latest.question_wording_snapshot_json");
        expect(migration).toContain("v_latest.attempt_number + 1");
    });

    it("locks recipient lineage and atomically mints a bounded clean browser session", () => {
        expect(migration).toContain("for update of recipient");
        expect(migration).toContain("order by session.attempt_number desc");
        expect(migration).toContain("v_latest.parent_invited_practice_session_id = p_expected_parent_session_id");
        expect(migration).toContain("least(p_requested_expires_at, v_token.expires_at)");
        expect(migration).toContain("insert into public.invited_practice_browser_sessions");
    });
});
