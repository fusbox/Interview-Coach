import React from "react";

const css = `
.rjs-metriccard{font-family:var(--font-sans);}
.rjs-metriccard--card{border-radius:var(--radius-xl);background:hsl(var(--card));color:hsl(var(--card-foreground));overflow:hidden;}
.rjs-metriccard--glass{background:linear-gradient(to bottom right,hsl(var(--brand-glass-start)),hsl(var(--brand-glass-end)));backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.2);}
.rjs-metriccard__title{font-size:12px;font-weight:var(--font-weight-bold);color:hsl(var(--text-muted));text-transform:uppercase;letter-spacing:0.1em;line-height:1;margin:0;}
.rjs-metriccard__desc{font-size:12px;color:hsl(var(--muted-foreground));margin:4px 0 0;}
.rjs-metriccard__value{font-family:var(--font-display);font-size:var(--type-metric-value-size);line-height:var(--type-metric-value-line);font-weight:var(--type-metric-value-weight);color:hsl(var(--foreground));}
.rjs-metriccard__trend{margin:4px 0 0;font-size:12px;font-weight:var(--font-weight-semibold);display:flex;align-items:center;gap:4px;}
.rjs-metriccard__trend--up{color:#065f46;}
.rjs-metriccard__trend--down{color:#9f1239;}
.rjs-metriccard__trend-note{color:hsl(var(--text-muted));font-weight:var(--font-weight-normal);margin-left:4px;}
.rjs-metriccard--pill{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 16px;border-radius:var(--radius-xl);border:1px solid hsl(var(--border)/0.1);box-shadow:var(--shadow-raised-1);width:100%;box-sizing:border-box;}
.rjs-metriccard--pill .rjs-metriccard__title{font-size:10px;margin-bottom:2px;white-space:nowrap;}
.rjs-metriccard--pill .rjs-metriccard__value{font-size:14px;}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-metriccard-css")) {
    const s = document.createElement("style");
    s.id = "rjs-metriccard-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function MetricCard({ title, value, description, trend, variant = "default", valueStyle, className = "", ...rest }) {
    if (variant === "pill") {
        return (
            <div className={["rjs-metriccard", "rjs-metriccard--pill", className].filter(Boolean).join(" ")} {...rest}>
                <span className="rjs-metriccard__title">{title}</span>
                <span className="rjs-metriccard__value" style={valueStyle}>{value}</span>
            </div>
        );
    }
    return (
        <div className={["rjs-metriccard", "rjs-metriccard--card", variant === "glass" ? "rjs-metriccard--glass" : "", className].filter(Boolean).join(" ")} {...rest}>
            <div style={{ padding: "20px 20px 8px" }}>
                <p className="rjs-metriccard__title">{title}</p>
                {description ? <p className="rjs-metriccard__desc">{description}</p> : null}
            </div>
            <div style={{ padding: "0 20px 20px" }}>
                <div className="rjs-metriccard__value" style={valueStyle}>{value}</div>
                {trend ? (
                    <p className={`rjs-metriccard__trend rjs-metriccard__trend--${trend.positive ? "up" : "down"}`}>
                        {trend.positive ? "↑" : "↓"} {trend.value}
                        <span className="rjs-metriccard__trend-note">vs last session</span>
                    </p>
                ) : null}
            </div>
        </div>
    );
}
