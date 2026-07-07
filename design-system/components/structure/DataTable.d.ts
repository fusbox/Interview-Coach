/**
 * Bordered data table with uppercase micro headers and hover rows.
 * @startingPoint section="Structure" subtitle="Bordered data table" viewport="700x240"
 */
export interface DataTableColumn {
    key: string;
    label: string;
    align?: "left" | "center" | "right";
}
export interface DataTableProps extends React.HTMLAttributes<HTMLDivElement> {
    columns: DataTableColumn[];
    rows: Array<Record<string, any>>;
    /** custom cell renderer; defaults to row[col.key] */
    renderCell?: (row: Record<string, any>, col: DataTableColumn) => React.ReactNode;
}
export declare function DataTable(props: DataTableProps): JSX.Element;
