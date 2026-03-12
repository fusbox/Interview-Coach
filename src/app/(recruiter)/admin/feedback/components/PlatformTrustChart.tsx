"use client";

import { useMemo } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { HeartHandshake } from "lucide-react";

interface FeedbackRecord {
    id: number;
    type: string;
    rating?: number | null;
    created_at: string;
}

interface TrustChartProps {
    feedback: FeedbackRecord[];
}

export function PlatformTrustChart({ feedback }: TrustChartProps) {
    // 1. Process NPS and Distribution Data
    const { npsScore, distribution, hasData } = useMemo(() => {
        let promoters = 0;
        let detractors = 0;
        let totalIntent = 0;
        let signalCount = 0;

        // Distribution buckets: 1 to 5
        const distCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        feedback.forEach(f => {
            if (!f.rating) return;

            // Metric A: Repeat Intent (NPS Calculation)
            if (f.type === 'session_completion_repeat_intent') {
                totalIntent++;
                signalCount++;
                if (f.rating >= 4) promoters++;
                if (f.rating <= 3) detractors++; // 1-3 considered detractors or passives
            }

            // Metric B: Psychological Safety (Distribution)
            if (f.type === 'session_completion_psychological_safety') {
                signalCount++;
                if (f.rating >= 1 && f.rating <= 5) {
                    distCount[f.rating as keyof typeof distCount]++;
                }
            }
        });

        const nps = totalIntent > 0 ? Math.round(((promoters - detractors) / totalIntent) * 100) : null;
        
        const chartData = [
            { score: '1', count: distCount[1], fill: 'hsl(var(--destructive))' },
            { score: '2', count: distCount[2], fill: 'hsl(var(--destructive))' },
            { score: '3', count: distCount[3], fill: 'hsl(var(--warning))' },
            { score: '4', count: distCount[4], fill: 'hsl(var(--success))' },
            { score: '5', count: distCount[5], fill: 'hsl(var(--success))' }
        ];

        return {
            npsScore: nps,
            distribution: chartData,
            hasData: signalCount > 0
        };
    }, [feedback]);


    if (!hasData) {
        return (
            <Card className="border-dashed bg-surface-subtle overflow-hidden">
                <CardContent className="h-64 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                    <p className="font-semibold text-lg text-foreground mb-1">Trust Metrics Collecting</p>
                    <p className="text-sm max-w-sm">No psychological safety or repeat intent data has been recorded yet.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* NPS KPI Column */}
            <div className="lg:col-span-1 space-y-6">
                <Card className="h-full flex flex-col justify-center bg-card">
                    <CardHeader className="pb-2">
                        <SectionHeader title="Candidate Promoter Score" size="sm" className="mb-0" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            {npsScore !== null ? (
                                <>
                                    <span className="text-5xl font-black text-foreground tracking-tight">{npsScore > 0 ? `+${npsScore}` : npsScore}</span>
                                    <span className="text-sm font-bold text-muted-foreground">NPS</span>
                                </>
                            ) : (
                                <span className="text-2xl font-bold text-muted-foreground">Not Enough Data</span>
                            )}
                        </div>
                        {npsScore !== null && (
                            <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                                <HeartHandshake className="w-4 h-4 text-primary" />
                                Willingness to use again
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Distribution Chart Column */}
            <div className="lg:col-span-3">
                <Card className="h-full">
                    <CardHeader className="pb-4">
                        <SectionHeader title="Psychological Safety Distribution" size="sm" className="mb-0" />
                        <p className="text-xs text-muted-foreground">&quot;I felt safe to focus on my growth during this session.&quot;</p>
                    </CardHeader>
                    <CardContent className="pl-0 pb-4 pr-6 h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={distribution} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                <XAxis
                                    dataKey="score"
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
                                    formatter={(value: unknown) => [`${value} responses`, 'Count']}
                                />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={60}>
                                    {distribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
