import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/cn"

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string
    value: string | number
    description?: string
    trend?: {
        value: string
        positive?: boolean
    }
    variant?: "default" | "glass" | "pill"
    valueClassName?: string
}

export function MetricCard({
    title,
    value,
    description,
    trend,
    variant = "default",
    className,
    valueClassName,
    ...props
}: MetricCardProps) {
    if (variant === "pill") {
        return (
            <div 
                className={cn(
                    "flex flex-col items-center justify-center py-2 px-3 md:px-4 rounded-xl border border-border/10 shadow-sm w-full",
                    className
                )}
                {...props}
            >
                <span className="text-[10px] font-bold text-text-muted uppercase leading-none mb-0.5 whitespace-nowrap">
                    {title}
                </span>
                <span className={cn("text-sm font-black", valueClassName || "text-foreground")}>
                    {value}
                </span>
            </div>
        )
    }

    return (
        <Card variant={variant} className={cn("overflow-hidden border-none shadow-none", className)} {...props}>
            <CardHeader className="flex flex-col items-start justify-between space-y-0 p-5 pb-2">
                <div className="space-y-1">
                    <CardTitle className="text-xs font-bold text-text-muted uppercase tracking-widest leading-none">{title}</CardTitle>
                    {description && <CardDescription className="text-xs">{description}</CardDescription>}
                </div>
            </CardHeader>
            <CardContent className="p-5 pt-0">
                <div className={cn("text-3xl font-black", valueClassName || "text-foreground")}>{value}</div>
                {trend && (
                    <p className={cn(
                        "mt-1 text-xs font-semibold flex items-center gap-1",
                        trend.positive ? "text-state-success" : "text-state-critical"
                    )}>
                        {trend.positive ? "↑" : "↓"}
                        {trend.value}
                        <span className="text-text-muted font-normal ml-1">vs last session</span>
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
