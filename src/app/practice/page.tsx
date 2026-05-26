import { CandidateShell } from "@/components/shell/CandidateShell";
import { PracticeSetupPage } from "@/features/practice-setup";
import { loadPracticeSetupDraftForCurrentCandidate } from "@/lib/server/candidate";

type PracticePageProps = {
    searchParams?: Promise<{
        draftId?: string | string[];
    }>;
};

export default async function PracticePage({ searchParams }: PracticePageProps) {
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const selectedDraftId = Array.isArray(resolvedSearchParams.draftId)
        ? resolvedSearchParams.draftId[0]
        : resolvedSearchParams.draftId;
    const restoredDraft = await loadPracticeSetupDraftForCurrentCandidate(selectedDraftId);

    return (
        <CandidateShell>
            <PracticeSetupPage restoredDraft={restoredDraft} />
        </CandidateShell>
    );
}
