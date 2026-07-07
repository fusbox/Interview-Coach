import React from "react";

const css = `
.rjs-datatable-wrap{border-radius:var(--radius-xl);border:1px solid hsl(var(--border));overflow:hidden;background:hsl(var(--card));font-family:var(--font-sans);}
.rjs-datatable{width:100%;border-collapse:collapse;font-size:14px;}
.rjs-datatable thead th{background:hsl(var(--surface-subtle));text-align:left;padding:12px 16px;font-size:var(--text-micro-size);font-weight:var(--font-weight-bold);text-transform:uppercase;letter-spacing:0.05em;color:hsl(var(--text-muted));border-bottom:1px solid hsl(var(--border));}
.rjs-datatable tbody td{padding:14px 16px;color:hsl(var(--text-primary));border-bottom:1px solid hsl(var(--border)/0.6);}
.rjs-datatable tbody tr:last-child td{border-bottom:none;}
.rjs-datatable tbody tr{transition:background var(--duration-fast);}
.rjs-datatable tbody tr:hover{background:hsl(var(--surface-subtle)/0.6);}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-datatable-css")) {
    const s = document.createElement("style");
    s.id = "rjs-datatable-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function DataTable({ columns = [], rows = [], renderCell, className = "", ...rest }) {
    return (
        <div className={["rjs-datatable-wrap", className].filter(Boolean).join(" ")} {...rest}>
            <table className="rjs-datatable">
                <thead>
                    <tr>
                        {columns.map((col) => (
                            <th key={col.key} style={col.align ? { textAlign: col.align } : undefined}>{col.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={row.id ?? i}>
                            {columns.map((col) => (
                                <td key={col.key} style={col.align ? { textAlign: col.align } : undefined}>
                                    {renderCell ? renderCell(row, col) : row[col.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
