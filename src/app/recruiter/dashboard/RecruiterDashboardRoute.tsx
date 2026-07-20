import { redirect } from "next/navigation";

import { RecruiterAccessDenied } from "@/features/recruiter-auth-v2/RecruiterAccessDenied";
import { getCurrentRecruiterAccess, type RecruiterAccess } from "@/features/recruiter-auth-v2/current-recruiter-access";
import { createRecruiterAuthQueryClientFromEnv } from "@/features/recruiter-auth-v2/recruiter-auth-postgres-runtime";
import { RecruiterDashboardExperience } from "@/features/recruiter-invites-v2/RecruiterDashboardExperience";
import { createRecruiterDashboardReadModel, type RecruiterDashboardRecipientFact } from "@/features/recruiter-invites-v2/recruiter-dashboard-read-model";
import { createRecruiterDashboardRepository } from "@/features/recruiter-invites-v2/recruiter-dashboard-repository";

export async function renderRecruiterDashboardRoute(dependencies: {
    resolveAccess?: () => Promise<RecruiterAccess>;
    loadRecipientFacts?: (recruiterId: string) => Promise<RecruiterDashboardRecipientFact[]>;
} = {}) {
    const access = await (dependencies.resolveAccess ?? getCurrentRecruiterAccess)();
    if (access.kind === "missing") redirect("/login?next=%2Frecruiter%2Fdashboard");
    if (access.kind === "forbidden") return <RecruiterAccessDenied />;

    const loadRecipientFacts = dependencies.loadRecipientFacts ?? loadOwnedRecipientFacts;
    const facts = await loadRecipientFacts(access.user.id);
    return <RecruiterDashboardExperience model={createRecruiterDashboardReadModel(facts)} />;
}

async function loadOwnedRecipientFacts(recruiterId: string) {
    const client = createRecruiterAuthQueryClientFromEnv();
    return createRecruiterDashboardRepository(client).listOwnedRecipientFacts(recruiterId);
}
