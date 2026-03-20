"use client";

import { useMemo } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ArrowUpRight } from "lucide-react";
import { SectionHeader } from "@/components/patterns/SectionHeader";

interface FeedbackRecord {
    id: number;
    type: string;
    rating?: number | null;
    created_at: string;
    sessions?: {
        target_role?: string;
    };
}

interface EfficacyChartProps {
    feedback: FeedbackRecord[];
}

export function CandidateEfficacyChart({ feedback }: EfficacyChartProps) {
    // 1. Filter and Aggregate the Data
    const chartData = useMemo(() => {
        // We only care about baseline vs post-session confidence delta
        const relevant = feedback.filter(f =>
            f.type === 'baseline_confidence' ||
            f.type === 'candidate_baseline' ||
            f.type === 'session_completion_confidence_delta'
        );

        // Group by Date
        const groupedByDate: Record<string, {
            date: string;
            baselineSum: number;
            baselineCount: number;
            deltaSum: number;
            deltaCount: number;
        }> = {};

        // Sort chronologically (oldest to newest) to draw a proper timeline
        const sorted = [...relevant].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        sorted.forEach(f => {
            const dateStr = new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (!groupedByDate[dateStr]) {
                groupedByDate[dateStr] = {
                    date: dateStr,
                    baselineSum: 0,
                    baselineCount: 0,
                    deltaSum: 0,
                    deltaCount: 0
                };
            }

            if (f.rating) {
                if (f.type === 'baseline_confidence' || f.type === 'candidate_baseline') {
                    groupedByDate[dateStr].baselineSum += f.rating;
                    groupedByDate[dateStr].baselineCount += 1;
                } else if (f.type === 'session_completion_confidence_delta') {
                    groupedByDate[dateStr].deltaSum += f.rating;
                    groupedByDate[dateStr].deltaCount += 1;
                }
            }
        });

        // Convert to array of points for Recharts
        return Object.values(groupedByDate).map(group => ({
            date: group.date,
            Baseline: group.baselineCount > 0 ? Number((group.baselineSum / group.baselineCount).toFixed(1)) : null,
            'Post-Session': group.deltaCount > 0 ? Number((group.deltaSum / group.deltaCount).toFixed(1)) : null,
        })).filter(point => point.Baseline !== null || point['Post-Session'] !== null);
    }, [feedback]);

    // 2. Compute Top-Level KPIs
    const kpis = useMemo(() => {
        let deltaSum = 0;
        let deltaCount = 0;
        let baselineSum = 0;
        let baselineCount = 0;

        feedback.forEach(f => {
            if (!f.rating) return;
            if (f.type === 'session_completion_confidence_delta') {
                deltaSum += f.rating;
                deltaCount++;
            } else if (f.type === 'baseline_confidence' || f.type === 'candidate_baseline') {
                baselineSum += f.rating;
                baselineCount++;
            }
        });

        const avgDelta = deltaCount > 0 ? (deltaSum / deltaCount) : 0;
        const avgBaseline = baselineCount > 0 ? (baselineSum / baselineCount) : 0;
        const lift = avgBaseline > 0 ? ((avgDelta - avgBaseline) / avgBaseline) * 100 : 0;

        return {
            averageDelta: avgDelta.toFixed(1),
            averageBaseline: avgBaseline.toFixed(1),
            percentageLift: lift.toFixed(0),
            hasData: deltaCount > 0 || baselineCount > 0
        };
    }, [feedback]);

    if (!kpis.hasData) {
        return (
            <Card className="border-dashed bg-surface-subtle overflow-hidden">
                <CardContent className="h-64 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                    <p className="font-semibold text-lg text-foreground mb-1">Efficacy Data Collecting</p>
                    <p className="text-sm max-w-sm">No confidence feedback has been recorded yet. As candidates complete sessions, charts will appear here.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* KPI Column */}
            <div className="lg:col-span-1 space-y-6">
                <Card className="h-full flex flex-col justify-center bg-primary/5 border-primary/10">
                    <CardHeader className="pb-2">
                        <SectionHeader title="Avg Post-Session Confidence" size="sm" className="mb-0" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-black text-primary">{kpis.averageDelta}</span>
                            <span className="text-xl font-bold text-muted-foreground">/ 5.0</span>
                        </div>
                        {Number(kpis.percentageLift) > 0 && (
                            <div className="mt-4 flex items-center gap-1.5 text-sm font-bold text-emerald-800 bg-emerald-50 dark:text-emerald-200 dark:bg-emerald-500/15 w-fit px-2.5 py-1 rounded-md">
                                <ArrowUpRight className="w-4 h-4" />
                                {kpis.percentageLift}% lift vs baseline ({kpis.averageBaseline})
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Chart Column */}
            <div className="lg:col-span-3">
                <Card className="h-full">
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <SectionHeader title="Confidence Trend (1-5 Scale)" size="sm" className="mb-0" />
                            <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground uppercase">
                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" /> Baseline</div>
                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-primary" /> Post-Session</div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pl-0 pb-4 pr-6 h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                                    dy={10}
                                />
                                <YAxis
                                    domain={[1, 5]}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                                    ticks={[1, 2, 3, 4, 5]}
                                    dx={-10}
                                />
                                <Tooltip
                                    cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1, strokeDasharray: '3 3' }}
                                    contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 600, fontSize: '13px' }}
                                    itemStyle={{ fontWeight: 700 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="Baseline"
                                    stroke="hsl(var(--muted-foreground))"
                                    strokeWidth={3}
                                    dot={{ r: 4, strokeWidth: 2 }}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                    connectNulls
                                />
                                <Line
                                    type="monotone"
                                    dataKey="Post-Session"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={3}
                                    dot={{ r: 4, strokeWidth: 2 }}
                                    activeDot={{ r: 6, strokeWidth: 0, fill: 'hsl(var(--primary))' }}
                                    connectNulls
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
