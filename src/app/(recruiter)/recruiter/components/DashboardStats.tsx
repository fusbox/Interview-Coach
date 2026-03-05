"use client";

import React from "react";
import { MetricCard } from "@/components/patterns/MetricCard";
import { Sparkles, Target, Zap, Clock } from "lucide-react";
import { SessionDashboardMetrics } from "@/lib/domain/types";

interface DashboardStatsProps {
    metrics: SessionDashboardMetrics;
}

export function DashboardStats({ metrics }: DashboardStatsProps) {
    const stats = [
        {
            label: "Total Invites",
            value: metrics.totalInvites,
            icon: <Target size={18} />,
            color: "text-blue-600",
        },
        {
            label: "In Progress",
            value: metrics.activeSessions,
            icon: <Zap size={18} />,
            color: "text-amber-600",
        },
        {
            label: "Completed",
            value: metrics.completedSessions,
            icon: <Sparkles size={18} />,
            color: "text-emerald-600",
        },
        {
            label: "Avg. Engagement",
            value: `${Math.round(metrics.averageEngagementTimeSeconds / 60)}m`,
            icon: <Clock size={18} />,
            color: "text-indigo-600",
        }
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat) => (
                <MetricCard
                    key={stat.label}
                    title={stat.label}
                    value={stat.value}
                    icon={<div className={stat.color}>{stat.icon}</div>}
                />
            ))}
        </div>
    );
}
