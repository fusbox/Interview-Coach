import { getCachedUser } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { RecruiterSidebar } from "@/components/layout/RecruiterSidebar";
import { RecruiterMobileDock } from "@/components/layout/RecruiterMobileDock";
import { getRecruiterProfileSummary } from "@/lib/server/auth/recruiter-profile";

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await getCachedUser();

    // Strict Admin Guard
    if (!user || !isAdmin(user)) {
        redirect("/recruiter");
    }

    const profile = await getRecruiterProfileSummary(user.id);

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Desktop Sidebar */}
            <RecruiterSidebar
                className="hidden md:flex w-64 shrink-0"
                user={user}
                profile={profile}
            />

            {/* Mobile Dock */}
            <RecruiterMobileDock user={user} />

            {/* Main Content */}
            <main className="flex-1 w-full max-w-full overflow-hidden px-4 pb-24 pt-6 md:p-8 md:pb-8 md:pt-8">
                {children}
            </main>
        </div>
    );
}
