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
        const payload = {
            session_id: record.sessionId,
            recruiter_id: record.recruiterId,
            type: record.type,
            rating: record.rating,
            comment: record.comment,
            metadata: record.metadata || {}
        };

        // If we have a sessionId, we should upsert to avoid duplicate feedback for the same type
        if (record.sessionId) {
            const { error } = await this.supabase
                .from('user_feedback')
                .upsert(payload, {
                    onConflict: 'session_id,type',
                    ignoreDuplicates: false
                });

            if (!error) return;

            // Fallback to insert if upsert fails (e.g. missing unique constraint in DB)
            console.warn('[FeedbackRepository] Upsert failed, falling back to insert:', error.message);
        }

        const { error: insertError } = await this.supabase
            .from('user_feedback')
            .insert(payload);

        if (insertError) {
            console.error('[FeedbackRepository] Failed to capture feedback:', insertError);
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
