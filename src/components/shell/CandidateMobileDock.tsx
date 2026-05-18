"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { LayoutDashboard, Plus } from "lucide-react";

import { cn } from "@/lib/cn";

const navItems = [
    { icon: Plus, label: "Create Practice", href: "/practice" },
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
];

export function CandidateMobileDock() {
    const { scrollY } = useScroll();
    const [hidden, setHidden] = useState(false);
    const pathname = usePathname();

    useMotionValueEvent(scrollY, "change", (latest) => {
        const previous = scrollY.getPrevious() || 0;
        if (latest > previous && latest > 150) {
            setHidden(true);
        } else {
            setHidden(false);
        }
    });

    const isActive = (path: string) => pathname === path || pathname?.startsWith(`${path}/`);

    return (
        <motion.nav
            variants={{
                visible: { y: 0 },
                hidden: { y: "100%" },
            }}
            animate={hidden ? "hidden" : "visible"}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-6 md:hidden pointer-events-none"
            aria-label="Candidate navigation"
        >
            <div className="mx-auto max-w-sm bg-surface-base/90 backdrop-blur-lg border shadow-lg rounded-2xl flex items-center justify-around p-2 pointer-events-auto">
                {navItems.map((item) => (
                    <Link
                        key={item.label}
                        href={item.href}
                        className={cn(
                            "p-3 rounded-xl transition-all duration-200 flex flex-col items-center gap-1",
                            isActive(item.href)
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted",
                        )}
                        title={item.label}
                    >
                        <item.icon className="w-5 h-5" />
                        <span className="sr-only">{item.label}</span>
                    </Link>
                ))}
            </div>
        </motion.nav>
    );
}
