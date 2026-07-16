import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CandidateNextRoundBuilderModel } from "./candidate-next-round-builder";
import {
    loadCandidateNextRoundBuilder,
    mutateCandidateNextRoundBuilder,
} from "./candidate-next-round-builder-service";

const mocks = vi.hoisted(() => ({
    createCoachPlan: vi.fn(() => ({ status: "candidate_coach_plan_reference_ready" })),
    createBuilderModel: vi.fn(),
}));

vi.mock("@/features/candidate-dashboard-v2/candidate-coach-plan-reference", () => ({
    createCandidateCoachPlanReference: mocks.createCoachPlan,
}));

vi.mock("./candidate-next-round-builder", () => ({
    createCandidateNextRoundBuilderModel: mocks.createBuilderModel,
}));

describe("candidate next-round builder service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("loads one candidate-owned draft and complete selected-context session history", async () => {
        const builder = createBuilder();
        mocks.createBuilderModel.mockReturnValue(builder);
        const draftRepository = createDraftRepository();
        const practiceSessionRepository = createSessionRepository();

        await expect(loadCandidateNextRoundBuilder({
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
            draftRepository,
            practiceSessionRepository,
        })).resolves.toBe(builder);

        expect(draftRepository.findOrCreateDraft).toHaveBeenCalledWith({
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
        });
        expect(practiceSessionRepository.listPracticeSessionsForCandidateRoleProfile).toHaveBeenCalledWith({
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
        });
    });

    it("derives add semantics from the authoritative server choice and reloads after mutation", async () => {
        const current = createBuilder();
        const updated = createBuilder({ version: 4, itemCount: 2 });
        mocks.createBuilderModel.mockReturnValueOnce(current).mockReturnValueOnce(updated);
        const draftRepository = createDraftRepository();
        const practiceSessionRepository = createSessionRepository();

        await expect(mutateCandidateNextRoundBuilder({
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
            candidateNextRoundDraftId: "draft-1",
            expectedVersion: 3,
            mutation: {
                kind: "add",
                sourceCandidatePracticeSessionId: "session-2",
                sourceQuestionKey: "slot-2",
            },
            draftRepository,
            practiceSessionRepository,
        })).resolves.toEqual({
            status: "candidate_next_round_builder_mutation",
            outcome: "updated",
            builder: updated,
        });

        expect(draftRepository.addItem).toHaveBeenCalledWith({
            candidateNextRoundDraftId: "draft-1",
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
            expectedVersion: 3,
            sourceCandidatePracticeSessionId: "session-2",
            sourceQuestionKey: "slot-2",
            practiceKind: "practice_missing_evidence",
            provenance: "coach_plan",
        });
    });

    it("returns the latest draft on a stale version without applying the requested change", async () => {
        const latest = createBuilder({ version: 7 });
        mocks.createBuilderModel.mockReturnValue(latest);
        const draftRepository = createDraftRepository();

        await expect(mutateCandidateNextRoundBuilder({
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
            candidateNextRoundDraftId: "draft-1",
            expectedVersion: 3,
            mutation: { kind: "clear" },
            draftRepository,
            practiceSessionRepository: createSessionRepository(),
        })).resolves.toEqual({
            status: "candidate_next_round_builder_mutation",
            outcome: "version_conflict",
            builder: latest,
        });

        expect(draftRepository.clearDraft).not.toHaveBeenCalled();
    });
});

function createBuilder(overrides: Partial<CandidateNextRoundBuilderModel> = {}): CandidateNextRoundBuilderModel {
    return {
        status: "candidate_next_round_builder_ready",
        candidateProfileId: "candidate-1",
        roleProfileId: "role-1",
        targetRole: "Quality Inspector",
        candidateNextRoundDraftId: "draft-1",
        version: 3,
        itemCount: 1,
        capacity: 20,
        items: [],
        choices: [{
            sourceCandidatePracticeSessionId: "session-2",
            sourceQuestionKey: "slot-2",
            rootCandidatePracticeSessionId: "session-1",
            rootQuestionKey: "slot-2",
            practiceKind: "practice_missing_evidence",
            provenance: "coach_plan",
            questionNumber: 2,
            category: "Behavioral",
            questionText: "Tell me about finding a defect.",
            evidenceLabel: "Plan coverage",
            isQueued: false,
        }],
        ...overrides,
    };
}

function createDraftRepository() {
    return {
        findOrCreateDraft: vi.fn(async () => ({ status: "candidate_next_round_draft" } as never)),
        addItem: vi.fn(async () => ({ outcome: "updated" as const, version: 4 })),
        removeItem: vi.fn(async () => ({ outcome: "updated" as const, version: 4 })),
        clearDraft: vi.fn(async () => ({ outcome: "updated" as const, version: 4 })),
        reorderItems: vi.fn(async () => ({ outcome: "updated" as const, version: 4 })),
    };
}

function createSessionRepository() {
    return {
        listPracticeSessionsForCandidateRoleProfile: vi.fn(async () => []),
    };
}
