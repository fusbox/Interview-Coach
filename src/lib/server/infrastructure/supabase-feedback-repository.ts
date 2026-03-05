import { createClient } from "@/lib/supabase/server";

export interface FeedbackRecord {
    sessionId?: string;
    recruiterId?: string;
    type: string;
    rating?: number;
    comment?: string;
    metadata?: Record<string, unknown>;
}

export class SupabaseFeedbackRepository {
    private supabase = createClient();

    async capture(record: FeedbackRecord) {
        const { error } = await this.supabase
            .from('user_feedback')
            .insert({
                session_id: record.sessionId,
                recruiter_id: record.recruiterId,
                type: record.type,
                rating: record.rating,
                comment: record.comment,
                metadata: record.metadata || {}
            });

        if (error) {
            console.error('[FeedbackRepository] Failed to capture feedback:', error);
            throw new Error('Failed to save feedback');
        }
    }

    async listAdminView() {
        const { data, error } = await this.supabase
            .from('user_feedback')
            .select(`
                *,
                sessions (
                    target_role,
                    intake_json
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }
}
