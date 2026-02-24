"use client";

import React from "react";
import { ReadinessLegend } from "./ReadinessLegend";
import { SessionDashboardMetrics } from "@/lib/domain/types";

interface CurrentBaselineBlockProps {
    metrics: SessionDashboardMetrics;
}

export function CurrentBaselineBlock({ metrics }: CurrentBaselineBlockProps) {
    const { totalInvites, completedSessions, readinessDistribution } = metrics;

    const emptyState = (
        <div className="space-y-1 py-4">
            <p className="text-xl md:text-2xl font-semibold text-slate-900 leading-snug">
                Invite candidates to begin building your baseline insights.
            </p>
            <p className="text-sm text-slate-500 italic">
                Insights will appear once candidates engage with their sessions.
            </p>
        </div>
    );

    const startedState = (
        <div className="space-y-1 py-4">
            <p className="text-xl md:text-2xl font-semibold text-slate-900 leading-snug">
                Several candidates have started their journey.
            </p>
            <p className="text-sm text-slate-500 italic">
                A complete baseline will be available once the first session is finalized.
            </p>
        </div>
    );

    if (totalInvites === 0) return emptyState;
    if (completedSessions === 0) return startedState;

    // Logic for qualitative baseline based on readiness distribution
    let baselineText = "Your candidate group is actively building their readiness.";
    const totalRL = readinessDistribution.RL1 + readinessDistribution.RL2 + readinessDistribution.RL3 + readinessDistribution.RL4;

    if (readinessDistribution.RL1 / totalRL > 0.6) {
        baselineText = "The majority of your candidates are demonstrating strong professional readiness.";
    } else if ((readinessDistribution.RL1 + readinessDistribution.RL2) / totalRL > 0.7) {
        baselineText = "Your candidate pool shows high potential with consistent engagement patterns.";
    } else if (readinessDistribution.RL3 / totalRL > 0.5) {
        baselineText = "Your candidates are currently in a heavy practice phase, building foundational skills.";
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 py-4 items-center">
            <div className="space-y-1">
                <p className="text-xl md:text-2xl font-semibold text-slate-900 leading-snug">
                    {baselineText}
                </p>
                <p className="text-sm text-slate-500 italic">
                    Grounding: Based on {completedSessions} completed sessions and current engagement trends.
                </p>
            </div>
            <div className="w-full">
                <ReadinessLegend />
            </div>
        </div>
    );
}
