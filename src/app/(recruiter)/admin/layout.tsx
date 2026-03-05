import { createClient, getCachedUser } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { RecruiterSidebar } from "@/components/layout/RecruiterSidebar";
import { RecruiterMobileDock } from "@/components/layout/RecruiterMobileDock";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = createClient();
    const user = await getCachedUser();

    // Strict Admin Guard
    if (!user || !isAdmin(user)) {
        redirect("/recruiter");
    }

    const { data: profile } = await supabase
        .from('recruiter_profiles')
        .select('first_name, last_name, title')
        .eq('recruiter_id', user.id)
        .single();

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
            <main className="flex-1 p-8 pt-8 w-full max-w-full overflow-hidden pb-24 md:pb-8">
                {children}
            </main>
        </div>
    );
}
