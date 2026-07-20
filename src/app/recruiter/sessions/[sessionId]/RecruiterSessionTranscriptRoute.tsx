import { notFound, redirect } from "next/navigation";

import { RecruiterAccessDenied } from "@/features/recruiter-auth-v2/RecruiterAccessDenied";
import { getCurrentRecruiterAccess, type RecruiterAccess } from "@/features/recruiter-auth-v2/current-recruiter-access";
import { createRecruiterAuthQueryClientFromEnv } from "@/features/recruiter-auth-v2/recruiter-auth-postgres-runtime";
import { RecruiterInvitedTranscriptExperience } from "@/features/recruiter-invites-v2/RecruiterInvitedTranscriptExperience";
import { createRecruiterInvitedTranscriptReadModel, type RecruiterInvitedTranscriptFact } from "@/features/recruiter-invites-v2/recruiter-invited-transcript-read-model";
import { createRecruiterInvitedTranscriptRepository } from "@/features/recruiter-invites-v2/recruiter-invited-transcript-repository";

export async function renderRecruiterSessionTranscriptRoute({
    params,
    resolveAccess = getCurrentRecruiterAccess,
    loadTranscriptFact = loadOwnedTranscriptFact,
}: {
    params: Promise<{ sessionId: string }> | { sessionId: string };
    resolveAccess?: () => Promise<RecruiterAccess>;
    loadTranscriptFact?: (recruiterId: string, sessionId: string) => Promise<RecruiterInvitedTranscriptFact | null>;
}) {
    const { sessionId } = await params;
    const access = await resolveAccess();
    if (access.kind === "missing") {
        const next = encodeURIComponent(`/recruiter/sessions/${sessionId}`);
        redirect(`/login?next=${next}`);
    }
    if (access.kind === "forbidden") return <RecruiterAccessDenied />;

    const fact = await loadTranscriptFact(access.user.id, sessionId);
    if (!fact) notFound();

    return <RecruiterInvitedTranscriptExperience model={createRecruiterInvitedTranscriptReadModel(fact)} />;
}

async function loadOwnedTranscriptFact(recruiterId: string, sessionId: string) {
    const client = createRecruiterAuthQueryClientFromEnv();
    return createRecruiterInvitedTranscriptRepository(client).findOwnedTranscriptFact(recruiterId, sessionId);
}
