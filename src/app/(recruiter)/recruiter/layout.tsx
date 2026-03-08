import { createClient, getCachedUser } from '@/lib/supabase/server';
import { RecruiterSidebar } from '@/components/layout/RecruiterSidebar';
import { RecruiterMobileDock } from '@/components/layout/RecruiterMobileDock'; // New Dock
import { ProfileGuard } from '@/components/auth/ProfileGuard';
import { redirect } from 'next/navigation';

export default async function RecruiterLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = createClient();
    const user = await getCachedUser();

    if (!user) {
        redirect('/login');
    }

    const { data: profile } = await supabase
        .from('recruiter_profiles')
        .select('first_name, last_name, title')
        .eq('recruiter_id', user.id)
        .single();

    return (
        <div className="min-h-screen bg-surface-subtle flex">
            <ProfileGuard />
            {/* Desktop Sidebar: Hidden on mobile, visible on md+ */}
            <RecruiterSidebar
                className="hidden md:flex w-64 shrink-0"
                user={user}
                profile={profile}
            />

            {/* Mobile Dock: Visible on mobile, replaces sidebar */}
            <RecruiterMobileDock user={user} />

            {/* Main Content - Add bottom padding for dock on mobile */}
            <main className="flex-1 p-8 pt-8 w-full max-w-full overflow-hidden pb-24 md:pb-8">
                {children}
            </main>
        </div>
    )
}
