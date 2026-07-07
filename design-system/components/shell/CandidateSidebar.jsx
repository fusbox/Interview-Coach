import React from "react";
import { Icon } from "../icons/Icon.jsx";

const NAV = [
    { label: "Dashboard", icon: "layout-dashboard" },
    { label: "Practice", icon: "mic" },
    { label: "Question set", icon: "list-checks" },
    { label: "Coach updates", icon: "sparkles" },
    { label: "Profile", icon: "circle-user" },
];

const css = `
.rjs-sidebar{display:flex;flex-direction:column;width:16rem;flex-shrink:0;height:100%;padding:24px 16px;background:rgb(var(--candidate-surface));border-right:1px solid rgb(var(--candidate-border)/0.7);font-family:var(--font-sans);box-sizing:border-box;}
.rjs-sidebar__brand{display:flex;align-items:center;gap:10px;padding:0 8px 24px;}
.rjs-sidebar__brand img{height:28px;width:auto;}
.rjs-sidebar__nav{display:flex;flex-direction:column;gap:4px;margin-top:8px;}
.rjs-sidebar__link{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:var(--radius-xl);font-size:14px;font-weight:var(--font-weight-medium);color:rgb(var(--candidate-muted));text-decoration:none;cursor:pointer;border:none;background:transparent;width:100%;text-align:left;transition:transform var(--duration-base) var(--ease-standard),background var(--duration-base),color var(--duration-base);}
.rjs-sidebar__link:hover{background:rgb(var(--candidate-background));color:rgb(var(--candidate-foreground));transform:scale(1.02);}
.rjs-sidebar__link--active{background:rgb(var(--candidate-primary-soft));color:rgb(var(--candidate-primary));font-weight:var(--font-weight-semibold);}
.rjs-sidebar__spacer{flex:1;}
.rjs-sidebar__cta{margin-top:8px;}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-sidebar-css")) {
    const s = document.createElement("style");
    s.id = "rjs-sidebar-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function CandidateSidebar({ activeLabel = "Dashboard", logoSrc, onNavigate, footer, className = "", ...rest }) {
    return (
        <aside className={["rjs-sidebar", className].filter(Boolean).join(" ")} {...rest}>
            <div className="rjs-sidebar__brand">
                {logoSrc ? <img src={logoSrc} alt="TalentArbor" /> : <strong style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "rgb(var(--candidate-foreground))" }}>TalentArbor</strong>}
            </div>
            <nav className="rjs-sidebar__nav">
                {NAV.map((item) => {
                    const active = item.label === activeLabel;
                    return (
                        <button
                            key={item.label}
                            className={["rjs-sidebar__link", active ? "rjs-sidebar__link--active" : ""].filter(Boolean).join(" ")}
                            onClick={() => onNavigate && onNavigate(item.label)}
                        >
                            <Icon name={item.icon} size={18} strokeWidth={active ? 2.4 : 2} />
                            {item.label}
                        </button>
                    );
                })}
            </nav>
            <div className="rjs-sidebar__spacer" />
            {footer ? <div className="rjs-sidebar__cta">{footer}</div> : null}
        </aside>
    );
}
