import {
    isCandidatePracticeIntentLifecycleState,
    isCandidatePracticeIntentSource,
    type CandidatePracticeIntentItem,
    type CandidatePracticeIntentLifecycleState,
    type CandidatePracticeIntentRecord,
    type CandidatePracticeIntentSource,
} from "./candidate-follow-up-practice-intent";

export type CandidatePracticeIntentQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

export type CreateCandidatePracticeIntentInput = {
    candidateProfileId: string;
    source: CandidatePracticeIntentSource;
    lifecycleState?: CandidatePracticeIntentLifecycleState;
    sourceNextRoundDraftId?: string | null;
    sourceNextRoundDraftVersion?: number | null;
    roleProfileId: string | null;
    targetInterviewId: string;
    targetRole: string;
    setupContext: CandidatePracticeIntentRecord["setupContext"];
    items: CandidatePracticeIntentItem[];
};

export type CreateCandidateDirectPracticeIntentInput = CreateCandidatePracticeIntentInput & {
    idempotencyKeyHash: string;
    requestFingerprint: string;
};

export type CandidateDirectPracticeIntentCreationRecord = {
    outcome: "created" | "replayed" | "conflict";
    candidatePracticeIntentId: string;
    lifecycleState: CandidatePracticeIntentLifecycleState;
    consumedCandidatePracticeSessionId: string | null;
};

export function createCandidatePracticeIntentRepository(client: CandidatePracticeIntentQueryClient) {
    return {
        async createPracticeIntent(input: CreateCandidatePracticeIntentInput) {
            const lifecycleState = input.lifecycleState ?? "ready";
            const result = await client.query(`
                insert into public.candidate_practice_intents (
                  candidate_profile_id,
                  source,
                  lifecycle_state,
                  source_next_round_draft_id,
                  source_next_round_draft_version,
                  role_profile_id,
                  target_interview_id,
                  target_role,
                  setup_context_json,
                  items_json
                )
                values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
                returning candidate_practice_intent_id
            `, [
                input.candidateProfileId,
                input.source,
                lifecycleState,
                input.sourceNextRoundDraftId ?? null,
                input.sourceNextRoundDraftVersion ?? null,
                input.roleProfileId,
                input.targetInterviewId,
                input.targetRole,
                JSON.stringify(input.setupContext),
                JSON.stringify(input.items),
            ]);

            const candidatePracticeIntentId = readString(result.rows[0]?.candidate_practice_intent_id);
            return candidatePracticeIntentId ? { candidatePracticeIntentId } : null;
        },

        async createDirectPracticeIntent(
            input: CreateCandidateDirectPracticeIntentInput,
        ): Promise<CandidateDirectPracticeIntentCreationRecord | null> {
            const result = await client.query(`
                select *
                from public.create_candidate_direct_practice_intent(
                  $1::uuid,
                  $2::text,
                  $3::text,
                  $4::text,
                  $5::uuid,
                  $6::text,
                  $7::text,
                  $8::jsonb,
                  $9::jsonb
                )
            `, [
                input.candidateProfileId,
                input.idempotencyKeyHash,
                input.requestFingerprint,
                input.source,
                input.roleProfileId,
                input.targetInterviewId,
                input.targetRole,
                JSON.stringify(input.setupContext),
                JSON.stringify(input.items),
            ]);

            return toCandidateDirectPracticeIntentCreationRecord(result.rows[0]);
        },

        async findPracticeIntent(input: {
            candidatePracticeIntentId: string;
            candidateProfileId: string;
        }) {
            const result = await client.query(`
                select
                  candidate_practice_intent_id,
                  candidate_profile_id,
                  source,
                  lifecycle_state,
                  launch_version,
                  consumed_candidate_practice_session_id,
                  consumed_at,
                  source_next_round_draft_id,
                  source_next_round_draft_version,
                  role_profile_id,
                  target_interview_id,
                  target_role,
                  setup_context_json,
                  items_json,
                  created_at,
                  updated_at,
                  expires_at
                from public.candidate_practice_intents
                where candidate_practice_intent_id = $1
                  and candidate_profile_id = $2
                limit 1
            `, [
                input.candidatePracticeIntentId,
                input.candidateProfileId,
            ]);

            return toCandidatePracticeIntentRecord(result.rows[0]);
        },

    };
}

function toCandidateDirectPracticeIntentCreationRecord(
    row: Record<string, unknown> | undefined,
): CandidateDirectPracticeIntentCreationRecord | null {
    const outcome = row?.creation_outcome;
    const candidatePracticeIntentId = readString(row?.candidate_practice_intent_id);
    const lifecycleState = row?.intent_lifecycle_state;
    const consumedCandidatePracticeSessionId = readNullableString(
        row?.consumed_candidate_practice_session_id,
    );
    if (
        (outcome !== "created" && outcome !== "replayed" && outcome !== "conflict")
        || !candidatePracticeIntentId
        || !isCandidatePracticeIntentLifecycleState(lifecycleState)
        || (lifecycleState === "consumed") !== Boolean(consumedCandidatePracticeSessionId)
    ) {
        return null;
    }
    return {
        outcome,
        candidatePracticeIntentId,
        lifecycleState,
        consumedCandidatePracticeSessionId,
    };
}

export function toCandidatePracticeIntentRecord(
    row: Record<string, unknown> | undefined,
): CandidatePracticeIntentRecord | null {
    if (!row) {
        return null;
    }

    const candidatePracticeIntentId = readString(row.candidate_practice_intent_id);
    const candidateProfileId = readString(row.candidate_profile_id);
    const source = row.source;
    const lifecycleState = row.lifecycle_state;
    const launchVersion = readPositiveInteger(row.launch_version);
    const consumedCandidatePracticeSessionId = readNullableString(row.consumed_candidate_practice_session_id);
    const consumedAt = readNullableDateString(row.consumed_at);
    const sourceNextRoundDraftId = readNullableString(row.source_next_round_draft_id);
    const sourceNextRoundDraftVersion = readNullablePositiveInteger(row.source_next_round_draft_version);
    const roleProfileId = readNullableString(row.role_profile_id);
    const targetInterviewId = readString(row.target_interview_id);
    const targetRole = readString(row.target_role);
    const setupContext = readObject(row.setup_context_json);
    const items = readItems(row.items_json);
    const createdAt = readDateString(row.created_at);
    const updatedAt = readDateString(row.updated_at);
    const expiresAt = readDateString(row.expires_at);
    const createdAtTime = createdAt ? Date.parse(createdAt) : Number.NaN;
    const updatedAtTime = updatedAt ? Date.parse(updatedAt) : Number.NaN;
    const expiresAtTime = expiresAt ? Date.parse(expiresAt) : Number.NaN;

    if (
        !candidatePracticeIntentId
        || !candidateProfileId
        || !isCandidatePracticeIntentSource(source)
        || !isCandidatePracticeIntentLifecycleState(lifecycleState)
        || !launchVersion
        || !targetInterviewId
        || !targetRole
        || !setupContext
        || items.length < 1
        || items.length > 20
        || !createdAt
        || !updatedAt
        || !expiresAt
        || !Number.isFinite(createdAtTime)
        || !Number.isFinite(updatedAtTime)
        || !Number.isFinite(expiresAtTime)
        || expiresAtTime <= createdAtTime
        || Boolean(sourceNextRoundDraftId) !== Boolean(sourceNextRoundDraftVersion)
        || (lifecycleState === "consumed") !== Boolean(consumedCandidatePracticeSessionId && consumedAt)
        || (lifecycleState !== "consumed" && Boolean(consumedCandidatePracticeSessionId || consumedAt))
    ) {
        return null;
    }

    return {
        status: "candidate_practice_intent_record",
        candidatePracticeIntentId,
        candidateProfileId,
        source,
        lifecycleState,
        launchVersion,
        consumedCandidatePracticeSessionId,
        consumedAt,
        ...(sourceNextRoundDraftId && sourceNextRoundDraftVersion
            ? { sourceNextRoundDraftId, sourceNextRoundDraftVersion }
            : {}),
        roleProfileId,
        targetInterviewId,
        targetRole,
        itemCount: items.length,
        setupContext: setupContext as CandidatePracticeIntentRecord["setupContext"],
        items,
        createdAt,
        updatedAt,
        expiresAt,
    };
}

function readItems(value: unknown): CandidatePracticeIntentItem[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is CandidatePracticeIntentItem => (
        Boolean(item)
        && typeof item === "object"
        && !Array.isArray(item)
    ));
}

function readObject(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    return value;
}

function readDateString(value: unknown) {
    if (value instanceof Date) {
        return value.toISOString();
    }

    return readString(value);
}

function readNullableDateString(value: unknown) {
    return value === null || value === undefined ? null : readDateString(value);
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNullableString(value: unknown) {
    return value === null || value === undefined ? null : readString(value);
}

function readNullablePositiveInteger(value: unknown) {
    if (value === null || value === undefined) {
        return null;
    }

    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function readPositiveInteger(value: unknown) {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
