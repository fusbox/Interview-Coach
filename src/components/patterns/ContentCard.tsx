import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/cn"

const contentCardVariants = cva(
    "border bg-card text-card-foreground",
    {
        variants: {
            density: {
                default: "rounded-2xl p-6 shadow-raised-1",
                spacious: "rounded-3xl p-8 md:p-10 shadow-raised-2",
                hero: "rounded-[2rem] p-8 md:p-10 shadow-floating",
            },
            align: {
                left: "text-left",
                center: "text-center",
            },
        },
        defaultVariants: {
            density: "default",
            align: "left",
        },
    }
)

export interface ContentCardProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof contentCardVariants> {}

export function ContentCard({
    className,
    density,
    align,
    ...props
}: ContentCardProps) {
    return <div className={cn(contentCardVariants({ density, align }), className)} {...props} />
}
