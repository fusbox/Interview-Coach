import type { Pool, PoolClient, QueryResultRow } from "pg";
import type { SessionRepository } from "@/lib/domain/repository";
import type { AnalysisResult, Answer, InterviewSession, Question, SessionStatus, SessionSummary } from "@/lib/domain/types";
import { AnalysisResultSchema } from "@/lib/domain/schemas";
import { Logger } from "@/lib/logger";
import { decrypt, encrypt } from "@/lib/server/encryption";
import { getPostgresPool } from "@/lib/server/db/postgres";

type SessionIntake = {
    candidate?: { firstName?: string; lastName?: string; name?: string; email?: string; resumeText?: string };
    invite_token?: string;
    viewed_at?: number;
    entered_initials?: string;
    engaged_time_seconds?: number;
    retry_contexts?: Record<string, unknown>;
    summary_expires_at?: number | string | null;
};

type SessionRow = QueryResultRow & {
    session_id: string;
    recruiter_id: string | null;
    status: string;
    current_question_index: number;
    target_role: string | null;
    job_description: string | null;
    intake_json: SessionIntake | null;
    created_at: string | Date;
    updated_at: string | Date;
    parent_session_id: string | null;
    attempt_number: number | null;
    client_name: string | null;
    summary_narrative: string | null;
    invitation_sent_at: string | Date | null;
};

type SessionSummaryRow = SessionRow & {
    question_count: number | string | null;
    answer_count: number | string | null;
    submitted_count: number | string | null;
};

type QuestionRow = QueryResultRow & {
    question_id: string;
    session_id: string;
    question_index: number;
    question_text: string;
    category: string | null;
};

type AnswerRow = QueryResultRow & {
    question_id: string;
    session_id: string;
    final_text: string | null;
    draft_text: string | null;
    submitted_at: string | Date | null;
    attempt_number: number;
};

type EvalRow = QueryResultRow & {
    question_id: string;
    session_id: string;
    feedback_json: unknown;
    attempt_number: number;
};

export class PostgresSessionRepository implements SessionRepository {
    constructor(private readonly pool: Pool = getPostgresPool()) {}

    private asObject(value: unknown): Record<string, unknown> {
        return value && typeof value === "object" && !Array.isArray(value)
            ? value as Record<string, unknown>
            : {};
    }

    private asString(value: unknown): string | undefined {
        return typeof value === "string" && value.trim().length > 0 ? value : undefined;
    }

    private asNumber(value: unknown): number | undefined {
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }

        if (typeof value === "string" && value.trim().length > 0) {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : undefined;
        }

        return undefined;
    }

    private asTimestamp(value: unknown): number | undefined {
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }

        if (value instanceof Date) {
            const timestamp = value.getTime();
            return Number.isFinite(timestamp) ? timestamp : undefined;
        }

        if (typeof value === "string" && value.trim().length > 0) {
            const parsed = new Date(value).getTime();
            return Number.isFinite(parsed) ? parsed : undefined;
        }

        return undefined;
    }

    private asIsoTimestamp(value: number | undefined): string | null {
        return typeof value === "number" && Number.isFinite(value)
            ? new Date(value).toISOString()
            : null;
    }

    private asAttemptNumber(value: unknown): number | undefined {
        return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
    }

    private normalizeCandidate(rawCandidate: unknown) {
        const candidate = this.asObject(rawCandidate);
        const firstName = this.asString(candidate.firstName) || "";
        const lastName = this.asString(candidate.lastName) || "";
        const fullName = this.asString(candidate.name);
        const email = this.asString(candidate.email) || "";
        const resumeText = this.asString(candidate.resumeText);

        return {
            firstName,
            lastName,
            fullName,
            email,
            resumeText
        };
    }

    private normalizeDbStatus(status: string): SessionStatus {
        if (status === "AWAITING_EVAL") {
            return "AWAITING_EVALUATION";
        }

        return status as SessionStatus;
    }

    private toDbStatus(status: SessionStatus): string {
        return status === "AWAITING_EVALUATION" ? "AWAITING_EVAL" : status;
    }

    private parseAnalysisResult(feedbackJson: unknown, sessionId: string, questionId: string): AnalysisResult | undefined {
        if (!feedbackJson) {
            return undefined;
        }

        const result = AnalysisResultSchema.safeParse(feedbackJson);
        if (!result.success) {
            Logger.warn("[Repo] Dropping invalid persisted analysis payload", {
                sessionId,
                questionId,
                issues: result.error.issues.map(issue => issue.message)
            });
            return undefined;
        }

        return result.data;
    }

    private mapSummary(row: SessionSummaryRow): SessionSummary {
        const intake = this.asObject(row.intake_json);
        const candidate = this.normalizeCandidate(intake.candidate);
        const candidateName = (candidate.firstName && candidate.lastName)
            ? `${candidate.firstName} ${candidate.lastName}`
            : (candidate.fullName || "Anonymous Candidate");

        let inviteToken: string | undefined;
        const encryptedInviteToken = this.asString(intake.invite_token);
        if (encryptedInviteToken) {
            try {
                inviteToken = decrypt(encryptedInviteToken);
            } catch {
                Logger.error("[Repo] Failed to decrypt invite token", { sessionId: row.session_id });
            }
        }

        const questionCount = this.asNumber(row.question_count) || 0;
        const answerCount = this.asNumber(row.answer_count) || 0;
        const submittedCount = this.asNumber(row.submitted_count) || 0;

        let derivedStatus = this.normalizeDbStatus(row.status);
        if (row.status === "NOT_STARTED" && answerCount > 0) {
            derivedStatus = "IN_SESSION";
        } else if (row.status === "IN_SESSION" && submittedCount === questionCount && questionCount > 0) {
            derivedStatus = "COMPLETED";
        }

        return {
            id: row.session_id,
            candidateName,
            role: row.target_role || "",
            status: derivedStatus,
            createdAt: this.asTimestamp(row.created_at) || 0,
            updatedAt: this.asTimestamp(row.updated_at) || this.asTimestamp(row.created_at) || 0,
            questionCount,
            answerCount,
            submittedCount,
            viewedAt: this.asTimestamp(intake.viewed_at),
            enteredInitials: this.asString(intake.entered_initials),
            inviteToken,
            parentSessionId: row.parent_session_id || undefined,
            attemptNumber: this.asAttemptNumber(row.attempt_number),
            clientName: this.asString(row.client_name),
            candidateEmail: candidate.email || undefined,
            candidateFirstName: candidate.firstName || undefined,
            candidateLastName: candidate.lastName || undefined,
            engagedTimeSeconds: this.asNumber(intake.engaged_time_seconds),
            invitationSentAt: this.asTimestamp(row.invitation_sent_at)
        };
    }

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

    private async fetchIntake(sessionId: string, client: Pool | PoolClient = this.pool): Promise<SessionIntake> {
        const result = await client.query<{ intake_json: SessionIntake | null }>(
            "select intake_json from public.sessions where session_id = $1",
            [sessionId]
        );

        return result.rows[0]?.intake_json || {};
    }

    private async upsertQuestions(client: Pool | PoolClient, sessionId: string, questions: Question[]): Promise<void> {
        for (let index = 0; index < questions.length; index += 1) {
            const question = questions[index];
            await client.query(
                `
                    insert into public.questions (
                        question_id,
                        session_id,
                        question_index,
                        question_text,
                        category
                    )
                    values ($1, $2, $3, $4, $5)
                    on conflict (question_id)
                    do update set
                        session_id = excluded.session_id,
                        question_index = excluded.question_index,
                        question_text = excluded.question_text,
                        category = excluded.category
                `,
                [
                    question.id,
                    sessionId,
                    index,
                    question.text,
                    question.category || "General"
                ]
            );
        }
    }

    private async upsertAnswersAndEvals(client: Pool | PoolClient, sessionId: string, answers: Record<string, Answer>): Promise<void> {
        for (const [questionId, answer] of Object.entries(answers)) {
            await client.query(
                `
                    insert into public.answers (
                        session_id,
                        question_id,
                        attempt_number,
                        modality,
                        final_text,
                        draft_text,
                        submitted_at
                    )
                    values ($1, $2, 1, $3, $4, $5, $6)
                    on conflict (question_id, attempt_number)
                    do update set
                        session_id = excluded.session_id,
                        modality = excluded.modality,
                        final_text = excluded.final_text,
                        draft_text = excluded.draft_text,
                        submitted_at = excluded.submitted_at
                `,
                [
                    sessionId,
                    questionId,
                    answer.modality ?? "text",
                    answer.transcript ?? null,
                    answer.draft ?? null,
                    this.asIsoTimestamp(answer.submittedAt)
                ]
            );

            if (answer.analysis) {
                await client.query(
                    `
                        insert into public.eval_results (
                            session_id,
                            question_id,
                            attempt_number,
                            status,
                            feedback_json
                        )
                        values ($1, $2, 1, 'COMPLETE', $3::jsonb)
                        on conflict (question_id, attempt_number)
                        do update set
                            session_id = excluded.session_id,
                            status = excluded.status,
                            feedback_json = excluded.feedback_json
                    `,
                    [
                        sessionId,
                        questionId,
                        JSON.stringify(answer.analysis)
                    ]
                );
            }
        }
    }

    private async clearExpiredSummary(sessionId: string, intake: SessionIntake | null | undefined): Promise<void> {
        const updatedIntake = { ...(intake || {}) };
        delete updatedIntake.summary_expires_at;

        try {
            await this.pool.query(
                `
                    update public.sessions
                    set summary_narrative = null,
                        intake_json = $2::jsonb
                    where session_id = $1
                `,
                [sessionId, JSON.stringify(updatedIntake)]
            );
        } catch (error) {
            Logger.error("[Repo] clearExpiredSummary Failed", error);
        }
    }

    async create(session: InterviewSession): Promise<void> {
        await this.update(session);
    }

    async listByRecruiter(recruiterId: string): Promise<SessionSummary[]> {
        const result = await this.pool.query<SessionSummaryRow>(
            `
                select
                    s.session_id,
                    s.recruiter_id,
                    s.target_role,
                    s.status,
                    s.created_at,
                    s.updated_at,
                    s.intake_json,
                    s.parent_session_id,
                    s.attempt_number,
                    s.client_name,
                    s.summary_narrative,
                    s.invitation_sent_at,
                    s.current_question_index,
                    s.job_description,
                    coalesce(q.question_count, 0)::int as question_count,
                    coalesce(a.answer_count, 0)::int as answer_count,
                    coalesce(a.submitted_count, 0)::int as submitted_count
                from public.sessions s
                left join (
                    select session_id, count(*)::int as question_count
                    from public.questions
                    group by session_id
                ) q on q.session_id = s.session_id
                left join (
                    select
                        session_id,
                        count(*)::int as answer_count,
                        count(*) filter (where submitted_at is not null)::int as submitted_count
                    from public.answers
                    group by session_id
                ) a on a.session_id = s.session_id
                where s.recruiter_id = $1
                  and (s.invitation_sent_at is not null or s.parent_session_id is not null)
                order by s.updated_at desc
            `,
            [recruiterId]
        );

        return result.rows.map((row) => this.mapSummary(row));
    }

    async markViewed(sessionId: string): Promise<void> {
        const currentIntake = await this.fetchIntake(sessionId);
        if (currentIntake.viewed_at) {
            return;
        }

        await this.pool.query(
            `
                update public.sessions
                set intake_json = $2::jsonb
                where session_id = $1
            `,
            [
                sessionId,
                JSON.stringify({
                    ...currentIntake,
                    viewed_at: Date.now()
                })
            ]
        );
    }

    async get(id: string): Promise<InterviewSession | null> {
        const sessionResult = await this.pool.query<SessionRow>(
            "select * from public.sessions where session_id = $1",
            [id]
        );
        const row = sessionResult.rows[0];
        if (!row) {
            return null;
        }

        const [questionsResult, answersResult, evalsResult] = await Promise.all([
            this.pool.query<QuestionRow>(
                "select * from public.questions where session_id = $1 order by question_index",
                [id]
            ),
            this.pool.query<AnswerRow>(
                "select * from public.answers where session_id = $1",
                [id]
            ),
            this.pool.query<EvalRow>(
                "select * from public.eval_results where session_id = $1",
                [id]
            )
        ]);

        const questions: Question[] = questionsResult.rows.map((question) => ({
            id: question.question_id,
            text: question.question_text,
            category: question.category || "General",
            index: question.question_index
        }));

        const answers: Record<string, Answer> = {};
        for (const answer of answersResult.rows) {
            const evalRow = evalsResult.rows.find((candidate) =>
                candidate.question_id === answer.question_id
                && candidate.attempt_number === answer.attempt_number
            );

            answers[answer.question_id] = {
                questionId: answer.question_id,
                transcript: answer.final_text || "",
                modality: answer.modality || undefined,
                draft: answer.draft_text || "",
                submittedAt: this.asTimestamp(answer.submitted_at),
                analysis: evalRow
                    ? this.parseAnalysisResult(evalRow.feedback_json, id, answer.question_id)
                    : undefined
            };
        }

        const intake = this.asObject(row.intake_json);
        const summaryExpiresAt = this.asTimestamp(intake.summary_expires_at);
        const summaryExpired =
            typeof row.summary_narrative === "string"
            && !!summaryExpiresAt
            && Date.now() >= summaryExpiresAt;

        if (summaryExpired) {
            await this.clearExpiredSummary(id, row.intake_json);
        }

        const candidate = this.normalizeCandidate(intake.candidate);
        const candidateName = (candidate.firstName && candidate.lastName)
            ? `${candidate.firstName} ${candidate.lastName}`
            : candidate.fullName;
        const enteredInitials = this.asString(intake.entered_initials);
        const encryptedInviteToken = this.asString(intake.invite_token);

        return {
            id: row.session_id,
            recruiterId: row.recruiter_id || undefined,
            status: this.normalizeDbStatus(row.status),
            role: row.target_role || "",
            jobDescription: row.job_description || undefined,
            currentQuestionIndex: row.current_question_index,
            questions,
            answers,
            initialsRequired: !!candidateName && !enteredInitials,
            candidateName,
            enteredInitials,
            viewedAt: this.asTimestamp(intake.viewed_at),
            updatedAt: this.asTimestamp(row.updated_at),
            summaryExpiresAt,
            summaryExpired,
            candidate: {
                firstName: candidate.firstName,
                lastName: candidate.lastName,
                email: candidate.email,
                resumeText: candidate.resumeText
            },
            engagedTimeSeconds: this.asNumber(intake.engaged_time_seconds) || 0,
            intakeData: intake,
            inviteToken: encryptedInviteToken ? (() => {
                try { return decrypt(encryptedInviteToken); }
                catch { return undefined; }
            })() : undefined,
            parentSessionId: row.parent_session_id || undefined,
            attemptNumber: this.asAttemptNumber(row.attempt_number),
            clientName: this.asString(row.client_name),
            summaryNarrative: summaryExpired ? null : row.summary_narrative
        };
    }

    async update(session: InterviewSession): Promise<void> {
        await this.withTransaction(async (client) => {
            const currentIntake = await this.fetchIntake(session.id, client);
            const sessionIntake = this.asObject(session.intakeData);
            const baseIntake = {
                ...currentIntake,
                ...sessionIntake
            };
            const nextIntake = {
                ...baseIntake,
                candidate: { ...this.asObject(baseIntake.candidate), ...session.candidate },
                entered_initials: session.enteredInitials || baseIntake.entered_initials,
                engaged_time_seconds: session.engagedTimeSeconds ?? baseIntake.engaged_time_seconds,
                invite_token: session.inviteToken
                    ? encrypt(session.inviteToken)
                    : baseIntake.invite_token
            };

            await client.query(
                `
                    insert into public.sessions (
                        session_id,
                        status,
                        current_question_index,
                        target_role,
                        job_description,
                        recruiter_id,
                        parent_session_id,
                        attempt_number,
                        client_name,
                        summary_narrative,
                        intake_json
                    )
                    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
                    on conflict (session_id)
                    do update set
                        status = excluded.status,
                        current_question_index = excluded.current_question_index,
                        target_role = excluded.target_role,
                        job_description = excluded.job_description,
                        recruiter_id = excluded.recruiter_id,
                        parent_session_id = excluded.parent_session_id,
                        attempt_number = excluded.attempt_number,
                        client_name = excluded.client_name,
                        summary_narrative = excluded.summary_narrative,
                        intake_json = excluded.intake_json
                `,
                [
                    session.id,
                    this.toDbStatus(session.status),
                    session.currentQuestionIndex,
                    session.role,
                    session.jobDescription ?? null,
                    session.recruiterId ?? null,
                    session.parentSessionId ?? null,
                    session.attemptNumber ?? null,
                    session.clientName ?? null,
                    session.summaryNarrative ?? null,
                    JSON.stringify(nextIntake)
                ]
            );

            await this.upsertQuestions(client, session.id, session.questions);
            await this.upsertAnswersAndEvals(client, session.id, session.answers);
        });
    }

    async updatePartial(id: string, updates: Partial<InterviewSession>): Promise<void> {
        const dbUpdates: string[] = [];
        const values: unknown[] = [];

        const addUpdate = (column: string, value: unknown, cast = "") => {
            values.push(value);
            dbUpdates.push(`${column} = $${values.length}${cast}`);
        };

        if (updates.status) addUpdate("status", this.toDbStatus(updates.status));
        if (updates.currentQuestionIndex !== undefined) addUpdate("current_question_index", updates.currentQuestionIndex);
        if (updates.role) addUpdate("target_role", updates.role);
        if (updates.jobDescription) addUpdate("job_description", updates.jobDescription);
        if (updates.recruiterId) addUpdate("recruiter_id", updates.recruiterId);
        if (updates.parentSessionId) addUpdate("parent_session_id", updates.parentSessionId);
        if (updates.attemptNumber) addUpdate("attempt_number", updates.attemptNumber);
        if (updates.clientName) addUpdate("client_name", updates.clientName);
        if (updates.summaryNarrative !== undefined) addUpdate("summary_narrative", updates.summaryNarrative);

        const shouldPatchIntake =
            updates.enteredInitials !== undefined
            || updates.engagedTimeSeconds !== undefined
            || updates.inviteToken !== undefined;

        if (shouldPatchIntake) {
            const currentIntake = await this.fetchIntake(id);
            const nextIntake = { ...currentIntake };

            if (updates.enteredInitials !== undefined) {
                nextIntake.entered_initials = updates.enteredInitials;
            }

            if (updates.engagedTimeSeconds !== undefined) {
                nextIntake.engaged_time_seconds = Math.max(
                    this.asNumber(nextIntake.engaged_time_seconds) || 0,
                    updates.engagedTimeSeconds
                );
            }

            if (updates.inviteToken !== undefined) {
                nextIntake.invite_token = encrypt(updates.inviteToken);
            }

            addUpdate("intake_json", JSON.stringify(nextIntake), "::jsonb");
        }

        if (dbUpdates.length > 0) {
            values.push(id);
            const idPlaceholder = `$${values.length}`;
            try {
                await this.pool.query(
                    `
                        update public.sessions
                        set ${dbUpdates.join(", ")}
                        where session_id = ${idPlaceholder}
                    `,
                    values
                );
            } catch (error) {
                Logger.error("[Repo] updatePartial Failed", error);
            }
        }

        if (updates.engagedTimeDelta !== undefined) {
            await this.incrementEngagementTime(id, updates.engagedTimeDelta);
        }

        if (updates.answers) {
            await this.upsertAnswersAndEvals(this.pool, id, updates.answers);
        }
    }

    async saveDraft(sessionId: string, questionId: string, draftText: string): Promise<void> {
        await this.pool.query(
            `
                insert into public.answers (
                    session_id,
                    question_id,
                    attempt_number,
                    draft_text,
                    draft_updated_at,
                    draft_revision
                )
                values ($1, $2, 1, $3, now(), 1)
                on conflict (question_id, attempt_number)
                do update set
                    session_id = excluded.session_id,
                    draft_text = excluded.draft_text,
                    draft_updated_at = excluded.draft_updated_at,
                    draft_revision = public.answers.draft_revision + 1
            `,
            [sessionId, questionId, draftText]
        );
    }

    async deleteAnalysis(sessionId: string, questionId: string): Promise<void> {
        await this.pool.query(
            "delete from public.eval_results where session_id = $1 and question_id = $2",
            [sessionId, questionId]
        );
    }

    async setSummaryExpiry(sessionId: string, expiresAt: number): Promise<void> {
        const currentIntake = await this.fetchIntake(sessionId);
        await this.pool.query(
            `
                update public.sessions
                set intake_json = $2::jsonb
                where session_id = $1
            `,
            [
                sessionId,
                JSON.stringify({
                    ...currentIntake,
                    summary_expires_at: expiresAt
                })
            ]
        );
    }

    async delete(id: string): Promise<void> {
        await this.pool.query("delete from public.sessions where session_id = $1", [id]);
    }

    async markInvitationSent(sessionId: string): Promise<void> {
        const result = await this.pool.query(
            `
                update public.sessions
                set invitation_sent_at = now()
                where session_id = $1
            `,
            [sessionId]
        );

        if ((result.rowCount ?? 0) === 0) {
            throw new Error("Failed to mark invitation sent: session not found");
        }
    }

    private async incrementEngagementTime(sessionId: string, deltaSeconds: number): Promise<void> {
        try {
            await this.pool.query(
                "select public.increment_session_engagement($1, $2)",
                [sessionId, deltaSeconds]
            );
        } catch (error) {
            Logger.error("[Repo] incrementEngagementTime Failed", error);
            throw error;
        }
    }
}
