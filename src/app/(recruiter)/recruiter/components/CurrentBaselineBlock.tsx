"use client";

import React from "react";
import { ReadinessLegend } from "./ReadinessLegend";
import { SessionDashboardMetrics } from "@/lib/domain/types";
import { PreparationLiftPrompt } from "./PreparationLiftPrompt";

interface CurrentBaselineBlockProps {
    metrics: SessionDashboardMetrics;
    recruiterEmail: string;
}

export function CurrentBaselineBlock({ metrics, recruiterEmail }: CurrentBaselineBlockProps) {
    const { totalInvites, activeSessions, completedSessions, stalledSessions, readinessDistribution } = metrics;

    const totalActioned = activeSessions + completedSessions + stalledSessions;

    if (totalInvites === 0) {
        return (
            <div className="space-y-1 py-4">
                <p className="text-xl md:text-2xl font-semibold text-slate-900 leading-snug">
                    Invite candidates to begin building your baseline insights.
                </p>
                <p className="text-sm text-slate-500 italic">
                    Insights will appear once candidates engage with their sessions.
                </p>
            </div>
        );
    }

    let baselineText = "";
    let subtext = "";

    if (completedSessions > 0) {
        // Logic for qualitative baseline based on readiness distribution
        baselineText = "Your candidate group is actively building their readiness.";
        const totalRL = readinessDistribution.RL1 + readinessDistribution.RL2 + readinessDistribution.RL3 + readinessDistribution.RL4;

        if (readinessDistribution.RL1 / totalRL > 0.6) {
            baselineText = "The majority of your candidates are demonstrating strong professional readiness.";
        } else if ((readinessDistribution.RL1 + readinessDistribution.RL2) / totalRL > 0.7) {
            baselineText = "Your candidate pool shows high potential with consistent engagement patterns.";
        } else if (readinessDistribution.RL3 / totalRL > 0.5) {
            baselineText = "Your candidates are currently in a heavy practice phase, building foundational skills.";
        }
        subtext = `Grounding: Based on ${completedSessions} completed sessions and current engagement trends.`;
    } else if (totalActioned > 0) {
        baselineText = totalActioned === 1
            ? "A candidate has started their journey."
            : "Several candidates have started their journey.";
        subtext = "A complete baseline will be available once the first session is finalized.";
    } else {
        baselineText = totalInvites === 1
            ? "Invite sent. No candidate action yet—check back soon."
            : "Invites sent. No candidate action yet—check back soon.";
        subtext = "Insights will appear once candidates engage with their sessions.";
    }

    return (
        <div className="space-y-4 py-4">
            {totalInvites > 0 && (
                <PreparationLiftPrompt recruiterEmail={recruiterEmail} />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
                <div className="space-y-1">
                    <p className="text-xl md:text-2xl font-semibold text-slate-900 leading-snug">
                        {baselineText}
                    </p>
                    <p className="text-sm text-slate-500 italic">
                        {subtext}
                    </p>
                </div>
                <div className="w-full">
                    <ReadinessLegend />
                </div>
            </div>
        </div>
    );
}
