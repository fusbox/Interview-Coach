import CandidateDashboardRoute from "./CandidateDashboardRoute";
import {
    createCandidateReturnPath,
    requireCurrentCandidatePageAccess,
} from "@/features/candidate-auth-v2/candidate-route-authorization";

type CandidateDashboardPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CandidateDashboardPage(props: CandidateDashboardPageProps) {
    const { identity } = await requireCurrentCandidatePageAccess(
        createCandidateReturnPath("/candidate/dashboard", await props.searchParams),
    );
    return CandidateDashboardRoute({
        ...props,
        authorizedCandidateProfileId: identity.candidateProfileId,
        showAccountLogout: identity.accessSource === "app_account",
    });
}
