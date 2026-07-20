import type { CandidatePracticeReadySearchParams } from "@/features/candidate-practice-v2/candidate-follow-up-practice-intent";

import CandidatePracticeReadyRoute from "./CandidatePracticeReadyRoute";

type CandidatePracticeReadyPageProps = {
    searchParams: Promise<CandidatePracticeReadySearchParams>;
};

export default function CandidatePracticeReadyPage(props: CandidatePracticeReadyPageProps) {
    return CandidatePracticeReadyRoute(props);
}
