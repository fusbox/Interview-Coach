"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Layers3, LayoutGrid, MousePointer2, Palette, Type } from "lucide-react";

const DEMO_QUERY_VALUES = new Set(["1", "true", "design", "system"]);

const PALETTE_REFERENCE = [
  {
    token: "--background",
    role: "Page canvas",
    value: "#F8FAFC",
    hsl: "hsl(210 40% 98%)",
    anchor: "--primary",
    anchorValue: "#0C61E9",
    anchorHsl: "hsl(216 87% 48%)",
    delta: "Hue -6, saturation -47, lightness +50, alpha 1."
  },
  {
    token: "--surface",
    role: "Base neutral surface",
    value: "#FFFFFF",
    hsl: "hsl(0 0% 100%)",
    anchor: "white",
    anchorValue: "#FFFFFF",
    anchorHsl: "hsl(0 0% 100%)",
    delta: "Self-anchor, no change."
  },
  {
    token: "--surface-alt",
    role: "Quiet secondary surface",
    value: "#F6F9FC",
    hsl: "hsl(210 50% 98%)",
    anchor: "--background",
    anchorValue: "#F1F6FB",
    anchorHsl: "hsl(210 56% 96%)",
    delta: "Hue 0, saturation -6, lightness +2, alpha 1."
  },
  {
    token: "--surface-elevated",
    role: "Highest neutral panel",
    value: "#FCFDFF",
    hsl: "hsl(220 100% 99%)",
    anchor: "--surface",
    anchorValue: "#FFFFFF",
    anchorHsl: "hsl(0 0% 100%)",
    delta: "Blue bias added, perceived lightness -1."
  },
  {
    token: "--border",
    role: "Structural separator",
    value: "#D3DDE8",
    hsl: "hsl(211 31% 87%)",
    anchor: "--background",
    anchorValue: "#F1F6FB",
    anchorHsl: "hsl(210 56% 96%)",
    delta: "Hue +1, saturation -25, lightness -9, alpha 1."
  },
  {
    token: "--foreground",
    role: "Primary text",
    value: "#0F2139",
    hsl: "hsl(214 58% 14%)",
    anchor: "slate anchor",
    anchorValue: "#0F2139",
    anchorHsl: "hsl(214 58% 14%)",
    delta: "Self-anchor, no change."
  },
  {
    token: "--muted",
    role: "Secondary text",
    value: "#566A83",
    hsl: "hsl(213 21% 43%)",
    anchor: "--foreground",
    anchorValue: "#0F2139",
    anchorHsl: "hsl(214 58% 14%)",
    delta: "Hue -1, saturation -37, lightness +29, alpha 1."
  },
  {
    token: "--primary",
    role: "Primary brand blue",
    value: "#0C61E9",
    hsl: "hsl(216 87% 48%)",
    anchor: "R2W blue",
    anchorValue: "#0C61E9",
    anchorHsl: "hsl(216 87% 48%)",
    delta: "Self-anchor, no change."
  },
  {
    token: "--primary-soft",
    role: "Soft blue fill",
    value: "#E8F1FF",
    hsl: "hsl(214 100% 95%)",
    anchor: "--primary",
    anchorValue: "#0C61E9",
    anchorHsl: "hsl(216 87% 48%)",
    delta: "Hue -2, saturation +13, lightness +47, alpha 1."
  },
  {
    token: "--secondary-brand",
    role: "Primary orange accent",
    value: "#F95500",
    hsl: "hsl(20 100% 49%)",
    anchor: "R2W orange",
    anchorValue: "#F95500",
    anchorHsl: "hsl(20 100% 49%)",
    delta: "Self-anchor, no change."
  },
  {
    token: "--secondary-soft",
    role: "Soft orange fill",
    value: "#FFECE1",
    hsl: "hsl(22 100% 94%)",
    anchor: "--secondary-brand",
    anchorValue: "#F95500",
    anchorHsl: "hsl(20 100% 49%)",
    delta: "Hue +2, saturation 0, lightness +45, alpha 1."
  },
  {
    token: "--accent",
    role: "Tertiary teal accent",
    value: "#0EB099",
    hsl: "hsl(171 85% 37%)",
    anchor: "teal anchor",
    anchorValue: "#0EB099",
    anchorHsl: "hsl(171 85% 37%)",
    delta: "Self-anchor, no change."
  },
  {
    token: "--accent-soft",
    role: "Soft teal fill",
    value: "#DDF6F2",
    hsl: "hsl(170 58% 92%)",
    anchor: "--accent",
    anchorValue: "#0EB099",
    anchorHsl: "hsl(171 85% 37%)",
    delta: "Hue -1, saturation -27, lightness +55, alpha 1."
  },
  {
    token: "--success",
    role: "Positive feedback green",
    value: "#1BA060",
    hsl: "hsl(151 71% 37%)",
    anchor: "success anchor",
    anchorValue: "#1BA060",
    anchorHsl: "hsl(151 71% 37%)",
    delta: "Self-anchor, no change."
  }
] as const;

function isDemoEnabled(queryValue: string | null) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "1") {
    return true;
  }

  return queryValue ? DEMO_QUERY_VALUES.has(queryValue.toLowerCase()) : false;
}

export function DesignSystemDemoOverlay() {
  const [enabled, setEnabled] = useState(process.env.NEXT_PUBLIC_DEMO_MODE === "1");

  useEffect(() => {
    const queryValue = new URLSearchParams(window.location.search).get("demo");
    setEnabled(isDemoEnabled(queryValue));
  }, []);

  useEffect(() => {
    if (enabled) {
      document.documentElement.dataset.demoMode = "true";
      return () => {
        delete document.documentElement.dataset.demoMode;
      };
    }

    delete document.documentElement.dataset.demoMode;
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <>
      <div aria-hidden className="demo-grid-overlay" />

      <div aria-hidden className="demo-mode-chip">
        Design System Demo
      </div>

      <aside className="demo-legend" aria-label="Design system demo legend">
        <div className="demo-legend__header">
          <p className="demo-legend__eyebrow">Inspection overlay</p>
          <h2>Compliant by construction</h2>
          <p>
            This mode reveals how layout, hierarchy, and token choices are being applied instead of treating the page as
            a one-off mock.
          </p>
        </div>

        <div className="demo-legend__section">
          <div className="demo-legend__title">
            <LayoutGrid className="h-4 w-4" />
            <span>Grid</span>
          </div>
          <p>12-column page grid, shared max width, and section spacing utilities define rhythm before content styling does.</p>
        </div>

        <div className="demo-legend__section">
          <div className="demo-legend__title">
            <Layers3 className="h-4 w-4" />
            <span>Layers</span>
          </div>
          <ul className="demo-legend__tokens">
            <li>
              <span className="demo-swatch demo-swatch--surface" />
              <div>
                <strong>Surface</strong>
                <span>`surface-base`, `surface-elevated`, `surface-blue`</span>
              </div>
            </li>
            <li>
              <span className="demo-swatch demo-swatch--border" />
              <div>
                <strong>Structure</strong>
                <span>radius + border + shadow scale with emphasis</span>
              </div>
            </li>
          </ul>
        </div>

        <div className="demo-legend__section">
          <div className="demo-legend__title">
            <Type className="h-4 w-4" />
            <span>Hierarchy</span>
          </div>
          <p>`eyebrow` introduces a block, `display-hero` anchors a page, `section-title` leads a region, and `copy-*` controls reading density.</p>
        </div>

        <div className="demo-legend__section">
          <div className="demo-legend__title">
            <MousePointer2 className="h-4 w-4" />
            <span>States</span>
          </div>
          <div className="demo-state-row">
            <span className="demo-state-pill">default</span>
            <span className="demo-state-pill demo-state-pill--hover">hover</span>
            <span className="demo-state-pill demo-state-pill--emphasis">emphasis</span>
          </div>
        </div>

        <div className="demo-legend__section">
          <div className="demo-legend__title">
            <Palette className="h-4 w-4" />
            <span>Palette reference</span>
          </div>
          <details className="demo-palette">
            <summary>
              <span>Inspect token derivations</span>
              <ChevronDown className="h-4 w-4" />
            </summary>
            <p className="demo-palette__hint">
              Each row shows the live token, its anchor color, and the HSL or transparency shift used to derive it.
            </p>

            <div className="demo-palette__list">
              {PALETTE_REFERENCE.map((color) => (
                <article key={color.token} className="demo-palette__item">
                  <div className="demo-palette__row">
                    <div className="demo-palette__pair" aria-hidden>
                      <span className="demo-palette__swatch" style={{ backgroundColor: color.value }} />
                      <span className="demo-palette__arrow">from</span>
                      <span className="demo-palette__swatch" style={{ backgroundColor: color.anchorValue }} />
                    </div>

                    <div className="demo-palette__meta">
                      <strong>
                        {color.token} <span className="text-[rgb(var(--candidate-muted))]">- {color.role}</span>
                      </strong>
                      <span>
                        Token {color.value} {color.hsl}
                      </span>
                      <span>
                        Anchor {color.anchor} {color.anchorValue} {color.anchorHsl}
                      </span>
                    </div>
                  </div>

                  <p className="demo-palette__note">{color.delta}</p>
                </article>
              ))}
            </div>
          </details>
        </div>
      </aside>
    </>
  );
}
