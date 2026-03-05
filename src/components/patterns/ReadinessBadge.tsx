import * as React from "react"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import { cn } from "@/lib/cn"
import { CheckCircle2, TrendingUp, BookOpen, AlertCircle, HelpCircle } from "lucide-react"

export type ReadinessLevel = 1 | 2 | 3 | 4 | "RL1" | "RL2" | "RL3" | "RL4" | "Ready" | "Strong Potential" | "Practice Recommended" | "Incomplete"

export interface ReadinessBadgeProps extends Omit<BadgeProps, "variant"> {
    level: ReadinessLevel
    showIcon?: boolean
}

const READINESS_MAP = {
    // Level 1: Ready / High
    1: { variant: "high", label: "Ready", icon: CheckCircle2 },
    RL1: { variant: "high", label: "Ready", icon: CheckCircle2 },
    Ready: { variant: "high", label: "Ready", icon: CheckCircle2 },

    // Level 2: Strong Potential / Medium
    2: { variant: "medium", label: "Strong Potential", icon: TrendingUp },
    RL2: { variant: "medium", label: "Strong Potential", icon: TrendingUp },
    "Strong Potential": { variant: "medium", label: "Strong Potential", icon: TrendingUp },

    // Level 3: Practice Recommended / Low
    3: { variant: "low", label: "Practice Recommended", icon: BookOpen },
    RL3: { variant: "low", label: "Practice Recommended", icon: BookOpen },
    "Practice Recommended": { variant: "low", label: "Practice Recommended", icon: BookOpen },

    // Level 4: Incomplete / Unknown
    4: { variant: "unknown", label: "Incomplete", icon: AlertCircle },
    RL4: { variant: "unknown", label: "Incomplete", icon: AlertCircle },
    Incomplete: { variant: "unknown", label: "Incomplete", icon: AlertCircle },
} as const

export function ReadinessBadge({ level, showIcon = true, className, ...props }: ReadinessBadgeProps) {
    const config = READINESS_MAP[level as keyof typeof READINESS_MAP] || {
        variant: "outline",
        label: String(level),
        icon: HelpCircle
    }

    const Icon = config.icon

    return (
        <Badge
            variant={config.variant as BadgeProps["variant"]}
            className={cn("gap-1.5 px-3 py-1 text-[11px] font-bold uppercase tracking-wider", className)}
            {...props}
        >
            {showIcon && <Icon size={12} className="shrink-0" />}
            {config.label}
        </Badge>
    )
}
