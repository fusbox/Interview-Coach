import { notFound } from "next/navigation";
import { SupabaseInviteRepository } from "@/lib/server/infrastructure/supabase-invite-repository";
import InterviewSessionScreen from "@/features/session/components/InterviewSessionScreen";

interface PageProps {
    params: Promise<{
        token: string;
    }>;
}

// Disable static generation for this dynamic route
export const dynamic = 'force-dynamic';

export default async function CandidateSessionPage({ params }: PageProps) {
    const { token } = await params;
    const repository = new SupabaseInviteRepository();
    const invite = await repository.getByToken(token);

    if (!invite) {
        // Fallback for "demo-invite-token" for dev convenience if not in repo
        if (token === 'demo-invite-token') {
            return <InterviewSessionScreen initialConfig={{ role: 'Product Manager' }} />;
        }
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
        description: "Join your personalized AI interview practice session."
    }
}
