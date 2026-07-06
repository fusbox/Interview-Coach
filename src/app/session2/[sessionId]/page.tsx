import { V2RouteShell } from "@/features/candidate-v2/V2RouteShell";
import {
    createCandidateSessionCompletionLinks,
    createSharedSessionContext,
    parseSessionId,
    resolveSessionCompletionTarget,
} from "@/features/session-v2/session-domain";

export default async function Session2Page({ params }: { params: Promise<{ sessionId: string }> }) {
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
            title="Practice session V2"
            description={`This route will host the rebuilt shared session runtime for session ${sessionId}.`}
        >
            <div className="candidate-v2-action-stack">
                <p className="type-body-sm candidate-v2-muted-copy">
                    When this round is finished, the dashboard is the next stop.
                </p>
                <a className="candidate-v2-primary-action" href={completionTarget.href}>
                    {completionTarget.label}
                </a>
            </div>
        </V2RouteShell>
    );
}
