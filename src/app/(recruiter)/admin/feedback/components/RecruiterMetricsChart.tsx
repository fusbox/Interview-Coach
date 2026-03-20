"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { Briefcase } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface FeedbackRecord {
    id: number;
    type: string;
    rating?: number | null;
    comment?: string | null;
    created_at: string;
}

interface RecruiterMetricsProps {
    feedback: FeedbackRecord[];
}

/**
 * Normalizes qualitative (yes/no) or quantitative (1-5) feedback into sentiment categories.
 */
function normalizeToSentiment(record: FeedbackRecord): 'positive' | 'neutral' | 'negative' | null {
    if (record.rating !== null && record.rating !== undefined) {
        if (record.rating >= 4) return 'positive';
        if (record.rating === 3) return 'neutral';
        return 'negative';
    }
    if (record.comment) {
        const val = record.comment.toLowerCase().trim();
        if (['yes', 'easy', 'very easy'].includes(val)) return 'positive';
        if (['somewhat', 'neutral', 'okay'].includes(val)) return 'neutral';
        if (['no', 'hard', 'difficult'].includes(val)) return 'negative';
    }
    return null;
}

const SENTIMENT_COLORS = {
    positive: 'hsl(var(--success))',
    neutral: 'hsl(var(--warning))',
    negative: 'hsl(var(--destructive))'
};

export function RecruiterMetricsChart({ feedback }: RecruiterMetricsProps) {
    const { frictionData, hasData } = useMemo(() => {
        const frictionCounts = { positive: 0, neutral: 0, negative: 0 };
        let totalSignalsCount = 0;

        feedback.forEach(f => {
            if (f.type === 'recruiter_friction_invite') {
                const sentiment = normalizeToSentiment(f);
                if (sentiment) {
                    frictionCounts[sentiment]++;
                    totalSignalsCount++;
                }
            }
        });

        return {
            frictionData: [
                { name: 'Positive (Low Friction)', value: frictionCounts.positive, fill: SENTIMENT_COLORS.positive },
                { name: 'Neutral', value: frictionCounts.neutral, fill: SENTIMENT_COLORS.neutral },
                { name: 'Negative (High Friction)', value: frictionCounts.negative, fill: SENTIMENT_COLORS.negative },
            ].filter(d => d.value > 0),
            totalSignals: totalSignalsCount,
            hasData: totalSignalsCount > 0
        };
    }, [feedback]);


    if (!hasData) {
        return (
            <Card className="border-dashed bg-surface-subtle overflow-hidden">
                <CardContent className="h-64 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                    <p className="font-semibold text-lg text-foreground mb-1">Recruiter Metrics Collecting</p>
                    <p className="text-sm max-w-sm">No internal recruiter feedback (lift or friction) has been recorded yet.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-6">


            {/* Platform Friction */}
            <Card className="h-full">
                <CardHeader className="pb-4">
                    <SectionHeader title="Recruiter Workflow Friction" size="sm" className="mb-0" />
                    <p className="text-xs text-muted-foreground">&quot;How easy was sending these invites?&quot;</p>
                </CardHeader>
                <CardContent className="flex items-center">
                    <div className="h-[200px] w-1/2">
                        <div className="sr-only">
                            Recruiter workflow friction breakdown:
                            {frictionData.map((entry) => ` ${entry.name}: ${entry.value} responses.`).join("")}
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={frictionData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={2}
                                    dataKey="value"
                                    stroke="transparent"
                                >
                                    {frictionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 600, fontSize: '13px' }}
                                    formatter={(value: unknown) => {
                                        const num = Number(value);
                                        return [`${num} responses`, 'Count'];
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="w-1/2 flex flex-col justify-center space-y-4 pl-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                                <Briefcase className="w-6 h-6 text-success" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-muted-foreground uppercase">Operational Ease</p>
                                <p className="text-2xl font-black text-foreground">{frictionData.find(d => d.name === 'Positive (Low Friction)')?.value || 0} <span className="text-sm font-semibold text-muted-foreground">found it easy</span></p>
                            </div>
                        </div>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            {frictionData.map((entry) => (
                                <li key={entry.name} className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.fill }} aria-hidden="true" />
                                    <span>{entry.name}: {entry.value}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
