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
            bgColor: "bg-state-info/10",
            textColor: "text-state-info",
        },
        {
            label: "In Progress",
            value: metrics.activeSessions,
            bgColor: "bg-state-warning/10",
            textColor: "text-state-warning",
        },
        {
            label: "Completed",
            value: metrics.completedSessions,
            bgColor: "bg-state-success/10",
            textColor: "text-state-success",
        },
        {
            label: "Avg. Engagement",
            value: `${Math.round(metrics.averageEngagementTimeSeconds / 60)}m`,
            bgColor: "bg-state-info/10",
            textColor: "text-state-info",
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
