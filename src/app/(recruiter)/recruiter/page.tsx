import { Button } from "@/components/ui/button";
import { getRecruiterSessions } from "./actions";
import Link from "next/link";
import { isAdmin } from "@/lib/auth/rbac";
import { Plus } from "lucide-react";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { RecruiterSessionsTable } from "./components/RecruiterSessionsTable";
import { DashboardStats } from "./components/DashboardStats";
import { InviteProgressWidget } from "./components/InviteProgressWidget";
import { CollapsibleSection } from "./components/CollapsibleSection";
import { redirect } from "next/navigation";
import { computeDashboardStats } from "@/lib/services/compute-dashboard-stats";
export const dynamic = 'force-dynamic';

export default async function RecruiterDashboard() {
    const user = await getCachedUser();
    if (!user) redirect("/login");

    const [sessions, profileData] = await Promise.all([
        getRecruiterSessions(),
        createClient().from('recruiter_profiles').select('timezone, full_name, title, company, phone, email').eq('recruiter_id', user.id).single()
    ]);

    const recruiterTimezone = profileData.data?.timezone;
    const recruiterProfile = {
        name: profileData.data?.full_name || user.email || '',
        title: profileData.data?.title || 'Recruiter',
        company: profileData.data?.company || 'Rangam Consultants Inc.',
        phone: profileData.data?.phone || '',
        email: profileData.data?.email || user.email || '',
    };

    // Derive basic stats from the already-fetched sessions
    const basicStats = computeDashboardStats(sessions);

    return (
        <div className="space-y-10">
            <SectionHeader
                title="Dashboard"
                size="lg"
                description="At-a-glance view of your hiring pipeline."
                actions={
                    <Button asChild className="h-11 shadow-raised-1 rounded-2xl font-semibold">
                        <Link href="/recruiter/create">
                            <Plus className="w-4 h-4 mr-2" />
                            New Invite
                        </Link>
                    </Button>
                }
            />

            {/* High Level Stats */}
            <DashboardStats metrics={basicStats} />

            {/* Invite Progress — collapsible, persisted */}
            <CollapsibleSection
                storageKey="invite_progress"
                title="Invite Progress"
            >
                <InviteProgressWidget sessions={sessions} recruiterProfile={recruiterProfile} />
            </CollapsibleSection>

            {/* Manage Invites — collapsible, persisted */}
            <CollapsibleSection
                storageKey="manage_invites"
                title="Manage Invites"
                trailing={
                    <span className="text-sm text-text-secondary">
                        Track individual candidate progress.
                    </span>
                }
            >
                <RecruiterSessionsTable
                    initialSessions={sessions}
                    recruiterTimezone={recruiterTimezone}
                    recruiterProfile={recruiterProfile}
                    isAdmin={isAdmin(user)}
                />
            </CollapsibleSection>
        </div >
    );
}
