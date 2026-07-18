import type {
    CandidateSetupStartClaim,
    CandidateSetupStartClaimResult,
} from "./candidate-setup-start-request";

export type CandidateSetupStartRequestQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

export type ClaimCandidateSetupStartRequestInput = {
    candidateProfileId: string;
    idempotencyKeyHash: string;
    requestFingerprint: string;
    claimedAt: string;
    claimExpiresAt: string;
    requestExpiresAt: string;
};

export type FailCandidateSetupStartRequestInput = CandidateSetupStartClaim & {
    candidateProfileId: string;
    failedAt: string;
    errorCode: string;
};

export function createCandidateSetupStartRequestRepository(client: CandidateSetupStartRequestQueryClient) {
    return {
        async claimSetupStart(
            input: ClaimCandidateSetupStartRequestInput,
        ): Promise<CandidateSetupStartClaimResult | null> {
            const result = await client.query(`
                with claim_lock as materialized (
                  select pg_advisory_xact_lock(
                    hashtextextended($1::uuid::text || ':' || $2::text, 0)
                  )
                ), existing as materialized (
                  select request.*
                  from public.candidate_setup_start_requests request
                  cross join claim_lock
                  where request.candidate_profile_id = $1
                    and request.idempotency_key_hash = $2
                ), reclaimed as (
                  update public.candidate_setup_start_requests request
                  set request_fingerprint = $3,
                      lifecycle_state = 'pending',
                      claim_generation = request.claim_generation + 1,
                      claim_expires_at = $5,
                      expires_at = $6,
                      candidate_practice_session_id = null,
                      completed_at = null,
                      failed_at = null,
                      last_error_code = null
                  from claim_lock
                  where request.candidate_profile_id = $1
                    and request.idempotency_key_hash = $2
                    and (
                      request.expires_at <= $4
                      or (
                        request.request_fingerprint = $3
                        and (
                          request.lifecycle_state = 'failed'
                          or (
                            request.lifecycle_state = 'pending'
                            and request.claim_expires_at <= $4
                          )
                        )
                      )
                    )
                  returning request.*
                ), inserted as (
                  insert into public.candidate_setup_start_requests (
                    candidate_profile_id,
                    idempotency_key_hash,
                    request_fingerprint,
                    lifecycle_state,
                    claim_generation,
                    claim_expires_at,
                    expires_at
                  )
                  select $1, $2, $3, 'pending', 1, $5, $6
                  from claim_lock
                  where not exists (select 1 from existing)
                  returning *
                )
                select 'acquired'::text as claim_outcome, inserted.*
                from inserted
                union all
                select 'acquired'::text as claim_outcome, reclaimed.*
                from reclaimed
                union all
                select
                  case
                    when existing.request_fingerprint <> $3 then 'conflict'
                    when existing.lifecycle_state = 'completed' then 'replayed'
                    else 'in_progress'
                  end as claim_outcome,
                  existing.*
                from existing
                where not exists (select 1 from reclaimed)
                limit 1
            `, [
                input.candidateProfileId,
                input.idempotencyKeyHash,
                input.requestFingerprint,
                input.claimedAt,
                input.claimExpiresAt,
                input.requestExpiresAt,
            ]);

            return normalizeCandidateSetupStartClaimResult(result.rows[0]);
        },

        async failSetupStart(input: FailCandidateSetupStartRequestInput): Promise<boolean> {
            const result = await client.query(`
                update public.candidate_setup_start_requests
                set lifecycle_state = 'failed',
                    claim_expires_at = $5,
                    failed_at = $5,
                    last_error_code = $6
                where candidate_profile_id = $1
                  and idempotency_key_hash = $2
                  and request_fingerprint = $3
                  and claim_generation = $4
                  and lifecycle_state = 'pending'
                  and candidate_practice_session_id is null
                returning candidate_setup_start_request_id
            `, [
                input.candidateProfileId,
                input.idempotencyKeyHash,
                input.requestFingerprint,
                input.claimGeneration,
                input.failedAt,
                input.errorCode,
            ]);

            return Boolean(result.rows[0]?.candidate_setup_start_request_id);
        },
    };
}

function normalizeCandidateSetupStartClaimResult(
    row: Record<string, unknown> | undefined,
): CandidateSetupStartClaimResult | null {
    const outcome = readOutcome(row?.claim_outcome);
    const idempotencyKeyHash = readSha256(row?.idempotency_key_hash);
    const requestFingerprint = readSha256(row?.request_fingerprint);
    const claimGeneration = readPositiveInteger(row?.claim_generation);
    if (!outcome || !idempotencyKeyHash || !requestFingerprint || !claimGeneration) {
        return null;
    }

    const claim = { idempotencyKeyHash, requestFingerprint, claimGeneration };
    if (outcome === "replayed") {
        const candidatePracticeSessionId = readString(row?.candidate_practice_session_id);
        return candidatePracticeSessionId
            ? { outcome, candidatePracticeSessionId, ...claim }
            : null;
    }

    return { outcome, ...claim };
}

function readOutcome(value: unknown): CandidateSetupStartClaimResult["outcome"] | null {
    return value === "acquired" || value === "replayed" || value === "in_progress" || value === "conflict"
        ? value
        : null;
}

function readSha256(value: unknown) {
    return typeof value === "string" && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

function readPositiveInteger(value: unknown) {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value : null;
}
