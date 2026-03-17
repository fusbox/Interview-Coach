"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// ---------------------------------------------------------------------------
// localStorage helpers — safe for SSR (no-op on server)
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = "dashboard_section_";

function readPersistedState(key: string, fallback: boolean): boolean {
    if (typeof window === "undefined") return fallback;
    try {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
        return raw === null ? fallback : raw === "1";
    } catch {
        return fallback;
    }
}

function persistState(key: string, open: boolean): void {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(`${STORAGE_PREFIX}${key}`, open ? "1" : "0");
    } catch {
        // quota exceeded or private browsing — silent fail
    }
}

// ---------------------------------------------------------------------------
// CollapsibleSection
// ---------------------------------------------------------------------------

interface CollapsibleSectionProps {
    /** Stable key used for localStorage persistence (e.g. "invite_progress"). */
    storageKey: string;
    /** Section heading text. */
    title: string;
    /** Optional trailing element next to the title (e.g. badge or count). */
    trailing?: React.ReactNode;
    /** Optional secondary text next to the title. */
    description?: string;
    /** Whether the section starts open when no persisted state exists. Default: true. */
    defaultOpen?: boolean;
    children: React.ReactNode;
}

export function CollapsibleSection({
    storageKey,
    title,
    trailing,
    description,
    defaultOpen = true,
    children,
}: CollapsibleSectionProps) {
    const detailsRef = useRef<HTMLDetailsElement>(null);

    // Hydration-safe: start with defaultOpen, then sync from localStorage after mount
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const hydrated = useRef(false);

    useEffect(() => {
        const persisted = readPersistedState(storageKey, defaultOpen);
        setIsOpen(persisted);
        if (detailsRef.current) {
            detailsRef.current.open = persisted;
        }
        hydrated.current = true;
    }, [storageKey, defaultOpen]);

    const handleToggle = useCallback(() => {
        const nowOpen = detailsRef.current?.open ?? true;
        setIsOpen(nowOpen);
        persistState(storageKey, nowOpen);
    }, [storageKey]);

    return (
        <details
            ref={detailsRef}
            open={defaultOpen}
            onToggle={handleToggle}
        >
            <summary className="flex items-center justify-between cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden group/section">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-800">
                        {title}
                    </h2>
                    <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""
                            }`}
                    />
                    {description && (
                        <span className="text-md font-medium text-text-muted/60 mt-0.5 ml-3 border-l border-border/40 pl-3 leading-none">
                            {description}
                        </span>
                    )}
                </div>
                {trailing && (
                    <div className="flex items-center">{trailing}</div>
                )}
            </summary>
            <div className="mt-4">
                {children}
            </div>
        </details>
    );
}
