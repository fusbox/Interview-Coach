"use client";



import { SessionProvider } from '@/features/session/context/SessionContext';


// Internal component to consume context
function CandidateLayoutContent({ children }: { children: React.ReactNode }) {

    // We keep the padding logic for the main content area, as the session screen likely needs full width (p-0)
    // while other screens (like Initials or Intro) might need the padding.
    // However, the Initials screen in the previous view_file (InitialsScreen.tsx) has its own container with padding:
    // `className="w-full max-w-xl mx-auto px-6 py-12 md:py-24 space-y-12"`
    // And it has `min-h-[100dvh] ... overflow-y-auto`.
    // If CandidateLayout puts a wrapper with `p-4`, it might double up or constrain it.
    // Let's check `CandidateLayoutContent` again.
    // It has `min-h-screen bg-slate-50 flex`.
    // If we remove the sidebar, it's just `min-h-screen bg-slate-50`.

    // The Initials screen seems self-contained.
    // The Session screen seems self-contained (`h-screen ... relative overflow-hidden`).

    // If we look at `UnifiedSessionScreen.tsx`:
    // It returns `div className="flex flex-col h-screen ..."`

    // If `CandidateLayoutContent` adds padding, it might break the `h-screen` of the session.
    // So ensuring `p-0` for session is critical.

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
