"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/cn';

import { User } from '@supabase/supabase-js';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { isAdmin } from '@/lib/auth/rbac';
import { Plus, List, LayoutTemplate, Settings, BarChart3, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

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
                            unoptimized
                        />
                    </div>
                    <h1 className="font-bold text-xl font-display select-none">
                        <span className="text-primary">Ready</span>
                        <span className="text-brand-orange">2</span>
                        <span className="text-brand-deep">Work</span>
                    </h1>
                </Link>

                <div className="mb-6 pb-6 border-b">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1 truncate" title={profile?.title || "Recruiter"}>
                        {profile?.title || "Recruiter"}
                    </div>
                    <div className="font-medium text-lg text-foreground truncate font-display" title={displayName}>
                        {displayName}
                    </div>
                </div>
            </div>

            <nav className="flex-1 px-6 overflow-y-auto py-4 space-y-8">
                {/* 1. Primary Action Section */}
                <div className="space-y-3">
                    <div className="px-2 text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">
                        Quick Actions
                    </div>
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <Link
                            href="/recruiter/create"
                            className={cn(
                                "flex items-center gap-3 p-4 rounded-2xl transition-all duration-300 border shadow-sm group relative overflow-hidden",
                                isActive('/recruiter/create')
                                    ? "glass-card border-primary/20 text-primary shadow-md"
                                    : "bg-surface-base border-primary/10 hover:border-primary/30 text-primary/60 hover:text-primary"
                            )}
                            onClick={onNavigate}
                        >
                            <div className={cn(
                                "p-1.5 rounded-lg transition-colors",
                                isActive('/recruiter/create') ? "bg-primary/10" : "bg-primary/5 group-hover:bg-primary/10"
                            )}>
                                <Plus size={18} strokeWidth={2.5} className={cn(isActive('/recruiter/create') ? "text-primary" : "text-primary/70 group-hover:text-primary")} />
                            </div>
                            <span className="font-bold">Create Invite</span>
                            <ChevronRight size={14} className="ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary/40" />
                        </Link>
                    </motion.div>
                </div>

                {/* 2. Main Navigation */}
                <div className="space-y-1">
                    <div className="px-2 mb-3 text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">
                        Navigation
                    </div>

                    <Link
                        href="/recruiter"
                        className={cn(
                            "flex items-center gap-3 p-2.5 rounded-xl font-medium transition-all duration-200 group",
                            isActive('/recruiter')
                                ? "bg-primary/10 text-primary"
                                : "text-text-muted hover:bg-surface-subtle hover:text-text-primary"
                        )}
                        onClick={onNavigate}
                    >
                        <List size={18} className={cn("transition-colors", isActive('/recruiter') ? "text-primary" : "text-text-muted group-hover:text-text-primary")} />
                        <span>Invites & Sessions</span>
                    </Link>

                    <Link
                        href="/recruiter/templates"
                        className={cn(
                            "flex items-center gap-3 p-2.5 rounded-xl font-medium transition-all duration-200 group",
                            isActive('/recruiter/templates')
                                ? "bg-primary/10 text-primary"
                                : "text-text-muted hover:bg-surface-subtle hover:text-text-primary"
                        )}
                        onClick={onNavigate}
                    >
                        <LayoutTemplate size={18} className={cn("transition-colors", isActive('/recruiter/templates') ? "text-primary" : "text-text-muted group-hover:text-text-primary")} />
                        <span>Templates</span>
                    </Link>

                    <Link
                        href="/recruiter/settings"
                        className={cn(
                            "flex items-center gap-3 p-2.5 rounded-xl font-medium transition-all duration-200 group",
                            isActive('/recruiter/settings')
                                ? "bg-primary/10 text-primary"
                                : "text-text-muted hover:bg-surface-subtle hover:text-text-primary"
                        )}
                        onClick={onNavigate}
                    >
                        <Settings size={18} className={cn("transition-colors", isActive('/recruiter/settings') ? "text-primary" : "text-text-muted group-hover:text-text-primary")} />
                        <span>Settings</span>
                    </Link>
                </div>

                {isAdmin(user) && (
                    <div className="space-y-1">
                        <div className="px-2 mb-3 text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">
                            Admin Portal
                        </div>
                        <Link
                            href="/admin/feedback"
                            className={cn(
                                "flex items-center gap-3 p-2.5 rounded-xl font-medium transition-all duration-200 group",
                                isActive('/admin/feedback')
                                    ? "bg-primary/10 text-primary"
                                    : "text-text-muted hover:bg-surface-subtle hover:text-text-primary"
                            )}
                            onClick={onNavigate}
                        >
                            <BarChart3 size={18} className={cn("transition-colors", isActive('/admin/feedback') ? "text-primary" : "text-text-muted group-hover:text-text-primary")} />
                            <span>User Feedback</span>
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
