import React from "react";

export function SessionPromptShell({ children, className = "", ...rest }) {
    return (
        <div
            className={["glass-card", className].filter(Boolean).join(" ")}
            style={{
                borderRadius: "2rem",
                padding: 32,
                fontFamily: "var(--font-sans)",
                background: "linear-gradient(to bottom right, hsl(var(--brand-glass-start)), hsl(var(--brand-glass-end)))",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "1px solid rgba(255,255,255,0.2)",
                boxShadow: "var(--shadow-floating)",
            }}
            {...rest}
        >
            {children}
        </div>
    );
}
