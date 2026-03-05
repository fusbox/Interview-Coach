import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import { cn } from "@/lib/cn"
import { Sparkles, Target, AlertTriangle, CheckCircle2 } from "lucide-react"

export type FeedbackAssessment = "outstanding" | "satisfactory" | "growth" | "critical"

export interface FeedbackPanelProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string
    body: string | React.ReactNode
    assessment?: FeedbackAssessment
    icon?: React.ReactNode
}

const ASSESSMENT_CONFIG = {
    outstanding: {
        variant: "high",
        label: "Outstanding",
        icon: Sparkles,
        color: "text-state-success"
    },
    satisfactory: {
        variant: "medium",
        label: "Satisfactory",
        icon: CheckCircle2,
        color: "text-state-info"
    },
    growth: {
        variant: "low",
        label: "Growth Opportunity",
        icon: Target,
        color: "text-state-warning"
    },
    critical: {
        variant: "destructive",
        label: "Critical Issue",
        icon: AlertTriangle,
        color: "text-state-critical"
    }
} as const

export function FeedbackPanel({
    title,
    body,
    assessment,
    icon,
    className,
    ...props
}: FeedbackPanelProps) {
    const config = assessment ? ASSESSMENT_CONFIG[assessment] : null
    const Icon = icon || (config?.icon) || Sparkles

    return (
        <Card className={cn("overflow-hidden border-l-4", config ? `border-l-state-${assessment === 'outstanding' ? 'success' : assessment === 'satisfactory' ? 'info' : assessment === 'growth' ? 'warning' : 'critical'}` : "border-l-primary", className)} {...props}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className={cn("p-1.5 rounded-md bg-surface-subtle border shadow-flat", config?.color)}>
                            {typeof Icon === 'function' ? <Icon size={16} /> : Icon}
                        </div>
                        <CardTitle className="text-base font-bold">{title}</CardTitle>
                    </div>
                    {assessment && (
                        <Badge variant={ASSESSMENT_CONFIG[assessment].variant as BadgeProps["variant"]}>
                            {ASSESSMENT_CONFIG[assessment].label}
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                    {body}
                </div>
            </CardContent>
        </Card>
    )
}
