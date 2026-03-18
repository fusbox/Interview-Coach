import { SupabaseInviteRepository } from "@/lib/server/infrastructure/supabase-invite-repository";
import { CandidateLayoutClient } from "./CandidateLayoutClient";

export default async function CandidateTokenLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    const repository = new SupabaseInviteRepository();
    const invite = await repository.getByToken(token);

    // For "demo-invite-token" fallback:
    let initialConfig = undefined;
    let sessionId = undefined;

    if (invite) {
        sessionId = invite.id;
        initialConfig = {
            role: invite.role,
            jobDescription: invite.jobDescription,
            candidate: invite.candidate
        };
    } else if (token === 'demo-invite-token') {
        initialConfig = { role: 'Product Manager' };
    }

    return (
        <CandidateLayoutClient
            sessionId={sessionId}
            candidateToken={token}
            initialConfig={initialConfig}
        >
            {children}
        </CandidateLayoutClient>
    );
}
