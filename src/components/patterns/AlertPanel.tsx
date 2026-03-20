import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { AlertCircle, CheckCircle2, Info, AlertTriangle, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/cn"

const alertPanelVariants = cva(
    "rounded-2xl border text-sm flex items-start gap-3",
    {
        variants: {
            tone: {
                critical: "border-state-critical/20 bg-state-critical/5 text-state-critical",
                success: "border-state-success/20 bg-state-success/5 text-state-success",
                info: "border-state-info/20 bg-state-info/5 text-state-info",
                warning: "border-state-warning/20 bg-state-warning/5 text-state-warning",
            },
            weight: {
                medium: "font-medium",
                semibold: "font-semibold",
            },
            size: {
                sm: "rounded-xl px-3 py-3",
                md: "px-4 py-3",
            },
        },
        defaultVariants: {
            tone: "critical",
            weight: "medium",
            size: "md",
        },
    }
)

const toneIcons: Record<NonNullable<AlertPanelProps["tone"]>, LucideIcon> = {
    critical: AlertCircle,
    success: CheckCircle2,
    info: Info,
    warning: AlertTriangle,
}

export interface AlertPanelProps
    extends React.HTMLAttributes<HTMLDivElement>,
        Omit<VariantProps<typeof alertPanelVariants>, "tone"> {
    tone?: NonNullable<VariantProps<typeof alertPanelVariants>["tone"]>
    icon?: boolean | React.ReactNode
}

export function AlertPanel({
    tone = "critical",
    weight,
    size,
    icon = false,
    className,
    children,
    ...props
}: AlertPanelProps) {
    const Icon = toneIcons[tone]

    return (
        <div className={cn(alertPanelVariants({ tone, weight, size }), className)} {...props}>
            {icon === true && <Icon className="mt-0.5 h-4 w-4 shrink-0" />}
            {React.isValidElement(icon) && icon}
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    )
}
