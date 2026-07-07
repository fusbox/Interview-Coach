import React from "react";
import { Icon } from "../icons/Icon.jsx";

const css = `
.rjs-searchfield{position:relative;}
.rjs-searchfield__icon{position:absolute;left:16px;top:50%;transform:translateY(-50%);color:hsl(var(--muted-foreground));pointer-events:none;transition:color var(--duration-base);}
.rjs-searchfield:focus-within .rjs-searchfield__icon{color:hsl(var(--primary));}
.rjs-searchfield__input{height:48px;width:100%;border-radius:var(--radius-2xl);border:1px solid hsl(var(--border));background:hsl(var(--surface-base));padding:0 16px 0 48px;font-size:14px;font-family:var(--font-sans);color:hsl(var(--text-primary));transition:all var(--duration-base) var(--ease-standard);box-sizing:border-box;}
.rjs-searchfield__input::placeholder{color:hsl(var(--muted-foreground));}
.rjs-searchfield__input:focus-visible{border-color:hsl(var(--primary));outline:2px solid hsl(var(--ring));outline-offset:2px;}
`;

if (typeof document !== "undefined" && !document.getElementById("rjs-searchfield-css")) {
    const s = document.createElement("style");
    s.id = "rjs-searchfield-css";
    s.textContent = css;
    document.head.appendChild(s);
}

export function SearchField({ wrapperClassName = "", className = "", ...rest }) {
    return (
        <div className={["rjs-searchfield", wrapperClassName].filter(Boolean).join(" ")}>
            <Icon name="search" size={16} className="rjs-searchfield__icon" />
            <input
                type="text"
                className={["rjs-searchfield__input", className].filter(Boolean).join(" ")}
                {...rest}
            />
        </div>
    );
}
