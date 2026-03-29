import { describe, expect, it } from "vitest";
import type { Invite } from "@/lib/domain/invite";
import { createInviteBatch } from "./create-invite-batch";
import { retryInviteBatch } from "./retry-invite-batch";
import type {
    CreateInviteBatchInput,
    InviteBatchFailure,
    PersistedInviteBatch,
} from "./types";

class InMemoryInviteBatchRepository {
    private batchSequence = 0;
    private invitesByBatch = new Map<string, Invite[]>();
    private batches = new Map<string, PersistedInviteBatch>();
    private failCreateBatch = false;

    create = async () => undefined;
    getByToken = async () => null;

    setFailCreateBatchOnce() {
        this.failCreateBatch = true;
    }

    async createBatch(invites: Invite[]): Promise<void> {
        if (this.failCreateBatch) {
            this.failCreateBatch = false;
            throw new Error("database write failed");
        }

        const batchId = Array.from(this.invitesByBatch.entries()).find(([, storedInvites]) => storedInvites === invites)?.[0];
        if (!batchId) {
            throw new Error("batch tracking missing");
        }
    }

    async createTrackedBatch(input: CreateInviteBatchInput, invites: Invite[]): Promise<string> {
        this.batchSequence += 1;
        const batchId = `batch-${this.batchSequence}`;

        this.invitesByBatch.set(batchId, invites);
        this.batches.set(batchId, {
            batchId,
            parentBatchId: input.parentBatchId,
            createdBy: input.createdBy,
            role: input.role,
            jobDescription: input.jobDescription,
            questions: input.questions,
            status: "pending",
            candidates: invites.map((invite, candidateIndex) => ({
                candidateIndex,
                firstName: invite.candidate.firstName,
                lastName: invite.candidate.lastName,
                email: invite.candidate.email,
                reqId: invite.candidate.reqId,
                resumeText: invite.candidate.resumeText,
                status: "pending",
                retryable: true,
                retryCount: 0,
            })),
        });

        return batchId;
    }

    async markTrackedBatchCompleted(batchId: string, invites: Invite[]): Promise<void> {
        const batch = this.requireBatch(batchId);
        batch.status = "completed";
        batch.candidates = batch.candidates.map((candidate, index) => ({
            ...candidate,
            status: "created",
            retryable: false,
            sessionId: invites[index]?.id,
            errorCode: undefined,
            errorMessage: undefined,
        }));
    }

    async markTrackedBatchFailed(batchId: string, failures: InviteBatchFailure[]): Promise<void> {
        const batch = this.requireBatch(batchId);
        batch.status = "failed";
        batch.candidates = batch.candidates.map((candidate, index) => ({
            ...candidate,
            status: "failed",
            retryable: failures[index]?.retryable ?? true,
            errorCode: failures[index]?.code,
            errorMessage: failures[index]?.message,
        }));
    }

    async getTrackedBatch(batchId: string, actorId: string): Promise<PersistedInviteBatch | null> {
        const batch = this.batches.get(batchId);
        if (!batch || batch.createdBy !== actorId) {
            return null;
        }

        return structuredClone(batch);
    }

    async markTrackedBatchRetried(batchId: string, childBatchId: string): Promise<void> {
        const batch = this.requireBatch(batchId);
        batch.status = "retry_issued";
        batch.candidates = batch.candidates.map((candidate) => (
            candidate.status === "failed" && candidate.retryable
                ? {
                    ...candidate,
                    status: "retry_issued",
                    retryable: false,
                    retryCount: candidate.retryCount + 1,
                }
                : candidate
        ));
        this.batches.set(batchId, {
            ...batch,
            batchId,
            parentBatchId: batch.parentBatchId,
        });

        const childBatch = this.requireBatch(childBatchId);
        childBatch.parentBatchId = batchId;
    }

    snapshotBatch(batchId: string) {
        return this.batches.get(batchId);
    }

    private requireBatch(batchId: string) {
        const batch = this.batches.get(batchId);
        if (!batch) {
            throw new Error(`Missing tracked batch ${batchId}`);
        }

        return batch;
    }
}

describe("invite batch lifecycle integration", () => {
    it("tracks create failure state and safe retry lineage across parent and child batches", async () => {
        const repository = new InMemoryInviteBatchRepository();
        repository.setFailCreateBatchOnce();

        const input: CreateInviteBatchInput = {
            role: "QA Engineer",
            jobDescription: "Own API quality",
            createdBy: "recruiter-1",
            appBaseUrl: "https://app.example.com",
            candidates: [
                {
                    firstName: "Cand",
                    lastName: "Date",
                    email: "candidate@example.com",
                    reqId: "REQ-1",
                },
                {
                    firstName: "Pat",
                    lastName: "Chy",
                    email: "patchy@example.com",
                    reqId: "REQ-2",
                },
            ],
            questions: [
                {
                    text: "Tell me about a bug you found.",
                    category: "STAR",
                    index: 0,
                },
            ],
        };

        const failedCreate = await createInviteBatch(input, {
            repository,
            createSessionId: (() => {
                const ids = ["session-1", "session-2"];
                let index = 0;
                return () => ids[index++]!;
            })(),
            createToken: (() => {
                const tokens = ["token-1", "token-2"];
                let index = 0;
                return () => tokens[index++]!;
            })(),
        });

        expect(failedCreate.batchId).toBe("batch-1");
        expect(failedCreate.summary).toEqual({
            requested: 2,
            succeeded: 0,
            failed: 2,
            hasFailures: true,
        });
        expect(failedCreate.failures.map((failure) => failure.email)).toEqual([
            "candidate@example.com",
            "patchy@example.com",
        ]);

        const failedBatch = repository.snapshotBatch("batch-1");
        expect(failedBatch).toEqual(expect.objectContaining({
            batchId: "batch-1",
            status: "failed",
        }));
        expect(failedBatch?.candidates).toEqual([
            expect.objectContaining({
                email: "candidate@example.com",
                status: "failed",
                retryable: true,
                retryCount: 0,
                errorMessage: "database write failed",
            }),
            expect.objectContaining({
                email: "patchy@example.com",
                status: "failed",
                retryable: true,
                retryCount: 0,
                errorMessage: "database write failed",
            }),
        ]);

        const retried = await retryInviteBatch("batch-1", "recruiter-1", "https://app.example.com", {
            repository,
            createSessionId: (() => {
                const ids = ["session-retry-1", "session-retry-2"];
                let index = 0;
                return () => ids[index++]!;
            })(),
            createToken: (() => {
                const tokens = ["retry-token-1", "retry-token-2"];
                let index = 0;
                return () => tokens[index++]!;
            })(),
        });

        expect(retried).toEqual({
            batchId: "batch-2",
            retriedFromBatchId: "batch-1",
            results: [
                {
                    status: "created",
                    id: "session-retry-1",
                    firstName: "Cand",
                    lastName: "Date",
                    email: "candidate@example.com",
                    link: "https://app.example.com/s/retry-token-1",
                },
                {
                    status: "created",
                    id: "session-retry-2",
                    firstName: "Pat",
                    lastName: "Chy",
                    email: "patchy@example.com",
                    link: "https://app.example.com/s/retry-token-2",
                },
            ],
            failures: [],
            summary: {
                requested: 2,
                succeeded: 2,
                failed: 0,
                hasFailures: false,
            },
        });

        const retriedParent = repository.snapshotBatch("batch-1");
        expect(retriedParent).toEqual(expect.objectContaining({
            batchId: "batch-1",
            status: "retry_issued",
        }));
        expect(retriedParent?.candidates).toEqual([
            expect.objectContaining({
                email: "candidate@example.com",
                status: "retry_issued",
                retryable: false,
                retryCount: 1,
            }),
            expect.objectContaining({
                email: "patchy@example.com",
                status: "retry_issued",
                retryable: false,
                retryCount: 1,
            }),
        ]);

        const childBatch = repository.snapshotBatch("batch-2");
        expect(childBatch).toEqual(expect.objectContaining({
            batchId: "batch-2",
            parentBatchId: "batch-1",
            status: "completed",
        }));
        expect(childBatch?.candidates).toEqual([
            expect.objectContaining({
                email: "candidate@example.com",
                status: "created",
                retryable: false,
                sessionId: "session-retry-1",
            }),
            expect.objectContaining({
                email: "patchy@example.com",
                status: "created",
                retryable: false,
                sessionId: "session-retry-2",
            }),
        ]);
    });
});
