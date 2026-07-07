import React from "react";

export function Progress({ value = 0, style, className = "", ...rest }) {
    return (
        <div
            className={className}
            style={{
                position: "relative",
                height: 16,
                width: "100%",
                overflow: "hidden",
                borderRadius: 9999,
                background: "#f1f5f9",
                ...style,
            }}
            {...rest}
        >
            <div
                style={{
                    height: "100%",
                    width: "100%",
                    background: "#2563eb",
                    transition: "transform 500ms ease-in-out",
                    transform: `translateX(-${100 - (value || 0)}%)`,
                }}
            />
        </div>
    );
}
