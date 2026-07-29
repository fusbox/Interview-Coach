"use client";

import Link from "next/link";
import { LayoutDashboard, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CandidatePrimaryNavigationProps = {
    activeDestination: "dashboard" | "setup";
};

const destinations = [
    {
        id: "dashboard" as const,
        href: "/candidate/dashboard",
        label: "Dashboard",
        Icon: LayoutDashboard,
    },
    {
        id: "setup" as const,
        href: "/candidate/setup",
        label: "New role",
        Icon: Plus,
    },
];

const DOCK_REVEAL_TOP = 24;
const DOCK_HIDE_AFTER = 80;
const DOCK_DIRECTION_THRESHOLD = 6;

export function CandidatePrimaryNavigation({
    activeDestination,
}: CandidatePrimaryNavigationProps) {
    const [isDockHidden, setIsDockHidden] = useState(false);
    const lastScrollYRef = useRef(0);

    useEffect(() => {
        const mobileDockQuery = window.matchMedia?.("(max-width: 719px)");
        lastScrollYRef.current = Math.max(window.scrollY, 0);

        function handleScroll() {
            const nextScrollY = Math.max(window.scrollY, 0);

            if (mobileDockQuery && !mobileDockQuery.matches) {
                setIsDockHidden(false);
                lastScrollYRef.current = nextScrollY;
                return;
            }

            const delta = nextScrollY - lastScrollYRef.current;

            if (nextScrollY <= DOCK_REVEAL_TOP) {
                setIsDockHidden(false);
                lastScrollYRef.current = nextScrollY;
                return;
            }

            if (Math.abs(delta) < DOCK_DIRECTION_THRESHOLD) {
                return;
            }

            setIsDockHidden(delta > 0 && nextScrollY > DOCK_HIDE_AFTER);
            lastScrollYRef.current = nextScrollY;
        }

        function handleViewportChange(event: MediaQueryListEvent) {
            if (!event.matches) {
                setIsDockHidden(false);
            }
            lastScrollYRef.current = Math.max(window.scrollY, 0);
        }

        window.addEventListener("scroll", handleScroll, { passive: true });
        mobileDockQuery?.addEventListener("change", handleViewportChange);
        return () => {
            window.removeEventListener("scroll", handleScroll);
            mobileDockQuery?.removeEventListener("change", handleViewportChange);
        };
    }, []);

    return (
        <nav
            className={isDockHidden
                ? "candidate-primary-navigation is-dock-hidden"
                : "candidate-primary-navigation"}
            aria-label="Candidate"
            data-dock-visibility={isDockHidden ? "hidden" : "visible"}
            onFocusCapture={() => setIsDockHidden(false)}
        >
            {destinations.map(({ id, href, label, Icon }) => {
                const isActive = id === activeDestination;
                return (
                    <Link
                        key={id}
                        className={isActive
                            ? "candidate-primary-navigation__link is-active"
                            : "candidate-primary-navigation__link"}
                        href={href}
                        aria-current={isActive ? "page" : undefined}
                    >
                        <Icon size={18} strokeWidth={isActive ? 2.4 : 2.2} aria-hidden="true" />
                        <span>{label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
