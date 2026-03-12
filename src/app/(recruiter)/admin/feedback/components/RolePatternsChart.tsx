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
    created_at: string;
    sessions?: {
        target_role?: string;
    } | null;
}

interface RolePatternsProps {
    feedback: FeedbackRecord[];
}

export function RolePatternsChart({ feedback }: RolePatternsProps) {
    const { columns, itemsPerColumn, hasData } = useMemo(() => {
        // We only care about baseline vs post-session confidence delta
        const relevant = feedback.filter(f =>
            (f.type === 'baseline_confidence' ||
            f.type === 'candidate_baseline' ||
            f.type === 'session_completion_confidence_delta') &&
            f.rating !== null && f.rating !== undefined
        );

        // Group by Role
        const groupedByRole: Record<string, {
            role: string;
            baselineSum: number;
            baselineCount: number;
            deltaSum: number;
            deltaCount: number;
        }> = {};

        relevant.forEach(f => {
            const role = f.sessions?.target_role || "Unspecified Role";
            
            if (!groupedByRole[role]) {
                groupedByRole[role] = {
                    role: role,
                    baselineSum: 0,
                    baselineCount: 0,
                    deltaSum: 0,
                    deltaCount: 0
                };
            }

            if (f.type === 'baseline_confidence' || f.type === 'candidate_baseline') {
                groupedByRole[role].baselineSum += f.rating!;
                groupedByRole[role].baselineCount += 1;
            } else if (f.type === 'session_completion_confidence_delta') {
                groupedByRole[role].deltaSum += f.rating!;
                groupedByRole[role].deltaCount += 1;
            }
        });

        // Convert to array of points for Recharts
        const data = Object.values(groupedByRole).map(group => ({
            name: group.role,
            Baseline: group.baselineCount > 0 ? Number((group.baselineSum / group.baselineCount).toFixed(1)) : null,
            'Post-Session': group.deltaCount > 0 ? Number((group.deltaSum / group.deltaCount).toFixed(1)) : null,
        })).filter(point => point.Baseline !== null || point['Post-Session'] !== null);

        // Sort by role name alphabetically, putting Unspecified Role at the end
        data.sort((a, b) => {
            if (a.name === "Unspecified Role") return 1;
            if (b.name === "Unspecified Role") return -1;
            return a.name.localeCompare(b.name);
        });

        // Distribute into 5 columns (down, then across)
        const COLUMN_COUNT = 5;
        // Calculate max items per column to preserve alphabetical downward flow
        const itemsPerColumn = Math.ceil(data.length / COLUMN_COUNT);
        
        type DataPoint = typeof data[0];
        const columns: DataPoint[][] = Array.from({ length: COLUMN_COUNT }, () => []);
        
        data.forEach((item, index) => {
            const columnIndex = Math.floor(index / itemsPerColumn);
            columns[columnIndex].push(item);
        });

        return {
            columns,
            hasData: data.length > 0,
            itemsPerColumn // For height calculation
        };
    }, [feedback]);

    if (!hasData) {
        return (
            <Card className="border-dashed bg-surface-subtle overflow-hidden">
                <CardContent className="h-64 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                    <p className="font-semibold text-lg text-foreground mb-1">Role Patterns Collecting</p>
                    <p className="text-sm max-w-sm">No formatted role data is available yet to visualize cross-dimensional metrics.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <SectionHeader title="Confidence Lift by Role" size="sm" className="mb-0" />
                        <p className="text-xs text-muted-foreground">Comparing baseline confidence vs post-session confidence across job tracks.</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="px-6 pb-6 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-x-8 gap-y-6">
                    {columns.map((columnData, colIndex) => {
                        if (columnData.length === 0) return null;
                        
                        // Calculate an explicit height based on items to give bars room to breathe
                        // Min 250px so small lists don't look squished, or scale up for many roles
                        const chartHeight = Math.max(250, itemsPerColumn * 60);

                        return (
                            <div key={`col-${colIndex}`} className="w-full flex flex-col relative z-0 hover:z-50 transition-all duration-200" style={{ height: chartHeight }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart 
                                        layout="vertical"
                                        data={columnData} 
                                        margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                                        barGap={2}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                        <XAxis
                                            type="number"
                                            domain={[1, 5]}
                                            ticks={[1, 2, 3, 4, 5]}
                                            allowDecimals={false}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                                            dy={5}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fill: 'hsl(var(--foreground))', fontWeight: 600 }}
                                            width={95}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                                            contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 600, fontSize: '13px' }}
                                            itemStyle={{ fontWeight: 700 }}
                                            wrapperStyle={{ zIndex: 100 }}
                                        />
                                        <Bar dataKey="Baseline" fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]} maxBarSize={16} />
                                        <Bar dataKey="Post-Session" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} maxBarSize={16} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        );
                    })}
                </div>
                
                {/* Global Legend at the bottom since we removed it from individual charts */}
                <div className="flex justify-center items-center gap-6 mt-6 pt-4 border-t border-dashed">
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                        <div className="w-3 h-3 rounded-sm bg-muted-foreground" /> Baseline
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                        <div className="w-3 h-3 rounded-sm bg-success" /> Post-Session
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
