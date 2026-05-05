import { randomUUID } from "crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Invite } from "@/lib/domain/invite";
import type { CreateInviteBatchInput, InviteBatchFailure } from "@/lib/server/application/invites/types";
import { hashToken } from "@/lib/server/crypto";
import { PostgresInviteRepository } from "./postgres-invite-repository";

const databaseUrl = process.env.POSTGRES_INVITE_REPOSITORY_TEST_DATABASE_URL;
const runIntegration = databaseUrl ? describe : describe.skip;

runIntegration("PostgresInviteRepository integration", () => {
    let pool: Pool;
    let repository: PostgresInviteRepository;
    let userId: string;

    beforeAll(async () => {
        if (!databaseUrl) {
            return;
        }

        process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || "test-encryption-secret-minimum-32-chars";
        pool = new Pool({ connectionString: databaseUrl });
        repository = new PostgresInviteRepository(pool);
        userId = randomUUID();

        await pool.query(
            `
                insert into public.app_users (
                    user_id,
                    email,
                    display_name,
                    email_verified_at
                )
                values ($1, $2, 'Repository Test', now())
            `,
            [userId, `repo-${userId}@example.invalid`]
        );
    });

    afterAll(async () => {
        if (!pool) {
            return;
        }

        await pool.query(
            `
                delete from public.invite_batches
                where created_by in (
                    select user_id
                    from public.app_users
                    where email like 'repo-%@example.invalid'
                )
            `
        );
        await pool.query(
            `
                delete from public.sessions
                where recruiter_id in (
                    select user_id
                    from public.app_users
                    where email like 'repo-%@example.invalid'
                )
            `
        );
        await pool.query("delete from public.app_users where email like 'repo-%@example.invalid'");
        await pool.end();
    });

    function buildInvite(overrides: Partial<Invite> = {}): Invite {
        const id = overrides.id ?? randomUUID();
        return {
            id,
            token: overrides.token ?? `token-${id}`,
            role: "Security Engineer",
            jobDescription: "Own secure application delivery.",
            candidate: {
                firstName: "Schema",
                lastName: "Tester",
                email: `candidate-${id}@example.invalid`,
                reqId: `REQ-${id.slice(0, 8)}`,
                resumeText: "Security engineer with application security experience."
            },
            questions: [
                {
                    index: 0,
                    text: "Tell me about a security review you led.",
                    category: "Behavioral"
                },
                {
                    index: 1,
                    text: "How do you prioritize vulnerabilities?",
                    category: "Technical"
                }
            ],
            createdBy: userId,
            createdAt: Date.now(),
            ...overrides
        };
    }

    function buildInput(invites: Invite[], parentBatchId?: string): CreateInviteBatchInput {
        return {
            role: "Security Engineer",
            jobDescription: "Own secure application delivery.",
            candidates: invites.map((invite) => invite.candidate),
            questions: invites[0]?.questions ?? [],
            createdBy: userId,
            appBaseUrl: "https://app.example.invalid",
            parentBatchId
        };
    }

    it("creates tracked invite rows, creates sessions, completes tracking, and resolves token lookup", async () => {
        const invites = [buildInvite(), buildInvite()];
        const input = buildInput(invites);

        const batchId = await repository.createTrackedBatch(input, invites);
        await repository.createBatch(invites);
        await repository.markTrackedBatchCompleted(batchId, invites);

        const batch = await repository.getTrackedBatch(batchId, userId);
        expect(batch).toMatchObject({
            batchId,
            createdBy: userId,
            status: "completed",
            candidates: [
                expect.objectContaining({
                    status: "created",
                    retryable: false,
                    sessionId: invites[0].id
                }),
                expect.objectContaining({
                    status: "created",
                    retryable: false,
                    sessionId: invites[1].id
                })
            ]
        });

        const inviteByToken = await repository.getByToken(invites[0].token);
        expect(inviteByToken).toMatchObject({
            id: invites[0].id,
            token: invites[0].token,
            role: "Security Engineer",
            createdBy: userId,
            candidate: expect.objectContaining({
                firstName: "Schema",
                lastName: "Tester"
            }),
            questions: invites[0].questions
        });

        const tokenRow = await pool.query(
            "select token_hash from public.candidate_tokens where session_id = $1",
            [invites[0].id]
        );
        expect(tokenRow.rows[0]?.token_hash).toBe(hashToken(invites[0].token));
    });

    it("tracks failures and marks retryable candidates as retried", async () => {
        const invites = [buildInvite(), buildInvite()];
        const input = buildInput(invites);
        const batchId = await repository.createTrackedBatch(input, invites);
        const failures: InviteBatchFailure[] = invites.map((invite) => ({
            status: "failed",
            firstName: invite.candidate.firstName,
            lastName: invite.candidate.lastName,
            email: invite.candidate.email,
            code: "INVITE_CREATE_FAILED",
            message: "database write failed",
            retryable: true
        }));

        await repository.markTrackedBatchFailed(batchId, failures);

        const childInvites = [buildInvite(), buildInvite()];
        const childBatchId = await repository.createTrackedBatch(buildInput(childInvites, batchId), childInvites);
        await repository.markTrackedBatchRetried(batchId, childBatchId);

        const batch = await repository.getTrackedBatch(batchId, userId);
        expect(batch?.status).toBe("retry_issued");
        expect(batch?.candidates).toEqual([
            expect.objectContaining({
                status: "retry_issued",
                retryable: false,
                retryCount: 1
            }),
            expect.objectContaining({
                status: "retry_issued",
                retryable: false,
                retryCount: 1
            })
        ]);
    });
});
