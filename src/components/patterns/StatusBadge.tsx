import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/cn"
import { AlertCircle, CheckCircle2, Clock, HelpCircle, AlertTriangle } from "lucide-react"

const statusBadgeVariants = cva(
    "inline-flex items-center gap-1.5 font-medium uppercase tracking-wider transition-colors",
    {
        variants: {
            variant: {
                success: "bg-emerald-50 text-emerald-800 border-emerald-400 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-400/50",
                warning: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-400/30",
                critical: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-400/30",
                info: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:border-sky-400/30",
                neutral: "bg-muted text-muted-foreground border-border",
                readinessHigh: "bg-emerald-50 text-emerald-800 border-emerald-400 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-400/50",
                readinessPotential: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:border-sky-400/30",
                readinessMedium: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-400/30",
                readinessLow: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-400/30",
                readinessUnknown: "bg-readiness-unknown/10 text-readiness-unknown border-readiness-unknown/20",
                // Progress (Pill Fill) — ghost → tint → solid
                progressIdle: "bg-transparent text-muted-foreground border-border",
                progressViewed: "bg-transparent text-sky-800 border-sky-300 dark:text-sky-200 dark:border-sky-400/40",
                progressStarted: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:border-sky-400/30",
                progressActive: "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-500/20 dark:text-sky-100 dark:border-sky-400/40",
                progressSolid: "bg-state-info text-text-inverse border-transparent",
                progressComplete: "bg-state-success text-text-inverse border-transparent",
            },
            size: {
                sm: "px-2 py-0.5 text-micro",
                md: "px-2.5 py-0.5 text-xs",
                lg: "px-3 py-1 text-sm",
            },
            fullWidth: {
                true: "w-full justify-center",
                false: "w-fit"
            }
        },
        defaultVariants: {
            variant: "neutral",
            size: "md",
            fullWidth: false
        },
    }
)

export interface StatusBadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
    icon?: boolean
}

export function StatusBadge({
    className,
    variant,
    size,
    fullWidth,
    icon = true,
    children,
    ...props
}: StatusBadgeProps) {

    // Map variant semantics to appropriate icon
    let IconComponent = HelpCircle;
    if (variant === 'success' || variant === 'readinessHigh' || variant === 'readinessPotential' || variant === 'progressComplete') IconComponent = CheckCircle2;
    if (variant === 'warning' || variant === 'readinessMedium') IconComponent = AlertTriangle;
    if (variant === 'critical' || variant === 'readinessLow') IconComponent = AlertCircle;
    if (variant === 'info' || variant === 'progressSolid' || variant === 'progressActive') IconComponent = Clock;

    return (
        <Badge
            variant="outline"
            className={cn(statusBadgeVariants({ variant, size, fullWidth }), className)}
            {...props}
        >
            {icon && <IconComponent className={cn(
                "shrink-0",
                size === 'sm' ? "w-3 h-3" : size === 'lg' ? "w-4 h-4" : "w-3.5 h-3.5"
            )} />}
            {children}
        </Badge>
    )
}
