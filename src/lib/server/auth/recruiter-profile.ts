import { createClient } from "@/lib/supabase/server";
import { getAppAuthBackendName } from "@/lib/server/auth/app-auth";
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
    if (getAppAuthBackendName() === "postgres") {
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

    const { data } = await createClient()
        .from('recruiter_profiles')
        .select('first_name, last_name, title')
        .eq('recruiter_id', userId)
        .single();

    return data;
}

export async function getRecruiterProfileRecord(userId: string): Promise<RecruiterProfileRecord | null> {
    if (getAppAuthBackendName() === "postgres") {
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

    const { data } = await createClient()
        .from('recruiter_profiles')
        .select('recruiter_id, first_name, last_name, title, phone, timezone')
        .eq('recruiter_id', userId)
        .single();

    return data;
}

export async function upsertRecruiterProfileRecord(
    userId: string,
    updates: RecruiterProfileUpdate
): Promise<RecruiterProfileRecord> {
    if (getAppAuthBackendName() === "postgres") {
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

    const { data, error } = await createClient()
        .from('recruiter_profiles')
        .upsert({
            recruiter_id: userId,
            first_name: updates.first_name,
            last_name: updates.last_name,
            title: updates.title ?? null,
            phone: updates.phone ?? null,
            timezone: updates.timezone ?? "UTC",
            updated_at: new Date().toISOString(),
        })
        .select('recruiter_id, first_name, last_name, title, phone, timezone')
        .single();

    if (error) {
        throw new Error(error.message);
    }

    return data;
}
