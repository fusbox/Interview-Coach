import { describe, expect, it, vi } from "vitest";

import { createCandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";
import { createFixtureCandidateQuestionWordingRuntime } from "@/features/candidate-session-v2/candidate-question-wording-runtime";
import { hashInvitedPracticeToken, type InvitedPracticeTokenVault } from "./invited-practice-token-vault";
import { createRecruiterInvitationQuestionSetRepository } from "./recruiter-invitation-question-set-repository";
import { createRecruiterInvitationRepository } from "./recruiter-invitation-repository";
import {
    createRecruiterInvitationsFromQuestionSet,
    prepareRecruiterInvitationQuestions,
    RecruiterQuestionSetInProgressError,
    RecruiterQuestionSetUnavailableError,
} from "./recruiter-invitation-create-service";

describe("recruiter invitation create service", () => {
    it("calls V2 wording once and retries only durable completion", async () => {
        const repository = createQuestionSetRepository();
        const preparing = questionSet("preparing");
        const ready = questionSet("ready");
        repository.claim = vi.fn().mockResolvedValue({ outcome: "claimed", questionSet: preparing });
        repository.complete = vi.fn()
            .mockRejectedValueOnce(new Error("transient database failure"))
            .mockResolvedValueOnce(ready);
        const runtime = createFixtureCandidateQuestionWordingRuntime();
        const wordQuestions = vi.spyOn(runtime, "wordQuestions");

        const result = await prepareRecruiterInvitationQuestions(RECRUITER_ID, prepareRequest("generated"), {
            repository,
            wordingRuntime: runtime,
            now: NOW,
            createId: () => QUESTION_SET_ID,
        });

        expect(result.outcome).toBe("created");
        expect(wordQuestions).toHaveBeenCalledTimes(1);
        expect(repository.complete).toHaveBeenCalledTimes(2);
    });

    it("replays a ready question set without another provider call", async () => {
        const repository = createQuestionSetRepository();
        repository.claim = vi.fn().mockResolvedValue({ outcome: "replayed", questionSet: questionSet("ready") });
        const complete = vi.spyOn(repository, "complete");
        const runtime = createFixtureCandidateQuestionWordingRuntime();
        const wordQuestions = vi.spyOn(runtime, "wordQuestions");

        const result = await prepareRecruiterInvitationQuestions(RECRUITER_ID, prepareRequest("generated"), {
            repository,
            wordingRuntime: runtime,
            now: NOW,
        });

        expect(result.outcome).toBe("replayed");
        expect(wordQuestions).not.toHaveBeenCalled();
        expect(complete).not.toHaveBeenCalled();
    });

    it("does not let a concurrent request enter the provider", async () => {
        const repository = createQuestionSetRepository();
        repository.claim = vi.fn().mockResolvedValue({ outcome: "in_progress", questionSet: questionSet("preparing") });
        const runtime = createFixtureCandidateQuestionWordingRuntime();
        const wordQuestions = vi.spyOn(runtime, "wordQuestions");

        await expect(prepareRecruiterInvitationQuestions(RECRUITER_ID, prepareRequest("generated"), {
            repository,
            wordingRuntime: runtime,
        })).rejects.toBeInstanceOf(RecruiterQuestionSetInProgressError);
        expect(wordQuestions).not.toHaveBeenCalled();
    });

    it("accepts a complete manual set without a provider runtime", async () => {
        const repository = createQuestionSetRepository();
        repository.claim = vi.fn().mockResolvedValue({ outcome: "claimed", questionSet: questionSet("preparing", "manual") });
        repository.complete = vi.fn().mockImplementation(async (input) => ({
            ...questionSet("ready", "manual"),
            questionWordingSnapshot: input.questionWordingSnapshot,
        }));

        const result = await prepareRecruiterInvitationQuestions(RECRUITER_ID, prepareRequest("manual"), {
            repository,
            wordingRuntime: null,
            now: NOW,
        });

        expect(result.questionSet.questionWordingSnapshot.questions).toHaveLength(5);
        expect(repository.complete).toHaveBeenCalledTimes(1);
    });

    it("creates from only an owned ready set and recovers the persisted handoff winner", async () => {
        const questionSetRepository = createQuestionSetRepository();
        questionSetRepository.findOwnedReady = vi.fn().mockResolvedValue(questionSet("ready"));
        const invitationRepository = createRecruiterInvitationRepository({ query: vi.fn() });
        invitationRepository.createOrReplayFromQuestionSet = vi.fn().mockResolvedValue({ outcome: "replayed", batchId: "batch-winner" });
        invitationRepository.findOwnedAggregate = vi.fn().mockResolvedValue({
            batchId: "batch-winner",
            recruiterId: RECRUITER_ID,
            targetRole: "Quality Inspector",
            jobDescription: "Inspect finished goods.",
            interviewStage: "screening",
            questionPlanSnapshot: plan(),
            questionWordingSnapshot: wording(),
            recipients: [{
                recipientId: "recipient-winner",
                candidateIndex: 0,
                firstName: "Irma",
                lastName: "Castillo",
                email: "irma@example.com",
                requisitionReference: null,
                sessionId: "session-winner",
                sessionStatus: "planned",
                attemptNumber: 1,
                tokenHash: hashInvitedPracticeToken("winner-token"),
                tokenCiphertext: "winner-ciphertext",
                encryptionKeyId: "key-1",
                tokenExpiresAt: "2026-08-02T00:00:00.000Z",
            }],
        });

        const result = await createRecruiterInvitationsFromQuestionSet(RECRUITER_ID, createRequest(), {
            questionSetRepository,
            invitationRepository,
            tokenVault: tokenVault(),
            tokenTtlSeconds: 14 * 24 * 60 * 60,
            now: NOW,
        });

        expect(result).toMatchObject({ outcome: "replayed", recipients: [{ rawToken: "winner-token" }] });
        expect(questionSetRepository.findOwnedReady).toHaveBeenCalledWith(expect.objectContaining({ recruiterId: RECRUITER_ID }));
        expect(invitationRepository.createOrReplayFromQuestionSet).toHaveBeenCalledWith(expect.objectContaining({
            sourceQuestionSetId: QUESTION_SET_ID,
        }));
    });

    it("fails closed before aggregate creation when the question set is not owned and ready", async () => {
        const questionSetRepository = createQuestionSetRepository();
        questionSetRepository.findOwnedReady = vi.fn().mockResolvedValue(null);
        const invitationRepository = createRecruiterInvitationRepository({ query: vi.fn() });
        invitationRepository.createOrReplay = vi.fn();
        invitationRepository.createOrReplayFromQuestionSet = vi.fn();

        await expect(createRecruiterInvitationsFromQuestionSet(RECRUITER_ID, createRequest(), {
            questionSetRepository,
            invitationRepository,
            tokenVault: tokenVault(),
            tokenTtlSeconds: 14 * 24 * 60 * 60,
        })).rejects.toBeInstanceOf(RecruiterQuestionSetUnavailableError);
        expect(invitationRepository.createOrReplay).not.toHaveBeenCalled();
        expect(invitationRepository.createOrReplayFromQuestionSet).not.toHaveBeenCalled();
    });
});

const RECRUITER_ID = "20000000-0000-4000-8000-000000000001";
const QUESTION_SET_ID = "30000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-07-19T18:00:00.000Z");

function prepareRequest(source: "generated" | "manual") {
    return {
        operation: "prepare_questions" as const,
        actionKey: "browser-action-key-0001",
        source,
        targetRole: "Quality Inspector",
        jobDescription: "Inspect finished goods.",
        interviewStage: "screening" as const,
        questions: source === "manual"
            ? ["Question one?", "Question two?", "Question three?", "Question four?", "Question five?"]
            : null,
    };
}

function createRequest() {
    return {
        operation: "create_invitations" as const,
        actionKey: "browser-action-key-0001",
        questionSetId: QUESTION_SET_ID,
        recipients: [{ firstName: "Irma", lastName: "Castillo", email: "irma@example.com" }],
    };
}

function createQuestionSetRepository() {
    return createRecruiterInvitationQuestionSetRepository({ query: vi.fn() });
}

function questionSet(state: "preparing" | "ready", source: "generated" | "manual" = "generated") {
    return {
        questionSetId: QUESTION_SET_ID,
        recruiterId: RECRUITER_ID,
        actionKeyHash: "a".repeat(64),
        requestFingerprint: "b".repeat(64),
        source,
        lifecycleState: state,
        targetRole: "Quality Inspector",
        jobDescription: "Inspect finished goods.",
        interviewStage: "screening" as const,
        questionPlanSnapshot: plan(),
        questionWordingSnapshot: state === "ready" ? wording() : null,
        expiresAt: "2026-07-20T18:00:00.000Z",
    };
}

function plan() {
    return createCandidateQuestionPlan({ interviewStage: "screening", questionCount: 5 });
}

function wording() {
    return {
        status: "questions_worded" as const,
        questions: plan().slots.map((slot) => ({
            slotId: slot.id,
            index: slot.index,
            category: slot.category,
            questionText: `Question ${slot.index + 1}?`,
        })),
    };
}

function tokenVault() {
    return {
        createTokenMaterial: vi.fn(() => ({
            rawToken: "loser-token",
            tokenHash: "c".repeat(64),
            tokenCiphertext: "loser-ciphertext",
            encryptionKeyId: "key-1",
        })),
        decryptToken: vi.fn(() => "winner-token"),
    } satisfies InvitedPracticeTokenVault;
}
