import CandidateSessionRoute from "./CandidateSessionRoute";

type CandidateSessionPageProps = {
    params: Promise<{ sessionId: string }>;
    searchParams: Promise<{ entry?: string | string[] }>;
};

export default function CandidateSessionPage(props: CandidateSessionPageProps) {
    return CandidateSessionRoute(props);
}
