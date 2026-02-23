"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "../../../../components/ui/progress";
import { Target, Info } from "lucide-react";
import { SessionDashboardMetrics } from "@/lib/domain/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CoachingFocusCardProps {
    metrics: SessionDashboardMetrics;
}

export function CoachingFocusCard({ metrics }: CoachingFocusCardProps) {
    const { coachingFocusDistribution, completedSessions } = metrics;

    if (completedSessions === 0 || Object.keys(coachingFocusDistribution).length === 0) {
        return null; // Don't show if no data
    }

    // Identify the top 3 focus areas
    const sortedFocus = Object.entries(coachingFocusDistribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    const totalEvals = Object.values(coachingFocusDistribution).reduce((a, b) => a + b, 0);

    const getHeadline = (dimension: string) => {
        const mapping: Record<string, string> = {
            'structural_clarity': 'Structural Clarity',
            'outcome_explicitness': 'Outcome Explicitness',
            'specificity_concreteness': 'Specificity & Detail',
            'conversational_pace': 'Conversational Pace',
            'role_alignment': 'Role Alignment',
            'analytical_depth': 'Analytical Depth',
            'practice_recommendation': 'Foundational Practice'
        };
        return mapping[dimension] || dimension.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    const getRationale = (dimension: string) => {
        const mapping: Record<string, string> = {
            'structural_clarity': 'Candidates often struggle to organize their answers using a clear framework (like STAR).',
            'outcome_explicitness': 'Focus on helping candidates clearly state the result or impact of their actions.',
            'specificity_concreteness': 'Encourage candidates to provide more tangible examples rather than abstract generalities.',
            'conversational_pace': 'Candidates may need to slow down or use more natural pauses in spoken dialogue.',
            'role_alignment': 'Work on tailoring experiences more directly to the requirements of the target role.'
        };
        return mapping[dimension] || 'This area represents a common growth opportunity across your candidate pool.';
    };

    return (
        <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-xl flex items-center justify-center">
                        <Target size={18} />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-bold">Top Coaching Needs</CardTitle>
                        <CardDescription>Aggregate skill gaps across all candidate answers</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
                {sortedFocus.map(([dimension, count], index) => {
                    const percentage = (count / totalEvals) * 100;
                    return (
                        <div key={dimension} className="space-y-2">
                            <div className="flex items-center justify-between group">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-700">{getHeadline(dimension)}</span>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Info size={14} className="text-slate-300 hover:text-slate-500 cursor-help transition-colors" />
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-[200px] text-xs">
                                                {getRationale(dimension)}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{Math.round(percentage)}% of answers</span>
                            </div>
                            <Progress value={percentage} className="h-1.5 bg-slate-100" />
                            {index === 0 && (
                                <p className="text-xs text-slate-500 mt-1 pl-1 border-l-2 border-blue-200">
                                    Primary lever: {getRationale(dimension)}
                                </p>
                            )}
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
