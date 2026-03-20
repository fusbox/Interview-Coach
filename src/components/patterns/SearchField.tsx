import * as React from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/cn"

export interface SearchFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    wrapperClassName?: string
}

export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
    ({ className, wrapperClassName, ...props }, ref) => {
        return (
            <div className={cn("group relative", wrapperClassName)}>
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled transition-colors group-focus-within:text-primary" />
                <input
                    ref={ref}
                    type="text"
                    className={cn(
                        "h-12 w-full rounded-2xl border border-border bg-surface-base pl-12 pr-4 text-sm placeholder:text-text-disabled transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                        className
                    )}
                    {...props}
                />
            </div>
        )
    }
)

SearchField.displayName = "SearchField"
