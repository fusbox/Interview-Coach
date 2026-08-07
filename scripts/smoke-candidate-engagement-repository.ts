import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import { createCandidateEngagementRepository } from "../src/features/candidate-engagement-v2/candidate-engagement-repository";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

async function main() {
    if (process.env.NODE_ENV === "production") {
        throw new Error("The candidate engagement repository smoke is local-only.");
    }

    const pool = new Pool({
        connectionString: getSmokeDatabaseUrl(),
        max: 1,
        application_name: "interview-coach-candidate-engagement-repository-smoke",
    });
    const client = await pool.connect();

    try {
        await client.query("begin");
        const candidateProfileId = randomUUID();
        const candidatePracticeSessionId = randomUUID();
        await client.query(`
            insert into public.candidate_profiles (
              candidate_profile_id,
              auth_subject,
              email,
              display_name,
              workspace
            ) values ($1, $2, $3, 'Engagement Repository Smoke', 'local_dev')
        `, [
            candidateProfileId,
            `local_dev:candidate-engagement-repository-smoke:${candidateProfileId}`,
            `candidate-engagement-repository-smoke-${candidateProfileId}@example.invalid`,
        ]);
        await client.query(`
            insert into public.candidate_practice_sessions (
              candidate_practice_session_id,
              candidate_profile_id,
              setup_snapshot_json,
              question_plan_snapshot_json
            ) values ($1, $2, $3::jsonb, $4::jsonb)
        `, [
            candidatePracticeSessionId,
            candidateProfileId,
            JSON.stringify({ targetRole: "Repository Smoke" }),
            JSON.stringify({ questionCount: 1, slots: [] }),
        ]);

        const repository = createCandidateEngagementRepository({
            query: (sql, values) => client.query(sql, values),
        });
        const endedAt = new Date();
        const startedAt = new Date(endedAt.valueOf() - 1_000);
        const result = await repository.appendSlices({
            candidatePracticeSessionId,
            candidateProfileId,
            slices: [{
                engagementSliceId: randomUUID(),
                trackerInstanceId: randomUUID(),
                sequenceNumber: 1,
                activeMilliseconds: 1_000,
                clientStartedAt: startedAt.toISOString(),
                clientEndedAt: endedAt.toISOString(),
                openedBy: "interaction",
                lastActivity: "interface_control",
                flushReason: "periodic",
            }],
        });

        if (!result.sessionOwned || result.acceptedSliceCount !== 1) {
            throw new Error(`Unexpected candidate engagement append result: ${JSON.stringify(result)}`);
        }

        console.log("Candidate engagement repository smoke passed.");
    } finally {
        await client.query("rollback").catch(() => undefined);
        client.release();
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
