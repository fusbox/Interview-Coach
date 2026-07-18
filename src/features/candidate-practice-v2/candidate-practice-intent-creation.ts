import type {
    CandidateDirectPracticeIntentCreationRecord,
    CreateCandidatePracticeIntentInput,
} from "./candidate-practice-intent-repository";
import {
    createCandidateDirectPracticeIntentRequestFingerprint,
} from "./candidate-direct-practice-intent-request";
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
        requestDisposition?: "created" | "replayed";
    }
    | {
        status: "candidate_practice_intent_not_created";
        reason: "invalid_intent_items" | "idempotency_conflict" | "persistence_failed";
    };

export type CandidatePracticeIntentCreationRepository = {
    createPracticeIntent: (input: CreateCandidatePracticeIntentInput) => Promise<{
        candidatePracticeIntentId: string;
    } | null>;
};

export type CandidateDirectPracticeIntentCreationRepository = {
    createDirectPracticeIntent: (input: CreateCandidatePracticeIntentInput & {
        idempotencyKeyHash: string;
        requestFingerprint: string;
    }) => Promise<CandidateDirectPracticeIntentCreationRecord | null>;
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
    const intentInput = createPracticeIntentInput({ candidateProfileId, source, resolvedItems });

    if (!intentInput) {
        return {
            status: "candidate_practice_intent_not_created",
            reason: "invalid_intent_items",
        };
    }

    const created = await practiceIntentRepository.createPracticeIntent({
        ...intentInput,
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
        itemCount: intentInput.items.length,
    };
}

export async function createCandidateDirectPracticeIntentFromResolvedItems({
    candidateProfileId,
    source,
    resolvedItems,
    idempotencyKeyHash,
    practiceIntentRepository,
}: {
    candidateProfileId: string;
    source: Exclude<CandidatePracticeIntentSource, "practice_builder">;
    resolvedItems: CandidateResolvedFollowUpPracticeIntent[];
    idempotencyKeyHash: string;
    practiceIntentRepository: CandidateDirectPracticeIntentCreationRepository;
}): Promise<CandidatePracticeIntentCreationResult> {
    const intentInput = createPracticeIntentInput({ candidateProfileId, source, resolvedItems });
    if (!intentInput) {
        return {
            status: "candidate_practice_intent_not_created",
            reason: "invalid_intent_items",
        };
    }

    const requestFingerprint = createCandidateDirectPracticeIntentRequestFingerprint(intentInput);
    const created = await practiceIntentRepository.createDirectPracticeIntent({
        ...intentInput,
        idempotencyKeyHash,
        requestFingerprint,
    });
    if (!created) {
        return {
            status: "candidate_practice_intent_not_created",
            reason: "persistence_failed",
        };
    }
    if (created.outcome === "conflict") {
        return {
            status: "candidate_practice_intent_not_created",
            reason: "idempotency_conflict",
        };
    }

    return {
        status: "candidate_practice_intent_created",
        candidatePracticeIntentId: created.candidatePracticeIntentId,
        redirectTo: `/candidate/practice/ready/${created.candidatePracticeIntentId}`,
        itemCount: intentInput.items.length,
        requestDisposition: created.outcome,
    };
}

function createPracticeIntentInput({
    candidateProfileId,
    source,
    resolvedItems,
}: {
    candidateProfileId: string;
    source: CandidatePracticeIntentSource;
    resolvedItems: CandidateResolvedFollowUpPracticeIntent[];
}): CreateCandidatePracticeIntentInput | null {
    const intentRecord = createCandidateFollowUpPracticeIntentRecord({
        candidatePracticeIntentId: "00000000-0000-4000-8000-000000000000",
        candidateProfileId,
        source,
        items: resolvedItems,
        createdAt: new Date().toISOString(),
    });
    return intentRecord ? {
        candidateProfileId,
        source,
        lifecycleState: "ready",
        roleProfileId: intentRecord.roleProfileId,
        targetInterviewId: intentRecord.targetInterviewId,
        targetRole: intentRecord.targetRole,
        setupContext: intentRecord.setupContext,
        items: intentRecord.items,
    } : null;
}
