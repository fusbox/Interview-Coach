import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/cn"
import { LucideIcon } from "lucide-react"

const iconBadgeVariants = cva(
    "flex items-center justify-center shrink-0 border shadow-flat transition-all",
    {
        variants: {
            variant: {
                default: "bg-transparent text-muted-foreground border-none shadow-none",
                info: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:border-sky-400/30",
                success: "bg-emerald-50 text-emerald-800 border-emerald-400 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-400/50",
                warning: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-400/30",
                critical: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-400/30",
                primary: "bg-primary/10 text-primary border-primary/20",
                brand: "bg-brand-deep/10 text-brand-deep border-brand-deep/20",
            },
            size: {
                sm: "w-8 h-8 rounded-lg",
                md: "w-10 h-10 rounded-xl",
                lg: "w-12 h-12 rounded-2xl",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "md",
        },
    }
)

export interface IconBadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof iconBadgeVariants> {
    icon: LucideIcon
}

export function IconBadge({
    className,
    variant,
    size,
    icon: Icon,
    ...props
}: IconBadgeProps) {
    const iconSize = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;

    return (
        <div
            className={cn(iconBadgeVariants({ variant, size }), className)}
            {...props}
        >
            <Icon size={iconSize} strokeWidth={2.5} />
        </div>
    )
}
