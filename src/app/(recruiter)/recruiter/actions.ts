"use server";

import { getCachedUser } from "@/lib/supabase/server";
import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { redirect } from "next/navigation";
import { SessionSummary } from "@/lib/domain/types";
import { revalidatePath } from "next/cache";

const sessionRepo = new SupabaseSessionRepository();

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
