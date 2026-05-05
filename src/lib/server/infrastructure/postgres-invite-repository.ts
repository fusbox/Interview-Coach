import { randomUUID } from "crypto";
import type { Pool, PoolClient, QueryResultRow } from "pg";
import { Invite, InviteRepository } from "@/lib/domain/invite";
import { Logger } from "@/lib/logger";
import { hashToken } from "@/lib/server/crypto";
import { encrypt } from "@/lib/server/encryption";
import { getPostgresPool } from "@/lib/server/db/postgres";
import type {
    CreateInviteBatchInput,
    InviteBatchFailure,
    PersistedInviteBatch,
    PersistedInviteBatchCandidate,
    PersistedInviteBatchCandidateStatus,
    PersistedInviteBatchStatus,
} from "@/lib/server/application/invites/types";

type Queryable = Pick<PoolClient, "query">;

type InviteBatchRow = QueryResultRow & {
    batch_id: string;
    parent_batch_id: string | null;
    created_by: string;
    role: string;
    job_description: string | null;
    questions_json: unknown;
    status: PersistedInviteBatchStatus;
};

type InviteBatchCandidateRow = QueryResultRow & {
    batch_candidate_id?: string;
    candidate_index: number;
    first_name: string;
    last_name: string;
    email: string;
    req_id: string;
    resume_text: string | null;
    status: PersistedInviteBatchCandidateStatus;
    retryable: boolean;
    retry_count: number;
    session_id: string | null;
    error_code: InviteBatchFailure["code"] | null;
    error_message: string | null;
};

type TokenLookupRow = QueryResultRow & {
    session_id: string;
};

type SessionLookupRow = QueryResultRow & {
    session_id: string;
    target_role: string | null;
    job_description: string | null;
    recruiter_id: string | null;
    created_at: Date | string;
    intake_json: {
        candidate?: {
            firstName?: string;
            lastName?: string;
            name?: string;
            email?: string;
            reqId?: string;
            resumeText?: string;
        };
    } | null;
};

type QuestionLookupRow = QueryResultRow & {
    question_text: string;
    question_index: number;
    category: string | null;
    competencies: { category?: string } | null;
};

function toCreateInviteBatchPayload(invites: Invite[]) {
    return invites.map((invite) => ({
        session_id: invite.id,
        created_by: invite.createdBy,
        role: invite.role,
        job_description: invite.jobDescription ?? null,
        candidate: invite.candidate,
        questions: invite.questions,
        token_hash: hashToken(invite.token),
        encrypted_token: encrypt(invite.token)
    }));
}

function mapCandidateRow(candidate: InviteBatchCandidateRow): PersistedInviteBatchCandidate {
    return {
        candidateIndex: candidate.candidate_index,
        firstName: candidate.first_name,
        lastName: candidate.last_name,
        email: candidate.email,
        reqId: candidate.req_id,
        resumeText: candidate.resume_text ?? undefined,
        status: candidate.status,
        retryable: candidate.retryable,
        retryCount: candidate.retry_count,
        sessionId: candidate.session_id ?? undefined,
        errorCode: candidate.error_code ?? undefined,
        errorMessage: candidate.error_message ?? undefined
    };
}

async function insertInvite(client: Queryable, invite: Invite): Promise<void> {
    await client.query(
        `
            insert into public.sessions (
                session_id,
                recruiter_id,
                target_role,
                job_description,
                status,
                intake_json
            )
            values ($1, $2, $3, $4, 'NOT_STARTED', $5::jsonb)
        `,
        [
            invite.id,
            invite.createdBy,
            invite.role,
            invite.jobDescription ?? null,
            JSON.stringify({
                candidate: invite.candidate,
                invite_token: encrypt(invite.token)
            })
        ]
    );

    if (invite.questions.length > 0) {
        for (const question of invite.questions) {
            await client.query(
                `
                    insert into public.questions (
                        session_id,
                        question_index,
                        question_text,
                        category
                    )
                    values ($1, $2, $3, $4)
                `,
                [invite.id, question.index, question.text, question.category]
            );
        }
    }

    await client.query(
        `
            insert into public.candidate_tokens (
                token_hash,
                session_id
            )
            values ($1, $2)
        `,
        [hashToken(invite.token), invite.id]
    );
}

export class PostgresInviteRepository implements InviteRepository {
    constructor(private readonly pool: Pool = getPostgresPool()) {}

    private async withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
        const client = await this.pool.connect();
        try {
            await client.query("begin");
            const result = await operation(client);
            await client.query("commit");
            return result;
        } catch (error) {
            await client.query("rollback");
            throw error;
        } finally {
            client.release();
        }
    }

    async create(invite: Invite): Promise<void> {
        await this.withTransaction(async (client) => {
            await insertInvite(client, invite);
        });
    }

    async createBatch(invites: Invite[]): Promise<void> {
        if (invites.length === 0) {
            return;
        }

        await this.pool.query(
            "select public.create_invite_batch($1::jsonb)",
            [JSON.stringify(toCreateInviteBatchPayload(invites))]
        );
    }

    async createTrackedBatch(input: CreateInviteBatchInput, invites: Invite[]): Promise<string> {
        const batchId = randomUUID();

        await this.withTransaction(async (client) => {
            await client.query(
                `
                    insert into public.invite_batches (
                        batch_id,
                        parent_batch_id,
                        created_by,
                        role,
                        job_description,
                        questions_json,
                        status,
                        requested_count,
                        succeeded_count,
                        failed_count
                    )
                    values ($1, $2, $3, $4, $5, $6::jsonb, 'pending', $7, 0, 0)
                `,
                [
                    batchId,
                    input.parentBatchId ?? null,
                    input.createdBy,
                    input.role,
                    input.jobDescription ?? null,
                    JSON.stringify(input.questions),
                    input.candidates.length
                ]
            );

            for (let index = 0; index < invites.length; index += 1) {
                const invite = invites[index];
                await client.query(
                    `
                        insert into public.invite_batch_candidates (
                            batch_id,
                            candidate_index,
                            first_name,
                            last_name,
                            email,
                            req_id,
                            resume_text,
                            status,
                            retryable,
                            retry_count,
                            session_id,
                            error_code,
                            error_message
                        )
                        values ($1, $2, $3, $4, $5, $6, $7, 'pending', true, 0, null, null, null)
                    `,
                    [
                        batchId,
                        index,
                        invite.candidate.firstName,
                        invite.candidate.lastName,
                        invite.candidate.email,
                        invite.candidate.reqId,
                        invite.candidate.resumeText ?? null
                    ]
                );
            }
        });

        return batchId;
    }

    async markTrackedBatchCompleted(batchId: string, invites: Invite[]): Promise<void> {
        await this.withTransaction(async (client) => {
            await client.query(
                `
                    update public.invite_batches
                    set
                        status = 'completed',
                        succeeded_count = $2,
                        failed_count = 0
                    where batch_id = $1
                `,
                [batchId, invites.length]
            );

            for (let index = 0; index < invites.length; index += 1) {
                await client.query(
                    `
                        update public.invite_batch_candidates
                        set
                            status = 'created',
                            retryable = false,
                            session_id = $3,
                            error_code = null,
                            error_message = null
                        where batch_id = $1
                          and candidate_index = $2
                    `,
                    [batchId, index, invites[index].id]
                );
            }
        });
    }

    async markTrackedBatchFailed(batchId: string, failures: InviteBatchFailure[]): Promise<void> {
        await this.withTransaction(async (client) => {
            await client.query(
                `
                    update public.invite_batches
                    set
                        status = 'failed',
                        succeeded_count = 0,
                        failed_count = $2
                    where batch_id = $1
                `,
                [batchId, failures.length]
            );

            for (let index = 0; index < failures.length; index += 1) {
                const failure = failures[index];
                await client.query(
                    `
                        update public.invite_batch_candidates
                        set
                            status = 'failed',
                            retryable = $3,
                            error_code = $4,
                            error_message = $5
                        where batch_id = $1
                          and candidate_index = $2
                    `,
                    [batchId, index, failure.retryable, failure.code, failure.message]
                );
            }
        });
    }

    async getTrackedBatch(batchId: string, actorId: string): Promise<PersistedInviteBatch | null> {
        const batchResult = await this.pool.query<InviteBatchRow>(
            `
                select
                    batch_id,
                    parent_batch_id,
                    created_by,
                    role,
                    job_description,
                    questions_json,
                    status
                from public.invite_batches
                where batch_id = $1
                  and created_by = $2
                limit 1
            `,
            [batchId, actorId]
        );

        const batch = batchResult.rows[0];
        if (!batch) {
            return null;
        }

        const candidateResult = await this.pool.query<InviteBatchCandidateRow>(
            `
                select
                    candidate_index,
                    first_name,
                    last_name,
                    email,
                    req_id,
                    resume_text,
                    status,
                    retryable,
                    retry_count,
                    session_id,
                    error_code,
                    error_message
                from public.invite_batch_candidates
                where batch_id = $1
                order by candidate_index asc
            `,
            [batchId]
        );

        return {
            batchId: batch.batch_id,
            parentBatchId: batch.parent_batch_id ?? undefined,
            createdBy: batch.created_by,
            role: batch.role,
            jobDescription: batch.job_description ?? undefined,
            questions: Array.isArray(batch.questions_json) ? batch.questions_json as PersistedInviteBatch["questions"] : [],
            status: batch.status,
            candidates: candidateResult.rows.map(mapCandidateRow)
        };
    }

    async markTrackedBatchRetried(batchId: string, childBatchId: string): Promise<void> {
        await this.withTransaction(async (client) => {
            await client.query(
                `
                    update public.invite_batches
                    set
                        status = 'retry_issued',
                        last_retry_batch_id = $2
                    where batch_id = $1
                `,
                [batchId, childBatchId]
            );

            await client.query(
                `
                    update public.invite_batch_candidates
                    set
                        status = 'retry_issued',
                        retryable = false,
                        retry_count = retry_count + 1
                    where batch_id = $1
                      and status = 'failed'
                      and retryable = true
                `,
                [batchId]
            );
        });
    }

    async getByToken(token: string): Promise<Invite | null> {
        const tokenHash = hashToken(token);
        const tokenResult = await this.pool.query<TokenLookupRow>(
            `
                select session_id
                from public.candidate_tokens
                where token_hash = $1
                  and revoked_at is null
                  and (expires_at is null or expires_at > now())
                limit 1
            `,
            [tokenHash]
        );

        const tokenRow = tokenResult.rows[0];
        if (!tokenRow) {
            return null;
        }

        const sessionResult = await this.pool.query<SessionLookupRow>(
            `
                select
                    session_id,
                    target_role,
                    job_description,
                    recruiter_id,
                    created_at,
                    intake_json
                from public.sessions
                where session_id = $1
                limit 1
            `,
            [tokenRow.session_id]
        );

        const session = sessionResult.rows[0];
        if (!session) {
            Logger.error("Invite session lookup failed", {
                errorCode: "INVITE_SESSION_LOOKUP_FAILED"
            }, "PostgresInviteRepository");
            return null;
        }

        const questionResult = await this.pool.query<QuestionLookupRow>(
            `
                select
                    question_text,
                    question_index,
                    category,
                    competencies
                from public.questions
                where session_id = $1
                order by question_index asc
            `,
            [session.session_id]
        );

        const questions = questionResult.rows.map((question) => ({
            text: question.question_text,
            index: question.question_index,
            category: question.category || question.competencies?.category || "General"
        }));

        const rawCandidate = session.intake_json?.candidate || {};
        const candidate = {
            firstName: rawCandidate.firstName || rawCandidate.name?.split(" ")[0] || "",
            lastName: rawCandidate.lastName || rawCandidate.name?.split(" ").slice(1).join(" ") || "",
            email: rawCandidate.email || "",
            reqId: rawCandidate.reqId || "",
            resumeText: rawCandidate.resumeText || undefined
        };

        return {
            id: session.session_id,
            token,
            role: session.target_role || "",
            jobDescription: session.job_description ?? undefined,
            candidate,
            questions,
            createdBy: session.recruiter_id || "",
            createdAt: new Date(session.created_at).getTime()
        };
    }
}
