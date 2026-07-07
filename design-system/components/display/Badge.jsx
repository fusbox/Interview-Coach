import React from "react";

const css = `
.rjs-badge{display:inline-flex;align-items:center;border-radius:9999px;border:1px solid transparent;padding:2px 10px;font-size:12px;font-weight:var(--font-weight-semibold);font-family:var(--font-sans);transition:color var(--duration-base);}
.rjs-badge--default{background:hsl(var(--primary));color:hsl(var(--primary-foreground));}
.rjs-badge--secondary{background:hsl(var(--secondary));color:hsl(var(--secondary-foreground));}
.rjs-badge--destructive{background:hsl(var(--destructive));color:hsl(var(--destructive-foreground));}
.rjs-badge--outline{background:transparent;color:hsl(var(--foreground));box-shadow:var(--shadow-flat);}
.rjs-badge--success,.rjs-badge--high{background:hsl(var(--state-success));color:#fff;}
.rjs-badge--warning,.rjs-badge--medium{background:hsl(var(--state-warning));color:#fff;}
.rjs-badge--info{background:hsl(var(--state-info));color:#fff;}
.rjs-badge--low{background:hsl(var(--readiness-low));color:#fff;}
.rjs-badge--unknown{background:hsl(var(--readiness-unknown));color:hsl(var(--muted-foreground));}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-badge-css")) {
    const s = document.createElement("style");
    s.id = "rjs-badge-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function Badge({ variant = "default", className = "", ...rest }) {
    return <div className={["rjs-badge", `rjs-badge--${variant}`, className].filter(Boolean).join(" ")} {...rest} />;
}
