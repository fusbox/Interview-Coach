import type { CandidateSetupStageId } from "@/features/candidate-setup-v2/candidate-setup-contract";
import { getCandidateStageBaselineQuestionCount } from "@/features/candidate-setup-v2/candidate-practice-plan-baseline";
import {
    createCandidateQuestionPlan,
    type CandidateQuestionPlan,
} from "@/features/candidate-session-v2/candidate-question-plan";
import {
    parseCandidateQuestionWordingResult,
    type CandidateQuestionWordingResult,
} from "@/features/candidate-session-v2/candidate-question-wording";
import type { RecruiterQuestionSource } from "./recruiter-invitation-create-contract";

export type RecruiterInvitationQuestionSetQueryClient = {
    query: (sql: string, values?: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

export type RecruiterInvitationQuestionSetRecord = {
    questionSetId: string;
    recruiterId: string;
    actionKeyHash: string;
    requestFingerprint: string;
    source: RecruiterQuestionSource;
    lifecycleState: "preparing" | "ready" | "failed";
    targetRole: string;
    jobDescription: string;
    interviewStage: CandidateSetupStageId;
    questionPlanSnapshot: CandidateQuestionPlan;
    questionWordingSnapshot: CandidateQuestionWordingResult | null;
    expiresAt: string;
};

export type RecruiterInvitationQuestionSetClaimOutcome =
    | "claimed"
    | "replayed"
    | "in_progress"
    | "conflict"
    | "failed"
    | "unauthorized";

export function createRecruiterInvitationQuestionSetRepository(
    client: RecruiterInvitationQuestionSetQueryClient,
) {
    return {
        async claim(input: {
            questionSetId: string;
            recruiterId: string;
            actionKeyHash: string;
            requestFingerprint: string;
            source: RecruiterQuestionSource;
            targetRole: string;
            jobDescription: string;
            interviewStage: CandidateSetupStageId;
            questionPlanSnapshot: CandidateQuestionPlan;
            expiresAt: string;
        }) {
            const result = await client.query(`
                with authorized_recruiter as materialized (
                  select app_user.user_id
                  from public.app_users app_user
                  join public.app_user_roles app_role
                    on app_role.user_id = app_user.user_id
                   and app_role.role in ('recruiter', 'admin')
                  where app_user.user_id = $2
                    and app_user.status = 'active'
                  limit 1
                ),
                inserted as (
                  insert into public.recruiter_invitation_question_sets (
                    recruiter_invitation_question_set_id,
                    recruiter_id,
                    action_key_hash,
                    request_fingerprint,
                    source,
                    lifecycle_state,
                    target_role,
                    job_description,
                    interview_stage,
                    question_plan_snapshot_json,
                    expires_at
                  )
                  select
                    $1::uuid,
                    authorized_recruiter.user_id,
                    $3,
                    $4,
                    $5,
                    'preparing',
                    $6,
                    $7,
                    $8,
                    $9::jsonb,
                    $10::timestamptz
                  from authorized_recruiter
                  on conflict (recruiter_id, action_key_hash) do nothing
                  returning *
                ),
                resolved as (
                  select 'claimed'::text as claim_outcome, inserted.*
                  from inserted
                  union all
                  select
                    case
                      when existing.request_fingerprint <> $4 then 'conflict'
                      when existing.expires_at <= now() then 'failed'
                      when existing.lifecycle_state = 'ready' then 'replayed'
                      when existing.lifecycle_state = 'failed' then 'failed'
                      else 'in_progress'
                    end,
                    existing.*
                  from public.recruiter_invitation_question_sets existing
                  join authorized_recruiter
                    on authorized_recruiter.user_id = existing.recruiter_id
                  where existing.recruiter_id = $2
                    and existing.action_key_hash = $3
                    and not exists (select 1 from inserted)
                  limit 1
                )
                select * from resolved
            `, [
                input.questionSetId,
                input.recruiterId,
                input.actionKeyHash,
                input.requestFingerprint,
                input.source,
                input.targetRole,
                input.jobDescription,
                input.interviewStage,
                JSON.stringify(input.questionPlanSnapshot),
                input.expiresAt,
            ]);

            let row = result.rows[0];
            if (!row) {
                // An ON CONFLICT loser can miss the winner in the statement snapshot.
                // A second statement sees the committed row and preserves convergence.
                const resolved = await client.query(`
                    with authorized_recruiter as materialized (
                      select app_user.user_id
                      from public.app_users app_user
                      join public.app_user_roles app_role
                        on app_role.user_id = app_user.user_id
                       and app_role.role in ('recruiter', 'admin')
                      where app_user.user_id = $1
                        and app_user.status = 'active'
                      limit 1
                    )
                    select
                      case
                        when existing.request_fingerprint <> $3 then 'conflict'
                        when existing.expires_at <= now() then 'failed'
                        when existing.lifecycle_state = 'ready' then 'replayed'
                        when existing.lifecycle_state = 'failed' then 'failed'
                        else 'in_progress'
                      end as claim_outcome,
                      existing.*
                    from public.recruiter_invitation_question_sets existing
                    join authorized_recruiter
                      on authorized_recruiter.user_id = existing.recruiter_id
                    where existing.recruiter_id = $1
                      and existing.action_key_hash = $2
                    limit 1
                `, [input.recruiterId, input.actionKeyHash, input.requestFingerprint]);
                row = resolved.rows[0];
            }
            if (!row) {
                return { outcome: "unauthorized" as const, questionSet: null };
            }
            return {
                outcome: readClaimOutcome(row.claim_outcome),
                questionSet: mapQuestionSetRow(row),
            };
        },

        async complete(input: {
            questionSetId: string;
            recruiterId: string;
            actionKeyHash: string;
            requestFingerprint: string;
            questionWordingSnapshot: CandidateQuestionWordingResult;
            acceptedAt: string;
        }) {
            const result = await client.query(`
                with updated as (
                  update public.recruiter_invitation_question_sets question_set
                  set lifecycle_state = 'ready',
                      question_wording_snapshot_json = $5::jsonb,
                      accepted_at = $6::timestamptz
                  where question_set.recruiter_invitation_question_set_id = $1
                    and question_set.recruiter_id = $2
                    and question_set.action_key_hash = $3
                    and question_set.request_fingerprint = $4
                    and question_set.lifecycle_state = 'preparing'
                    and question_set.expires_at > $6::timestamptz
                  returning question_set.*
                )
                select * from updated
                union all
                select existing.*
                from public.recruiter_invitation_question_sets existing
                where existing.recruiter_invitation_question_set_id = $1
                  and existing.recruiter_id = $2
                  and existing.action_key_hash = $3
                  and existing.request_fingerprint = $4
                  and existing.lifecycle_state = 'ready'
                  and existing.question_wording_snapshot_json = $5::jsonb
                  and not exists (select 1 from updated)
                limit 1
            `, [
                input.questionSetId,
                input.recruiterId,
                input.actionKeyHash,
                input.requestFingerprint,
                JSON.stringify(input.questionWordingSnapshot),
                input.acceptedAt,
            ]);
            return mapQuestionSetRow(result.rows[0]);
        },

        async fail(input: {
            questionSetId: string;
            recruiterId: string;
            actionKeyHash: string;
            requestFingerprint: string;
            failedAt: string;
            failureCode: string;
        }) {
            await client.query(`
                update public.recruiter_invitation_question_sets question_set
                set lifecycle_state = 'failed',
                    failure_code = $6,
                    failed_at = $5::timestamptz
                where question_set.recruiter_invitation_question_set_id = $1
                  and question_set.recruiter_id = $2
                  and question_set.action_key_hash = $3
                  and question_set.request_fingerprint = $4
                  and question_set.lifecycle_state = 'preparing'
            `, [
                input.questionSetId,
                input.recruiterId,
                input.actionKeyHash,
                input.requestFingerprint,
                input.failedAt,
                input.failureCode.slice(0, 80),
            ]);
        },

        async findOwnedReady(input: {
            questionSetId: string;
            recruiterId: string;
            actionKeyHash: string;
        }) {
            const result = await client.query(`
                select question_set.*
                from public.recruiter_invitation_question_sets question_set
                join public.app_users app_user
                  on app_user.user_id = question_set.recruiter_id
                 and app_user.status = 'active'
                join public.app_user_roles app_role
                  on app_role.user_id = app_user.user_id
                 and app_role.role in ('recruiter', 'admin')
                where question_set.recruiter_invitation_question_set_id = $1
                  and question_set.recruiter_id = $2
                  and question_set.action_key_hash = $3
                  and question_set.lifecycle_state = 'ready'
                  and question_set.expires_at > now()
                limit 1
            `, [input.questionSetId, input.recruiterId, input.actionKeyHash]);
            return mapQuestionSetRow(result.rows[0]);
        },
    };
}

export type RecruiterInvitationQuestionSetRepository = ReturnType<
    typeof createRecruiterInvitationQuestionSetRepository
>;

function mapQuestionSetRow(row: Record<string, unknown> | undefined): RecruiterInvitationQuestionSetRecord | null {
    if (!row) return null;
    const interviewStage = readInterviewStage(row.interview_stage);
    const expectedPlan = createCandidateQuestionPlan({
        interviewStage,
        questionCount: getCandidateStageBaselineQuestionCount(interviewStage),
    });
    validateStoredPlan(row.question_plan_snapshot_json, expectedPlan);
    const lifecycleState = readLifecycleState(row.lifecycle_state);
    const questionWordingSnapshot = lifecycleState === "ready"
        ? parseCandidateQuestionWordingResult(row.question_wording_snapshot_json, expectedPlan)
        : null;

    return {
        questionSetId: requireString(row.recruiter_invitation_question_set_id),
        recruiterId: requireString(row.recruiter_id),
        actionKeyHash: requireString(row.action_key_hash),
        requestFingerprint: requireString(row.request_fingerprint),
        source: readSource(row.source),
        lifecycleState,
        targetRole: requireString(row.target_role),
        jobDescription: requireString(row.job_description),
        interviewStage,
        questionPlanSnapshot: expectedPlan,
        questionWordingSnapshot,
        expiresAt: toIsoString(row.expires_at),
    };
}

function validateStoredPlan(value: unknown, expected: CandidateQuestionPlan) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid question-set plan.");
    const plan = value as Record<string, unknown>;
    if (plan.interviewStage !== expected.interviewStage || plan.questionCount !== expected.questionCount) {
        throw new Error("Stored question-set plan does not match its stage.");
    }
    if (!Array.isArray(plan.slots) || plan.slots.length !== expected.slots.length) {
        throw new Error("Stored question-set plan has invalid slots.");
    }
    plan.slots.forEach((valueSlot, index) => {
        if (!valueSlot || typeof valueSlot !== "object" || Array.isArray(valueSlot)) {
            throw new Error("Stored question-set plan has invalid slots.");
        }
        const slot = valueSlot as Record<string, unknown>;
        const expectedSlot = expected.slots[index];
        if (slot.id !== expectedSlot.id || slot.index !== expectedSlot.index || slot.category !== expectedSlot.category) {
            throw new Error("Stored question-set plan has invalid slots.");
        }
    });
}

function readClaimOutcome(value: unknown): RecruiterInvitationQuestionSetClaimOutcome {
    if (
        value === "claimed"
        || value === "replayed"
        || value === "in_progress"
        || value === "conflict"
        || value === "failed"
    ) return value;
    throw new Error("Question-set repository returned an invalid claim outcome.");
}

function readInterviewStage(value: unknown): CandidateSetupStageId {
    if (
        value === "practice_only"
        || value === "screening"
        || value === "first_interview"
        || value === "follow_up"
        || value === "final_interview"
    ) return value;
    throw new Error("Question-set repository returned an invalid stage.");
}

function readLifecycleState(value: unknown): RecruiterInvitationQuestionSetRecord["lifecycleState"] {
    if (value === "preparing" || value === "ready" || value === "failed") return value;
    throw new Error("Question-set repository returned an invalid lifecycle state.");
}

function readSource(value: unknown): RecruiterQuestionSource {
    if (value === "generated" || value === "manual") return value;
    throw new Error("Question-set repository returned an invalid source.");
}

function requireString(value: unknown) {
    if (typeof value !== "string" || !value.trim()) throw new Error("Question-set repository returned invalid text.");
    return value;
}

function toIsoString(value: unknown) {
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.valueOf())) throw new Error("Question-set repository returned an invalid timestamp.");
    return date.toISOString();
}
