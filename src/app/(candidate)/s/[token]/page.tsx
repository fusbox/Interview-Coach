import { notFound } from "next/navigation";
import { SupabaseInviteRepository } from "@/lib/server/infrastructure/supabase-invite-repository";
import InterviewSessionScreen from "@/features/session/components/InterviewSessionScreen";
import { pilotRollout } from "@/lib/config/pilot-rollout";

interface PageProps {
    params: Promise<{
        token: string;
    }>;
}

// Disable static generation for this dynamic route
export const dynamic = 'force-dynamic';

export default async function CandidateSessionPage({ params }: PageProps) {
    const { token } = await params;

    // Preserve the built-in demo token as a zero-dependency local/test entrypoint.
    // This keeps local browser smoke tests and manual UX checks off the real repository path.
    if (token === 'demo-invite-token') {
        return <InterviewSessionScreen initialConfig={{ role: 'Product Manager' }} />;
    }

    const repository = new SupabaseInviteRepository();
    const invite = await repository.getByToken(token);

    if (!invite) {
        notFound();
    }

    return (
        <InterviewSessionScreen
            sessionId={invite.id}
            candidateToken={token}
            initialConfig={{
                role: invite.role,
                jobDescription: invite.jobDescription
            }}
        />
    );
}

// Metadata for nice sharing
export async function generateMetadata() {
    return {
        title: "Your Interview Session",
        description: pilotRollout.enabled
            ? "Join a limited-pilot AI interview practice session."
            : "Join your personalized AI interview practice session."
    }
}
