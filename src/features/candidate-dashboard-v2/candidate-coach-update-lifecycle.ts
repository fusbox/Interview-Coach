export const CANDIDATE_COACH_UPDATE_CLAIM_LEASE_MS = 120_000;

export function isCandidateCoachUpdateRequestStale({
    requestedAt,
    now,
}: {
    requestedAt: string;
    now: Date;
}) {
    const requestedAtMs = Date.parse(requestedAt);

    return Number.isFinite(requestedAtMs)
        && now.getTime() - requestedAtMs >= CANDIDATE_COACH_UPDATE_CLAIM_LEASE_MS;
}
