import { randomUUID } from "node:crypto";

import { Pool } from "pg";

import {
    createEvaluatorFingerprint,
    evidenceFirstEvaluatorResolvedConfigurationManifestSchema,
} from "../src/features/evaluation-v2/evidence-first-evaluator-contract";
import { createInvitedPracticeAnswerHistoryRepository } from "../src/features/recruiter-invites-v2/invited-practice-answer-history-repository";
import { createInvitedPracticeSessionRuntimeRepository } from "../src/features/recruiter-invites-v2/invited-practice-session-runtime-repository";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

const RECRUITER_ID = "20000000-0000-4000-8000-000000000001";

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL?.trim() || getSmokeDatabaseUrl(),
        max: 12,
        application_name: "interview-coach-invited-live-runtime-smoke",
    });
    const client = { query: (sql: string, values: unknown[]) => pool.query(sql, values) };
    const sessionRepository = createInvitedPracticeSessionRuntimeRepository(client);
    const historyRepository = createInvitedPracticeAnswerHistoryRepository(client);
    const batchId = randomUUID();
    const recipientId = randomUUID();
    const sessionId = randomUUID();
    const idempotencyKey = `invited-smoke:${randomUUID()}`;

    try {
        await createFixture(pool, { batchId, recipientId, sessionId });

        const firstAttemptInput = {
            invitedPracticeSessionId: sessionId,
            recruiterInvitationRecipientId: recipientId,
            questionSlotId: "slot-1",
            questionIndex: 0,
            mode: "text" as const,
            answerText: "I inspect each item against the documented standard.",
            submittedAt: new Date().toISOString(),
            trigger: "initial_submit" as const,
            idempotencyKey,
            payloadFingerprint: "invited-smoke-first-answer",
        };
        const concurrentAttempts = await Promise.all(
            Array.from({ length: 8 }, () => historyRepository.appendAnswerAttempt(firstAttemptInput)),
        );
        assert(concurrentAttempts.every(Boolean), "Concurrent invited answer writes did not all resolve.");
        assert(
            concurrentAttempts.filter((result) => result?.outcome === "created").length === 1,
            "Concurrent invited answer writes did not create exactly one attempt.",
        );
        assert(
            concurrentAttempts.filter((result) => result?.outcome === "replayed").length === 7,
            "Concurrent invited answer replays did not converge.",
        );
        const firstAttempt = concurrentAttempts[0]!.attempt;

        const submissions = await sessionRepository.saveAnswerSubmission({
            invitedPracticeSessionId: sessionId,
            recruiterInvitationRecipientId: recipientId,
            answerSubmission: {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text",
                text: firstAttempt.answerText,
                status: "pending_analysis",
                submittedAt: firstAttempt.submittedAt,
                answerAttemptId: firstAttempt.candidateAnswerAttemptId,
                attemptNumber: 1,
                trigger: "initial_submit",
                supersedesAnswerAttemptId: null,
            },
        });
        assert(submissions?.["slot-1"]?.answerAttemptId === firstAttempt.candidateAnswerAttemptId, "Accepted answer was not projected into the invited session.");

        const retry = await historyRepository.appendAnswerAttempt({
            ...firstAttemptInput,
            answerText: "I compare each item to the standard, document defects, and isolate failed units.",
            submittedAt: new Date().toISOString(),
            trigger: "feedback_retry",
            supersedesInvitedPracticeAnswerAttemptId: firstAttempt.candidateAnswerAttemptId,
            idempotencyKey: `${idempotencyKey}:retry`,
            payloadFingerprint: "invited-smoke-retry-answer",
        });
        assert(retry?.outcome === "created" && retry.attempt.attemptNumber === 2, "Feedback retry did not append immutable attempt two.");
        assert(
            await historyRepository.appendAnswerAttempt({
                ...firstAttemptInput,
                recruiterInvitationRecipientId: randomUUID(),
                idempotencyKey: `${idempotencyKey}:foreign`,
            }) === null,
            "A foreign recipient wrote into the invited session.",
        );

        const manifest = evidenceFirstEvaluatorResolvedConfigurationManifestSchema.parse({
            schemaVersion: 1,
            configurationStatus: "resolved",
            profileId: "invited-smoke-fixture-v1",
            pipelineProvider: "fixture",
            serviceMode: "validation_fixture",
            adapterVersion: "invited-smoke-fixture-v1",
            promptBundleVersion: "prompt-v1",
            evaluatorVersion: "evaluator-v1",
            stages: [
                {
                    stage: "evidence_extraction",
                    provider: "fixture",
                    model: "invited-smoke-fixture-v1",
                    promptVersion: "prompt-v1",
                    responseSchemaVersion: "extract-v1",
                    generation: { mode: "deterministic", structuredOutput: true },
                },
                {
                    stage: "feedback_composition",
                    provider: "fixture",
                    model: "invited-smoke-fixture-v1",
                    promptVersion: "prompt-v1",
                    responseSchemaVersion: "compose-v1",
                    generation: { mode: "deterministic", structuredOutput: true },
                },
            ],
        });
        const requestedAt = new Date();
        const runInput = {
            invitedPracticeAnswerAttemptId: retry.attempt.candidateAnswerAttemptId,
            invitedPracticeSessionId: sessionId,
            recruiterInvitationRecipientId: recipientId,
            purpose: "candidate_coaching" as const,
            provider: "fixture",
            modelName: "invited-smoke-fixture-v1",
            promptVersion: "prompt-v1",
            evaluatorVersion: "evaluator-v1",
            configurationManifest: manifest,
            configurationFingerprint: createEvaluatorFingerprint(manifest),
            inputFingerprint: "invited-smoke-analysis-input",
            idempotencyKey: `${idempotencyKey}:analysis`,
            requestedAt: requestedAt.toISOString(),
            claimExpiresAt: new Date(requestedAt.getTime() + 60_000).toISOString(),
        };
        const concurrentRuns = await Promise.all(
            Array.from({ length: 8 }, () => historyRepository.claimEvaluationRun(runInput)),
        );
        assert(concurrentRuns.every(Boolean), "Concurrent invited evaluator claims did not all resolve.");
        assert(concurrentRuns.filter((result) => result?.outcome === "created").length === 1, "Evaluator claim did not create exactly one generation.");
        assert(concurrentRuns.filter((result) => result?.outcome === "replayed").length === 7, "Evaluator claim replays did not converge.");

        const claimedRun = concurrentRuns[0]!.run;
        const completedRun = await historyRepository.completeEvaluationRun({
            invitedPracticeAnswerEvaluationRunId: claimedRun.candidateAnswerEvaluationRunId,
            invitedPracticeAnswerAttemptId: retry.attempt.candidateAnswerAttemptId,
            completedAt: new Date().toISOString(),
            result: { status: "candidate_answer_analysis", candidateSafe: true },
            validation: { disposition: "accepted", candidateSafeProjection: true },
        });
        assert(completedRun?.lifecycleState === "completed", "Invited evaluator run did not complete.");

        const completed = await sessionRepository.completeSession({
            invitedPracticeSessionId: sessionId,
            recruiterInvitationRecipientId: recipientId,
            completionSnapshot: {
                status: "invited_session_completed",
                audience: "invited_candidate",
                sessionId,
                completedAt: new Date().toISOString(),
                finalProgress: { status: "completed", currentQuestionIndex: 0 },
                questionCount: 1,
                answeredCount: 1,
                coachedCount: 1,
                answeredQuestionKeys: ["slot-1"],
                coachedQuestionKeys: ["slot-1"],
                skippedOrUnansweredQuestionKeys: [],
                nextRoute: "/candidate/invited",
            },
        });
        assert(completed?.progress.status === "completed", "Invited session completion was not durable.");

        let attemptImmutable = false;
        try {
            await pool.query(`
                update public.invited_practice_answer_attempts
                set answer_text = 'mutated'
                where invited_practice_answer_attempt_id = $1
            `, [firstAttempt.candidateAnswerAttemptId]);
        } catch (error) {
            attemptImmutable = readPostgresCode(error) === "55000";
        }
        assert(attemptImmutable, "Invited answer attempt was mutable.");

        const candidateWrites = await pool.query(`
            select count(*)::integer as count
            from public.candidate_answer_attempts
            where idempotency_key like $1
        `, [`${idempotencyKey}%`]);
        assert(candidateWrites.rows[0]?.count === 0, "Invited live runtime wrote candidate-owned answer rows.");

        console.log("Invited practice live runtime smoke passed.");
    } finally {
        await pool.query(`
            delete from public.recruiter_invitation_batches
            where recruiter_invitation_batch_id = $1 and recruiter_id = $2
        `, [batchId, RECRUITER_ID]).catch(() => undefined);
        await pool.end();
    }
}

async function createFixture(pool: Pool, ids: { batchId: string; recipientId: string; sessionId: string }) {
    const plan = {
        interviewStage: "screening",
        questionCount: 1,
        categoryCounts: { screening: 1, behavioral: 0, culture_fit: 0, case_scenario: 0, technical_role_specific: 0 },
        slots: [{ id: "slot-1", index: 0, category: "screening", label: "Screening" }],
    };
    const wording = {
        status: "questions_worded",
        questionCount: 1,
        questions: [{ slotId: "slot-1", index: 0, category: "screening", questionText: "Why are you interested in this role?" }],
        generatedAt: new Date().toISOString(),
    };
    await pool.query(`
        insert into public.recruiter_invitation_batches (
          recruiter_invitation_batch_id, recruiter_id, lifecycle_state, target_role,
          interview_stage, recipient_count, question_plan_snapshot_json, question_wording_snapshot_json
        ) values ($1, $2, 'ready', 'Invited runtime smoke', 'screening', 1, $3::jsonb, $4::jsonb)
    `, [ids.batchId, RECRUITER_ID, plan, wording]);
    await pool.query(`
        insert into public.recruiter_invitation_recipients (
          recruiter_invitation_recipient_id, recruiter_invitation_batch_id, recruiter_id,
          candidate_index, first_name, last_name, email, normalized_email, lifecycle_state
        ) values ($1, $2, $3, 0, 'Smoke', 'Candidate',
          'invited-runtime@example.invalid', 'invited-runtime@example.invalid', 'ready')
    `, [ids.recipientId, ids.batchId, RECRUITER_ID]);
    await pool.query(`
        insert into public.invited_practice_sessions (
          invited_practice_session_id, recruiter_invitation_recipient_id, recruiter_id,
          attempt_number, status, setup_snapshot_json, question_plan_snapshot_json,
          question_wording_snapshot_json, progress_state_json
        ) values ($1, $2, $3, 1, 'planned', $4::jsonb, $5::jsonb, $6::jsonb,
          '{"status":"planned","currentQuestionIndex":0}'::jsonb)
    `, [
        ids.sessionId,
        ids.recipientId,
        RECRUITER_ID,
        {
            targetRole: "Invited runtime smoke",
            jobDescription: "Inspect finished goods.",
            resumeText: null,
            interviewStage: "screening",
            questionCount: 1,
            resumeCaptureMode: "none",
            createdAt: new Date().toISOString(),
        },
        plan,
        wording,
    ]);
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
