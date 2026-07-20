import { createHash, randomUUID } from "node:crypto";

import { Pool } from "pg";

import { createCandidateQuestionPlan } from "../src/features/candidate-session-v2/candidate-question-plan";
import { createRecruiterInvitationQuestionSetRepository } from "../src/features/recruiter-invites-v2/recruiter-invitation-question-set-repository";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

const RECRUITER_ID = "20000000-0000-4000-8000-000000000001";
const UNAUTHORIZED_RECRUITER_ID = "29999999-9999-4999-8999-999999999999";

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL?.trim() || getSmokeDatabaseUrl(),
        max: 10,
        application_name: "interview-coach-recruiter-question-set-smoke",
    });
    const actionKeyHash = hash(`question-set-smoke:${randomUUID()}`);
    const requestFingerprint = hash("question-set-smoke-request-v1");
    let batchId: string | null = null;
    const questionPlanSnapshot = createCandidateQuestionPlan({
        interviewStage: "screening",
        questionCount: 5,
    });
    const expiresAt = new Date(Date.now() + 60 * 60 * 1_000).toISOString();
    const repositories = Array.from({ length: 8 }, () => createRecruiterInvitationQuestionSetRepository({
        query: (sql, values) => pool.query(sql, values),
    }));

    try {
        const claims = await Promise.all(repositories.map((repository) => repository.claim({
            questionSetId: randomUUID(),
            recruiterId: RECRUITER_ID,
            actionKeyHash,
            requestFingerprint,
            source: "generated",
            targetRole: "Invitation concurrency smoke",
            jobDescription: "Verify one durable question-set winner under concurrent requests.",
            interviewStage: "screening",
            questionPlanSnapshot,
            expiresAt,
        })));
        const claimed = claims.filter((claim) => claim.outcome === "claimed");
        const inProgress = claims.filter((claim) => claim.outcome === "in_progress");
        assert(claimed.length === 1, `Expected one claim winner, received ${claimed.length}.`);
        assert(inProgress.length === repositories.length - 1, "Concurrent claim losers did not converge on the preparing winner.");

        const winner = claimed[0].questionSet;
        assert(winner, "Claim winner was missing its persisted question set.");
        const questionWordingSnapshot = {
            status: "questions_worded" as const,
            questions: questionPlanSnapshot.slots.map((slot) => ({
                slotId: slot.id,
                index: slot.index,
                category: slot.category,
                questionText: `Question-set smoke question ${slot.index + 1}?`,
            })),
        };
        const completed = await repositories[0].complete({
            questionSetId: winner.questionSetId,
            recruiterId: RECRUITER_ID,
            actionKeyHash,
            requestFingerprint,
            questionWordingSnapshot,
            acceptedAt: new Date().toISOString(),
        });
        assert(completed?.lifecycleState === "ready", "Claim winner did not become ready.");

        const replay = await repositories[1].claim({
            questionSetId: randomUUID(),
            recruiterId: RECRUITER_ID,
            actionKeyHash,
            requestFingerprint,
            source: "generated",
            targetRole: "Invitation concurrency smoke",
            jobDescription: "Verify one durable question-set winner under concurrent requests.",
            interviewStage: "screening",
            questionPlanSnapshot,
            expiresAt,
        });
        assert(replay.outcome === "replayed", "Ready question set did not replay.");
        assert(replay.questionSet?.questionSetId === winner.questionSetId, "Replay did not return the durable winner.");

        const conflict = await repositories[2].claim({
            questionSetId: randomUUID(),
            recruiterId: RECRUITER_ID,
            actionKeyHash,
            requestFingerprint: hash("changed-question-set-smoke-request"),
            source: "generated",
            targetRole: "Invitation concurrency smoke",
            jobDescription: "Changed content must conflict.",
            interviewStage: "screening",
            questionPlanSnapshot,
            expiresAt,
        });
        assert(conflict.outcome === "conflict", "Changed content reused the action key without a conflict.");

        const unauthorized = await repositories[3].claim({
            questionSetId: randomUUID(),
            recruiterId: UNAUTHORIZED_RECRUITER_ID,
            actionKeyHash: hash(`unauthorized:${randomUUID()}`),
            requestFingerprint,
            source: "generated",
            targetRole: "Unauthorized smoke",
            jobDescription: "This row must not be created.",
            interviewStage: "screening",
            questionPlanSnapshot,
            expiresAt,
        });
        assert(unauthorized.outcome === "unauthorized", "Inactive recruiter authorization did not fail closed.");

        let immutable = false;
        try {
            await pool.query(`
                update public.recruiter_invitation_question_sets
                set target_role = 'Mutated role'
                where recruiter_invitation_question_set_id = $1
            `, [winner.questionSetId]);
        } catch (error) {
            immutable = readPostgresCode(error) === "55000";
        }
        assert(immutable, "Accepted question-set source fields were mutable.");

        batchId = randomUUID();
        const aggregateCreation = await pool.query(`
            select creation_outcome, recruiter_invitation_batch_id
            from public.create_recruiter_invitation_aggregate_from_question_set(
              $1::uuid, $2::uuid, $3::text, $4::text, $5::uuid,
              $6::text, $7::text, $8::text, $9::jsonb, $10::jsonb, $11::jsonb
            )
        `, [
            winner.questionSetId,
            RECRUITER_ID,
            actionKeyHash,
            hash("question-set-smoke-aggregate-v1"),
            batchId,
            winner.targetRole,
            winner.jobDescription,
            winner.interviewStage,
            JSON.stringify(questionPlanSnapshot),
            JSON.stringify(questionWordingSnapshot),
            JSON.stringify([{
                candidateIndex: 0,
                recipientId: randomUUID(),
                sessionId: randomUUID(),
                firstName: "Question-set",
                lastName: "Smoke",
                email: `question-set-${randomUUID()}@example.invalid`,
                requisitionReference: null,
                resumeText: null,
                tokenHash: hash(`invite-token:${randomUUID()}`),
                tokenCiphertext: "question-set-smoke-ciphertext",
                encryptionKeyId: "smoke-key",
                tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1_000).toISOString(),
            }]),
        ]);
        assert(aggregateCreation.rows[0]?.creation_outcome === "created", "Question-set aggregate wrapper did not create a batch.");
        const lineage = await pool.query(`
            select source_recruiter_invitation_question_set_id
            from public.recruiter_invitation_batches
            where recruiter_invitation_batch_id = $1
              and recruiter_id = $2
        `, [batchId, RECRUITER_ID]);
        assert(
            lineage.rows[0]?.source_recruiter_invitation_question_set_id === winner.questionSetId,
            "Invitation batch did not retain its accepted question-set lineage.",
        );

        console.log("Recruiter invitation question-set smoke passed.");
    } finally {
        if (batchId) {
            await pool.query(`
                delete from public.recruiter_invitation_batches
                where recruiter_invitation_batch_id = $1
                  and recruiter_id = $2
            `, [batchId, RECRUITER_ID]).catch(() => undefined);
        }
        await pool.query(`
            delete from public.recruiter_invitation_question_sets
            where recruiter_id = $1
              and action_key_hash = $2
        `, [RECRUITER_ID, actionKeyHash]).catch(() => undefined);
        await pool.end();
    }
}

function hash(value: string) {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function readPostgresCode(error: unknown) {
    if (!error || typeof error !== "object" || !("code" in error)) return null;
    return typeof error.code === "string" ? error.code : null;
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
