import { renderCandidateInvitedEntryRoute } from "./CandidateInvitedEntryRoute";

export const dynamic = "force-dynamic";
export const metadata = {
    title: "Your interview practice | Interview Coach",
    robots: { index: false, follow: false },
};

export default function CandidateInvitedEntryPage() {
    return renderCandidateInvitedEntryRoute();
}
