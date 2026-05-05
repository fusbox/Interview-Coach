import { randomUUID } from "crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { RecruiterTemplate } from "@/lib/domain/template";
import { PostgresTemplateRepository } from "./postgres-template-repository";

const databaseUrl = process.env.POSTGRES_TEMPLATE_REPOSITORY_TEST_DATABASE_URL;
const runIntegration = databaseUrl ? describe : describe.skip;

runIntegration("PostgresTemplateRepository integration", () => {
    let pool: Pool;
    let ownerId: string;
    let otherId: string;
    let ownerRepo: PostgresTemplateRepository;
    let otherRepo: PostgresTemplateRepository;
    let adminRepo: PostgresTemplateRepository;

    beforeAll(async () => {
        if (!databaseUrl) {
            return;
        }

        pool = new Pool({ connectionString: databaseUrl });
        ownerId = randomUUID();
        otherId = randomUUID();
        ownerRepo = new PostgresTemplateRepository({ userId: ownerId }, pool);
        otherRepo = new PostgresTemplateRepository({ userId: otherId }, pool);
        adminRepo = new PostgresTemplateRepository({ userId: ownerId, canManageAllTemplates: true }, pool);

        await pool.query(
            `
                insert into public.app_users (
                    user_id,
                    email,
                    display_name,
                    email_verified_at
                )
                values
                    ($1, $2, 'Template Owner', now()),
                    ($3, $4, 'Template Other', now())
            `,
            [
                ownerId,
                `template-owner-${ownerId}@example.invalid`,
                otherId,
                `template-other-${otherId}@example.invalid`
            ]
        );
    });

    beforeEach(async () => {
        await pool.query(
            "delete from public.recruiter_templates where recruiter_id = any($1::uuid[])",
            [[ownerId, otherId]]
        );
    });

    afterAll(async () => {
        if (!pool) {
            return;
        }

        await pool.query(
            "delete from public.recruiter_templates where recruiter_id = any($1::uuid[])",
            [[ownerId, otherId]]
        );
        await pool.query("delete from public.app_users where user_id = any($1::uuid[])", [[ownerId, otherId]]);
        await pool.end();
    });

    function buildTemplate(overrides: Partial<RecruiterTemplate> = {}): Partial<RecruiterTemplate> {
        return {
            name: "Warehouse Interview",
            isShared: true,
            targetRole: "Warehouse Associate",
            questions: {
                star: [{ id: "star-1", text: "Tell me about a safety procedure.", category: "STAR", label: "Safety" }],
                perma: [{ id: "perma-1", text: "What helps you stay engaged?", category: "PERMA", label: "Engagement" }],
                technical: [{ id: "tech-1", text: "How do you inspect equipment?", category: "Technical", label: "Equipment" }]
            },
            ...overrides
        };
    }

    it("creates templates and applies owner/shared/admin visibility rules", async () => {
        const ownedPrivate = await ownerRepo.create(buildTemplate({
            name: "Owner Private",
            isShared: false
        }));
        const otherShared = await otherRepo.create(buildTemplate({
            name: "Other Shared",
            isShared: true
        }));
        const otherPrivate = await otherRepo.create(buildTemplate({
            name: "Other Private",
            isShared: false
        }));

        const ownerList = await ownerRepo.list();
        expect(ownerList.map((template) => template.id)).toEqual(
            expect.arrayContaining([ownedPrivate.id, otherShared.id])
        );
        expect(ownerList.map((template) => template.id)).not.toContain(otherPrivate.id);

        const adminList = await adminRepo.list();
        expect(adminList.map((template) => template.id)).toEqual(
            expect.arrayContaining([ownedPrivate.id, otherShared.id, otherPrivate.id])
        );
    });

    it("allows owners and admins to update or delete templates while blocking nonowners", async () => {
        const template = await ownerRepo.create(buildTemplate({ name: "Original" }));

        const updated = await ownerRepo.update(template.id, { name: "Owner Updated" });
        expect(updated.name).toBe("Owner Updated");

        await expect(otherRepo.update(template.id, { name: "Other Updated" })).rejects.toThrow(
            "Unauthorized or Template not found."
        );

        const adminUpdated = await adminRepo.update(template.id, { name: "Admin Updated" });
        expect(adminUpdated.name).toBe("Admin Updated");

        await expect(otherRepo.delete(template.id)).rejects.toThrow(
            "Unauthorized or Template not found."
        );

        await adminRepo.delete(template.id);
        await expect(adminRepo.update(template.id, { name: "Missing" })).rejects.toThrow(
            "Unauthorized or Template not found."
        );
    });
});
