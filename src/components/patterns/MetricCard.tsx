import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/cn"

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string
    value: string | number
    description?: string
    icon?: React.ReactNode
    trend?: {
        value: string
        positive?: boolean
    }
    variant?: "default" | "glass"
}

export function MetricCard({
    title,
    value,
    description,
    icon,
    trend,
    variant = "default",
    className,
    ...props
}: MetricCardProps) {
    return (
        <Card variant={variant} className={cn("overflow-hidden", className)} {...props}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">{title}</CardTitle>
                    {description && <CardDescription className="text-xs">{description}</CardDescription>}
                </div>
                {icon && <div className="text-muted-foreground bg-surface-subtle p-2 rounded-lg border shadow-flat">{icon}</div>}
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold tracking-tight">{value}</div>
                {trend && (
                    <p className={cn(
                        "mt-1 text-xs font-semibold flex items-center gap-1",
                        trend.positive ? "text-state-success" : "text-state-critical"
                    )}>
                        {trend.positive ? "↑" : "↓"}
                        {trend.value}
                        <span className="text-muted-foreground font-normal ml-1">vs last session</span>
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
