import { getOptionalServerEnv } from "@/lib/server/config/server-env";

export interface FeedbackRecord {
    sessionId?: string;
    recruiterId?: string;
    type: string;
    rating?: number;
    comment?: string;
    metadata?: Record<string, unknown>;
}

export type AdminFeedbackRecord = {
    id: string;
    session_id: string | null;
    recruiter_id: string | null;
    type: string;
    rating: number | null;
    comment: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    sessions: {
        target_role: string | null;
        intake_json: unknown;
    } | null;
};

export interface FeedbackRepository {
    capture(record: FeedbackRecord): Promise<void>;
    listAdminView(): Promise<AdminFeedbackRecord[]>;
}

export type FeedbackRepositoryBackend = "supabase" | "postgres";

export function getFeedbackRepositoryBackend(): FeedbackRepositoryBackend {
    const configured = getOptionalServerEnv("FEEDBACK_REPOSITORY_BACKEND")?.toLowerCase();
    if (!configured) {
        return "supabase";
    }

    if (configured === "supabase" || configured === "postgres") {
        return configured;
    }

    throw new Error(`Unsupported FEEDBACK_REPOSITORY_BACKEND value "${configured}". Expected "supabase" or "postgres".`);
}

export async function createFeedbackRepository(): Promise<FeedbackRepository> {
    const backend = getFeedbackRepositoryBackend();

    if (backend === "postgres") {
        const { PostgresFeedbackRepository } = await import("@/lib/server/infrastructure/postgres-feedback-repository");
        return new PostgresFeedbackRepository();
    }

    const { SupabaseFeedbackRepository } = await import("@/lib/server/infrastructure/supabase-feedback-repository");
    return new SupabaseFeedbackRepository();
}
