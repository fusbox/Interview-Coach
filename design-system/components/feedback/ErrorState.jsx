import React from "react";
import { Icon } from "../icons/Icon.jsx";
import { Button } from "../actions/Button.jsx";

const css = `
.rjs-errorstate{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:64px 24px;border:1px solid hsl(var(--state-critical)/0.1);border-radius:var(--radius-2xl);background:hsl(var(--state-critical)/0.05);font-family:var(--font-sans);}
.rjs-errorstate__iconwrap{margin-bottom:24px;display:flex;align-items:center;justify-content:center;width:80px;height:80px;border-radius:9999px;background:hsl(var(--surface-base));border:1px solid hsl(var(--state-critical)/0.2);box-shadow:var(--shadow-raised-1);color:#be123c;}
.rjs-errorstate__title{font-size:20px;font-weight:var(--font-weight-semibold);color:hsl(var(--text-primary));margin:0;}
.rjs-errorstate__desc{font-size:14px;color:hsl(var(--text-muted));margin:4px 0 0;max-width:28rem;}
.rjs-errorstate__code{margin-top:24px;padding:16px;background:rgba(0,0,0,0.05);border-radius:var(--radius-md);border:1px solid hsl(var(--border)/0.5);max-width:32rem;overflow:auto;font-size:var(--text-micro-size);color:hsl(var(--muted-foreground));white-space:pre-wrap;font-family:monospace;}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-errorstate-css")) {
    const s = document.createElement("style");
    s.id = "rjs-errorstate-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function ErrorState({
    title = "Something went wrong",
    description = "We encountered an error while loading this content. Please try again or contact support if the issue persists.",
    icon,
    onRetry,
    error,
    className = "",
    ...rest
}) {
    return (
        <div className={["rjs-errorstate", className].filter(Boolean).join(" ")} {...rest}>
            <div className="rjs-errorstate__iconwrap">
                {icon || <Icon name="alert-circle" size={48} />}
            </div>
            <h2 className="rjs-errorstate__title">{title}</h2>
            <p className="rjs-errorstate__desc">{description}</p>
            {error ? <code className="rjs-errorstate__code">{typeof error === "string" ? error : error.message}</code> : null}
            {onRetry ? (
                <div style={{ marginTop: 32 }}>
                    <Button variant="outline" onClick={onRetry}>
                        <Icon name="refresh-cw" size={16} /> Try Again
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
