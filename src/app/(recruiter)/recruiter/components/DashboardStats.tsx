"use client";

import React from "react";
import { MetricCard } from "@/components/patterns/MetricCard";
import { DashboardBasicStats } from "@/lib/services/compute-dashboard-stats";

interface DashboardStatsProps {
    metrics: DashboardBasicStats;
}

export function DashboardStats({ metrics }: DashboardStatsProps) {
    const stats = [
        {
            label: "Total Invites",
            value: metrics.totalInvites,
            bgColor: "bg-blue-50/50 dark:bg-blue-950/20",
            textColor: "text-blue-700 dark:text-blue-300",
        },
        {
            label: "In Progress",
            value: metrics.activeSessions,
            bgColor: "bg-amber-50/50 dark:bg-amber-950/20",
            textColor: "text-amber-700 dark:text-amber-300",
        },
        {
            label: "Completed",
            value: metrics.completedSessions,
            bgColor: "bg-emerald-50/50 dark:bg-emerald-950/20",
            textColor: "text-emerald-700 dark:text-emerald-300",
        },
        {
            label: "Avg. Engagement",
            value: `${Math.round(metrics.averageEngagementTimeSeconds / 60)}m`,
            bgColor: "bg-indigo-50/50 dark:bg-indigo-950/20",
            textColor: "text-indigo-700 dark:text-indigo-300",
        }
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
                <MetricCard
                    key={stat.label}
                    title={stat.label}
                    value={stat.value}
                    className={stat.bgColor}
                    valueClassName={stat.textColor}
                />
            ))}
        </div>
    );
}
