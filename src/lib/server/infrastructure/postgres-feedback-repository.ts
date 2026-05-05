import type { Pool, QueryResultRow } from "pg";
import type { AdminFeedbackRecord, FeedbackRecord, FeedbackRepository } from "@/lib/server/infrastructure/feedback-repository";
import { getPostgresPool } from "@/lib/server/db/postgres";
import { Logger } from "@/lib/logger";

type FeedbackRow = QueryResultRow & {
    id: string;
    session_id: string | null;
    recruiter_id: string | null;
    type: string;
    rating: number | null;
    comment: string | null;
    metadata: unknown;
    created_at: string | Date;
    session_target_role: string | null;
    session_intake_json: unknown;
};

export class PostgresFeedbackRepository implements FeedbackRepository {
    constructor(private readonly pool: Pool = getPostgresPool()) {}

    async capture(record: FeedbackRecord): Promise<void> {
        const metadata = record.metadata || {};

        try {
            if (record.sessionId) {
                const updated = await this.pool.query(
                    `
                        update public.user_feedback
                        set recruiter_id = $2,
                            rating = $4,
                            comment = $5,
                            metadata = $6::jsonb
                        where session_id = $1
                          and type = $3
                    `,
                    [
                        record.sessionId,
                        record.recruiterId ?? null,
                        record.type,
                        record.rating ?? null,
                        record.comment ?? null,
                        JSON.stringify(metadata)
                    ]
                );

                if ((updated.rowCount ?? 0) > 0) {
                    return;
                }
            }

            await this.pool.query(
                `
                    insert into public.user_feedback (
                        session_id,
                        recruiter_id,
                        type,
                        rating,
                        comment,
                        metadata
                    )
                    values ($1, $2, $3, $4, $5, $6::jsonb)
                `,
                [
                    record.sessionId ?? null,
                    record.recruiterId ?? null,
                    record.type,
                    record.rating ?? null,
                    record.comment ?? null,
                    JSON.stringify(metadata)
                ]
            );
        } catch (error) {
            Logger.error("Failed to capture feedback", {
                error,
                errorCode: "FEEDBACK_INSERT_FAILED"
            }, "FeedbackRepository");
            throw new Error("Failed to save feedback");
        }
    }

    async listAdminView(): Promise<AdminFeedbackRecord[]> {
        const result = await this.pool.query<FeedbackRow>(
            `
                select
                    f.id,
                    f.session_id,
                    f.recruiter_id,
                    f.type,
                    f.rating,
                    f.comment,
                    f.metadata,
                    f.created_at,
                    s.target_role as session_target_role,
                    s.intake_json as session_intake_json
                from public.user_feedback f
                left join public.sessions s on s.session_id = f.session_id
                order by f.created_at desc
            `
        );

        return result.rows.map((row) => ({
            id: row.id,
            session_id: row.session_id,
            recruiter_id: row.recruiter_id,
            type: row.type,
            rating: row.rating,
            comment: row.comment,
            metadata: this.asObject(row.metadata),
            created_at: this.toIsoString(row.created_at),
            sessions: row.session_id
                ? {
                    target_role: row.session_target_role,
                    intake_json: row.session_intake_json
                }
                : null
        }));
    }

    private asObject(value: unknown): Record<string, unknown> {
        return value && typeof value === "object" && !Array.isArray(value)
            ? value as Record<string, unknown>
            : {};
    }

    private toIsoString(value: string | Date): string {
        if (value instanceof Date) {
            return value.toISOString();
        }

        return new Date(value).toISOString();
    }
}
