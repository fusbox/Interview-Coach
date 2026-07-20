import { randomUUID } from "node:crypto";

import { Pool } from "pg";

import { createRecruiterSettingsRepository } from "../src/features/recruiter-auth-v2/recruiter-settings-repository";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL?.trim() || getSmokeDatabaseUrl(),
        max: 1,
        application_name: "interview-coach-recruiter-settings-smoke",
    });
    const client = await pool.connect();
    const ownerId = randomUUID();
    const foreignId = randomUUID();
    const qaId = randomUUID();
    const disabledId = randomUUID();

    try {
        await client.query("begin");
        await client.query(`
            insert into public.app_users (user_id, email, display_name, status, updated_at)
            values
              ($1, $5, 'Settings owner', 'active', now() - interval '1 minute'),
              ($2, $6, 'Foreign recruiter', 'active', now() - interval '1 minute'),
              ($3, $7, 'QA user', 'active', now() - interval '1 minute'),
              ($4, $8, 'Disabled recruiter', 'disabled', now() - interval '1 minute')
        `, [
            ownerId,
            foreignId,
            qaId,
            disabledId,
            `settings-owner-${ownerId}@example.invalid`,
            `settings-foreign-${foreignId}@example.invalid`,
            `settings-qa-${qaId}@example.invalid`,
            `settings-disabled-${disabledId}@example.invalid`,
        ]);
        await client.query(`
            insert into public.app_user_roles (user_id, role)
            values
              ($1, 'recruiter'),
              ($2, 'recruiter'),
              ($3, 'qa'),
              ($4, 'recruiter')
        `, [ownerId, foreignId, qaId, disabledId]);

        const repository = createRecruiterSettingsRepository({
            query: (sql, values) => client.query(sql, values),
        });
        const initial = await repository.findOwnedSettings(ownerId);
        assert(initial?.senderDisplayName === "Settings owner", "The owner settings did not load.");
        assert(await repository.findOwnedSettings(qaId) === null, "A QA-only account read recruiter settings.");
        assert(await repository.findOwnedSettings(disabledId) === null, "A disabled recruiter read settings.");

        const updated = await repository.updateOwnedSettings({
            userId: ownerId,
            senderDisplayName: "Updated sender",
            revision: initial.revision,
        });
        assert(updated.outcome === "updated", "The owner settings update did not persist.");
        assert(updated.settings.senderDisplayName === "Updated sender", "The updated name did not recover.");

        const replay = await repository.updateOwnedSettings({
            userId: ownerId,
            senderDisplayName: "Updated sender",
            revision: initial.revision,
        });
        assert(replay.outcome === "unchanged", "An exact response-lost replay did not converge safely.");

        const conflict = await repository.updateOwnedSettings({
            userId: ownerId,
            senderDisplayName: "Stale competing name",
            revision: initial.revision,
        });
        assert(conflict.outcome === "conflict", "A stale competing update was not rejected.");

        const audit = await client.query(`
            select metadata
            from public.auth_audit_events
            where user_id = $1
              and event_type = 'recruiter_display_name_updated'
            order by created_at
        `, [ownerId]);
        assert(audit.rows.length === 1, "The update did not create exactly one audit event.");
        assert(
            JSON.stringify(audit.rows[0]?.metadata) === JSON.stringify({ fields: ["display_name"] }),
            "The audit event contains unexpected candidate-facing identity data.",
        );

        const foreign = await repository.findOwnedSettings(foreignId);
        assert(foreign?.senderDisplayName === "Foreign recruiter", "The owner's update changed another account.");

        console.log(JSON.stringify({
            ownerRead: true,
            ownerUpdate: true,
            responseLostReplay: true,
            staleWriteRejected: true,
            ownerFencePreserved: true,
            roleAndStatusFencePreserved: true,
            metadataOnlyAudit: true,
        }, null, 2));
    } finally {
        await client.query("rollback").catch(() => undefined);
        client.release();
        await pool.end();
    }
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
