import { createHash } from "node:crypto";

import type { CandidateSetupStageId } from "./candidate-setup-contract";
import type { CandidateSetupSessionCreationResult } from "./candidate-setup-session-creation";
import type { CandidateTrustedSetupContext } from "./candidate-setup-entry-context";

export type CandidateSetupPrepContextQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

export type ResolveCandidateSetupPrepContextInput = {
    candidateProfileId: string;
    requestedRoleProfileId?: string | null;
    createSeparateFromRoleProfileId?: string | null;
    allowManualCreation: boolean;
    trustedLaunchContext?: CandidateTrustedSetupContext | null;
    trustedLaunchSessionId?: string | null;
    setupSnapshot: CandidateSetupSessionCreationResult["setupSnapshot"];
};

export type CandidateExistingPrepContextSummary = {
    roleProfileId: string;
    targetRole: string;
    jobDescription: string;
    interviewStage: CandidateSetupStageId | null;
    questionCount: number | null;
    createdAt: string;
    lastPracticeActivityAt: string | null;
    completedSessionCount: number;
    completedQuestionCount: number;
    activeRound: {
        completedQuestionCount: number;
        totalQuestionCount: number;
    } | null;
};

export type CandidateSetupPrepContextResolution =
    | {
        status: "resolved";
        roleProfileId: string;
        resolution:
            | "requested"
            | "created"
            | "reused_empty"
            | "separate_created"
            | "separate_reused_empty";
    }
    | {
        status: "existing_paths";
        existingPrepContexts: CandidateExistingPrepContextSummary[];
    }
    | {
        status: "decision_invalid";
    };

export type CandidateSetupPrepContextResolver = {
    resolveSetupPrepContext: (
        input: ResolveCandidateSetupPrepContextInput,
    ) => Promise<CandidateSetupPrepContextResolution | null>;
};

type CandidateManualPrepContextKey = ReturnType<typeof createCandidateManualPrepContextKey>;
type CandidateHostPrepContextKey = CandidateTrustedSetupContext & {
    normalizedTargetRole: string;
};

type CandidateManualPrepContextMatch = CandidateExistingPrepContextSummary & {
    sessionCount: number;
};

export function createCandidateSetupPrepContextRepository(
    client: CandidateSetupPrepContextQueryClient,
): CandidateSetupPrepContextResolver {
    return {
        async resolveSetupPrepContext(input) {
            const candidateProfileId = normalizeRequiredId(input.candidateProfileId);
            const requestedRoleProfileId = normalizeOptionalId(input.requestedRoleProfileId);

            if (requestedRoleProfileId) {
                const owned = await findOwnedPrepContext(client, {
                    candidateProfileId,
                    roleProfileId: requestedRoleProfileId,
                });
                return owned
                    ? { status: "resolved", roleProfileId: owned.roleProfileId, resolution: "requested" }
                    : null;
            }

            if (input.trustedLaunchContext) {
                const key = createCandidateHostPrepContextKey(
                    input.trustedLaunchContext,
                    input.setupSnapshot,
                );
                if (!key) {
                    return null;
                }
                const trustedLaunchSessionId = normalizeRequiredId(input.trustedLaunchSessionId ?? "");
                const createSeparateFromRoleProfileId = normalizeOptionalId(input.createSeparateFromRoleProfileId);
                if (createSeparateFromRoleProfileId) {
                    return createSeparateHostPrepContext(client, {
                        candidateProfileId,
                        sourceRoleProfileId: createSeparateFromRoleProfileId,
                        key,
                        trustedLaunchSessionId,
                        setupSnapshot: input.setupSnapshot,
                    });
                }

                const existingMatches = await listHostPrepContextMatches(client, {
                    candidateProfileId,
                    key,
                });
                const usedMatches = existingMatches.filter((match) => match.sessionCount > 0);
                if (usedMatches.length > 0) {
                    return {
                        status: "existing_paths",
                        existingPrepContexts: usedMatches.map(toExistingPrepContextSummary),
                    };
                }

                const reusableEmptyProfile = existingMatches[0];
                if (reusableEmptyProfile) {
                    return {
                        status: "resolved",
                        roleProfileId: reusableEmptyProfile.roleProfileId,
                        resolution: "reused_empty",
                    };
                }

                const created = await insertHostPrepContext(client, {
                    candidateProfileId,
                    key,
                    trustedLaunchSessionId,
                    setupSnapshot: input.setupSnapshot,
                    practicePathNumber: 1,
                });
                if (created) {
                    return { status: "resolved", roleProfileId: created.roleProfileId, resolution: "created" };
                }

                const concurrentMatches = await listHostPrepContextMatches(client, {
                    candidateProfileId,
                    key,
                });
                const concurrentUsedMatches = concurrentMatches.filter((match) => match.sessionCount > 0);
                if (concurrentUsedMatches.length > 0) {
                    return {
                        status: "existing_paths",
                        existingPrepContexts: concurrentUsedMatches.map(toExistingPrepContextSummary),
                    };
                }
                const concurrentEmptyProfile = concurrentMatches[0];
                return concurrentEmptyProfile
                    ? {
                        status: "resolved",
                        roleProfileId: concurrentEmptyProfile.roleProfileId,
                        resolution: "reused_empty",
                    }
                    : null;
            }

            if (!input.allowManualCreation) {
                return null;
            }

            const key = createCandidateManualPrepContextKey({
                targetRole: input.setupSnapshot.targetRole,
                jobDescription: input.setupSnapshot.jobDescription,
            });
            const createSeparateFromRoleProfileId = normalizeOptionalId(input.createSeparateFromRoleProfileId);

            if (createSeparateFromRoleProfileId) {
                return createSeparateManualPrepContext(client, {
                    candidateProfileId,
                    sourceRoleProfileId: createSeparateFromRoleProfileId,
                    key,
                    setupSnapshot: input.setupSnapshot,
                });
            }

            const existingMatches = await listManualPrepContextMatches(client, {
                candidateProfileId,
                key,
            });
            const usedMatches = existingMatches.filter((match) => match.sessionCount > 0);
            if (usedMatches.length > 0) {
                return {
                    status: "existing_paths",
                    existingPrepContexts: usedMatches.map(toExistingPrepContextSummary),
                };
            }

            const reusableEmptyProfile = existingMatches[0];
            if (reusableEmptyProfile) {
                return {
                    status: "resolved",
                    roleProfileId: reusableEmptyProfile.roleProfileId,
                    resolution: "reused_empty",
                };
            }

            const created = await insertManualPrepContext(client, {
                candidateProfileId,
                key,
                setupSnapshot: input.setupSnapshot,
                practicePathNumber: 1,
            });
            if (created) {
                return { status: "resolved", roleProfileId: created.roleProfileId, resolution: "created" };
            }

            // A concurrent first-path create can win after the initial lookup.
            const concurrentMatches = await listManualPrepContextMatches(client, {
                candidateProfileId,
                key,
            });
            const concurrentUsedMatches = concurrentMatches.filter((match) => match.sessionCount > 0);
            if (concurrentUsedMatches.length > 0) {
                return {
                    status: "existing_paths",
                    existingPrepContexts: concurrentUsedMatches.map(toExistingPrepContextSummary),
                };
            }

            const concurrentEmptyProfile = concurrentMatches[0];
            return concurrentEmptyProfile
                ? {
                    status: "resolved",
                    roleProfileId: concurrentEmptyProfile.roleProfileId,
                    resolution: "reused_empty",
                }
                : null;
        },
    };
}

function createCandidateHostPrepContextKey(
    trusted: CandidateTrustedSetupContext,
    setupSnapshot: CandidateSetupSessionCreationResult["setupSnapshot"],
): CandidateHostPrepContextKey | null {
    const canonical = createCandidateManualPrepContextKey({
        targetRole: trusted.targetRole,
        jobDescription: trusted.jobDescription,
    });
    if (
        setupSnapshot.targetRole !== canonical.targetRole
        || setupSnapshot.jobDescription !== canonical.jobDescription
        || trusted.jobDescriptionHash !== canonical.jobDescriptionHash
    ) {
        return null;
    }

    return {
        ...trusted,
        normalizedTargetRole: canonical.normalizedTargetRole,
    };
}

export function createCandidateManualPrepContextKey(input: {
    targetRole: string;
    jobDescription: string;
}) {
    const targetRole = normalizeRequiredText(input.targetRole, "Target role");
    const jobDescription = normalizeRequiredText(input.jobDescription, "Job description");

    return {
        targetRole,
        normalizedTargetRole: targetRole.toLowerCase(),
        jobDescription,
        jobDescriptionHash: createHash("sha256").update(jobDescription).digest("hex"),
    };
}

async function findOwnedPrepContext(
    client: CandidateSetupPrepContextQueryClient,
    input: {
        candidateProfileId: string;
        roleProfileId: string;
    },
) {
    const result = await client.query(`
        select role_profile_id
        from public.candidate_role_preparation_profiles
        where role_profile_id = $1
          and candidate_profile_id = $2
          and status in ('active', 'paused')
        limit 1
    `, [input.roleProfileId, input.candidateProfileId]);
    const roleProfileId = readRoleProfileId(result.rows[0]);

    return roleProfileId ? { roleProfileId } : null;
}

async function listManualPrepContextMatches(
    client: CandidateSetupPrepContextQueryClient,
    input: {
        candidateProfileId: string;
        key: CandidateManualPrepContextKey;
    },
): Promise<CandidateManualPrepContextMatch[]> {
    return listPrepContextMatches(client, {
        candidateProfileId: input.candidateProfileId,
        key: {
            kind: "manual",
            normalizedTargetRole: input.key.normalizedTargetRole,
            jobDescriptionHash: input.key.jobDescriptionHash,
        },
    });
}

async function listHostPrepContextMatches(
    client: CandidateSetupPrepContextQueryClient,
    input: {
        candidateProfileId: string;
        key: CandidateHostPrepContextKey;
    },
): Promise<CandidateManualPrepContextMatch[]> {
    return listPrepContextMatches(client, {
        candidateProfileId: input.candidateProfileId,
        key: {
            kind: "host",
            sourcePlatform: input.key.sourcePlatform,
            jobCollectionId: input.key.jobCollectionId,
        },
    });
}

async function listPrepContextMatches(
    client: CandidateSetupPrepContextQueryClient,
    input: {
        candidateProfileId: string;
        key:
            | { kind: "manual"; normalizedTargetRole: string; jobDescriptionHash: string }
            | { kind: "host"; sourcePlatform: string; jobCollectionId: string };
    },
): Promise<CandidateManualPrepContextMatch[]> {
    const matchPredicate = input.key.kind === "host"
        ? "profile.source = 'host_platform' and profile.source_platform = $2 and profile.source_job_collection_id = $3"
        : "profile.source in ('manual', 'dev_seed') and profile.normalized_target_role = $2 and profile.job_description_hash = $3";
    const matchValues = input.key.kind === "host"
        ? [input.candidateProfileId, input.key.sourcePlatform, input.key.jobCollectionId]
        : [input.candidateProfileId, input.key.normalizedTargetRole, input.key.jobDescriptionHash];
    const result = await client.query(`
        select
          profile.role_profile_id,
          profile.target_role,
          profile.job_description_snapshot,
          profile.created_at,
          activity.last_practice_activity_at,
          activity.session_count,
          activity.completed_session_count,
          activity.completed_question_count,
          initial_round.interview_stage,
          initial_round.question_count,
          active_round.completed_question_count as active_completed_question_count,
          active_round.total_question_count as active_total_question_count
        from public.candidate_role_preparation_profiles profile
        left join lateral (
          select
            max(session.updated_at) as last_practice_activity_at,
            count(*)::integer as session_count,
            count(*) filter (where session.status = 'completed')::integer as completed_session_count,
            coalesce(sum(
              case
                when session.status = 'completed'
                  then (
                    select count(*)
                    from jsonb_object_keys(coalesce(session.answer_submissions_json, '{}'::jsonb))
                  )
                else 0
              end
            ), 0)::integer as completed_question_count
          from public.candidate_practice_sessions session
          where session.candidate_profile_id = profile.candidate_profile_id
            and session.role_profile_id = profile.role_profile_id
        ) activity on true
        left join lateral (
          select
            session.setup_snapshot_json ->> 'interviewStage' as interview_stage,
            case
              when jsonb_typeof(session.setup_snapshot_json -> 'questionCount') = 'number'
                then (session.setup_snapshot_json ->> 'questionCount')::integer
              else null
            end as question_count
          from public.candidate_practice_sessions session
          where session.candidate_profile_id = profile.candidate_profile_id
            and session.role_profile_id = profile.role_profile_id
          order by session.created_at asc, session.candidate_practice_session_id asc
          limit 1
        ) initial_round on true
        left join lateral (
          select
            (
              select count(*)::integer
              from jsonb_object_keys(coalesce(session.answer_submissions_json, '{}'::jsonb))
            )
              as completed_question_count,
            case
              when jsonb_typeof(session.setup_snapshot_json -> 'questionCount') = 'number'
                then (session.setup_snapshot_json ->> 'questionCount')::integer
              when jsonb_typeof(session.question_wording_snapshot_json -> 'questions') = 'array'
                then jsonb_array_length(session.question_wording_snapshot_json -> 'questions')
              else 0
            end as total_question_count
          from public.candidate_practice_sessions session
          where session.candidate_profile_id = profile.candidate_profile_id
            and session.role_profile_id = profile.role_profile_id
            and session.status in ('planned', 'in_progress')
          order by session.updated_at desc, session.created_at desc
          limit 1
        ) active_round on true
        where profile.candidate_profile_id = $1
          and ${matchPredicate}
          and profile.status in ('active', 'paused')
        order by activity.last_practice_activity_at desc nulls last, profile.created_at desc
    `, matchValues);

    return result.rows
        .map(toManualPrepContextMatch)
        .filter((match): match is CandidateManualPrepContextMatch => Boolean(match));
}

async function insertManualPrepContext(
    client: CandidateSetupPrepContextQueryClient,
    input: {
        candidateProfileId: string;
        key: CandidateManualPrepContextKey;
        setupSnapshot: CandidateSetupSessionCreationResult["setupSnapshot"];
        practicePathNumber: number;
    },
) {
    const result = await client.query(`
        insert into public.candidate_role_preparation_profiles (
          candidate_profile_id,
          target_role,
          normalized_target_role,
          job_description_snapshot,
          job_description_hash,
          resume_context_snapshot_json,
          source,
          practice_path_number
        )
        values ($1, $2, $3, $4, $5, $6::jsonb, 'manual', $7)
        on conflict do nothing
        returning role_profile_id
    `, [
        input.candidateProfileId,
        input.key.targetRole,
        input.key.normalizedTargetRole,
        input.key.jobDescription,
        input.key.jobDescriptionHash,
        toResumeContext(input.setupSnapshot),
        input.practicePathNumber,
    ]);
    const roleProfileId = readRoleProfileId(result.rows[0]);

    return roleProfileId ? { roleProfileId } : null;
}

async function insertHostPrepContext(
    client: CandidateSetupPrepContextQueryClient,
    input: {
        candidateProfileId: string;
        trustedLaunchSessionId: string;
        key: CandidateHostPrepContextKey;
        setupSnapshot: CandidateSetupSessionCreationResult["setupSnapshot"];
        practicePathNumber: number;
    },
) {
    const result = await client.query(`
        insert into public.candidate_role_preparation_profiles (
          candidate_profile_id,
          target_role,
          normalized_target_role,
          job_description_snapshot,
          job_description_hash,
          resume_context_snapshot_json,
          source,
          source_platform,
          source_job_collection_id,
          source_requirement_id,
          source_launch_session_id,
          practice_path_number
        )
        values ($1, $2, $3, $4, $5, $6::jsonb, 'host_platform', $7, $8, $9, $10, $11)
        on conflict do nothing
        returning role_profile_id
    `, [
        input.candidateProfileId,
        input.key.targetRole,
        input.key.normalizedTargetRole,
        input.key.jobDescription,
        input.key.jobDescriptionHash,
        toResumeContext(input.setupSnapshot),
        input.key.sourcePlatform,
        input.key.jobCollectionId,
        input.key.requirementId,
        input.trustedLaunchSessionId,
        input.practicePathNumber,
    ]);
    const roleProfileId = readRoleProfileId(result.rows[0]);

    return roleProfileId ? { roleProfileId } : null;
}

async function createSeparateHostPrepContext(
    client: CandidateSetupPrepContextQueryClient,
    input: {
        candidateProfileId: string;
        sourceRoleProfileId: string;
        trustedLaunchSessionId: string;
        key: CandidateHostPrepContextKey;
        setupSnapshot: CandidateSetupSessionCreationResult["setupSnapshot"];
    },
): Promise<CandidateSetupPrepContextResolution> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
        const matches = await listHostPrepContextMatches(client, {
            candidateProfileId: input.candidateProfileId,
            key: input.key,
        });
        const sourceMatch = matches.find((match) => (
            match.roleProfileId === input.sourceRoleProfileId && match.sessionCount > 0
        ));
        if (!sourceMatch) {
            return { status: "decision_invalid" };
        }

        const reusableEmptyProfile = matches.find((match) => match.sessionCount === 0);
        if (reusableEmptyProfile) {
            return {
                status: "resolved",
                roleProfileId: reusableEmptyProfile.roleProfileId,
                resolution: "separate_reused_empty",
            };
        }

        const result = await client.query(`
            insert into public.candidate_role_preparation_profiles (
              candidate_profile_id,
              target_role,
              normalized_target_role,
              job_description_snapshot,
              job_description_hash,
              resume_context_snapshot_json,
              source,
              source_platform,
              source_job_collection_id,
              source_requirement_id,
              source_launch_session_id,
              practice_path_number
            )
            select
              $1, $2, $3, $4, $5, $6::jsonb, 'host_platform', $7, $8, $9, $10,
              coalesce(max(profile.practice_path_number), 0) + 1
            from public.candidate_role_preparation_profiles profile
            where profile.candidate_profile_id = $1
              and profile.source = 'host_platform'
              and profile.source_platform = $7
              and profile.source_job_collection_id = $8
            having exists (
              select 1
              from public.candidate_role_preparation_profiles source_profile
              where source_profile.role_profile_id = $11
                and source_profile.candidate_profile_id = $1
                and source_profile.source = 'host_platform'
                and source_profile.source_platform = $7
                and source_profile.source_job_collection_id = $8
                and source_profile.status in ('active', 'paused')
            )
            on conflict do nothing
            returning role_profile_id
        `, [
            input.candidateProfileId,
            input.key.targetRole,
            input.key.normalizedTargetRole,
            input.key.jobDescription,
            input.key.jobDescriptionHash,
            toResumeContext(input.setupSnapshot),
            input.key.sourcePlatform,
            input.key.jobCollectionId,
            input.key.requirementId,
            input.trustedLaunchSessionId,
            input.sourceRoleProfileId,
        ]);
        const roleProfileId = readRoleProfileId(result.rows[0]);
        if (roleProfileId) {
            return { status: "resolved", roleProfileId, resolution: "separate_created" };
        }
    }

    return { status: "decision_invalid" };
}

async function createSeparateManualPrepContext(
    client: CandidateSetupPrepContextQueryClient,
    input: {
        candidateProfileId: string;
        sourceRoleProfileId: string;
        key: CandidateManualPrepContextKey;
        setupSnapshot: CandidateSetupSessionCreationResult["setupSnapshot"];
    },
): Promise<CandidateSetupPrepContextResolution> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
        const matches = await listManualPrepContextMatches(client, {
            candidateProfileId: input.candidateProfileId,
            key: input.key,
        });
        const sourceMatch = matches.find((match) => (
            match.roleProfileId === input.sourceRoleProfileId && match.sessionCount > 0
        ));
        if (!sourceMatch) {
            return { status: "decision_invalid" };
        }

        const reusableEmptyProfile = matches.find((match) => match.sessionCount === 0);
        if (reusableEmptyProfile) {
            return {
                status: "resolved",
                roleProfileId: reusableEmptyProfile.roleProfileId,
                resolution: "separate_reused_empty",
            };
        }

        const result = await client.query(`
            insert into public.candidate_role_preparation_profiles (
              candidate_profile_id,
              target_role,
              normalized_target_role,
              job_description_snapshot,
              job_description_hash,
              resume_context_snapshot_json,
              source,
              practice_path_number
            )
            select
              $1, $2, $3, $4, $5, $6::jsonb, 'manual',
              coalesce(max(profile.practice_path_number), 0) + 1
            from public.candidate_role_preparation_profiles profile
            where profile.candidate_profile_id = $1
              and profile.normalized_target_role = $3
              and profile.job_description_hash = $5
            having exists (
              select 1
              from public.candidate_role_preparation_profiles source_profile
              where source_profile.role_profile_id = $7
                and source_profile.candidate_profile_id = $1
                and source_profile.normalized_target_role = $3
                and source_profile.job_description_hash = $5
                and source_profile.status in ('active', 'paused')
            )
            on conflict do nothing
            returning role_profile_id
        `, [
            input.candidateProfileId,
            input.key.targetRole,
            input.key.normalizedTargetRole,
            input.key.jobDescription,
            input.key.jobDescriptionHash,
            toResumeContext(input.setupSnapshot),
            input.sourceRoleProfileId,
        ]);
        const roleProfileId = readRoleProfileId(result.rows[0]);
        if (roleProfileId) {
            return { status: "resolved", roleProfileId, resolution: "separate_created" };
        }
    }

    return { status: "decision_invalid" };
}

function toResumeContext(setupSnapshot: CandidateSetupSessionCreationResult["setupSnapshot"]) {
    return JSON.stringify({
        included: Boolean(setupSnapshot.resumeText),
        captureMode: setupSnapshot.resumeCaptureMode,
    });
}

function toManualPrepContextMatch(row: Record<string, unknown>): CandidateManualPrepContextMatch | null {
    const roleProfileId = readRoleProfileId(row);
    const targetRole = readString(row.target_role);
    const jobDescription = readString(row.job_description_snapshot);
    const createdAt = readTimestamp(row.created_at);
    if (!roleProfileId || !targetRole || !jobDescription || !createdAt) {
        return null;
    }

    const activeCompletedQuestionCount = readNullableCount(row.active_completed_question_count);
    const activeTotalQuestionCount = readNullableCount(row.active_total_question_count);

    return {
        roleProfileId,
        targetRole,
        jobDescription,
        interviewStage: readInterviewStage(row.interview_stage),
        questionCount: readNullableCount(row.question_count),
        createdAt,
        lastPracticeActivityAt: readTimestamp(row.last_practice_activity_at),
        sessionCount: readCount(row.session_count),
        completedSessionCount: readCount(row.completed_session_count),
        completedQuestionCount: readCount(row.completed_question_count),
        activeRound: activeCompletedQuestionCount != null && activeTotalQuestionCount != null
            ? {
                completedQuestionCount: activeCompletedQuestionCount,
                totalQuestionCount: activeTotalQuestionCount,
            }
            : null,
    };
}

function toExistingPrepContextSummary(match: CandidateManualPrepContextMatch): CandidateExistingPrepContextSummary {
    return {
        roleProfileId: match.roleProfileId,
        targetRole: match.targetRole,
        jobDescription: match.jobDescription,
        interviewStage: match.interviewStage,
        questionCount: match.questionCount,
        createdAt: match.createdAt,
        lastPracticeActivityAt: match.lastPracticeActivityAt,
        completedSessionCount: match.completedSessionCount,
        completedQuestionCount: match.completedQuestionCount,
        activeRound: match.activeRound,
    };
}

function normalizeRequiredId(value: string) {
    const normalized = value.trim();
    if (!normalized) {
        throw new Error("Candidate profile ID is required.");
    }
    return normalized;
}

function normalizeOptionalId(value: string | null | undefined) {
    if (value == null) {
        return null;
    }
    const normalized = value.trim();
    return normalized || null;
}

function normalizeRequiredText(value: string, label: string) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) {
        throw new Error(`${label} is required.`);
    }
    return normalized;
}

function readRoleProfileId(row: Record<string, unknown> | undefined) {
    return readString(row?.role_profile_id);
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readTimestamp(value: unknown) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString();
    }
    if (typeof value !== "string" || !value.trim()) {
        return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function readCount(value: unknown) {
    return readNullableCount(value) ?? 0;
}

function readNullableCount(value: unknown) {
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function readInterviewStage(value: unknown): CandidateSetupStageId | null {
    return value === "practice_only"
        || value === "screening"
        || value === "first_interview"
        || value === "follow_up"
        || value === "final_interview"
        ? value
        : null;
}
