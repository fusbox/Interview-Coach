import React from "react";
import { Icon } from "../icons/Icon.jsx";

const css = `
.rjs-statusbadge{display:inline-flex;align-items:center;gap:6px;border-radius:9999px;border:1px solid;font-weight:var(--font-weight-medium);text-transform:uppercase;letter-spacing:0.05em;font-family:var(--font-sans);width:fit-content;}
.rjs-statusbadge--size-sm{padding:2px 8px;font-size:var(--text-micro-size);}
.rjs-statusbadge--size-md{padding:2px 10px;font-size:12px;}
.rjs-statusbadge--size-lg{padding:4px 12px;font-size:14px;}
.rjs-statusbadge--full{width:100%;justify-content:center;}
.rjs-statusbadge--success,.rjs-statusbadge--readinessHigh{background:#ecfdf5;color:#065f46;border-color:#34d399;}
.rjs-statusbadge--warning,.rjs-statusbadge--readinessMedium{background:#fffbeb;color:#78350f;border-color:#fde68a;}
.rjs-statusbadge--critical,.rjs-statusbadge--readinessLow{background:#fff1f2;color:#9f1239;border-color:#fecdd3;}
.rjs-statusbadge--info,.rjs-statusbadge--readinessPotential{background:#f0f9ff;color:#075985;border-color:#bae6fd;}
.rjs-statusbadge--neutral{background:hsl(var(--muted));color:hsl(var(--muted-foreground));border-color:hsl(var(--border));}
.rjs-statusbadge--progressIdle{background:transparent;color:hsl(var(--muted-foreground));border-color:hsl(var(--border));}
.rjs-statusbadge--progressStarted{background:#f0f9ff;color:#075985;border-color:#bae6fd;}
.rjs-statusbadge--progressSolid{background:hsl(var(--state-info));color:hsl(var(--text-inverse));border-color:transparent;}
.rjs-statusbadge--progressComplete{background:hsl(var(--state-success));color:hsl(var(--text-inverse));border-color:transparent;}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-statusbadge-css")) {
    const s = document.createElement("style");
    s.id = "rjs-statusbadge-css";
    s.textContent = css;
    document.head.appendChild(s);
}

const VARIANT_ICON = {
    success: "check-circle", readinessHigh: "check-circle", readinessPotential: "check-circle", progressComplete: "check-circle",
    warning: "alert-triangle", readinessMedium: "alert-triangle",
    critical: "alert-circle", readinessLow: "alert-circle",
    info: "clock", progressSolid: "clock", progressStarted: "clock",
};

export function StatusBadge({ variant = "neutral", size = "md", fullWidth = false, icon = true, className = "", children, ...rest }) {
    const iconName = VARIANT_ICON[variant] || "help-circle";
    const iconSize = size === "sm" ? 12 : size === "lg" ? 16 : 14;
    const classes = [
        "rjs-statusbadge",
        `rjs-statusbadge--${variant}`,
        `rjs-statusbadge--size-${size}`,
        fullWidth ? "rjs-statusbadge--full" : "",
        className,
    ].filter(Boolean).join(" ");
    return (
        <div className={classes} {...rest}>
            {icon ? <Icon name={iconName} size={iconSize} /> : null}
            {children}
        </div>
    );
}
