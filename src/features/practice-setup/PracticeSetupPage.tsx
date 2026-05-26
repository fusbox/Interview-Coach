import type { RestoredPracticeSetupDraft } from "@/lib/server/candidate";

import { PracticeSetupForm } from "./PracticeSetupForm";

type PracticeSetupPageProps = {
    restoredDraft?: RestoredPracticeSetupDraft | null;
};

export function PracticeSetupPage({ restoredDraft = null }: PracticeSetupPageProps) {
    return (
        <main className="w-full">
            <section className="mx-auto w-full max-w-5xl">
                <PracticeSetupForm
                    initialValues={restoredDraft?.initialValues ?? null}
                    practiceDraftId={restoredDraft?.practiceDraftId ?? null}
                />
            </section>
        </main>
    );
}
