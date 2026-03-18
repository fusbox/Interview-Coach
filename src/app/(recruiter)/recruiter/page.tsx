import { Button } from "@/components/ui/button";
import { getRecruiterSessions } from "./actions";
import Link from "next/link";
import { isAdmin } from "@/lib/auth/rbac";
import { Plus } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { RecruiterSessionsTable } from "./components/RecruiterSessionsTable";
import { SectionHeader } from "@/components/patterns/SectionHeader";
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

    const basicStats = computeDashboardStats(sessions);

    return (
        <div className="space-y-10">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <SectionHeader
                    title="Dashboard"
                    description="At-a-glance view of your hiring pipeline."
                    isPageHeader
                />

                <div className="flex-1 md:flex md:justify-center">
                    <DashboardStats metrics={basicStats} variant="header" />
                </div>

                <div className="hidden md:block shrink-0">
                    <Button asChild className="h-11 shadow-raised-1 rounded-2xl font-semibold">
                        <Link href="/recruiter/create">
                            <Plus className="w-4 h-4 mr-2" />
                            New Invite
                        </Link>
                    </Button>
                </div>
            </div>

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
        </div >
    );
}
