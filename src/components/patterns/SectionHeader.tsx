import * as React from "react"
import { cn } from "@/lib/cn"

export interface SectionHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
    title: string | React.ReactNode
    description?: string | React.ReactNode
    actions?: React.ReactNode
    size?: "sm" | "md" | "lg"
    isPageHeader?: boolean
}

export function SectionHeader({
    title,
    description,
    actions,
    size = "md",
    isPageHeader = false,
    className,
    ...props
}: SectionHeaderProps) {
    const HeadingTag = isPageHeader ? "h1" : "h2"

    return (
        <div
            className={cn(
                "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
                className
            )}
            {...props}
        >
            <div className="space-y-1">
                <HeadingTag
                    className={cn(
                        "text-text-primary",
                        isPageHeader
                            ? "text-3xl font-semibold text-text-muted tracking-wider font-display"
                            : cn("font-semibold", {
                                "text-lg": size === "sm",
                                "text-xl": size === "md",
                                "text-2xl": size === "lg",
                            })
                    )}
                >
                    {title}
                </HeadingTag>
                {description && (
                    <div className={cn(
                        "text-text-muted",
                        {
                            "text-sm": size === "sm",
                            "text-sm sm:text-base": size === "md",
                            "text-base": size === "lg",
                        }
                    )}>
                        {description}
                    </div>
                )}
            </div>
            {actions && (
                <div className="flex items-center gap-3 shrink-0">
                    {actions}
                </div>
            )}
        </div>
    )
}
