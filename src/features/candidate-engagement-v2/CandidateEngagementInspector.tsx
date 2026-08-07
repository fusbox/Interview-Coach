"use client";

import { Activity, Database, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { IconButton } from "@/components/ui/icon-button";

import type { CandidateEngagementTracker } from "./useCandidateEngagementTracker";
import styles from "./CandidateEngagementInspector.module.css";

export function CandidateEngagementInspector({
    enabled,
    tracker,
}: {
    enabled: boolean;
    tracker: CandidateEngagementTracker;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (isOpen) closeButtonRef.current?.focus();
    }, [isOpen]);

    if (!enabled) return null;

    return (
        <div data-engagement-ignore="true">
            <button
                type="button"
                className={styles.trigger}
                aria-label="Open engagement inspector"
                title="Engagement inspector"
                onClick={() => setIsOpen(true)}
            />
            {isOpen ? (
                <aside className={styles.inspector} aria-label="Engagement inspector">
                    <header className={styles.header}>
                        <div>
                            <Activity size={17} aria-hidden="true" />
                            <strong>Engagement inspector</strong>
                        </div>
                        <IconButton
                            ref={closeButtonRef}
                            label="Close engagement inspector"
                            title="Close engagement inspector"
                            size="compact"
                            onClick={() => setIsOpen(false)}
                        >
                            <X size={16} aria-hidden="true" />
                        </IconButton>
                    </header>

                    <div className={styles.metrics}>
                        <Metric
                            label="Window"
                            value={tracker.isWindowOpen ? "Active" : "Idle"}
                            tone={tracker.isWindowOpen ? "active" : "idle"}
                        />
                        <Metric
                            label="Tab"
                            value={tracker.isLeader ? "Leader" : "Follower"}
                            tone={tracker.isLeader ? "active" : "idle"}
                        />
                        <Metric label="Remaining" value={`${tracker.windowTimeRemaining}s`} />
                        <Metric label="This view" value={formatDuration(tracker.localActiveMilliseconds)} />
                    </div>

                    <div className={styles.persistence}>
                        <Database size={14} aria-hidden="true" />
                        <span>Server confirmed</span>
                        <strong>{formatDuration(tracker.serverSummary.activeMilliseconds)}</strong>
                        <small data-state={tracker.persistenceState}>
                            {tracker.pendingSliceCount} pending · {tracker.persistenceState}
                        </small>
                    </div>

                    <div className={styles.logHeader}>
                        <span>Event &amp; window log</span>
                        <button type="button" onClick={tracker.clearDebugEvents}>
                            <Trash2 size={12} aria-hidden="true" />
                            Clear
                        </button>
                    </div>
                    <div className={styles.log}>
                        {tracker.debugEvents.length ? tracker.debugEvents.map((event) => (
                            <article key={event.id} data-event={event.type}>
                                <div>
                                    <strong>{event.type.replaceAll("_", " ")}</strong>
                                    <time dateTime={new Date(event.timestamp).toISOString()}>
                                        {new Date(event.timestamp).toLocaleTimeString()}
                                    </time>
                                </div>
                                <p>{event.detail}</p>
                                {event.tier ? <span>{event.tier}</span> : null}
                            </article>
                        )) : (
                            <p className={styles.empty}>Interact with the practice session to inspect the window.</p>
                        )}
                    </div>
                </aside>
            ) : null}
        </div>
    );
}

function Metric({
    label,
    value,
    tone,
}: {
    label: string;
    value: string;
    tone?: "active" | "idle";
}) {
    return (
        <div className={styles.metric} data-tone={tone}>
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function formatDuration(milliseconds: number) {
    const seconds = Math.max(0, Math.round(milliseconds / 1_000));
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}
