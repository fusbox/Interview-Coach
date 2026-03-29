"use server";

import { SupabaseFeedbackRepository, FeedbackRecord } from "@/lib/server/infrastructure/supabase-feedback-repository";
import { getCachedUser } from "@/lib/supabase/server";

export async function captureFeedbackAction(record: FeedbackRecord) {
    try {
        const feedbackRepo = new SupabaseFeedbackRepository();

        // If it's a recruiter-side signal, try to associate the recruiter ID
        if (record.type.startsWith('recruiter_')) {
            const user = await getCachedUser();
            if (user) {
                record.recruiterId = user.id;
            }
        }

        await feedbackRepo.capture(record);
        return { success: true };
    } catch (error) {
        console.error('[FeedbackAction] Error:', error);
        return { success: false, error: 'Internal server error' };
    }
}
