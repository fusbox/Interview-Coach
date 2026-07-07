import React from "react";
import { Icon } from "../icons/Icon.jsx";

const css = `
.rjs-alertpanel{border-radius:var(--radius-2xl);border:1px solid;font-size:14px;display:flex;align-items:flex-start;gap:12px;font-family:var(--font-sans);color:hsl(var(--text-primary));box-sizing:border-box;}
.rjs-alertpanel--size-md{padding:12px 16px;}
.rjs-alertpanel--size-sm{border-radius:var(--radius-xl);padding:12px;}
.rjs-alertpanel--weight-medium{font-weight:var(--font-weight-medium);}
.rjs-alertpanel--weight-semibold{font-weight:var(--font-weight-semibold);}
.rjs-alertpanel--critical{border-color:hsl(var(--state-critical)/0.25);background:hsl(var(--state-critical)/0.05);}
.rjs-alertpanel--critical svg{color:#be123c;}
.rjs-alertpanel--success{border-color:hsl(var(--state-success)/0.4);background:hsl(var(--state-success)/0.05);}
.rjs-alertpanel--success svg{color:#047857;}
.rjs-alertpanel--info{border-color:hsl(var(--state-info)/0.25);background:hsl(var(--state-info)/0.05);}
.rjs-alertpanel--info svg{color:#0369a1;}
.rjs-alertpanel--warning{border-color:hsl(var(--state-warning)/0.25);background:hsl(var(--state-warning)/0.05);}
.rjs-alertpanel--warning svg{color:#92400e;}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-alertpanel-css")) {
    const s = document.createElement("style");
    s.id = "rjs-alertpanel-css";
    s.textContent = css;
    document.head.appendChild(s);
}

const TONE_ICON = { critical: "alert-circle", success: "check-circle", info: "info", warning: "alert-triangle" };

export function AlertPanel({ tone = "critical", weight = "medium", size = "md", icon = false, className = "", children, ...rest }) {
    const classes = [
        "rjs-alertpanel",
        `rjs-alertpanel--${tone}`,
        `rjs-alertpanel--weight-${weight}`,
        `rjs-alertpanel--size-${size}`,
        className,
    ].filter(Boolean).join(" ");
    return (
        <div className={classes} {...rest}>
            {icon === true ? <Icon name={TONE_ICON[tone]} size={16} style={{ marginTop: 2 }} /> : (icon || null)}
            <div style={{ minWidth: 0, flex: 1 }}>{children}</div>
        </div>
    );
}
