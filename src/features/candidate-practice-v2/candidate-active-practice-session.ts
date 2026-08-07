import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";

export function hasCandidateActivePracticeSessionForContext({
    candidateProfileId,
    roleProfileId,
    legacyTargetRole,
    practiceSessions,
}: {
    candidateProfileId: string;
    roleProfileId: string | null;
    legacyTargetRole: string;
    practiceSessions: CandidatePracticeSessionRecord[];
}) {
    const normalizedLegacyTargetRole = normalizeTargetRole(legacyTargetRole);

    return practiceSessions.some((session) => {
        if (
            session.candidateProfileId !== candidateProfileId
            || (session.status !== "planned" && session.status !== "in_progress")
        ) {
            return false;
        }

        return roleProfileId
            ? session.roleProfileId === roleProfileId
            : !session.roleProfileId
                && normalizeTargetRole(session.setupSnapshot.targetRole) === normalizedLegacyTargetRole;
    });
}

function normalizeTargetRole(value: string | null | undefined) {
    return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}
