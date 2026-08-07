import { redirect } from "next/navigation";

import { createAppAuthQueryClientFromEnv } from "@/features/app-auth-v2/app-auth-postgres-runtime";
import { AdminReportsAccessDenied } from "@/features/admin-reporting-v2/AdminReportsAccessDenied";
import { CandidateEngagementReportsExperience } from "@/features/admin-reporting-v2/CandidateEngagementReportsExperience";
import { getCurrentAdminAccess, type AdminAccess } from "@/features/admin-reporting-v2/current-admin-access";
import type { CandidateEngagementReportRow } from "@/features/candidate-engagement-v2/candidate-engagement-contract";
import { createCandidateEngagementRepository } from "@/features/candidate-engagement-v2/candidate-engagement-repository";
import { RecruiterShell } from "@/features/recruiter-auth-v2/RecruiterShell";

export async function renderAdminReportsRoute(dependencies: {
    resolveAccess?: () => Promise<AdminAccess>;
    loadEngagementRows?: () => Promise<CandidateEngagementReportRow[]>;
} = {}) {
    const access = await (dependencies.resolveAccess ?? getCurrentAdminAccess)();
    if (access.kind === "missing") redirect("/login?next=%2Fadmin%2Freports");
    if (access.kind === "forbidden") return <AdminReportsAccessDenied />;

    let rows: CandidateEngagementReportRow[] = [];
    let unavailable = false;
    try {
        rows = await (dependencies.loadEngagementRows ?? loadEngagementRows)();
    } catch (error) {
        console.warn("candidate_engagement_report_load_failed", {
            errorCode: error instanceof Error ? "data_load_failed" : "unknown_failure",
        });
        unavailable = true;
    }

    return (
        <RecruiterShell user={access.user}>
            <CandidateEngagementReportsExperience rows={rows} unavailable={unavailable} />
        </RecruiterShell>
    );
}

async function loadEngagementRows() {
    const repository = createCandidateEngagementRepository(createAppAuthQueryClientFromEnv());
    return repository.listAdminReport({ limit: 200 });
}
