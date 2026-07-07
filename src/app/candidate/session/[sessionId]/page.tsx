import { V2RouteShell } from "@/features/candidate-v2/V2RouteShell";
import {
    createCandidateSessionCompletionLinks,
    createSharedSessionContext,
    parseSessionId,
    resolveSessionCompletionTarget,
} from "@/features/session-v2/session-domain";

export default async function CandidateSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    const parsedSessionId = parseSessionId(sessionId);
    const sessionContext = createSharedSessionContext({
        sessionId: parsedSessionId,
        audience: "candidate_owned",
        candidateCompletionLinks: createCandidateSessionCompletionLinks(parsedSessionId),
    });
    const completionTarget = resolveSessionCompletionTarget(sessionContext);

    return (
        <V2RouteShell
            title="Practice session"
            description={`This route will host the rebuilt shared session runtime for session ${sessionId}.`}
        >
            <div className="action-stack">
                <p className="type-body-sm muted-copy">
                    When this round is finished, the dashboard is the next stop.
                </p>
                <a className="primary-action" href={completionTarget.href}>
                    {completionTarget.label}
                </a>
            </div>
        </V2RouteShell>
    );
}
