import { createClient, getCachedUser } from '@/lib/supabase/server';
import { RecruiterSidebar } from '@/components/layout/RecruiterSidebar';
import { RecruiterMobileDock } from '@/components/layout/RecruiterMobileDock';
import { ProfileGuard } from '@/components/auth/ProfileGuard';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

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
            <RecruiterSidebar
                className="hidden md:flex w-64 shrink-0"
                user={user}
                profile={profile}
            />

            <RecruiterMobileDock user={user} />

            <main className="flex-1 w-full max-w-full overflow-hidden px-4 pb-24 pt-6 md:p-8 md:pb-8 md:pt-8">
                {children}
            </main>
        </div>
    )
}
