"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
    value?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
    ({ className, value, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                "relative h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800",
                className
            )}
            {...props}
        >
            <div
                className="h-full w-full flex-1 bg-blue-600 transition-all duration-500 ease-in-out"
                style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
            />
        </div>
    )
);
Progress.displayName = "Progress";

export { Progress };
