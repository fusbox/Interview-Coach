import * as React from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/cn"
import { EmptyState } from "./EmptyState"
import { Loader2 } from "lucide-react"

export interface DataTableColumn<T> {
    header: string | React.ReactNode
    accessorKey?: keyof T | string
    cell?: (item: T) => React.ReactNode
    className?: string
}

export interface DataTableProps<T> extends React.HTMLAttributes<HTMLDivElement> {
    columns: DataTableColumn<T>[]
    data: T[]
    isLoading?: boolean
    emptyState?: React.ReactNode
    onRowClick?: (item: T) => void
}

export function DataTable<T>({
    columns,
    data,
    isLoading,
    emptyState,
    onRowClick,
    className,
    ...props
}: DataTableProps<T>) {
    return (
        <div className={cn("overflow-hidden rounded-2xl border bg-card shadow-flat", className)} {...props}>
            <Table>
                <TableHeader className="bg-surface-subtle/50">
                    <TableRow className="hover:bg-transparent">
                        {columns.map((column, idx) => (
                            <TableHead key={idx} className={cn("text-micro font-bold uppercase tracking-widest py-3", column.className)}>
                                {column.header}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-32 text-center">
                                <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                    <Loader2 className="animate-spin" size={20} />
                                    <span className="text-xs">Loading data...</span>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : data.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="p-0">
                                {emptyState || (
                                    <EmptyState
                                        title="No data available"
                                        border={false}
                                        className="py-12"
                                    />
                                )}
                            </TableCell>
                        </TableRow>
                    ) : (
                        data.map((item, rowIdx) => (
                            <TableRow
                                key={rowIdx}
                                className={cn(
                                    "transition-colors hover:bg-surface-subtle/30",
                                    onRowClick && "cursor-pointer"
                                )}
                                onClick={() => onRowClick?.(item)}
                            >
                                {columns.map((column, colIdx) => (
                                    <TableCell key={colIdx} className={cn("py-4 text-sm", column.className)}>
                                        {column.cell
                                            ? column.cell(item)
                                            : column.accessorKey
                                                ? String(item[column.accessorKey as keyof T] ?? "")
                                                : null}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
