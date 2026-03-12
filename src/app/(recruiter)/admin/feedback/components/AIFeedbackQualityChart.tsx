"use client";

import { useMemo } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionHeader } from "@/components/patterns/SectionHeader";

interface FeedbackRecord {
    id: number;
    type: string;
    rating?: number | null;
    comment?: string | null;
    created_at: string;
}

interface AIQualityProps {
    feedback: FeedbackRecord[];
}

// Normalizes yes/somewhat/no into positive/neutral/negative buckets
function normalizeToSentiment(record: FeedbackRecord): 'positive' | 'neutral' | 'negative' | null {
    if (record.comment) {
        const val = record.comment.toLowerCase().trim();
        if (['yes', 'helpful'].includes(val)) return 'positive';
        if (['somewhat', 'neutral', 'okay'].includes(val)) return 'neutral';
        if (['no', 'unhelpful'].includes(val)) return 'negative';
    }
    return null;
}

export function AIFeedbackQualityChart({ feedback }: AIQualityProps) {
    const { chartData, hasData } = useMemo(() => {
        // Raw Counts
        const contentCounts = { positive: 0, neutral: 0, negative: 0 };
        const deliveryCounts = { positive: 0, neutral: 0, negative: 0 };
        let totalSignalsCount = 0;

        feedback.forEach(f => {
            if (f.type === 'helpfulness_content') {
                const sentiment = normalizeToSentiment(f);
                if (sentiment) {
                    contentCounts[sentiment]++;
                    totalSignalsCount++;
                }
            }
            if (f.type === 'helpfulness_delivery') {
                const sentiment = normalizeToSentiment(f);
                if (sentiment) {
                    deliveryCounts[sentiment]++;
                    totalSignalsCount++;
                }
            }
        });

        // Grouped format for Recharts
        const data = [
            {
                name: 'Content Helpfulness',
                Positive: contentCounts.positive,
                Neutral: contentCounts.neutral,
                Negative: contentCounts.negative
            },
            {
                name: 'Delivery Helpfulness',
                Positive: deliveryCounts.positive,
                Neutral: deliveryCounts.neutral,
                Negative: deliveryCounts.negative
            }
        ];

        return {
            chartData: data,
            hasData: totalSignalsCount > 0
        };
    }, [feedback]);


    if (!hasData) {
        return (
            <Card className="border-dashed bg-surface-subtle overflow-hidden">
                <CardContent className="h-64 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                    <p className="font-semibold text-lg text-foreground mb-1">AI Quality Data Collecting</p>
                    <p className="text-sm max-w-sm">No feedback regarding content or delivery helpfulness has been recorded yet.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full">
            <CardHeader className="pb-4">
                <SectionHeader title="AI Feedback Quality Breakdown" size="sm" className="mb-0" />
                <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground uppercase tracking-tight">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-success" /> Helpful</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-warning" /> Somewhat</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-destructive" /> Not Helpful</div>
                </div>
            </CardHeader>
            <CardContent className="pl-0 pb-4 pr-6 h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                            dy={10}
                        />
                        <YAxis
                            allowDecimals={false}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                            dx={-10}
                        />
                        <Tooltip
                            cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                            contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 600, fontSize: '13px' }}
                        />
                        <Bar dataKey="Positive" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} maxBarSize={60} />
                        <Bar dataKey="Neutral" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} maxBarSize={60} />
                        <Bar dataKey="Negative" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} maxBarSize={60} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
