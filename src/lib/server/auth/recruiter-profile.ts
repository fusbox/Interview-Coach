import { createClient } from "@/lib/supabase/server";
import { getAppAuthBackendName } from "@/lib/server/auth/app-auth";
import { queryPostgres } from "@/lib/server/db/postgres";
import type { QueryResultRow } from "pg";

export interface RecruiterProfileSummary {
    first_name: string | null;
    last_name: string | null;
    title?: string | null;
}

type RecruiterProfileRow = QueryResultRow & RecruiterProfileSummary;

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

