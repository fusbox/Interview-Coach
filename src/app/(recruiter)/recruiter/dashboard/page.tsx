import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeaderBlock } from "@/components/patterns/PageHeaderBlock";
import { isAdmin } from "@/lib/auth/rbac";
import { E2E_RECRUITER_ID, getE2ERecruiterProfile, isServerE2EMode } from "@/lib/e2e/test-mode";
import { normalizeRecruiterSignature } from "@/lib/recruiter-signature";
import { getCachedUser } from "@/lib/server/auth/current-user";
import { getRecruiterProfileRecord } from "@/lib/server/auth/recruiter-profile";
import { computeDashboardStats } from "@/lib/services/compute-dashboard-stats";

import { getRecruiterSessions } from "../actions";
import { CollapsibleSection } from "../components/CollapsibleSection";
import { DashboardStats } from "../components/DashboardStats";
import { InviteProgressWidget } from "../components/InviteProgressWidget";
import { RecruiterSessionsTable } from "../components/RecruiterSessionsTable";

export const dynamic = "force-dynamic";

export default async function RecruiterDashboard() {
    const user = await getCachedUser();
    if (!user) {
        redirect("/login");
    }

    const isE2ERecruiter = isServerE2EMode() && user.id === E2E_RECRUITER_ID;
    const [sessions, profile] = await Promise.all([
        getRecruiterSessions(),
        isE2ERecruiter
            ? Promise.resolve(getE2ERecruiterProfile())
            : getRecruiterProfileRecord(user.id),
    ]);

    const recruiterTimezone = profile?.timezone ?? undefined;
    const recruiterName = [profile?.first_name, profile?.last_name]
        .filter((value): value is string => Boolean(value && value.trim()))
        .join(" ");
    const recruiterProfile = normalizeRecruiterSignature({
        name: recruiterName,
        title: profile?.title ?? undefined,
        company: profile && "company" in profile ? profile.company : undefined,
        phone: profile?.phone ?? undefined,
        email: profile && "email" in profile ? profile.email : user.email,
    });

    const basicStats = computeDashboardStats(sessions);

    return (
        <div className="space-y-10">
            <PageHeaderBlock
                title="Dashboard"
                description="At-a-glance view of your hiring pipeline."
                actions={
                    <Button asChild density="comfortable" shape="app" label="strong">
                        <Link href="/recruiter/create">
                            <Plus className="mr-2 h-4 w-4" />
                            New Invite
                        </Link>
                    </Button>
                }
            />

            <DashboardStats metrics={basicStats} variant="header" />

            <CollapsibleSection
                storageKey="invite_progress"
                title="Invite Progress"
                description="Aggregated pipeline summary"
            >
                <InviteProgressWidget
                    sessions={sessions}
                    recruiterProfile={recruiterProfile}
                    recruiterTimezone={recruiterTimezone}
                />
            </CollapsibleSection>

            <CollapsibleSection
                storageKey="manage_invites"
                title="Manage Invites"
                description="Detailed candidate-level tracking"
            >
                <RecruiterSessionsTable
                    initialSessions={sessions}
                    recruiterTimezone={recruiterTimezone}
                    recruiterProfile={recruiterProfile}
                    isAdmin={isAdmin(user)}
                />
            </CollapsibleSection>
        </div>
    );
}
