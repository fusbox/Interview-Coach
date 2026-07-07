import React from "react";
import { Icon } from "../icons/Icon.jsx";

const css = `
.rjs-disclosure{border-top:1px solid rgb(var(--candidate-border)/0.7);padding:24px 0;display:flex;align-items:flex-start;gap:12px;font-family:var(--font-sans);}
.rjs-disclosure__icon{color:rgb(var(--candidate-accent));flex-shrink:0;margin-top:2px;}
.rjs-disclosure__text{font-size:12px;line-height:1.7;color:rgb(var(--candidate-muted));max-width:48rem;margin:0;}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-disclosure-css")) {
    const s = document.createElement("style");
    s.id = "rjs-disclosure-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function CandidateDisclosureFooter({ children, className = "", ...rest }) {
    return (
        <footer className={["rjs-disclosure", className].filter(Boolean).join(" ")} {...rest}>
            <Icon name="shield-check" size={16} className="rjs-disclosure__icon" />
            <p className="rjs-disclosure__text">
                {children || "Your answers are used to provide coaching and improve your practice. They are protected by access controls and are not shared with recruiters or employers for hiring decisions."}
            </p>
        </footer>
    );
}
