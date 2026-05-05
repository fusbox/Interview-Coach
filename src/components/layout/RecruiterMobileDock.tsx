"use client";

import { useScroll, motion, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, List, Settings, LogOut, LayoutTemplate, BarChart3, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";
import type { AppUser } from "@/lib/auth/user";
import type { User } from "@supabase/supabase-js";
import { isAdmin, isQualityEvaluator } from "@/lib/auth/rbac";

export function RecruiterMobileDock({ user }: { user?: AppUser | User | null }) {
    const { scrollY } = useScroll();
    const [hidden, setHidden] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    useMotionValueEvent(scrollY, "change", (latest) => {
        const previous = scrollY.getPrevious() || 0;
        if (latest > previous && latest > 150) {
            setHidden(true);
        } else {
            setHidden(false);
        }
    });

    const isActive = (path: string) => {
        if (path === '/recruiter') {
            return pathname === '/recruiter' || pathname?.startsWith('/recruiter/sessions');
        }
        return pathname === path || pathname?.startsWith(`${path}/`);
    };

    const handleLogout = async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.refresh();
        router.push('/login');
    };

    const navItems = [
        { icon: Plus, label: "Create", href: "/recruiter/create" },
        { icon: List, label: "Invites & Sessions", href: "/recruiter" },
        { icon: LayoutTemplate, label: "Templates", href: "/recruiter/templates" },
        { icon: Settings, label: "Settings", href: "/recruiter/settings" },
    ];

    // Add Admin Feedback link if applicable
    if (isAdmin(user)) {
        navItems.push({ icon: BarChart3, label: "Feedback", href: "/admin/feedback" });
    }

    if (isQualityEvaluator(user)) {
        navItems.push({ icon: ClipboardCheck, label: "AI Quality", href: "/qa/ai-quality" });
    }

    return (
        <motion.div
            variants={{
                visible: { y: 0 },
                hidden: { y: "100%" },
            }}
            animate={hidden ? "hidden" : "visible"}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-6 md:hidden pointer-events-none"
        >
            <div className="mx-auto max-w-sm bg-surface-base/90 backdrop-blur-lg border shadow-lg rounded-2xl flex items-center justify-around p-2 pointer-events-auto">
                {navItems.map((item) => (
                    <Link
                        key={item.label}
                        href={item.href}
                        className={cn(
                            "p-3 rounded-xl transition-all duration-200 flex flex-col items-center gap-1",
                            isActive(item.href) && item.href !== '#'
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted"
                        )}
                        title={item.label}
                    >
                        <item.icon className="w-5 h-5" />
                        <span className="sr-only">{item.label}</span>
                    </Link>
                ))}

                {/* Logout Button in Dock */}
                <button
                    onClick={handleLogout}
                    className="p-3 rounded-xl transition-all duration-200 flex flex-col items-center gap-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Sign out"
                >
                    <LogOut className="w-5 h-5" />
                    <span className="sr-only">Sign out</span>
                </button>
            </div>
        </motion.div>
    );
}
