import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyPassword } from "./password";

describe("recruiter development seed", () => {
    it("uses the documented local password and fixed principal", async () => {
        const sql = await readFile(resolve("db/seeds/003_recruiter_dev_seed.sql"), "utf8");
        const hash = sql.match(/'(scrypt\$16384\$8\$1\$[^']+)'/)?.[1];

        expect(sql).toContain("20000000-0000-4000-8000-000000000001");
        expect(sql).toContain("recruiter-dev@talentarbor.local");
        expect(sql).toContain("('20000000-0000-4000-8000-000000000001', 'admin')");
        expect(sql).toContain("insert into public.ai_eval_operator_grants");
        expect(sql).toContain("Local development AI-eval operator");
        expect(hash).toBeTruthy();
        await expect(verifyPassword("local-only-recruiter", hash!)).resolves.toBe(true);
    });
});
