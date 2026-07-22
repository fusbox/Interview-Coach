import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { Pool } from "pg";

import { createCandidateResumeIngestionOperationRepository } from "../src/features/candidate-setup-v2/candidate-resume-ingestion-operation-repository";
import { createCandidateSetupResumeSelectionRepository } from "../src/features/candidate-setup-v2/candidate-setup-resume-selection-repository";
import { createCandidateResumeTextArtifactRepository } from "../src/features/candidate-setup-v2/candidate-resume-text-artifact-repository";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

const databaseUrl = process.env.DATABASE_URL?.trim() || getSmokeDatabaseUrl();
const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
    max: 12,
    application_name: "interview-coach-resume-ingestion-operations-smoke",
});
const client = {
    async query(sql: string, values: unknown[]) {
        const result = await pool.query(sql, values);
        return { rows: result.rows as Array<Record<string, unknown>> };
    },
};
const operations = createCandidateResumeIngestionOperationRepository(client);
const selections = createCandidateSetupResumeSelectionRepository(client);
const artifacts = createCandidateResumeTextArtifactRepository(client);
const candidateIds = Array.from({ length: 5 }, () => randomUUID());
const baseTime = new Date();

async function main() {
    try {
        await Promise.all(candidateIds.map((candidateProfileId, index) => pool.query(`
            insert into public.candidate_profiles (
              candidate_profile_id, auth_subject, email, display_name, workspace
            ) values ($1, $2, $3, $4, 'local_dev')
        `, [
            candidateProfileId,
            `local_dev:resume-ingestion-smoke:${candidateProfileId}`,
            `resume-ingestion-${candidateProfileId}@example.invalid`,
            `Resume Ingestion Smoke ${index + 1}`,
        ])));

        const candidateProfileId = candidateIds[0]!;
        const setupOwnerKey = `candidate:${candidateProfileId}:setup`;
        const operationId = randomUUID();
        const concurrent = await Promise.all(Array.from({ length: 8 }, () => operations.claimOperation({
            operationId,
            candidateProfileId,
            setupOwnerKey,
            source: "pasted_text",
            now: baseTime,
        })));
        assert.equal(concurrent.filter((claim) => claim.outcome === "acquired").length, 1);
        assert.equal(concurrent.filter((claim) => claim.outcome === "in_progress").length, 7);
        const acquired = concurrent.find((claim) => claim.outcome === "acquired")!;

        await selections.beginSelectionOperation({ candidateProfileId, setupOwnerKey, operationId, now: baseTime });
        const artifact = await artifacts.createOrRecoverReviewArtifact({
            candidateProfileId,
            source: "pasted_text",
            text: "Inventory lead with documented inspection experience.",
            candidateLabel: "Pasted resume",
            now: baseTime,
        });
        assert.equal(await operations.completeOperationAndPublish({
            operationId,
            candidateProfileId,
            setupOwnerKey,
            source: "pasted_text",
            claimGeneration: acquired.claimGeneration,
            artifactId: artifact.artifactId,
            inputSizeClass: "tiny",
            pageCount: 0,
            durationMs: 100,
            now: new Date(baseTime.getTime() + 100),
        }), "completed");
        const replay = await operations.claimOperation({
            operationId,
            candidateProfileId,
            setupOwnerKey,
            source: "pasted_text",
            now: new Date(baseTime.getTime() + 200),
        });
        assert.equal(replay.outcome, "replayed");
        assert.equal(replay.artifactId, artifact.artifactId);
        assert.equal((await artifacts.recoverSelectedArtifact({ candidateProfileId, setupOwnerKey, artifactId: artifact.artifactId }))?.artifactId, artifact.artifactId);

        const ownershipConflict = await operations.claimOperation({
            operationId,
            candidateProfileId: candidateIds[1]!,
            setupOwnerKey: `candidate:${candidateIds[1]}:setup`,
            source: "pasted_text",
            now: new Date(baseTime.getTime() + 300),
        });
        assert.equal(ownershipConflict.outcome, "ownership_conflict");

        const ownerOperations = Array.from({ length: 6 }, () => randomUUID());
        const ownerClaims = await Promise.all(ownerOperations.map((nextOperationId) => operations.claimOperation({
            operationId: nextOperationId,
            candidateProfileId,
            setupOwnerKey,
            source: "document_upload",
            now: new Date(baseTime.getTime() + 400),
        })));
        assert.equal(ownerClaims.filter((claim) => claim.outcome === "acquired").length, 1);
        assert.equal(ownerClaims.filter((claim) => claim.outcome === "owner_busy").length, 5);

        const photoClaims = [];
        for (let index = 1; index <= 3; index += 1) {
            photoClaims.push(await operations.claimOperation({
                operationId: randomUUID(),
                candidateProfileId: candidateIds[index]!,
                setupOwnerKey: `candidate:${candidateIds[index]}:photo`,
                source: "photo_capture",
                now: new Date(baseTime.getTime() + 500 + index),
            }));
        }
        assert.deepEqual(photoClaims.map((claim) => claim.outcome), ["acquired", "acquired", "capacity_limited"]);

        const staleCandidateId = candidateIds[4]!;
        const staleOperationId = randomUUID();
        const staleRequestedAt = new Date(baseTime.getTime() - 180_000);
        const stale = await operations.claimOperation({
            operationId: staleOperationId,
            candidateProfileId: staleCandidateId,
            setupOwnerKey: `candidate:${staleCandidateId}:stale`,
            source: "pasted_text",
            now: staleRequestedAt,
            policy: {
                globalActiveLimit: 32,
                recentOwnerLimit: 20,
                recentWindowSeconds: 600,
                leaseSeconds: 30,
                generationLimit: 3,
            },
        });
        assert.equal(stale.outcome, "acquired");
        const recovered = await operations.claimOperation({
            operationId: staleOperationId,
            candidateProfileId: staleCandidateId,
            setupOwnerKey: `candidate:${staleCandidateId}:stale`,
            source: "pasted_text",
            now: baseTime,
        });
        assert.equal(recovered.outcome, "acquired");
        assert.equal(recovered.claimGeneration, 2);
        assert.equal(await operations.failOperation({
            operationId: staleOperationId,
            candidateProfileId: staleCandidateId,
            setupOwnerKey: `candidate:${staleCandidateId}:stale`,
            source: "pasted_text",
            claimGeneration: stale.claimGeneration,
            terminalReason: "persistence_failed",
            inputSizeClass: "unknown",
            pageCount: 0,
            durationMs: 100,
            now: new Date(baseTime.getTime() + 100),
        }), "stale_claim");

        const rateCandidateId = candidateIds[3]!;
        const ratePolicy = {
            globalActiveLimit: 32,
            recentOwnerLimit: 1,
            recentWindowSeconds: 600,
            leaseSeconds: 30,
            generationLimit: 3,
        };
        const rateFirst = await operations.claimOperation({
            operationId: randomUUID(),
            candidateProfileId: rateCandidateId,
            setupOwnerKey: `candidate:${rateCandidateId}:rate-a`,
            source: "pasted_text",
            now: new Date(baseTime.getTime() + 1000),
            policy: ratePolicy,
        });
        assert.equal(rateFirst.outcome, "acquired");
        const rateSecond = await operations.claimOperation({
            operationId: randomUUID(),
            candidateProfileId: rateCandidateId,
            setupOwnerKey: `candidate:${rateCandidateId}:rate-b`,
            source: "pasted_text",
            now: new Date(baseTime.getTime() + 1100),
            policy: ratePolicy,
        });
        assert.equal(rateSecond.outcome, "rate_limited");

        console.log("Candidate resume ingestion operations smoke passed: concurrent admission, owner/global/rate limits, replay, ownership, and stale recovery.");
    } finally {
        await pool.query("delete from public.candidate_profiles where candidate_profile_id = any($1::uuid[])", [candidateIds]).catch(() => undefined);
        await pool.end();
    }
}

void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
