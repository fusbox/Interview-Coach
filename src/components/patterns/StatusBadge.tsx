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
                success: "bg-state-success/10 text-state-success border-state-success/20",
                warning: "bg-state-warning/10 text-state-warning border-state-warning/20",
                critical: "bg-state-critical/10 text-state-critical border-state-critical/20",
                info: "bg-state-info/10 text-state-info border-state-info/20",
                neutral: "bg-muted text-muted-foreground border-border",
                readinessHigh: "bg-readiness-high/10 text-readiness-high border-readiness-high/20",
                readinessPotential: "bg-state-info/10 text-state-info border-state-info/20",
                readinessMedium: "bg-readiness-medium/10 text-readiness-medium border-readiness-medium/20",
                readinessLow: "bg-readiness-low/10 text-readiness-low border-readiness-low/20",
                readinessUnknown: "bg-readiness-unknown/10 text-readiness-unknown border-readiness-unknown/20",
                // Progress (Pill Fill) — ghost → tint → solid
                progressIdle: "bg-transparent text-muted-foreground border-border",
                progressViewed: "bg-transparent text-state-info/60 border-state-info/30",
                progressStarted: "bg-state-info/10 text-state-info border-state-info/20",
                progressActive: "bg-state-info/20 text-state-info border-state-info/30",
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
