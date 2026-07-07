import React from "react";

const css = `
.rjs-iconbadge{display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid transparent;transition:all var(--duration-base);}
.rjs-iconbadge--size-sm{width:var(--icon-capsule-sm);height:var(--icon-capsule-sm);border-radius:var(--radius-lg);}
.rjs-iconbadge--size-md{width:var(--icon-capsule-md);height:var(--icon-capsule-md);border-radius:var(--radius-xl);}
.rjs-iconbadge--size-lg{width:var(--icon-capsule-lg);height:var(--icon-capsule-lg);border-radius:var(--radius-2xl);}
.rjs-iconbadge--default{background:transparent;color:hsl(var(--muted-foreground));}
.rjs-iconbadge--info{background:#f0f9ff;color:#075985;border-color:#bae6fd;box-shadow:var(--shadow-flat);}
.rjs-iconbadge--success{background:#ecfdf5;color:#065f46;border-color:#34d399;box-shadow:var(--shadow-flat);}
.rjs-iconbadge--warning{background:#fffbeb;color:#78350f;border-color:#fde68a;box-shadow:var(--shadow-flat);}
.rjs-iconbadge--critical{background:#fff1f2;color:#9f1239;border-color:#fecdd3;box-shadow:var(--shadow-flat);}
.rjs-iconbadge--primary{background:hsl(var(--primary)/0.1);color:hsl(var(--primary));border-color:hsl(var(--primary)/0.2);box-shadow:var(--shadow-flat);}
.rjs-iconbadge--brand{background:hsl(var(--primary-deep)/0.1);color:hsl(var(--primary-deep));border-color:hsl(var(--primary-deep)/0.2);box-shadow:var(--shadow-flat);}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-iconbadge-css")) {
    const s = document.createElement("style");
    s.id = "rjs-iconbadge-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function IconBadge({ variant = "default", size = "md", className = "", children, ...rest }) {
    const classes = ["rjs-iconbadge", `rjs-iconbadge--${variant}`, `rjs-iconbadge--size-${size}`, className].filter(Boolean).join(" ");
    return <div className={classes} {...rest}>{children}</div>;
}
