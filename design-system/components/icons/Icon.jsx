import React from "react";

/* Lucide icon path data (recreated from lucide.dev, ISC license) — the product's
   only icon system. 24x24 grid, stroke=currentColor, round caps/joins. */
const PATHS = {
    "plus": [["path", { d: "M5 12h14" }], ["path", { d: "M12 5v14" }]],
    "x": [["path", { d: "M18 6 6 18" }], ["path", { d: "m6 6 12 12" }]],
    "check": [["path", { d: "M20 6 9 17l-5-5" }]],
    "search": [["circle", { cx: 11, cy: 11, r: 8 }], ["path", { d: "m21 21-4.3-4.3" }]],
    "chevron-right": [["path", { d: "m9 18 6-6-6-6" }]],
    "chevron-left": [["path", { d: "m15 18-6-6 6-6" }]],
    "chevron-down": [["path", { d: "m6 9 6 6 6-6" }]],
    "chevrons-up-down": [["path", { d: "m7 15 5 5 5-5" }], ["path", { d: "m7 9 5-5 5 5" }]],
    "arrow-right": [["path", { d: "M5 12h14" }], ["path", { d: "m12 5 7 7-7 7" }]],
    "alert-circle": [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "M12 8v4" }], ["path", { d: "M12 16h.01" }]],
    "alert-triangle": [["path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" }], ["path", { d: "M12 9v4" }], ["path", { d: "M12 17h.01" }]],
    "check-circle": [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "m9 12 2 2 4-4" }]],
    "help-circle": [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }], ["path", { d: "M12 17h.01" }]],
    "info": [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "M12 16v-4" }], ["path", { d: "M12 8h.01" }]],
    "clock": [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "M12 6v6l4 2" }]],
    "inbox": [["polyline", { points: "22 12 16 12 14 15 10 15 8 12 2 12" }], ["path", { d: "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" }]],
    "refresh-cw": [["path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" }], ["path", { d: "M21 3v5h-5" }], ["path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" }], ["path", { d: "M8 16H3v5" }]],
    "layout-dashboard": [["rect", { width: 7, height: 9, x: 3, y: 3, rx: 1 }], ["rect", { width: 7, height: 5, x: 14, y: 3, rx: 1 }], ["rect", { width: 7, height: 9, x: 14, y: 12, rx: 1 }], ["rect", { width: 7, height: 5, x: 3, y: 16, rx: 1 }]],
    "sparkles": [["path", { d: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" }], ["path", { d: "M20 3v4" }], ["path", { d: "M22 5h-4" }], ["path", { d: "M4 17v2" }], ["path", { d: "M5 18H3" }]],
    "target": [["circle", { cx: 12, cy: 12, r: 10 }], ["circle", { cx: 12, cy: 12, r: 6 }], ["circle", { cx: 12, cy: 12, r: 2 }]],
    "mic": [["path", { d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" }], ["path", { d: "M19 10v2a7 7 0 0 1-14 0v-2" }], ["path", { d: "M12 19v3" }]],
    "keyboard": [["path", { d: "M10 8h.01" }], ["path", { d: "M12 12h.01" }], ["path", { d: "M14 8h.01" }], ["path", { d: "M16 12h.01" }], ["path", { d: "M18 8h.01" }], ["path", { d: "M6 8h.01" }], ["path", { d: "M7 16h10" }], ["path", { d: "M8 12h.01" }], ["rect", { width: 20, height: 16, x: 2, y: 4, rx: 2 }]],
    "message-square": [["path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }]],
    "message-circle-question": [["path", { d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z" }], ["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }], ["path", { d: "M12 17h.01" }]],
    "file-text": [["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }], ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }], ["path", { d: "M10 9H8" }], ["path", { d: "M16 13H8" }], ["path", { d: "M16 17H8" }]],
    "briefcase": [["path", { d: "M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" }], ["rect", { width: 20, height: 14, x: 2, y: 6, rx: 2 }]],
    "shield-check": [["path", { d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" }], ["path", { d: "m9 12 2 2 4-4" }]],
    "list-checks": [["path", { d: "m3 17 2 2 4-4" }], ["path", { d: "m3 7 2 2 4-4" }], ["path", { d: "M13 6h8" }], ["path", { d: "M13 12h8" }], ["path", { d: "M13 18h8" }]],
    "circle-user": [["circle", { cx: 12, cy: 12, r: 10 }], ["circle", { cx: 12, cy: 10, r: 3 }], ["path", { d: "M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" }]],
    "trash": [["path", { d: "M3 6h18" }], ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }], ["path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }], ["path", { d: "M10 11v6" }], ["path", { d: "M14 11v6" }]],
    "loader": [["path", { d: "M21 12a9 9 0 1 1-6.219-8.56" }]],
    "circle": [["circle", { cx: 12, cy: 12, r: 10 }]],
};

export function Icon({ name, size = 20, strokeWidth = 2, style, className, ...rest }) {
    const shapes = PATHS[name] || PATHS["help-circle"];
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, ...style }}
            className={className}
            aria-hidden="true"
            {...rest}
        >
            {shapes.map(([tag, attrs], i) => React.createElement(tag, { key: i, ...attrs }))}
        </svg>
    );
}

export const ICON_NAMES = Object.keys(PATHS);
