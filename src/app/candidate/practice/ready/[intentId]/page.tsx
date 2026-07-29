import CandidatePracticeIntentReadyRoute from "./CandidatePracticeIntentReadyRoute";
import { requireCurrentCandidatePageAccess } from "@/features/candidate-auth-v2/candidate-route-authorization";

type CandidatePracticeIntentReadyPageProps = {
    params: Promise<{ intentId: string }>;
};

export default async function CandidatePracticeIntentReadyPage(props: CandidatePracticeIntentReadyPageProps) {
    const { intentId } = await props.params;
    const { identity } = await requireCurrentCandidatePageAccess(
        `/candidate/practice/ready/${encodeURIComponent(intentId)}`,
    );
    return CandidatePracticeIntentReadyRoute({
        ...props,
        authorizedCandidateProfileId: identity.candidateProfileId,
    });
}
