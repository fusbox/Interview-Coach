import CandidateDashboardRoute from "./CandidateDashboardRoute";

type CandidateDashboardPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function CandidateDashboardPage(props: CandidateDashboardPageProps) {
    return CandidateDashboardRoute(props);
}
