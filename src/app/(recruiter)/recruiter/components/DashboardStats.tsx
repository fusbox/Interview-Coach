"use client";

import React from "react";
import { MetricCard } from "@/components/patterns/MetricCard";
import { DashboardBasicStats } from "@/lib/services/compute-dashboard-stats";
import { cn } from "@/lib/cn";

interface DashboardStatsProps {
    metrics: DashboardBasicStats;
    variant?: "default" | "header";
}

export function DashboardStats({ metrics, variant = "default" }: DashboardStatsProps) {
    const stats = [
        {
            label: "Invites",
            fullLabel: "Total Invites",
            value: metrics.totalInvites,
            bgColor: "bg-sky-50 dark:bg-sky-500/10",
            textColor: "text-sky-800 dark:text-sky-200",
        },
        {
            label: "In Progress",
            fullLabel: "In Progress",
            value: metrics.activeSessions,
            bgColor: "bg-amber-50 dark:bg-amber-500/10",
            textColor: "text-amber-900 dark:text-amber-200",
        },
        {
            label: "Completed",
            fullLabel: "Completed",
            value: metrics.completedSessions,
            bgColor: "bg-emerald-50 dark:bg-emerald-500/10",
            textColor: "text-emerald-800 dark:text-emerald-200",
        },
        {
            label: "Avg. Time",
            fullLabel: "Avg. Engagement",
            value: `${Math.round(metrics.averageEngagementTimeSeconds / 60)}m`,
            bgColor: "bg-sky-50 dark:bg-sky-500/10",
            textColor: "text-sky-800 dark:text-sky-200",
        }
    ];

    if (variant === "header") {
        return (
            <div className="flex items-center gap-1.5 md:gap-2 w-full">
                {stats.map((stat) => (
                    <MetricCard
                        key={stat.fullLabel}
                        title={stat.label}
                        value={stat.value}
                        variant="pill"
                        className={cn("flex-1 px-1 border-none shadow-none", stat.bgColor)}
                        valueClassName={stat.textColor}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
                <MetricCard
                    key={stat.fullLabel}
                    title={stat.fullLabel}
                    value={stat.value}
                    className={stat.bgColor}
                    valueClassName={stat.textColor}
                />
            ))}
        </div>
    );
}
