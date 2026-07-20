import { Pool } from "pg";

import { createCandidateNextRoundDraftRepository } from "../src/features/candidate-practice-v2/candidate-next-round-draft-repository";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

const candidateProfileId = "27272727-2727-4727-8727-272727272727";
const roleProfileId = "28282828-2828-4828-8828-282828282828";
const sessionId = "29292929-2929-4929-8929-292929292929";
const draftId = "30303030-3030-4030-8030-303030303030";

const baselineSlots = Array.from({ length: 5 }, (_, index) => ({
    id: `slot-${index + 1}`,
    index,
    category: index === 1 ? "behavioral" : index === 2 ? "culture_fit" : "screening",
    label: "Baseline",
    purpose: "Baseline coverage.",
}));
const baselineQuestions = baselineSlots.map((slot) => ({
    slotId: slot.id,
    index: slot.index,
    category: slot.category,
    questionText: `Baseline practice question ${slot.index + 1}?`,
}));

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL?.trim() || getSmokeDatabaseUrl(),
        max: 1,
        application_name: "interview-coach-baseline-queue-smoke",
    });
    const client = await pool.connect();

    try {
        await client.query("begin");
        await client.query(`
            insert into public.candidate_profiles (
              candidate_profile_id, auth_subject, email, display_name, workspace
            ) values ($1, $2, $3, 'Baseline Queue Smoke', 'local_dev')
        `, [
            candidateProfileId,
            "local_dev:baseline-queue-smoke@example.invalid",
            "baseline-queue-smoke@example.invalid",
        ]);
        await client.query(`
            insert into public.candidate_role_preparation_profiles (
              role_profile_id, candidate_profile_id, target_role, normalized_target_role,
              job_description_snapshot, job_description_hash, source,
              rigor_baseline_snapshot_json, rigor_baseline_question_wording_snapshot_json
            ) values ($1, $2, 'Warehouse lead', 'warehouse lead', $3, $4, 'manual', $5::jsonb, $6::jsonb)
        `, [
            roleProfileId,
            candidateProfileId,
            "Coordinate daily warehouse work.",
            "c".repeat(64),
            JSON.stringify({
                status: "candidate_practice_plan_baseline_v1",
                interviewStage: "screening",
                questionCount: 5,
                categoryCounts: {
                    screening: 3,
                    behavioral: 1,
                    culture_fit: 1,
                    case_scenario: 0,
                    technical_role_specific: 0,
                },
                slots: baselineSlots,
            }),
            JSON.stringify({ status: "questions_worded", questions: baselineQuestions }),
        ]);
        await client.query(`
            insert into public.candidate_practice_sessions (
              candidate_practice_session_id, candidate_profile_id, role_profile_id, status,
              setup_snapshot_json, question_plan_snapshot_json, question_wording_snapshot_json,
              question_wording_status, progress_state_json
            ) values ($1, $2, $3, 'completed', $4::jsonb, $5::jsonb, $6::jsonb, 'worded', $7::jsonb)
        `, [
            sessionId,
            candidateProfileId,
            roleProfileId,
            JSON.stringify({
                targetRole: "Warehouse lead",
                jobDescription: "Coordinate daily warehouse work.",
                interviewStage: "screening",
                questionCount: 3,
                resumeCaptureMode: "none",
                createdAt: "2026-07-19T18:00:00.000Z",
            }),
            JSON.stringify({
                interviewStage: "screening",
                questionCount: 3,
                categoryCounts: {
                    screening: 1,
                    behavioral: 1,
                    culture_fit: 1,
                    case_scenario: 0,
                    technical_role_specific: 0,
                },
                slots: baselineSlots.slice(0, 3),
            }),
            JSON.stringify({ status: "questions_worded", questions: baselineQuestions.slice(0, 3) }),
            JSON.stringify({ status: "completed", currentQuestionIndex: 2 }),
        ]);
        await client.query(`
            insert into public.candidate_next_round_drafts (
              candidate_next_round_draft_id, candidate_profile_id, role_profile_id
            ) values ($1, $2, $3)
        `, [draftId, candidateProfileId, roleProfileId]);

        const repository = createCandidateNextRoundDraftRepository({
            query: (sql, values) => client.query(sql, values),
        });
        const result = await repository.addItem({
            candidateNextRoundDraftId: draftId,
            candidateProfileId,
            roleProfileId,
            expectedVersion: 1,
            sourceCandidatePracticeSessionId: sessionId,
            sourceQuestionKey: "slot-5",
            practiceKind: "practice_missing_evidence",
            provenance: "coach_plan",
        });
        if (result.outcome !== "updated" || result.version !== 2) {
            throw new Error(`Unexposed baseline queue mutation failed: ${JSON.stringify(result)}`);
        }

        console.log("Candidate practice-plan baseline queue smoke passed.");
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
