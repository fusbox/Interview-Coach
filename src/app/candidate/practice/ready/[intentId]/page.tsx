import CandidatePracticeIntentReadyRoute from "./CandidatePracticeIntentReadyRoute";

type CandidatePracticeIntentReadyPageProps = {
    params: Promise<{ intentId: string }>;
};

export default function CandidatePracticeIntentReadyPage(props: CandidatePracticeIntentReadyPageProps) {
    return CandidatePracticeIntentReadyRoute(props);
}
