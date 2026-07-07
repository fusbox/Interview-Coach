import React from "react";

const css = `
.rjs-surfacecard{border-radius:var(--radius-widget);border:1px solid rgb(var(--candidate-border)/0.8);background:rgb(var(--candidate-surface)/0.95);padding:24px;box-shadow:var(--candidate-shadow-card);font-family:var(--font-sans);color:rgb(var(--candidate-foreground));box-sizing:border-box;}
.rjs-surfacecard__header{margin-bottom:20px;display:flex;flex-direction:column;gap:8px;}
.rjs-surfacecard__eyebrow{font-size:12px;font-weight:var(--font-weight-semibold);text-transform:uppercase;letter-spacing:0.28em;color:rgb(var(--candidate-muted));margin:0;}
.rjs-surfacecard__title{font-size:20px;font-weight:var(--font-weight-semibold);color:rgb(var(--candidate-foreground));margin:0;}
.rjs-surfacecard__description{max-width:42rem;font-size:14px;line-height:1.75rem;color:rgb(var(--candidate-muted));margin:0;}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-surfacecard-css")) {
    const s = document.createElement("style");
    s.id = "rjs-surfacecard-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function SurfaceCard({ title, eyebrow, description, className = "", children, ...rest }) {
    return (
        <section className={["rjs-surfacecard", className].filter(Boolean).join(" ")} {...rest}>
            {(eyebrow || title || description) ? (
                <header className="rjs-surfacecard__header">
                    {eyebrow ? <p className="rjs-surfacecard__eyebrow">{eyebrow}</p> : null}
                    {title ? <h2 className="rjs-surfacecard__title">{title}</h2> : null}
                    {description ? <p className="rjs-surfacecard__description">{description}</p> : null}
                </header>
            ) : null}
            {children}
        </section>
    );
}
