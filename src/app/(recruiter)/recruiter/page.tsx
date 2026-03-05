import { Button } from "@/components/ui/button";
import { getRecruiterSessions, getRecruiterInsights } from "./actions";
import Link from "next/link";
import { Plus } from "lucide-react";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { RecruiterSessionsTable } from "./components/RecruiterSessionsTable";
import { DashboardStats } from "./components/DashboardStats";
import { CurrentBaselineBlock } from "./components/CurrentBaselineBlock";
import { CoachingFocusCard } from "./components/CoachingFocusCard";
import { TopOpportunitiesCard } from "./components/TopOpportunitiesCard";
import { InviteProgressWidget } from "./components/InviteProgressWidget";
import { CollapsibleSection } from "./components/CollapsibleSection";
import { redirect } from "next/navigation";
import { computeDashboardStats } from "@/lib/services/compute-dashboard-stats";

export const dynamic = 'force-dynamic';

export default async function RecruiterDashboard() {
    const user = await getCachedUser();
    if (!user) redirect("/login");

    // Single session fetch + separate evals query (no duplicate sessions query)
    const [sessions, insights, profileData] = await Promise.all([
        getRecruiterSessions(),
        getRecruiterInsights(),
        createClient().from('recruiter_profiles').select('timezone').eq('recruiter_id', user.id).single()
    ]);

    const recruiterTimezone = profileData.data?.timezone;

    // Derive basic stats from the already-fetched sessions
    const basicStats = computeDashboardStats(sessions);

    // Merge into full metrics shape for existing components
    const metrics = {
        ...basicStats,
        ...insights,
    };

    const inviteCountBadge = (
        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
            {sessions.length} invite{sessions.length !== 1 ? 's' : ''}
        </span>
    );

    return (
        <div className="space-y-10">
            <SectionHeader
                title="Dashboard"
                size="lg"
                description="At-a-glance view of your hiring pipeline and coaching impact."
                actions={
                    <Button asChild className="shadow-md">
                        <Link href="/recruiter/create">
                            <Plus className="w-4 h-4 mr-2" />
                            New Invite
                        </Link>
                    </Button>
                }
            />

            {/* Top Baseline Header */}
            <CurrentBaselineBlock
                metrics={metrics}
                recruiterEmail={user.email || ''}
            />

            {/* High Level Stats */}
            <DashboardStats metrics={metrics} />

            {/* Invite Progress — collapsible, persisted */}
            <CollapsibleSection
                storageKey="invite_progress"
                title="Invite Progress"
                trailing={inviteCountBadge}
            >
                <InviteProgressWidget sessions={sessions} />
            </CollapsibleSection>

            {/* Coaching Trends — collapsible, persisted */}
            <CollapsibleSection
                storageKey="coaching_trends"
                title="Coaching Trends"
            >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <CoachingFocusCard metrics={metrics} />
                    <TopOpportunitiesCard metrics={metrics} />
                </div>
            </CollapsibleSection>

            {/* Manage Invites — collapsible, persisted */}
            <CollapsibleSection
                storageKey="manage_invites"
                title="Manage Invites"
                trailing={
                    <span className="text-sm text-slate-500">
                        Track individual candidate progress and readiness scores.
                    </span>
                }
            >
                <RecruiterSessionsTable
                    initialSessions={sessions}
                    recruiterTimezone={recruiterTimezone}
                />
            </CollapsibleSection>
        </div>
    );
}
