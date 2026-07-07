import React from "react";
import { Icon } from "../icons/Icon.jsx";

const css = `
@keyframes rjs-pill-pop{from{opacity:0;transform:translate(-50%,10px) scale(0.5);}to{opacity:1;transform:translate(-50%,-20px) scale(1);}}
.rjs-feedbackpill{position:absolute;bottom:100%;left:50%;z-index:20;pointer-events:none;padding-bottom:8px;animation:rjs-pill-pop 250ms var(--ease-emphasized) both;}
.rjs-feedbackpill__bubble{background:hsl(var(--state-success));color:hsl(var(--text-inverse));border-radius:9999px;box-shadow:var(--shadow-raised-2);display:flex;align-items:center;justify-content:center;white-space:nowrap;font-family:var(--font-sans);}
.rjs-feedbackpill__bubble--text{padding:2px 8px;gap:4px;}
.rjs-feedbackpill__bubble--icononly{padding:6px;}
.rjs-feedbackpill__label{font-size:var(--text-micro-size);line-height:var(--text-micro-line);font-weight:var(--font-weight-bold);text-transform:uppercase;letter-spacing:var(--text-micro-tracking);}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-feedbackpill-css")) {
    const s = document.createElement("style");
    s.id = "rjs-feedbackpill-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function FeedbackPill({ isVisible, text = "", icon, className = "", ...rest }) {
    if (!isVisible) return null;
    return (
        <div className={["rjs-feedbackpill", className].filter(Boolean).join(" ")} {...rest}>
            <div className={`rjs-feedbackpill__bubble rjs-feedbackpill__bubble--${text ? "text" : "icononly"}`}>
                {icon || <Icon name="check" size={10} strokeWidth={4} />}
                {text ? <span className="rjs-feedbackpill__label">{text}</span> : null}
            </div>
        </div>
    );
}
