import { queryPostgres } from "@/lib/server/db/postgres";
import type { QueryResultRow } from "pg";

export interface RecruiterProfileSummary {
    first_name: string | null;
    last_name: string | null;
    title?: string | null;
}

export interface RecruiterProfileRecord extends RecruiterProfileSummary {
    recruiter_id: string;
    phone: string | null;
    timezone: string | null;
}

export type RecruiterProfileUpdate = {
    first_name: string;
    last_name: string;
    title?: string | null;
    phone?: string | null;
    timezone?: string | null;
};

type RecruiterProfileRow = QueryResultRow & RecruiterProfileRecord;

export async function getRecruiterProfileSummary(userId: string): Promise<RecruiterProfileSummary | null> {
    const result = await queryPostgres<RecruiterProfileRow>(
        `
            select first_name, last_name, title
            from public.recruiter_profiles
            where recruiter_id = $1
            limit 1
        `,
        [userId]
    );

    return result.rows[0] ?? null;
}

export async function getRecruiterProfileRecord(userId: string): Promise<RecruiterProfileRecord | null> {
    const result = await queryPostgres<RecruiterProfileRow>(
        `
            select recruiter_id, first_name, last_name, title, phone, timezone
            from public.recruiter_profiles
            where recruiter_id = $1
            limit 1
        `,
        [userId]
    );

    return result.rows[0] ?? null;
}

export async function upsertRecruiterProfileRecord(
    userId: string,
    updates: RecruiterProfileUpdate
): Promise<RecruiterProfileRecord> {
    const result = await queryPostgres<RecruiterProfileRow>(
        `
            insert into public.recruiter_profiles (
                recruiter_id,
                first_name,
                last_name,
                title,
                phone,
                timezone
            )
            values ($1, $2, $3, $4, $5, $6)
            on conflict (recruiter_id)
            do update set
                first_name = excluded.first_name,
                last_name = excluded.last_name,
                title = excluded.title,
                phone = excluded.phone,
                timezone = excluded.timezone
            returning recruiter_id, first_name, last_name, title, phone, timezone
        `,
        [
            userId,
            updates.first_name,
            updates.last_name,
            updates.title ?? null,
            updates.phone ?? null,
            updates.timezone ?? "UTC",
        ]
    );

    return result.rows[0];
}
