"use server";

import { getCachedUser } from "@/lib/supabase/server";
import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { redirect } from "next/navigation";
import { SessionSummary } from "@/lib/domain/types";
import { revalidatePath } from "next/cache";

const sessionRepo = new SupabaseSessionRepository();

/**
 * @deprecated Use `getRecruiterInsights()` + `computeDashboardStats()` instead.
 * This function re-fetches sessions redundantly. Kept for backward compatibility.
 */
export async function getRecruiterMetrics() {
    const user = await getCachedUser();
    if (!user) redirect("/login");
    return sessionRepo.getDashboardMetrics(user.id);
}

/**
 * Fetch only eval-derived coaching insights (no duplicate session query).
 * Basic stats (totalInvites, activeSessions, etc.) are computed client-side
 * from the SessionSummary[] returned by getRecruiterSessions().
 */
export async function getRecruiterInsights() {
    const user = await getCachedUser();
    if (!user) redirect("/login");
    return sessionRepo.getEvalInsights(user.id);
}

export async function getRecruiterSessions(): Promise<SessionSummary[]> {
    const user = await getCachedUser();

    if (!user) {
        redirect("/login");
    }

    try {
        const allSessions = await sessionRepo.listByRecruiter(user.id);

        // Map to quickly find parent sessions
        const sessionMap = new Map<string, SessionSummary>(allSessions.map(s => [s.id, s]));

        // Resolve "Anonymous Candidate" for children from their parents
        const resolvedSessions = allSessions.map(s => {
            if (s.candidateName === "Anonymous Candidate" && s.parentSessionId) {
                const parent = sessionMap.get(s.parentSessionId);
                if (parent) {
                    return { ...s, candidateName: parent.candidateName };
                }
            }
            return s;
        });

        // Sort by creation date (newest first)
        return resolvedSessions.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
        console.error("Failed to fetch sessions:", error);
        return [];
    }
}

export async function deleteSession(sessionId: string) {
    const user = await getCachedUser();
    if (!user) throw new Error("Unauthorized");

    try {
        await sessionRepo.delete(sessionId);
        revalidatePath("/recruiter");
    } catch (error) {
        console.error("Failed to delete session:", error);
        throw error;
    }
}
