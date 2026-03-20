import * as React from "react"
import { cn } from "@/lib/cn"
import { SectionHeader } from "@/components/patterns/SectionHeader"

export interface PageHeaderBlockProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
    title: string | React.ReactNode
    description?: string | React.ReactNode
    actions?: React.ReactNode
    supporting?: React.ReactNode
}

export function PageHeaderBlock({
    title,
    description,
    actions,
    supporting,
    className,
    ...props
}: PageHeaderBlockProps) {
    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-xl bg-transparent p-6 pl-7",
                className
            )}
            {...props}
        >
            <div className="absolute bottom-0 left-0 top-0 w-1 bg-primary/40" />
            <SectionHeader
                title={title}
                description={description}
                actions={actions}
                isPageHeader
            />
            {supporting && <div className="mt-5 pt-5">{supporting}</div>}
        </div>
    )
}
