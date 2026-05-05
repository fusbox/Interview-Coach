import { getCachedUser } from '@/lib/supabase/server';
import { RecruiterSidebar } from '@/components/layout/RecruiterSidebar';
import { RecruiterMobileDock } from '@/components/layout/RecruiterMobileDock';
import { ProfileGuard } from '@/components/auth/ProfileGuard';
import { RecruiterTourProvider } from '@/features/tours/recruiter-tour-provider';
import { redirect } from 'next/navigation';
import { E2E_RECRUITER_ID, getE2ERecruiterProfile, isServerE2EMode } from '@/lib/e2e/test-mode';
import { getRecruiterProfileSummary } from '@/lib/server/auth/recruiter-profile';

export const dynamic = 'force-dynamic';

export default async function RecruiterLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await getCachedUser();

    if (!user) {
        redirect('/login');
    }

    const profile = isServerE2EMode() && user.id === E2E_RECRUITER_ID
        ? getE2ERecruiterProfile()
        : await getRecruiterProfileSummary(user.id);

    return (
        <div className="min-h-screen bg-surface-subtle flex">
            <RecruiterTourProvider>
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
            </RecruiterTourProvider>
        </div>
    )
}
