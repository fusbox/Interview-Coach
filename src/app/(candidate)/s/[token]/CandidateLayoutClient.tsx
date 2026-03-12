"use client";

import { SessionProvider } from '@/features/session/context/SessionContext';

// Internal component to consume context
function CandidateLayoutContent({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex flex-col">
            <main className="flex-1 p-0">
                {children}
            </main>
        </div>
    );
}

interface CandidateLayoutClientProps {
    children: React.ReactNode;
    sessionId?: string;
    candidateToken?: string;
    initialConfig?: {
        role: string;
        jobDescription?: string;
        candidate?: {
            firstName: string;
            lastName: string;
            email: string;
        }
    };
}

export function CandidateLayoutClient({ children, sessionId, candidateToken, initialConfig }: CandidateLayoutClientProps) {
    // TEST CRASH

    return (
        <SessionProvider sessionId={sessionId} candidateToken={candidateToken} initialConfig={initialConfig}>
            <CandidateLayoutContent>
                {children}
            </CandidateLayoutContent>
        </SessionProvider>
    );
}
