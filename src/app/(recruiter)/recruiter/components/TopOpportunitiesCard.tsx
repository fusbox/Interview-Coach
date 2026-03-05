"use client";

import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Lightbulb, Info } from "lucide-react";
import { SessionDashboardMetrics } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/patterns/SectionHeader";

interface TopOpportunitiesCardProps {
    metrics: SessionDashboardMetrics;
}

export function TopOpportunitiesCard({ metrics }: TopOpportunitiesCardProps) {
    const { commonObservations, completedSessions } = metrics;

    if (completedSessions === 0 || commonObservations.length === 0) {
        return null;
    }

    return (
        <Card className="border-none shadow-flat bg-surface-base h-full">
            <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-state-success text-state-success-foreground rounded-xl flex items-center justify-center shadow-flat">
                        <Lightbulb size={18} />
                    </div>
                    <SectionHeader
                        title="Candidate Struggles"
                        size="sm"
                        description="Recurring factual markers from responses"
                    />
                </div>
            </CardHeader>
            <CardContent className="pt-4">
                <ul className="space-y-4">
                    {commonObservations.map((obs, i) => (
                        <li key={i} className="flex gap-4 group">
                            <div className="flex-shrink-0 mt-1 flex flex-col items-center">
                                <div className="w-6 h-6 rounded-full bg-surface-subtle flex items-center justify-center text-[10px] font-bold text-text-muted group-hover:bg-state-success/10 group-hover:text-state-success transition-colors">
                                    {obs.count}
                                </div>
                                {i < commonObservations.length - 1 && <div className="w-px h-full bg-border mt-2" />}
                            </div>
                            <div className="space-y-1 pb-4">
                                <p className="text-sm text-text-primary leading-snug group-hover:text-primary transition-colors">
                                    {obs.text}
                                </p>
                                {obs.count > 1 && (
                                    <Badge variant="secondary" className="bg-surface-subtle text-text-muted border-none font-normal text-[10px] px-1.5 py-0 uppercase tracking-tighter">
                                        Seen in {Math.round((obs.count / completedSessions) * 100)}% of sessions
                                    </Badge>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
                <div className="mt-6 p-4 bg-state-success/10 rounded-2xl border border-state-success/20 flex gap-3">
                    <div className="text-state-success shrink-0">
                        <Info size={16} />
                    </div>
                    <p className="text-[11px] text-state-success-foreground font-medium leading-relaxed italic">
                        Tip: Large cohorts often struggle with specific STAR components. Use these markers to guide your candidate pre-screen questions.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
