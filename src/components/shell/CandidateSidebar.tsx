"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, LayoutDashboard, Plus } from "lucide-react";

import { cn } from "@/lib/cn";

export function CandidateSidebar() {
    const pathname = usePathname();
    const isCreateActive = pathname === "/practice" || pathname?.startsWith("/practice/");
    const isDashboardActive = pathname === "/dashboard" || pathname?.startsWith("/dashboard/");

    return (
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-surface-base px-6 py-6 md:flex">
            <div className="pb-8">
                <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
                    <div className="relative h-8 w-36">
                        <Image
                            src="/TA-logo.webp"
                            alt="TalentArbor"
                            fill
                            className="object-contain"
                            priority
                            unoptimized
                        />
                    </div>
                </Link>
            </div>

            <nav className="flex-1 space-y-8 overflow-y-auto py-4">
                <div className="space-y-3">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Link
                            href="/practice"
                            className={cn(
                                "flex items-center gap-3 p-4 rounded-2xl transition-all duration-300 border shadow-sm group relative overflow-hidden",
                                isCreateActive
                                    ? "glass-card border-primary/20 text-primary shadow-md"
                                    : "bg-surface-base border-primary/10 hover:border-primary/30 text-primary hover:text-primary",
                            )}
                        >
                            <div
                                className={cn(
                                    "p-1.5 rounded-lg transition-colors",
                                    isCreateActive ? "bg-primary/10" : "bg-primary/5 group-hover:bg-primary/10",
                                )}
                            >
                                <Plus size={18} strokeWidth={2.5} className="text-primary" />
                            </div>
                            <span className="font-bold">Create Practice</span>
                            <ChevronRight size={14} className="ml-auto -translate-x-2 text-primary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                        </Link>
                    </motion.div>
                </div>

                <div className="space-y-1">
                    <Link
                        href="/dashboard"
                        className={cn(
                            "flex items-center gap-3 p-2.5 rounded-xl font-medium transition-all duration-200 group",
                            isDashboardActive
                                ? "bg-primary/10 text-primary"
                                : "text-text-muted hover:bg-surface-subtle hover:text-text-primary",
                        )}
                    >
                        <LayoutDashboard
                            size={18}
                            className={cn(
                                "transition-colors",
                                isDashboardActive ? "text-primary" : "text-text-muted group-hover:text-text-primary",
                            )}
                        />
                        <span>Dashboard</span>
                    </Link>
                </div>
            </nav>
        </aside>
    );
}
