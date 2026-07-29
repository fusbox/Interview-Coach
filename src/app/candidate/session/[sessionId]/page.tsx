import CandidateSessionRoute from "./CandidateSessionRoute";
import {
    createCandidateReturnPath,
    requireCurrentCandidatePageAccess,
} from "@/features/candidate-auth-v2/candidate-route-authorization";

type CandidateSessionPageProps = {
    params: Promise<{ sessionId: string }>;
    searchParams: Promise<{ entry?: string | string[] }>;
};

export default async function CandidateSessionPage(props: CandidateSessionPageProps) {
    const { sessionId } = await props.params;
    const { identity } = await requireCurrentCandidatePageAccess(
        createCandidateReturnPath(
            `/candidate/session/${encodeURIComponent(sessionId)}`,
            await props.searchParams,
        ),
    );
    return CandidateSessionRoute({
        ...props,
        authorizedCandidateProfileId: identity.candidateProfileId,
    });
}
