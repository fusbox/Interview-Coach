import type {
    CreateCandidatePracticeIntentInput,
} from "./candidate-practice-intent-repository";
import {
    createCandidateFollowUpPracticeIntentRecord,
    type CandidatePracticeIntentSource,
    type CandidateResolvedFollowUpPracticeIntent,
} from "./candidate-follow-up-practice-intent";

export type CandidatePracticeIntentCreationResult =
    | {
        status: "candidate_practice_intent_created";
        candidatePracticeIntentId: string;
        redirectTo: string;
        itemCount: number;
    }
    | {
        status: "candidate_practice_intent_not_created";
        reason: "invalid_intent_items" | "persistence_failed";
    };

export type CandidatePracticeIntentCreationRepository = {
    createPracticeIntent: (input: CreateCandidatePracticeIntentInput) => Promise<{
        candidatePracticeIntentId: string;
    } | null>;
};

export async function createCandidatePracticeIntentFromResolvedItems({
    candidateProfileId,
    source,
    resolvedItems,
    practiceIntentRepository,
}: {
    candidateProfileId: string;
    source: CandidatePracticeIntentSource;
    resolvedItems: CandidateResolvedFollowUpPracticeIntent[];
    practiceIntentRepository: CandidatePracticeIntentCreationRepository;
}): Promise<CandidatePracticeIntentCreationResult> {
    const now = new Date().toISOString();
    const intentRecord = createCandidateFollowUpPracticeIntentRecord({
        candidatePracticeIntentId: "00000000-0000-4000-8000-000000000000",
        candidateProfileId,
        source,
        items: resolvedItems,
        createdAt: now,
    });

    if (!intentRecord) {
        return {
            status: "candidate_practice_intent_not_created",
            reason: "invalid_intent_items",
        };
    }

    const created = await practiceIntentRepository.createPracticeIntent({
        candidateProfileId,
        source,
        lifecycleState: "ready",
        roleProfileId: intentRecord.roleProfileId,
        targetInterviewId: intentRecord.targetInterviewId,
        targetRole: intentRecord.targetRole,
        setupContext: intentRecord.setupContext,
        items: intentRecord.items,
    });

    if (!created?.candidatePracticeIntentId) {
        return {
            status: "candidate_practice_intent_not_created",
            reason: "persistence_failed",
        };
    }

    return {
        status: "candidate_practice_intent_created",
        candidatePracticeIntentId: created.candidatePracticeIntentId,
        redirectTo: `/candidate/practice/ready/${created.candidatePracticeIntentId}`,
        itemCount: intentRecord.itemCount,
    };
}
