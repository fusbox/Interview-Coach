import React from "react";
import { Icon } from "../icons/Icon.jsx";

const DOCK = [
    { label: "Dashboard", icon: "layout-dashboard" },
    { label: "Practice", icon: "mic" },
    { label: "Questions", icon: "list-checks" },
    { label: "Profile", icon: "circle-user" },
];

const css = `
.rjs-dock{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:40;display:flex;align-items:center;gap:4px;padding:8px;border-radius:9999px;background:rgb(var(--candidate-surface)/0.9);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgb(var(--candidate-border)/0.7);box-shadow:var(--candidate-shadow-panel);font-family:var(--font-sans);}
.rjs-dock__link{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 16px;border-radius:9999px;border:none;background:transparent;color:rgb(var(--candidate-muted));font-size:10px;font-weight:var(--font-weight-semibold);cursor:pointer;transition:all var(--duration-base);min-width:44px;min-height:44px;justify-content:center;}
.rjs-dock__link--active{background:rgb(var(--candidate-primary-soft));color:rgb(var(--candidate-primary));}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-dock-css")) {
    const s = document.createElement("style");
    s.id = "rjs-dock-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function CandidateMobileDock({ activeLabel = "Dashboard", onNavigate, className = "", ...rest }) {
    return (
        <nav className={["rjs-dock", className].filter(Boolean).join(" ")} {...rest}>
            {DOCK.map((item) => {
                const active = item.label === activeLabel;
                return (
                    <button
                        key={item.label}
                        className={["rjs-dock__link", active ? "rjs-dock__link--active" : ""].filter(Boolean).join(" ")}
                        onClick={() => onNavigate && onNavigate(item.label)}
                    >
                        <Icon name={item.icon} size={18} strokeWidth={active ? 2.4 : 2} />
                        {item.label}
                    </button>
                );
            })}
        </nav>
    );
}
