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
                info: "bg-state-info/10 text-state-info border-state-info/20",
                success: "bg-state-success/10 text-state-success border-state-success/20",
                warning: "bg-state-warning/10 text-state-warning border-state-warning/20",
                critical: "bg-state-critical/10 text-state-critical border-state-critical/20",
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
