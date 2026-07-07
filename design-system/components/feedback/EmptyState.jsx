import React from "react";
import { Icon } from "../icons/Icon.jsx";

const css = `
.rjs-emptystate{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:64px 24px;font-family:var(--font-sans);}
.rjs-emptystate--border{border:1px dashed hsl(var(--border));border-radius:var(--radius-2xl);background:hsl(var(--surface-subtle)/0.5);}
.rjs-emptystate__iconwrap{margin-bottom:24px;display:flex;align-items:center;justify-content:center;width:80px;height:80px;border-radius:9999px;background:hsl(var(--surface-base));border:1px solid hsl(var(--border));box-shadow:var(--shadow-flat);}
.rjs-emptystate__title{font-size:20px;font-weight:var(--font-weight-semibold);color:hsl(var(--text-primary));margin:0;}
.rjs-emptystate__desc{font-size:14px;color:hsl(var(--text-muted));margin:4px 0 0;max-width:28rem;}
.rjs-emptystate__actions{margin-top:32px;display:flex;align-items:center;gap:12px;}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-emptystate-css")) {
    const s = document.createElement("style");
    s.id = "rjs-emptystate-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function EmptyState({ title, description, icon, actions, border = true, className = "", ...rest }) {
    return (
        <div className={["rjs-emptystate", border ? "rjs-emptystate--border" : "", className].filter(Boolean).join(" ")} {...rest}>
            <div className="rjs-emptystate__iconwrap">
                {icon || <Icon name="inbox" size={48} style={{ color: "hsl(var(--muted-foreground) / 0.3)" }} />}
            </div>
            <h2 className="rjs-emptystate__title">{title}</h2>
            {description ? <p className="rjs-emptystate__desc">{description}</p> : null}
            {actions ? <div className="rjs-emptystate__actions">{actions}</div> : null}
        </div>
    );
}
