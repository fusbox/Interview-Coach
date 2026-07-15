import type { CandidatePracticeIntentRecord } from "./candidate-follow-up-practice-intent";
import {
    toCandidatePracticeIntentRecord,
    type CandidatePracticeIntentQueryClient,
} from "./candidate-practice-intent-repository";

export type CandidateNextRoundDraftSnapshotInput = {
    candidateNextRoundDraftId: string;
    candidateProfileId: string;
    roleProfileId: string;
    expectedVersion: number;
    targetInterviewId: string;
    targetRole: string;
    setupContext: CandidatePracticeIntentRecord["setupContext"];
    items: CandidatePracticeIntentRecord["items"];
};

export type CandidateNextRoundDraftSnapshotResult = {
    outcome: "created" | "replayed" | "version_conflict" | "invalid_items" | "not_found";
    candidatePracticeIntentId?: string;
    currentVersion?: number;
};

export function createCandidateNextRoundDraftLaunchRepository(
    client: CandidatePracticeIntentQueryClient,
) {
    return {
        async findIntentForDraftVersion(input: {
            candidateNextRoundDraftId: string;
            candidateProfileId: string;
            roleProfileId: string;
            sourceDraftVersion: number;
        }) {
            const result = await client.query(`
                select
                  candidate_practice_intent_id,
                  candidate_profile_id,
                  source,
                  lifecycle_state,
                  consumed_candidate_practice_session_id,
                  source_next_round_draft_id,
                  source_next_round_draft_version,
                  role_profile_id,
                  target_interview_id,
                  target_role,
                  setup_context_json,
                  items_json,
                  created_at,
                  updated_at
                from public.candidate_practice_intents
                where source_next_round_draft_id = $1
                  and candidate_profile_id = $2
                  and role_profile_id = $3
                  and source_next_round_draft_version = $4
                limit 1
            `, [
                input.candidateNextRoundDraftId,
                input.candidateProfileId,
                input.roleProfileId,
                input.sourceDraftVersion,
            ]);

            return toCandidatePracticeIntentRecord(result.rows[0]);
        },

        async snapshotDraftToIntent(
            input: CandidateNextRoundDraftSnapshotInput,
        ): Promise<CandidateNextRoundDraftSnapshotResult> {
            const result = await client.query(`
                select
                  launch_outcome,
                  candidate_practice_intent_id,
                  current_version
                from public.snapshot_candidate_next_round_draft_to_intent(
                  $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb
                )
            `, [
                input.candidateNextRoundDraftId,
                input.candidateProfileId,
                input.roleProfileId,
                input.expectedVersion,
                input.targetInterviewId,
                input.targetRole,
                JSON.stringify(input.setupContext),
                JSON.stringify(input.items),
            ]);

            return normalizeSnapshotResult(result.rows[0]);
        },
    };
}

function normalizeSnapshotResult(
    row: Record<string, unknown> | undefined,
): CandidateNextRoundDraftSnapshotResult {
    if (!row) {
        return { outcome: "not_found" };
    }

    const outcome = row.launch_outcome;
    if (
        outcome !== "created"
        && outcome !== "replayed"
        && outcome !== "version_conflict"
        && outcome !== "invalid_items"
        && outcome !== "not_found"
    ) {
        return { outcome: "not_found" };
    }

    const candidatePracticeIntentId = readString(row.candidate_practice_intent_id);
    const currentVersion = readPositiveInteger(row.current_version);
    return {
        outcome,
        ...(candidatePracticeIntentId ? { candidatePracticeIntentId } : {}),
        ...(currentVersion ? { currentVersion } : {}),
    };
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readPositiveInteger(value: unknown) {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
