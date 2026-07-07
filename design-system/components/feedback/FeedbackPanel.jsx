import React from "react";
import { Icon } from "../icons/Icon.jsx";
import { Badge } from "../display/Badge.jsx";

const css = `
.rjs-feedbackpanel{border-radius:var(--radius-xl);border:1px solid hsl(var(--border));border-left-width:4px;background:hsl(var(--card));box-shadow:var(--shadow-raised-1);overflow:hidden;font-family:var(--font-sans);}
.rjs-feedbackpanel__header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:24px 24px 12px;}
.rjs-feedbackpanel__titlewrap{display:flex;align-items:center;gap:8px;}
.rjs-feedbackpanel__iconwrap{padding:6px;border-radius:var(--radius-md);background:hsl(var(--surface-subtle));border:1px solid hsl(var(--border));box-shadow:var(--shadow-flat);display:flex;}
.rjs-feedbackpanel__title{font-size:16px;font-weight:var(--font-weight-bold);margin:0;color:hsl(var(--text-primary));}
.rjs-feedbackpanel__body{padding:0 24px 24px;font-size:14px;color:hsl(var(--text-secondary));line-height:1.625;white-space:pre-wrap;}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-feedbackpanel-css")) {
    const s = document.createElement("style");
    s.id = "rjs-feedbackpanel-css";
    s.textContent = css;
    document.head.appendChild(s);
}

const ASSESSMENT = {
    outstanding: { badge: "high", label: "Outstanding", icon: "sparkles", color: "#065f46", border: "hsl(var(--state-success))" },
    satisfactory: { badge: "medium", label: "Satisfactory", icon: "check-circle", color: "#075985", border: "hsl(var(--state-info))" },
    growth: { badge: "low", label: "Growth Opportunity", icon: "target", color: "#78350f", border: "hsl(var(--state-warning))" },
    critical: { badge: "destructive", label: "Critical Issue", icon: "alert-triangle", color: "#9f1239", border: "hsl(var(--state-critical))" },
};

export function FeedbackPanel({ title, body, assessment, icon, className = "", ...rest }) {
    const config = assessment ? ASSESSMENT[assessment] : null;
    return (
        <div
            className={["rjs-feedbackpanel", className].filter(Boolean).join(" ")}
            style={{ borderLeftColor: config ? config.border : "hsl(var(--primary))" }}
            {...rest}
        >
            <div className="rjs-feedbackpanel__header">
                <div className="rjs-feedbackpanel__titlewrap">
                    <div className="rjs-feedbackpanel__iconwrap" style={{ color: config ? config.color : "hsl(var(--primary))" }}>
                        {icon || <Icon name={config ? config.icon : "sparkles"} size={16} />}
                    </div>
                    <h4 className="rjs-feedbackpanel__title">{title}</h4>
                </div>
                {config ? <Badge variant={config.badge}>{config.label}</Badge> : null}
            </div>
            <div className="rjs-feedbackpanel__body">{body}</div>
        </div>
    );
}
