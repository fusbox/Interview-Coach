import { createCandidateCoachPlanReference } from "@/features/candidate-dashboard-v2/candidate-coach-plan-reference";
import type { createCandidatePracticeSessionRepository } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import {
    createCandidateBaselineAwarePracticeSessions,
    type createCandidatePracticePlanBaselineRepository,
} from "@/features/candidate-setup-v2/candidate-practice-plan-baseline-repository";

import type { createCandidateNextRoundDraftRepository } from "./candidate-next-round-draft-repository";
import {
    createCandidateNextRoundBuilderModel,
    type CandidateNextRoundBuilderModel,
} from "./candidate-next-round-builder";

type CandidateNextRoundDraftRepository = Pick<
    ReturnType<typeof createCandidateNextRoundDraftRepository>,
    "findOrCreateDraft" | "addItem" | "removeItem" | "clearDraft" | "reorderItems"
>;

type CandidateNextRoundSessionRepository = Pick<
    ReturnType<typeof createCandidatePracticeSessionRepository>,
    "listPracticeSessionsForCandidateRoleProfile"
>;
type CandidateNextRoundBaselineRepository = Pick<
    ReturnType<typeof createCandidatePracticePlanBaselineRepository>,
    "findForCandidateRoleProfile"
>;

export type CandidateNextRoundBuilderMutation =
    | {
        kind: "add";
        sourceCandidatePracticeSessionId: string;
        sourceQuestionKey: string;
      }
    | {
        kind: "remove";
        candidateNextRoundDraftItemId: string;
      }
    | {
        kind: "reorder";
        orderedItemIds: string[];
      }
    | {
        kind: "clear";
      };

export type CandidateNextRoundBuilderMutationResult = {
    status: "candidate_next_round_builder_mutation";
    outcome:
        | "updated"
        | "unchanged"
        | "version_conflict"
        | "capacity_exceeded"
        | "invalid_source"
        | "invalid_order"
        | "item_conflict"
        | "not_found";
    builder: CandidateNextRoundBuilderModel | null;
};

export async function loadCandidateNextRoundBuilder({
    candidateProfileId,
    roleProfileId,
    draftRepository,
    practiceSessionRepository,
    practicePlanBaselineRepository,
}: {
    candidateProfileId: string;
    roleProfileId: string;
    draftRepository: CandidateNextRoundDraftRepository;
    practiceSessionRepository: CandidateNextRoundSessionRepository;
    practicePlanBaselineRepository?: CandidateNextRoundBaselineRepository;
}) {
    const [draft, practiceSessions, practicePlanBaseline] = await Promise.all([
        draftRepository.findOrCreateDraft({ candidateProfileId, roleProfileId }),
        practiceSessionRepository.listPracticeSessionsForCandidateRoleProfile({
            candidateProfileId,
            roleProfileId,
        }),
        practicePlanBaselineRepository
            ? practicePlanBaselineRepository.findForCandidateRoleProfile({ candidateProfileId, roleProfileId })
            : Promise.resolve(null),
    ]);
    const baselineAwareSessions = createCandidateBaselineAwarePracticeSessions({
        practiceSessions,
        baseline: practicePlanBaseline,
    });
    const coachPlan = createCandidateCoachPlanReference({
        candidateProfileId,
        roleProfileId,
        practiceSessions: baselineAwareSessions,
        practicePlanBaseline,
    });

    return createCandidateNextRoundBuilderModel({
        candidateProfileId,
        roleProfileId,
        coachPlan,
        practiceSessions: baselineAwareSessions,
        draft,
    });
}

export async function mutateCandidateNextRoundBuilder({
    candidateProfileId,
    roleProfileId,
    candidateNextRoundDraftId,
    expectedVersion,
    mutation,
    draftRepository,
    practiceSessionRepository,
    practicePlanBaselineRepository,
}: {
    candidateProfileId: string;
    roleProfileId: string;
    candidateNextRoundDraftId: string;
    expectedVersion: number;
    mutation: CandidateNextRoundBuilderMutation;
    draftRepository: CandidateNextRoundDraftRepository;
    practiceSessionRepository: CandidateNextRoundSessionRepository;
    practicePlanBaselineRepository?: CandidateNextRoundBaselineRepository;
}): Promise<CandidateNextRoundBuilderMutationResult> {
    const current = await loadCandidateNextRoundBuilder({
        candidateProfileId,
        roleProfileId,
        draftRepository,
        practiceSessionRepository,
        practicePlanBaselineRepository,
    });
    if (!current || current.candidateNextRoundDraftId !== candidateNextRoundDraftId) {
        return result("not_found", current);
    }
    if (current.version !== expectedVersion) {
        return result("version_conflict", current);
    }

    const mutationResult = mutation.kind === "add"
        ? await addBuilderItem({
            candidateProfileId,
            roleProfileId,
            expectedVersion,
            mutation,
            current,
            draftRepository,
        })
        : mutation.kind === "remove"
            ? await draftRepository.removeItem({
                candidateNextRoundDraftId,
                candidateProfileId,
                roleProfileId,
                expectedVersion,
                candidateNextRoundDraftItemId: mutation.candidateNextRoundDraftItemId,
            })
            : mutation.kind === "reorder"
                ? await draftRepository.reorderItems({
                    candidateNextRoundDraftId,
                    candidateProfileId,
                    roleProfileId,
                    expectedVersion,
                    orderedItemIds: mutation.orderedItemIds,
                    expectedItemCount: current.itemCount,
                })
                : await draftRepository.clearDraft({
                    candidateNextRoundDraftId,
                    candidateProfileId,
                    roleProfileId,
                    expectedVersion,
                });

    const authoritative = await loadCandidateNextRoundBuilder({
        candidateProfileId,
        roleProfileId,
        draftRepository,
        practiceSessionRepository,
        practicePlanBaselineRepository,
    });
    return result(mutationResult.outcome, authoritative);
}

async function addBuilderItem({
    candidateProfileId,
    roleProfileId,
    expectedVersion,
    mutation,
    current,
    draftRepository,
}: {
    candidateProfileId: string;
    roleProfileId: string;
    expectedVersion: number;
    mutation: Extract<CandidateNextRoundBuilderMutation, { kind: "add" }>;
    current: CandidateNextRoundBuilderModel;
    draftRepository: CandidateNextRoundDraftRepository;
}) {
    const choice = current.choices.find((item) => (
        item.sourceCandidatePracticeSessionId === mutation.sourceCandidatePracticeSessionId
        && item.sourceQuestionKey === mutation.sourceQuestionKey
        && !item.isQueued
    ));
    if (!choice) {
        return { outcome: "invalid_source" as const };
    }

    return draftRepository.addItem({
        candidateNextRoundDraftId: current.candidateNextRoundDraftId,
        candidateProfileId,
        roleProfileId,
        expectedVersion,
        sourceCandidatePracticeSessionId: choice.sourceCandidatePracticeSessionId,
        sourceQuestionKey: choice.sourceQuestionKey,
        practiceKind: choice.practiceKind,
        provenance: choice.provenance,
    });
}

function result(
    outcome: CandidateNextRoundBuilderMutationResult["outcome"],
    builder: CandidateNextRoundBuilderModel | null,
): CandidateNextRoundBuilderMutationResult {
    return {
        status: "candidate_next_round_builder_mutation",
        outcome,
        builder,
    };
}
