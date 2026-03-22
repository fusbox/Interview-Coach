import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/cn"

const insightCardVariants = cva("rounded-2xl border p-5", {
    variants: {
        tone: {
            positive: "border-emerald-400/70 bg-emerald-50/60 dark:border-emerald-400/40 dark:bg-emerald-900/10",
            caution: "border-rose-200/60 bg-rose-50/60 dark:border-rose-500/20 dark:bg-rose-900/10",
            highlight: "border-purple-200/60 bg-purple-50/50 dark:border-purple-500/20 dark:bg-purple-900/10",
            neutral: "border-border/60 bg-surface-subtle",
        },
    },
    defaultVariants: {
        tone: "neutral",
    },
})

export interface InsightCardProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof insightCardVariants> {}

export function InsightCard({ className, tone, ...props }: InsightCardProps) {
    return <div className={cn(insightCardVariants({ tone }), className)} {...props} />
}
