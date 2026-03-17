import { createClient } from "@/lib/supabase/server";
import { Logger } from "@/lib/logger";

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
            Logger.warn("Feedback upsert failed; falling back to insert", {
                error,
                errorCode: "FEEDBACK_UPSERT_FALLBACK"
            }, "FeedbackRepository");
        }

        const { error: insertError } = await this.supabase
            .from('user_feedback')
            .insert(payload);

        if (insertError) {
            Logger.error("Failed to capture feedback", {
                error: insertError,
                errorCode: "FEEDBACK_INSERT_FAILED"
            }, "FeedbackRepository");
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
