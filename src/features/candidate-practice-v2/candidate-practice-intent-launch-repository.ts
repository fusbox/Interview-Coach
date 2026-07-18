import {
    createCandidatePracticeSessionPersistenceInput,
    type CandidatePracticeSessionQueryClient,
    type CreateCandidatePracticeSessionInput,
} from "@/features/candidate-session-v2/candidate-practice-session-repository";

export type CandidatePracticeIntentLaunchOutcome =
    | "created"
    | "replayed"
    | "stale_context"
    | "not_found"
    | "expired"
    | "cancelled"
    | "mismatched"
    | "consumed_mismatch"
    | "invalid_session";

export type CandidatePracticeIntentLaunchResult =
    | {
        outcome: "created" | "replayed";
        candidatePracticeSessionId: string;
    }
    | {
        outcome: Exclude<CandidatePracticeIntentLaunchOutcome, "created" | "replayed">;
        candidatePracticeSessionId: null;
    };

export type StartCandidatePracticeIntentSessionInput = {
    candidatePracticeIntentId: string;
    candidateProfileId: string;
    expectedLaunchVersion: number;
    expectedPriorSessionCount: number;
    sessionInput?: CreateCandidatePracticeSessionInput | null;
};

export function createCandidatePracticeIntentLaunchRepository(
    client: CandidatePracticeSessionQueryClient,
) {
    return {
        async startPracticeIntentSession(
            input: StartCandidatePracticeIntentSessionInput,
        ): Promise<CandidatePracticeIntentLaunchResult | null> {
            const session = input.sessionInput
                ? createCandidatePracticeSessionPersistenceInput(input.sessionInput)
                : null;
            if (session && !session.questionWordingSnapshot) {
                return {
                    outcome: "invalid_session",
                    candidatePracticeSessionId: null,
                };
            }

            const result = await client.query(`
                select launch_outcome, candidate_practice_session_id
                from public.start_candidate_practice_intent_session(
                  $1::uuid,
                  $2::uuid,
                  $3::bigint,
                  $4::integer,
                  $5::uuid,
                  $6::uuid,
                  $7::jsonb,
                  $8::jsonb,
                  $9::jsonb,
                  $10::text,
                  $11::jsonb,
                  $12::jsonb
                )
            `, [
                input.candidatePracticeIntentId,
                input.candidateProfileId,
                input.expectedLaunchVersion,
                input.expectedPriorSessionCount,
                session?.roleProfileId ?? null,
                session?.candidateLaunchSessionId ?? null,
                session?.setupSnapshot ?? null,
                session?.questionPlanSnapshot ?? null,
                session?.questionWordingSnapshot ?? null,
                session?.questionWordingStatus ?? null,
                session?.progress ?? null,
                session?.answerDrafts ?? null,
            ]);

            return toCandidatePracticeIntentLaunchResult(result.rows[0]);
        },
    };
}

export function toCandidatePracticeIntentLaunchResult(
    row: Record<string, unknown> | undefined,
): CandidatePracticeIntentLaunchResult | null {
    const outcome = row?.launch_outcome;
    const candidatePracticeSessionId = readNullableString(row?.candidate_practice_session_id);

    if (outcome === "created" || outcome === "replayed") {
        return candidatePracticeSessionId
            ? { outcome, candidatePracticeSessionId }
            : null;
    }

    if (
        outcome === "stale_context"
        || outcome === "not_found"
        || outcome === "expired"
        || outcome === "cancelled"
        || outcome === "mismatched"
        || outcome === "consumed_mismatch"
        || outcome === "invalid_session"
    ) {
        return candidatePracticeSessionId === null
            ? { outcome, candidatePracticeSessionId: null }
            : null;
    }

    return null;
}

function readNullableString(value: unknown) {
    if (value === null || value === undefined) {
        return null;
    }
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
