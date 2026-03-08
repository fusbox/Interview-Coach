"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/cn';

import { User } from '@supabase/supabase-js';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { isAdmin } from '@/lib/auth/rbac';

interface RecruiterProfile {
    first_name: string;
    last_name: string;
    title?: string;
}

interface RecruiterSidebarProps {
    className?: string;
    onNavigate?: () => void;
    user?: User | null;
    profile?: RecruiterProfile | null;
}

export function RecruiterSidebar({ className, onNavigate, user, profile }: RecruiterSidebarProps) {
    const pathname = usePathname();

    // Derived Data
    const displayName = profile?.first_name
        ? `${profile.first_name} ${profile.last_name || ''}`.trim()
        : "Recruiter";
    const displayEmail = user?.email || "recruiter@example.com";

    const isActive = (path: string) => {
        if (path === '/recruiter') {
            return pathname === '/recruiter' || pathname?.startsWith('/recruiter/sessions');
        }
        return pathname === path || pathname?.startsWith(`${path}/`);
    };

    return (
        <aside className={cn("bg-surface-base border-r flex flex-col h-screen sticky top-0", className)}>
            <div className="p-6 pb-0">
                <Link
                    href="/"
                    className="mb-8 flex items-center gap-3 hover:opacity-80 transition-opacity"
                    onClick={onNavigate}
                >
                    <div className="relative w-8 h-8">
                        <Image
                            src="/r2w-logo.webp"
                            alt="Ready2Work Logo"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                    <h1 className="font-bold text-xl tracking-tight font-display select-none">
                        <span className="text-primary">Ready</span>
                        <span className="text-brand-orange">2</span>
                        <span className="text-brand-deep">Work</span>
                    </h1>
                </Link>

                <div className="mb-6 pb-6 border-b">
                    <div className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-1 truncate" title={profile?.title || "Recruiter"}>
                        {profile?.title || "Recruiter"}
                    </div>
                    <div className="font-medium text-lg text-foreground truncate font-display" title={displayName}>
                        {displayName}
                    </div>
                </div>
            </div>

            <nav className="space-y-2 flex-1 px-6 overflow-y-auto">
                <Link
                    href="/recruiter/create"
                    className={cn(
                        "block p-2 rounded font-medium transition-all duration-200",
                        isActive('/recruiter/create')
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={onNavigate}
                >
                    Create Invite
                </Link>

                <Link
                    href="/recruiter"
                    className={cn(
                        "block p-2 rounded font-medium transition-all duration-200",
                        isActive('/recruiter')
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={onNavigate}
                >
                    Invites & Sessions
                </Link>

                <Link
                    href="/recruiter/templates"
                    className={cn(
                        "block p-2 rounded font-medium transition-all duration-200",
                        isActive('/recruiter/templates')
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={onNavigate}
                >
                    Templates
                </Link>

                <Link
                    href="/recruiter/settings"
                    className={cn(
                        "block p-2 rounded font-medium transition-all duration-200",
                        isActive('/recruiter/settings')
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={onNavigate}
                >
                    Settings
                </Link>

                {isAdmin(user) && (
                    <div className="pt-6 mt-6 border-t">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4 px-2">
                            Admin Portal
                        </div>
                        <Link
                            href="/admin/feedback"
                            className={cn(
                                "block p-2 rounded font-medium transition-all duration-200",
                                isActive('/admin/feedback')
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                            onClick={onNavigate}
                        >
                            User Feedback
                        </Link>
                    </div>
                )}
            </nav>

            <div className="p-6 mt-auto border-t">
                {/* Consistent Footer Structure */}
                <div className="flex items-start justify-between">
                    <div className="overflow-hidden mr-2">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Signed in as
                        </div>
                        <div className="text-sm font-medium text-foreground truncate" title={displayEmail}>
                            {displayEmail}
                        </div>
                    </div>
                    <LogoutButton className="w-auto h-auto p-2" collapsed />
                </div>
            </div>
        </aside>
    );
}
