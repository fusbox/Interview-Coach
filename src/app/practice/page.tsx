import { PracticeSetupPage } from "@/features/practice-setup";
import { loadPracticeSetupDraftForCurrentCandidate } from "@/lib/server/candidate";

export default async function PracticePage() {
    const restoredDraft = await loadPracticeSetupDraftForCurrentCandidate();

    return <PracticeSetupPage restoredDraft={restoredDraft} />;
}
