import React from "react";

const css = `
.rjs-card{border-radius:var(--radius-xl);border:1px solid hsl(var(--border));background:hsl(var(--card));color:hsl(var(--card-foreground));box-shadow:var(--shadow-raised-1);transition:all var(--duration-base) var(--ease-standard);font-family:var(--font-sans);}
.rjs-card--glass{background:linear-gradient(to bottom right,hsl(var(--brand-glass-start)),hsl(var(--brand-glass-end)));backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.2);box-shadow:var(--shadow-floating);}
.rjs-card__header{display:flex;flex-direction:column;gap:6px;padding:24px;}
.rjs-card__title{font-size:24px;font-weight:var(--font-weight-semibold);line-height:1;margin:0;}
.rjs-card__description{font-size:14px;color:hsl(var(--muted-foreground));margin:0;}
.rjs-card__content{padding:0 24px 24px;}
.rjs-card__footer{display:flex;align-items:center;padding:0 24px 24px;}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-card-css")) {
    const s = document.createElement("style");
    s.id = "rjs-card-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function Card({ variant = "default", className = "", ...rest }) {
    const classes = ["rjs-card", variant === "glass" ? "rjs-card--glass" : "", className].filter(Boolean).join(" ");
    return <div className={classes} {...rest} />;
}

export function CardHeader({ className = "", ...rest }) {
    return <div className={["rjs-card__header", className].filter(Boolean).join(" ")} {...rest} />;
}

export function CardTitle({ className = "", ...rest }) {
    return <h3 className={["rjs-card__title", className].filter(Boolean).join(" ")} {...rest} />;
}

export function CardDescription({ className = "", ...rest }) {
    return <p className={["rjs-card__description", className].filter(Boolean).join(" ")} {...rest} />;
}

export function CardContent({ className = "", ...rest }) {
    return <div className={["rjs-card__content", className].filter(Boolean).join(" ")} {...rest} />;
}

export function CardFooter({ className = "", ...rest }) {
    return <div className={["rjs-card__footer", className].filter(Boolean).join(" ")} {...rest} />;
}
