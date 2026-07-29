import type { CandidatePracticeReadySearchParams } from "@/features/candidate-practice-v2/candidate-follow-up-practice-intent";
import {
    createCandidateReturnPath,
    requireCurrentCandidatePageAccess,
} from "@/features/candidate-auth-v2/candidate-route-authorization";

import CandidatePracticeReadyRoute from "./CandidatePracticeReadyRoute";

type CandidatePracticeReadyPageProps = {
    searchParams: Promise<CandidatePracticeReadySearchParams>;
};

export default async function CandidatePracticeReadyPage(props: CandidatePracticeReadyPageProps) {
    const { identity } = await requireCurrentCandidatePageAccess(
        createCandidateReturnPath(
            "/candidate/practice/ready",
            await props.searchParams,
        ),
    );
    return CandidatePracticeReadyRoute({
        ...props,
        authorizedCandidateProfileId: identity.candidateProfileId,
    });
}
