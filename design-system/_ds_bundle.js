/* @ds-bundle: {"format":4,"namespace":"RangamJobSeekerDesignSystem_7ff43f","components":[{"name":"ActionButton","sourcePath":"components/actions/ActionButton.jsx"},{"name":"Button","sourcePath":"components/actions/Button.jsx"},{"name":"Badge","sourcePath":"components/display/Badge.jsx"},{"name":"Card","sourcePath":"components/display/Card.jsx"},{"name":"CardHeader","sourcePath":"components/display/Card.jsx"},{"name":"CardTitle","sourcePath":"components/display/Card.jsx"},{"name":"CardDescription","sourcePath":"components/display/Card.jsx"},{"name":"CardContent","sourcePath":"components/display/Card.jsx"},{"name":"CardFooter","sourcePath":"components/display/Card.jsx"},{"name":"ContentCard","sourcePath":"components/display/ContentCard.jsx"},{"name":"IconBadge","sourcePath":"components/display/IconBadge.jsx"},{"name":"InsightCard","sourcePath":"components/display/InsightCard.jsx"},{"name":"MetricCard","sourcePath":"components/display/MetricCard.jsx"},{"name":"Progress","sourcePath":"components/display/Progress.jsx"},{"name":"Skeleton","sourcePath":"components/display/Skeleton.jsx"},{"name":"StatusBadge","sourcePath":"components/display/StatusBadge.jsx"},{"name":"SurfaceCard","sourcePath":"components/display/SurfaceCard.jsx"},{"name":"AlertPanel","sourcePath":"components/feedback/AlertPanel.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"ErrorState","sourcePath":"components/feedback/ErrorState.jsx"},{"name":"FeedbackCard","sourcePath":"components/feedback/FeedbackCard.jsx"},{"name":"FeedbackPanel","sourcePath":"components/feedback/FeedbackPanel.jsx"},{"name":"FeedbackPill","sourcePath":"components/feedback/FeedbackPill.jsx"},{"name":"EMOJI_SCALE","sourcePath":"components/forms/FeedbackChoiceButton.jsx"},{"name":"FeedbackChoiceButton","sourcePath":"components/forms/FeedbackChoiceButton.jsx"},{"name":"FieldGroup","sourcePath":"components/forms/FormField.jsx"},{"name":"FieldLabel","sourcePath":"components/forms/FormField.jsx"},{"name":"FieldHint","sourcePath":"components/forms/FormField.jsx"},{"name":"FormField","sourcePath":"components/forms/FormField.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"SearchField","sourcePath":"components/forms/SearchField.jsx"},{"name":"Icon","sourcePath":"components/icons/Icon.jsx"},{"name":"ICON_NAMES","sourcePath":"components/icons/Icon.jsx"},{"name":"CandidateDisclosureFooter","sourcePath":"components/shell/CandidateDisclosureFooter.jsx"},{"name":"CandidateMobileDock","sourcePath":"components/shell/CandidateMobileDock.jsx"},{"name":"CandidateSidebar","sourcePath":"components/shell/CandidateSidebar.jsx"},{"name":"DataTable","sourcePath":"components/structure/DataTable.jsx"},{"name":"PageHeaderBlock","sourcePath":"components/structure/PageHeaderBlock.jsx"},{"name":"PageIntro","sourcePath":"components/structure/PageIntro.jsx"},{"name":"SectionHeader","sourcePath":"components/structure/SectionHeader.jsx"},{"name":"SessionPromptShell","sourcePath":"components/structure/SessionPromptShell.jsx"}],"sourceHashes":{"components/actions/ActionButton.jsx":"757cffb0305f","components/actions/Button.jsx":"5c5a9dfc2007","components/display/Badge.jsx":"8f8338b170c2","components/display/Card.jsx":"8809101fa28f","components/display/ContentCard.jsx":"a1fe456decd2","components/display/IconBadge.jsx":"8917c5877859","components/display/InsightCard.jsx":"39245c2f0eb2","components/display/MetricCard.jsx":"fb7794e27490","components/display/Progress.jsx":"f1882935cf6b","components/display/Skeleton.jsx":"378f89f38681","components/display/StatusBadge.jsx":"3c0eb60b16a5","components/display/SurfaceCard.jsx":"9899df73c4d2","components/feedback/AlertPanel.jsx":"cb8732053f2d","components/feedback/EmptyState.jsx":"7b2ccf070127","components/feedback/ErrorState.jsx":"031b01e448e5","components/feedback/FeedbackCard.jsx":"3d293789bf0f","components/feedback/FeedbackPanel.jsx":"15b931ed2f9a","components/feedback/FeedbackPill.jsx":"7f5b2df38e52","components/forms/FeedbackChoiceButton.jsx":"736cc6df1647","components/forms/FormField.jsx":"e7893c648c4f","components/forms/Input.jsx":"66d61bbd4fd1","components/forms/SearchField.jsx":"b197cc3abcb0","components/icons/Icon.jsx":"1aba1715dcad","components/shell/CandidateDisclosureFooter.jsx":"0bcc923bfe79","components/shell/CandidateMobileDock.jsx":"08f3a4f41eb0","components/shell/CandidateSidebar.jsx":"b275ef9dcd76","components/structure/DataTable.jsx":"5124820cac8b","components/structure/PageHeaderBlock.jsx":"32d6f8f66156","components/structure/PageIntro.jsx":"4ddc15a596f7","components/structure/SectionHeader.jsx":"8c0459bd1017","components/structure/SessionPromptShell.jsx":"898b159af7ab","ui_kits/candidate/Dashboard.jsx":"2dab32f2c329","ui_kits/candidate/PracticeSession.jsx":"eaa6d94e02bf","ui_kits/candidate/SessionEntry.jsx":"63416341d781","ui_kits/candidate/data.js":"c871db6e0fcb"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.RangamJobSeekerDesignSystem_7ff43f = window.RangamJobSeekerDesignSystem_7ff43f || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/actions/ActionButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.rjs-actionbtn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:9999px;font-family:var(--font-sans);font-weight:var(--font-weight-semibold);font-size:14px;cursor:pointer;text-decoration:none;transition:transform 200ms,background-color 200ms,opacity 200ms;border:1px solid transparent;}
.rjs-actionbtn--size-default{padding:12px 20px;}
.rjs-actionbtn--size-large{min-height:48px;padding:14px 24px;}
.rjs-actionbtn--primary{background:rgb(var(--candidate-primary));color:#fff;box-shadow:var(--candidate-shadow-cta);}
.rjs-actionbtn--primary:hover{background:rgb(9,81,199);}
.rjs-actionbtn--secondary{border-color:rgb(var(--candidate-border));background:rgb(var(--candidate-surface));color:rgb(var(--candidate-foreground));}
.rjs-actionbtn--secondary:hover{background:rgb(var(--candidate-surface-alt));}
.rjs-actionbtn:not(.rjs-actionbtn--disabled):hover{transform:translateY(-2px);}
.rjs-actionbtn--disabled{cursor:not-allowed;opacity:.5;}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-actionbtn-css")) {
  const s = document.createElement("style");
  s.id = "rjs-actionbtn-css";
  s.textContent = css;
  document.head.appendChild(s);
}
function ActionButton({
  href,
  secondary = false,
  size = "default",
  disabled = false,
  className = "",
  children,
  ...rest
}) {
  const classes = ["rjs-actionbtn", `rjs-actionbtn--size-${size}`, secondary ? "rjs-actionbtn--secondary" : "rjs-actionbtn--primary", disabled ? "rjs-actionbtn--disabled" : "", className].filter(Boolean).join(" ");
  if (href) {
    return /*#__PURE__*/React.createElement("a", _extends({
      className: classes,
      href: disabled ? "#" : href,
      "aria-disabled": disabled
    }, rest), children);
  }
  return /*#__PURE__*/React.createElement("button", _extends({
    className: classes,
    disabled: disabled
  }, rest), children);
}
Object.assign(__ds_scope, { ActionButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/ActionButton.jsx", error: String((e && e.message) || e) }); }

// components/actions/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.rjs-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;border:1px solid transparent;cursor:pointer;font-family:var(--font-sans);text-decoration:none;transition:all var(--duration-base) var(--ease-standard);}
.rjs-btn:active{transform:scale(0.98);}
.rjs-btn:disabled{pointer-events:none;opacity:.5;}
.rjs-btn:focus-visible{outline:2px solid hsl(var(--ring));outline-offset:2px;}
.rjs-btn--default,.rjs-btn--primary{background:hsl(var(--primary));color:hsl(var(--primary-foreground));box-shadow:var(--shadow-raised-1);}
.rjs-btn--default:hover,.rjs-btn--primary:hover{background:hsl(var(--primary)/0.9);box-shadow:var(--shadow-raised-2);}
.rjs-btn--destructive,.rjs-btn--danger{background:hsl(var(--destructive));color:hsl(var(--destructive-foreground));box-shadow:var(--shadow-raised-1);}
.rjs-btn--destructive:hover,.rjs-btn--danger:hover{background:hsl(var(--destructive)/0.9);box-shadow:var(--shadow-raised-2);}
.rjs-btn--outline,.rjs-btn--secondary-emphasis{border-color:hsl(var(--input));background:hsl(var(--background));color:hsl(var(--text-primary));box-shadow:var(--shadow-flat);}
.rjs-btn--outline:hover,.rjs-btn--secondary-emphasis:hover{background:hsl(var(--surface-subtle));box-shadow:var(--shadow-raised-1);}
.rjs-btn--secondary{background:hsl(var(--secondary));color:hsl(var(--secondary-foreground));}
.rjs-btn--secondary:hover{background:hsl(var(--secondary)/0.8);}
.rjs-btn--ghost{background:transparent;color:hsl(var(--text-primary));}
.rjs-btn--ghost:hover{background:hsl(var(--surface-subtle));}
.rjs-btn--tertiary{background:transparent;color:hsl(var(--primary));box-shadow:none;}
.rjs-btn--tertiary:hover{background:hsl(var(--primary)/0.05);}
.rjs-btn--link{background:transparent;color:hsl(var(--primary));text-underline-offset:4px;box-shadow:none;}
.rjs-btn--link:hover{text-decoration:underline;}
.rjs-btn--info{background:hsl(var(--state-info));color:hsl(var(--primary-foreground));box-shadow:var(--shadow-raised-1);}
.rjs-btn--info:hover{background:hsl(var(--state-info)/0.9);box-shadow:var(--shadow-raised-2);}
.rjs-btn--size-default{height:40px;border-radius:var(--radius-md);padding:8px 16px;font-size:14px;font-weight:var(--font-weight-medium);}
.rjs-btn--size-sm{height:36px;border-radius:var(--radius-md);padding:0 12px;font-size:14px;font-weight:var(--font-weight-medium);}
.rjs-btn--size-lg{height:44px;border-radius:var(--radius-md);padding:0 32px;font-size:14px;font-weight:var(--font-weight-medium);}
.rjs-btn--size-icon{height:40px;width:40px;border-radius:var(--radius-md);padding:0;font-size:14px;}
.rjs-btn--density-compact{height:36px;padding:0 12px;font-size:14px;}
.rjs-btn--density-default{height:40px;padding:8px 16px;font-size:14px;}
.rjs-btn--density-comfortable{height:44px;padding:0 24px;font-size:14px;}
.rjs-btn--density-hero{height:48px;padding:0 32px;font-size:16px;}
.rjs-btn--shape-app{border-radius:var(--radius-2xl);}
.rjs-btn--shape-pill{border-radius:9999px;}
.rjs-btn--shape-square{border-radius:var(--radius-xl);}
.rjs-btn--label-default{font-weight:var(--font-weight-medium);text-transform:none;letter-spacing:normal;}
.rjs-btn--label-strong{font-weight:var(--font-weight-semibold);text-transform:none;letter-spacing:normal;}
.rjs-btn--label-chrome{font-weight:var(--font-weight-bold);text-transform:uppercase;font-size:var(--text-micro-size);letter-spacing:0.1em;}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-button-css")) {
  const s = document.createElement("style");
  s.id = "rjs-button-css";
  s.textContent = css;
  document.head.appendChild(s);
}
const EMPHASIS_CLASS = {
  primary: "rjs-btn--primary",
  secondary: "rjs-btn--secondary-emphasis",
  tertiary: "rjs-btn--tertiary",
  danger: "rjs-btn--danger",
  link: "rjs-btn--link",
  info: "rjs-btn--info"
};
function Button({
  variant,
  size,
  emphasis,
  density,
  shape,
  label,
  className = "",
  children,
  ...rest
}) {
  const classes = ["rjs-btn"];
  if (emphasis) classes.push(EMPHASIS_CLASS[emphasis] || EMPHASIS_CLASS.primary);else classes.push(`rjs-btn--${variant || "default"}`);
  if (density) classes.push(`rjs-btn--density-${density}`);else classes.push(`rjs-btn--size-${size || "default"}`);
  if (shape) classes.push(`rjs-btn--shape-${shape}`);
  if (label) classes.push(`rjs-btn--label-${label}`);
  if (className) classes.push(className);
  return /*#__PURE__*/React.createElement("button", _extends({
    className: classes.join(" ")
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/Button.jsx", error: String((e && e.message) || e) }); }

// components/display/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.rjs-badge{display:inline-flex;align-items:center;border-radius:9999px;border:1px solid transparent;padding:2px 10px;font-size:12px;font-weight:var(--font-weight-semibold);font-family:var(--font-sans);transition:color var(--duration-base);}
.rjs-badge--default{background:hsl(var(--primary));color:hsl(var(--primary-foreground));}
.rjs-badge--secondary{background:hsl(var(--secondary));color:hsl(var(--secondary-foreground));}
.rjs-badge--destructive{background:hsl(var(--destructive));color:hsl(var(--destructive-foreground));}
.rjs-badge--outline{background:transparent;color:hsl(var(--foreground));box-shadow:var(--shadow-flat);}
.rjs-badge--success,.rjs-badge--high{background:hsl(var(--state-success));color:#fff;}
.rjs-badge--warning,.rjs-badge--medium{background:hsl(var(--state-warning));color:#fff;}
.rjs-badge--info{background:hsl(var(--state-info));color:#fff;}
.rjs-badge--low{background:hsl(var(--readiness-low));color:#fff;}
.rjs-badge--unknown{background:hsl(var(--readiness-unknown));color:hsl(var(--muted-foreground));}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-badge-css")) {
  const s = document.createElement("style");
  s.id = "rjs-badge-css";
  s.textContent = css;
  document.head.appendChild(s);
}
function Badge({
  variant = "default",
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["rjs-badge", `rjs-badge--${variant}`, className].filter(Boolean).join(" ")
  }, rest));
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Badge.jsx", error: String((e && e.message) || e) }); }

// components/display/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.rjs-card{border-radius:var(--radius-xl);border:1px solid hsl(var(--border));background:hsl(var(--card));color:hsl(var(--card-foreground));box-shadow:var(--shadow-raised-1);transition:all var(--duration-base) var(--ease-standard);font-family:var(--font-sans);}
.rjs-card--glass{background:linear-gradient(to bottom right,hsl(var(--brand-glass-start)),hsl(var(--brand-glass-end)));backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.2);box-shadow:var(--shadow-floating);}
.rjs-card__header{display:flex;flex-direction:column;gap:6px;padding:24px;}
.rjs-card__title{font-size:24px;font-weight:var(--font-weight-semibold);line-height:1;margin:0;}
.rjs-card__description{font-size:14px;color:hsl(var(--muted-foreground));margin:0;}
.rjs-card__content{padding:0 24px 24px;}
.rjs-card__footer{display:flex;align-items:center;padding:0 24px 24px;}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-card-css")) {
  const s = document.createElement("style");
  s.id = "rjs-card-css";
  s.textContent = css;
  document.head.appendChild(s);
}
function Card({
  variant = "default",
  className = "",
  ...rest
}) {
  const classes = ["rjs-card", variant === "glass" ? "rjs-card--glass" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: classes
  }, rest));
}
function CardHeader({
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["rjs-card__header", className].filter(Boolean).join(" ")
  }, rest));
}
function CardTitle({
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("h3", _extends({
    className: ["rjs-card__title", className].filter(Boolean).join(" ")
  }, rest));
}
function CardDescription({
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("p", _extends({
    className: ["rjs-card__description", className].filter(Boolean).join(" ")
  }, rest));
}
function CardContent({
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["rjs-card__content", className].filter(Boolean).join(" ")
  }, rest));
}
function CardFooter({
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["rjs-card__footer", className].filter(Boolean).join(" ")
  }, rest));
}
Object.assign(__ds_scope, { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Card.jsx", error: String((e && e.message) || e) }); }

// components/display/ContentCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.rjs-contentcard{border:1px solid hsl(var(--border));background:hsl(var(--card));color:hsl(var(--card-foreground));font-family:var(--font-sans);box-sizing:border-box;}
.rjs-contentcard--default{border-radius:var(--radius-2xl);padding:24px;box-shadow:var(--shadow-raised-1);}
.rjs-contentcard--spacious{border-radius:var(--radius-3xl);padding:40px;box-shadow:var(--shadow-raised-2);}
.rjs-contentcard--hero{border-radius:2rem;padding:40px;box-shadow:var(--shadow-floating);}
.rjs-contentcard--center{text-align:center;}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-contentcard-css")) {
  const s = document.createElement("style");
  s.id = "rjs-contentcard-css";
  s.textContent = css;
  document.head.appendChild(s);
}
function ContentCard({
  density = "default",
  align = "left",
  className = "",
  ...rest
}) {
  const classes = ["rjs-contentcard", `rjs-contentcard--${density}`, align === "center" ? "rjs-contentcard--center" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: classes
  }, rest));
}
Object.assign(__ds_scope, { ContentCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/ContentCard.jsx", error: String((e && e.message) || e) }); }

// components/display/IconBadge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.rjs-iconbadge{display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid transparent;transition:all var(--duration-base);}
.rjs-iconbadge--size-sm{width:32px;height:32px;border-radius:var(--radius-lg);}
.rjs-iconbadge--size-md{width:40px;height:40px;border-radius:var(--radius-xl);}
.rjs-iconbadge--size-lg{width:48px;height:48px;border-radius:var(--radius-2xl);}
.rjs-iconbadge--default{background:transparent;color:hsl(var(--muted-foreground));}
.rjs-iconbadge--info{background:#f0f9ff;color:#075985;border-color:#bae6fd;box-shadow:var(--shadow-flat);}
.rjs-iconbadge--success{background:#ecfdf5;color:#065f46;border-color:#34d399;box-shadow:var(--shadow-flat);}
.rjs-iconbadge--warning{background:#fffbeb;color:#78350f;border-color:#fde68a;box-shadow:var(--shadow-flat);}
.rjs-iconbadge--critical{background:#fff1f2;color:#9f1239;border-color:#fecdd3;box-shadow:var(--shadow-flat);}
.rjs-iconbadge--primary{background:hsl(var(--primary)/0.1);color:hsl(var(--primary));border-color:hsl(var(--primary)/0.2);box-shadow:var(--shadow-flat);}
.rjs-iconbadge--brand{background:hsl(var(--primary-deep)/0.1);color:hsl(var(--primary-deep));border-color:hsl(var(--primary-deep)/0.2);box-shadow:var(--shadow-flat);}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-iconbadge-css")) {
  const s = document.createElement("style");
  s.id = "rjs-iconbadge-css";
  s.textContent = css;
  document.head.appendChild(s);
}
function IconBadge({
  variant = "default",
  size = "md",
  className = "",
  children,
  ...rest
}) {
  const classes = ["rjs-iconbadge", `rjs-iconbadge--${variant}`, `rjs-iconbadge--size-${size}`, className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: classes
  }, rest), children);
}
Object.assign(__ds_scope, { IconBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/IconBadge.jsx", error: String((e && e.message) || e) }); }

// components/display/InsightCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.rjs-insightcard{border-radius:var(--radius-2xl);border:1px solid;padding:20px;font-family:var(--font-sans);box-sizing:border-box;}
.rjs-insightcard--positive{border-color:rgba(167,243,208,0.6);background:rgba(236,253,245,0.6);}
.rjs-insightcard--caution{border-color:rgba(254,205,211,0.6);background:rgba(255,241,242,0.6);}
.rjs-insightcard--highlight{border-color:rgba(233,213,255,0.6);background:rgba(250,245,255,0.5);}
.rjs-insightcard--neutral{border-color:hsl(var(--border)/0.6);background:hsl(var(--surface-subtle));}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-insightcard-css")) {
  const s = document.createElement("style");
  s.id = "rjs-insightcard-css";
  s.textContent = css;
  document.head.appendChild(s);
}
function InsightCard({
  tone = "neutral",
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["rjs-insightcard", `rjs-insightcard--${tone}`, className].filter(Boolean).join(" ")
  }, rest));
}
Object.assign(__ds_scope, { InsightCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/InsightCard.jsx", error: String((e && e.message) || e) }); }

// components/display/MetricCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.rjs-metriccard{font-family:var(--font-sans);}
.rjs-metriccard--card{border-radius:var(--radius-xl);background:hsl(var(--card));color:hsl(var(--card-foreground));overflow:hidden;}
.rjs-metriccard--glass{background:linear-gradient(to bottom right,hsl(var(--brand-glass-start)),hsl(var(--brand-glass-end)));backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.2);}
.rjs-metriccard__title{font-size:12px;font-weight:var(--font-weight-bold);color:hsl(var(--text-muted));text-transform:uppercase;letter-spacing:0.1em;line-height:1;margin:0;}
.rjs-metriccard__desc{font-size:12px;color:hsl(var(--muted-foreground));margin:4px 0 0;}
.rjs-metriccard__value{font-size:30px;font-weight:var(--font-weight-black);color:hsl(var(--foreground));}
.rjs-metriccard__trend{margin:4px 0 0;font-size:12px;font-weight:var(--font-weight-semibold);display:flex;align-items:center;gap:4px;}
.rjs-metriccard__trend--up{color:#065f46;}
.rjs-metriccard__trend--down{color:#9f1239;}
.rjs-metriccard__trend-note{color:hsl(var(--text-muted));font-weight:var(--font-weight-normal);margin-left:4px;}
.rjs-metriccard--pill{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 16px;border-radius:var(--radius-xl);border:1px solid hsl(var(--border)/0.1);box-shadow:var(--shadow-raised-1);width:100%;box-sizing:border-box;}
.rjs-metriccard--pill .rjs-metriccard__title{font-size:10px;margin-bottom:2px;white-space:nowrap;}
.rjs-metriccard--pill .rjs-metriccard__value{font-size:14px;}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-metriccard-css")) {
  const s = document.createElement("style");
  s.id = "rjs-metriccard-css";
  s.textContent = css;
  document.head.appendChild(s);
}
function MetricCard({
  title,
  value,
  description,
  trend,
  variant = "default",
  valueStyle,
  className = "",
  ...rest
}) {
  if (variant === "pill") {
    return /*#__PURE__*/React.createElement("div", _extends({
      className: ["rjs-metriccard", "rjs-metriccard--pill", className].filter(Boolean).join(" ")
    }, rest), /*#__PURE__*/React.createElement("span", {
      className: "rjs-metriccard__title"
    }, title), /*#__PURE__*/React.createElement("span", {
      className: "rjs-metriccard__value",
      style: valueStyle
    }, value));
  }
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["rjs-metriccard", "rjs-metriccard--card", variant === "glass" ? "rjs-metriccard--glass" : "", className].filter(Boolean).join(" ")
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 20px 8px"
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "rjs-metriccard__title"
  }, title), description ? /*#__PURE__*/React.createElement("p", {
    className: "rjs-metriccard__desc"
  }, description) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px 20px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "rjs-metriccard__value",
    style: valueStyle
  }, value), trend ? /*#__PURE__*/React.createElement("p", {
    className: `rjs-metriccard__trend rjs-metriccard__trend--${trend.positive ? "up" : "down"}`
  }, trend.positive ? "↑" : "↓", " ", trend.value, /*#__PURE__*/React.createElement("span", {
    className: "rjs-metriccard__trend-note"
  }, "vs last session")) : null));
}
Object.assign(__ds_scope, { MetricCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/MetricCard.jsx", error: String((e && e.message) || e) }); }

// components/display/Progress.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Progress({
  value = 0,
  style,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: className,
    style: {
      position: "relative",
      height: 16,
      width: "100%",
      overflow: "hidden",
      borderRadius: 9999,
      background: "#f1f5f9",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      height: "100%",
      width: "100%",
      background: "#2563eb",
      transition: "transform 500ms ease-in-out",
      transform: `translateX(-${100 - (value || 0)}%)`
    }
  }));
}
Object.assign(__ds_scope, { Progress });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Progress.jsx", error: String((e && e.message) || e) }); }

// components/display/Skeleton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
@keyframes rjs-pulse{0%,100%{opacity:1;}50%{opacity:.5;}}
.rjs-skeleton{animation:rjs-pulse 2s cubic-bezier(0.4,0,0.6,1) infinite;border-radius:var(--radius-md);background:hsl(var(--muted));}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-skeleton-css")) {
  const s = document.createElement("style");
  s.id = "rjs-skeleton-css";
  s.textContent = css;
  document.head.appendChild(s);
}
function Skeleton({
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["rjs-skeleton", className].filter(Boolean).join(" ")
  }, rest));
}
Object.assign(__ds_scope, { Skeleton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Skeleton.jsx", error: String((e && e.message) || e) }); }

// components/display/SurfaceCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.rjs-surfacecard{border-radius:var(--radius-widget);border:1px solid rgb(var(--candidate-border)/0.8);background:rgb(var(--candidate-surface)/0.95);padding:24px;box-shadow:var(--candidate-shadow-card);font-family:var(--font-sans);color:rgb(var(--candidate-foreground));box-sizing:border-box;}
.rjs-surfacecard__header{margin-bottom:20px;display:flex;flex-direction:column;gap:8px;}
.rjs-surfacecard__eyebrow{font-size:12px;font-weight:var(--font-weight-semibold);text-transform:uppercase;letter-spacing:0.28em;color:rgb(var(--candidate-muted));margin:0;}
.rjs-surfacecard__title{font-size:20px;font-weight:var(--font-weight-semibold);color:rgb(var(--candidate-foreground));margin:0;}
.rjs-surfacecard__description{max-width:42rem;font-size:14px;line-height:1.75rem;color:rgb(var(--candidate-muted));margin:0;}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-surfacecard-css")) {
  const s = document.createElement("style");
  s.id = "rjs-surfacecard-css";
  s.textContent = css;
  document.head.appendChild(s);
}
function SurfaceCard({
  title,
  eyebrow,
  description,
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("section", _extends({
    className: ["rjs-surfacecard", className].filter(Boolean).join(" ")
  }, rest), eyebrow || title || description ? /*#__PURE__*/React.createElement("header", {
    className: "rjs-surfacecard__header"
  }, eyebrow ? /*#__PURE__*/React.createElement("p", {
    className: "rjs-surfacecard__eyebrow"
  }, eyebrow) : null, title ? /*#__PURE__*/React.createElement("h2", {
    className: "rjs-surfacecard__title"
  }, title) : null, description ? /*#__PURE__*/React.createElement("p", {
    className: "rjs-surfacecard__description"
  }, description) : null) : null, children);
}
Object.assign(__ds_scope, { SurfaceCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/SurfaceCard.jsx", error: String((e && e.message) || e) }); }

// components/forms/FeedbackChoiceButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.rjs-fcb{display:flex;align-items:center;justify-content:center;border:2px solid hsl(var(--border));background:transparent;cursor:pointer;font-family:var(--font-sans);transition:all 300ms;color:hsl(var(--text-secondary));}
.rjs-fcb--emoji{height:56px;width:56px;border-radius:var(--radius-2xl);font-size:30px;}
.rjs-fcb--chip{gap:8px;border-radius:var(--radius-2xl);padding:16px 32px;font-weight:var(--font-weight-bold);font-size:14px;background:#fff;}
.rjs-fcb--compact{gap:8px;border-radius:var(--radius-xl);padding:8px 16px;font-size:14px;font-weight:var(--font-weight-bold);background:hsl(var(--surface-base));color:hsl(var(--text-primary));}
.rjs-fcb--emoji:hover{border-color:hsl(var(--primary)/0.3);transform:scale(1.05);}
.rjs-fcb--emoji.rjs-fcb--selected{background:#fff;border-color:hsl(var(--primary)/0.5);transform:scale(1.1);box-shadow:var(--shadow-raised-2);}
.rjs-fcb--chip.rjs-fcb--tone-success:hover{border-color:#86efac;color:#16a34a;}
.rjs-fcb--chip.rjs-fcb--tone-success.rjs-fcb--selected{border-color:#16a34a;background:#16a34a;color:#fff;transform:scale(1.05);box-shadow:var(--shadow-raised-2);}
.rjs-fcb--chip.rjs-fcb--tone-neutral:hover{border-color:#cbd5e1;color:#1e293b;}
.rjs-fcb--chip.rjs-fcb--tone-neutral.rjs-fcb--selected{border-color:#1e293b;background:#1e293b;color:#fff;transform:scale(1.05);box-shadow:var(--shadow-raised-2);}
.rjs-fcb--compact:hover{border-color:hsl(var(--primary)/0.3);}
.rjs-fcb--compact.rjs-fcb--selected{border-color:hsl(var(--primary));background:hsl(var(--primary));color:hsl(var(--primary-foreground));box-shadow:var(--shadow-raised-1);}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-fcb-css")) {
  const s = document.createElement("style");
  s.id = "rjs-fcb-css";
  s.textContent = css;
  document.head.appendChild(s);
}
const EMOJI_SCALE = [{
  val: 1,
  emoji: "🙁"
}, {
  val: 2,
  emoji: "😐"
}, {
  val: 3,
  emoji: "🙂"
}, {
  val: 4,
  emoji: "😊"
}, {
  val: 5,
  emoji: "🤩"
}];
function FeedbackChoiceButton({
  kind = "compact",
  selected = false,
  tone = "primary",
  className = "",
  children,
  ...rest
}) {
  const classes = ["rjs-fcb", `rjs-fcb--${kind}`, `rjs-fcb--tone-${tone}`, selected ? "rjs-fcb--selected" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("button", _extends({
    className: classes
  }, rest), children);
}
Object.assign(__ds_scope, { EMOJI_SCALE, FeedbackChoiceButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/FeedbackChoiceButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/FormField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.rjs-fieldgroup{display:flex;flex-direction:column;gap:12px;}
.rjs-fieldlabel{font-size:var(--text-micro-size);line-height:var(--text-micro-line);letter-spacing:0.05em;font-weight:var(--font-weight-bold);text-transform:uppercase;color:hsl(var(--text-secondary));margin-left:4px;font-family:var(--font-sans);}
.rjs-fieldhint{font-size:var(--text-micro-size);line-height:var(--text-micro-line);color:hsl(var(--text-muted));font-style:italic;margin:0 0 0 4px;font-family:var(--font-sans);}
.rjs-textfield,.rjs-selectfield{display:flex;height:48px;width:100%;border-radius:var(--radius-xl);border:1px solid hsl(var(--border));background:hsl(var(--surface-subtle));padding:8px 16px;font-size:14px;font-family:var(--font-sans);color:hsl(var(--text-primary));transition:all var(--duration-base) var(--ease-standard);box-sizing:border-box;}
.rjs-textareafield{display:flex;min-height:120px;width:100%;border-radius:var(--radius-xl);border:1px solid hsl(var(--border));background:hsl(var(--surface-subtle));padding:12px 16px;font-size:14px;line-height:1.625;font-family:var(--font-sans);color:hsl(var(--text-primary));transition:all var(--duration-base) var(--ease-standard);box-sizing:border-box;resize:vertical;}
.rjs-textfield:focus,.rjs-textareafield:focus,.rjs-selectfield:focus{outline:none;border-color:hsl(var(--primary));box-shadow:0 0 0 2px hsl(var(--primary)/0.2);}
.rjs-textfield::placeholder,.rjs-textareafield::placeholder{color:hsl(var(--muted-foreground));}
.rjs-selectfield{appearance:none;cursor:pointer;align-items:center;justify-content:space-between;}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-formfield-css")) {
  const s = document.createElement("style");
  s.id = "rjs-formfield-css";
  s.textContent = css;
  document.head.appendChild(s);
}
function FieldGroup({
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["rjs-fieldgroup", className].filter(Boolean).join(" ")
  }, rest));
}
function FieldLabel({
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", _extends({
    className: ["rjs-fieldlabel", className].filter(Boolean).join(" ")
  }, rest));
}
function FieldHint({
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("p", _extends({
    className: ["rjs-fieldhint", className].filter(Boolean).join(" ")
  }, rest));
}

/** Labelled field: label + control (text/textarea/select) + optional hint. */
function FormField({
  label,
  hint,
  kind = "text",
  inputProps = {},
  children
}) {
  return /*#__PURE__*/React.createElement(FieldGroup, null, label ? /*#__PURE__*/React.createElement(FieldLabel, null, label) : null, children ? children : kind === "textarea" ? /*#__PURE__*/React.createElement("textarea", _extends({
    className: "rjs-textareafield"
  }, inputProps)) : kind === "select" ? /*#__PURE__*/React.createElement("select", _extends({
    className: "rjs-selectfield"
  }, inputProps)) : /*#__PURE__*/React.createElement("input", _extends({
    className: "rjs-textfield"
  }, inputProps)), hint ? /*#__PURE__*/React.createElement(FieldHint, null, hint) : null);
}
Object.assign(__ds_scope, { FieldGroup, FieldLabel, FieldHint, FormField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/FormField.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.rjs-input{display:flex;height:40px;width:100%;border-radius:var(--radius-md);border:1px solid hsl(var(--input));background:hsl(var(--background));padding:8px 12px;font-size:14px;font-family:var(--font-sans);color:hsl(var(--text-primary));transition:all var(--duration-base) var(--ease-standard);box-sizing:border-box;}
.rjs-input::placeholder{color:hsl(var(--muted-foreground));}
.rjs-input:focus-visible{outline:2px solid hsl(var(--ring));outline-offset:2px;}
.rjs-input:disabled{cursor:not-allowed;opacity:.5;}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-input-css")) {
  const s = document.createElement("style");
  s.id = "rjs-input-css";
  s.textContent = css;
  document.head.appendChild(s);
}
function Input({
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("input", _extends({
    className: ["rjs-input", className].filter(Boolean).join(" ")
  }, rest));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/icons/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Lucide icon path data (recreated from lucide.dev, ISC license) — the product's
   only icon system. 24x24 grid, stroke=currentColor, round caps/joins. */
const PATHS = {
  "plus": [["path", {
    d: "M5 12h14"
  }], ["path", {
    d: "M12 5v14"
  }]],
  "x": [["path", {
    d: "M18 6 6 18"
  }], ["path", {
    d: "m6 6 12 12"
  }]],
  "check": [["path", {
    d: "M20 6 9 17l-5-5"
  }]],
  "search": [["circle", {
    cx: 11,
    cy: 11,
    r: 8
  }], ["path", {
    d: "m21 21-4.3-4.3"
  }]],
  "chevron-right": [["path", {
    d: "m9 18 6-6-6-6"
  }]],
  "chevron-left": [["path", {
    d: "m15 18-6-6 6-6"
  }]],
  "chevron-down": [["path", {
    d: "m6 9 6 6 6-6"
  }]],
  "chevrons-up-down": [["path", {
    d: "m7 15 5 5 5-5"
  }], ["path", {
    d: "m7 9 5-5 5 5"
  }]],
  "arrow-right": [["path", {
    d: "M5 12h14"
  }], ["path", {
    d: "m12 5 7 7-7 7"
  }]],
  "alert-circle": [["circle", {
    cx: 12,
    cy: 12,
    r: 10
  }], ["path", {
    d: "M12 8v4"
  }], ["path", {
    d: "M12 16h.01"
  }]],
  "alert-triangle": [["path", {
    d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
  }], ["path", {
    d: "M12 9v4"
  }], ["path", {
    d: "M12 17h.01"
  }]],
  "check-circle": [["circle", {
    cx: 12,
    cy: 12,
    r: 10
  }], ["path", {
    d: "m9 12 2 2 4-4"
  }]],
  "help-circle": [["circle", {
    cx: 12,
    cy: 12,
    r: 10
  }], ["path", {
    d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"
  }], ["path", {
    d: "M12 17h.01"
  }]],
  "info": [["circle", {
    cx: 12,
    cy: 12,
    r: 10
  }], ["path", {
    d: "M12 16v-4"
  }], ["path", {
    d: "M12 8h.01"
  }]],
  "clock": [["circle", {
    cx: 12,
    cy: 12,
    r: 10
  }], ["path", {
    d: "M12 6v6l4 2"
  }]],
  "inbox": [["polyline", {
    points: "22 12 16 12 14 15 10 15 8 12 2 12"
  }], ["path", {
    d: "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
  }]],
  "refresh-cw": [["path", {
    d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"
  }], ["path", {
    d: "M21 3v5h-5"
  }], ["path", {
    d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"
  }], ["path", {
    d: "M8 16H3v5"
  }]],
  "layout-dashboard": [["rect", {
    width: 7,
    height: 9,
    x: 3,
    y: 3,
    rx: 1
  }], ["rect", {
    width: 7,
    height: 5,
    x: 14,
    y: 3,
    rx: 1
  }], ["rect", {
    width: 7,
    height: 9,
    x: 14,
    y: 12,
    rx: 1
  }], ["rect", {
    width: 7,
    height: 5,
    x: 3,
    y: 16,
    rx: 1
  }]],
  "sparkles": [["path", {
    d: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
  }], ["path", {
    d: "M20 3v4"
  }], ["path", {
    d: "M22 5h-4"
  }], ["path", {
    d: "M4 17v2"
  }], ["path", {
    d: "M5 18H3"
  }]],
  "target": [["circle", {
    cx: 12,
    cy: 12,
    r: 10
  }], ["circle", {
    cx: 12,
    cy: 12,
    r: 6
  }], ["circle", {
    cx: 12,
    cy: 12,
    r: 2
  }]],
  "mic": [["path", {
    d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"
  }], ["path", {
    d: "M19 10v2a7 7 0 0 1-14 0v-2"
  }], ["path", {
    d: "M12 19v3"
  }]],
  "keyboard": [["path", {
    d: "M10 8h.01"
  }], ["path", {
    d: "M12 12h.01"
  }], ["path", {
    d: "M14 8h.01"
  }], ["path", {
    d: "M16 12h.01"
  }], ["path", {
    d: "M18 8h.01"
  }], ["path", {
    d: "M6 8h.01"
  }], ["path", {
    d: "M7 16h10"
  }], ["path", {
    d: "M8 12h.01"
  }], ["rect", {
    width: 20,
    height: 16,
    x: 2,
    y: 4,
    rx: 2
  }]],
  "message-square": [["path", {
    d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
  }]],
  "message-circle-question": [["path", {
    d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z"
  }], ["path", {
    d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"
  }], ["path", {
    d: "M12 17h.01"
  }]],
  "file-text": [["path", {
    d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"
  }], ["path", {
    d: "M14 2v4a2 2 0 0 0 2 2h4"
  }], ["path", {
    d: "M10 9H8"
  }], ["path", {
    d: "M16 13H8"
  }], ["path", {
    d: "M16 17H8"
  }]],
  "briefcase": [["path", {
    d: "M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"
  }], ["rect", {
    width: 20,
    height: 14,
    x: 2,
    y: 6,
    rx: 2
  }]],
  "shield-check": [["path", {
    d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
  }], ["path", {
    d: "m9 12 2 2 4-4"
  }]],
  "list-checks": [["path", {
    d: "m3 17 2 2 4-4"
  }], ["path", {
    d: "m3 7 2 2 4-4"
  }], ["path", {
    d: "M13 6h8"
  }], ["path", {
    d: "M13 12h8"
  }], ["path", {
    d: "M13 18h8"
  }]],
  "circle-user": [["circle", {
    cx: 12,
    cy: 12,
    r: 10
  }], ["circle", {
    cx: 12,
    cy: 10,
    r: 3
  }], ["path", {
    d: "M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"
  }]],
  "trash": [["path", {
    d: "M3 6h18"
  }], ["path", {
    d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"
  }], ["path", {
    d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
  }], ["path", {
    d: "M10 11v6"
  }], ["path", {
    d: "M14 11v6"
  }]],
  "loader": [["path", {
    d: "M21 12a9 9 0 1 1-6.219-8.56"
  }]],
  "circle": [["circle", {
    cx: 12,
    cy: 12,
    r: 10
  }]]
};
function Icon({
  name,
  size = 20,
  strokeWidth = 2,
  style,
  className,
  ...rest
}) {
  const shapes = PATHS[name] || PATHS["help-circle"];
  return /*#__PURE__*/React.createElement("svg", _extends({
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flexShrink: 0,
      ...style
    },
    className: className,
    "aria-hidden": "true"
  }, rest), shapes.map(([tag, attrs], i) => React.createElement(tag, {
    key: i,
    ...attrs
  })));
}
const ICON_NAMES = Object.keys(PATHS);
Object.assign(__ds_scope, { Icon, ICON_NAMES });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/icons/Icon.jsx", error: String((e && e.message) || e) }); }

// components/display/StatusBadge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.rjs-statusbadge{display:inline-flex;align-items:center;gap:6px;border-radius:9999px;border:1px solid;font-weight:var(--font-weight-medium);text-transform:uppercase;letter-spacing:0.05em;font-family:var(--font-sans);width:fit-content;}
.rjs-statusbadge--size-sm{padding:2px 8px;font-size:var(--text-micro-size);}
.rjs-statusbadge--size-md{padding:2px 10px;font-size:12px;}
.rjs-statusbadge--size-lg{padding:4px 12px;font-size:14px;}
.rjs-statusbadge--full{width:100%;justify-content:center;}
.rjs-statusbadge--success,.rjs-statusbadge--readinessHigh{background:#ecfdf5;color:#065f46;border-color:#34d399;}
.rjs-statusbadge--warning,.rjs-statusbadge--readinessMedium{background:#fffbeb;color:#78350f;border-color:#fde68a;}
.rjs-statusbadge--critical,.rjs-statusbadge--readinessLow{background:#fff1f2;color:#9f1239;border-color:#fecdd3;}
.rjs-statusbadge--info,.rjs-statusbadge--readinessPotential{background:#f0f9ff;color:#075985;border-color:#bae6fd;}
.rjs-statusbadge--neutral{background:hsl(var(--muted));color:hsl(var(--muted-foreground));border-color:hsl(var(--border));}
.rjs-statusbadge--progressIdle{background:transparent;color:hsl(var(--muted-foreground));border-color:hsl(var(--border));}
.rjs-statusbadge--progressStarted{background:#f0f9ff;color:#075985;border-color:#bae6fd;}
.rjs-statusbadge--progressSolid{background:hsl(var(--state-info));color:hsl(var(--text-inverse));border-color:transparent;}
.rjs-statusbadge--progressComplete{background:hsl(var(--state-success));color:hsl(var(--text-inverse));border-color:transparent;}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-statusbadge-css")) {
  const s = document.createElement("style");
  s.id = "rjs-statusbadge-css";
  s.textContent = css;
  document.head.appendChild(s);
}
const VARIANT_ICON = {
  success: "check-circle",
  readinessHigh: "check-circle",
  readinessPotential: "check-circle",
  progressComplete: "check-circle",
  warning: "alert-triangle",
  readinessMedium: "alert-triangle",
  critical: "alert-circle",
  readinessLow: "alert-circle",
  info: "clock",
  progressSolid: "clock",
  progressStarted: "clock"
};
function StatusBadge({
  variant = "neutral",
  size = "md",
  fullWidth = false,
  icon = true,
  className = "",
  children,
  ...rest
}) {
  const iconName = VARIANT_ICON[variant] || "help-circle";
  const iconSize = size === "sm" ? 12 : size === "lg" ? 16 : 14;
  const classes = ["rjs-statusbadge", `rjs-statusbadge--${variant}`, `rjs-statusbadge--size-${size}`, fullWidth ? "rjs-statusbadge--full" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: classes
  }, rest), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconName,
    size: iconSize
  }) : null, children);
}
Object.assign(__ds_scope, { StatusBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/StatusBadge.jsx", error: String((e && e.message) || e) }); }

// components/feedback/AlertPanel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.rjs-alertpanel{border-radius:var(--radius-2xl);border:1px solid;font-size:14px;display:flex;align-items:flex-start;gap:12px;font-family:var(--font-sans);color:hsl(var(--text-primary));box-sizing:border-box;}
.rjs-alertpanel--size-md{padding:12px 16px;}
.rjs-alertpanel--size-sm{border-radius:var(--radius-xl);padding:12px;}
.rjs-alertpanel--weight-medium{font-weight:var(--font-weight-medium);}
.rjs-alertpanel--weight-semibold{font-weight:var(--font-weight-semibold);}
.rjs-alertpanel--critical{border-color:hsl(var(--state-critical)/0.25);background:hsl(var(--state-critical)/0.05);}
.rjs-alertpanel--critical svg{color:#be123c;}
.rjs-alertpanel--success{border-color:hsl(var(--state-success)/0.4);background:hsl(var(--state-success)/0.05);}
.rjs-alertpanel--success svg{color:#047857;}
.rjs-alertpanel--info{border-color:hsl(var(--state-info)/0.25);background:hsl(var(--state-info)/0.05);}
.rjs-alertpanel--info svg{color:#0369a1;}
.rjs-alertpanel--warning{border-color:hsl(var(--state-warning)/0.25);background:hsl(var(--state-warning)/0.05);}
.rjs-alertpanel--warning svg{color:#92400e;}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-alertpanel-css")) {
  const s = document.createElement("style");
  s.id = "rjs-alertpanel-css";
  s.textContent = css;
  document.head.appendChild(s);
}
const TONE_ICON = {
  critical: "alert-circle",
  success: "check-circle",
  info: "info",
  warning: "alert-triangle"
};
function AlertPanel({
  tone = "critical",
  weight = "medium",
  size = "md",
  icon = false,
  className = "",
  children,
  ...rest
}) {
  const classes = ["rjs-alertpanel", `rjs-alertpanel--${tone}`, `rjs-alertpanel--weight-${weight}`, `rjs-alertpanel--size-${size}`, className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: classes
  }, rest), icon === true ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: TONE_ICON[tone],
    size: 16,
    style: {
      marginTop: 2
    }
  }) : icon || null, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, children));
}
Object.assign(__ds_scope, { AlertPanel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/AlertPanel.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.rjs-emptystate{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:64px 24px;font-family:var(--font-sans);}
.rjs-emptystate--border{border:1px dashed hsl(var(--border));border-radius:var(--radius-2xl);background:hsl(var(--surface-subtle)/0.5);}
.rjs-emptystate__iconwrap{margin-bottom:24px;display:flex;align-items:center;justify-content:center;width:80px;height:80px;border-radius:9999px;background:hsl(var(--surface-base));border:1px solid hsl(var(--border));box-shadow:var(--shadow-flat);}
.rjs-emptystate__title{font-size:20px;font-weight:var(--font-weight-semibold);color:hsl(var(--text-primary));margin:0;}
.rjs-emptystate__desc{font-size:14px;color:hsl(var(--text-muted));margin:4px 0 0;max-width:28rem;}
.rjs-emptystate__actions{margin-top:32px;display:flex;align-items:center;gap:12px;}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-emptystate-css")) {
  const s = document.createElement("style");
  s.id = "rjs-emptystate-css";
  s.textContent = css;
  document.head.appendChild(s);
}
function EmptyState({
  title,
  description,
  icon,
  actions,
  border = true,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["rjs-emptystate", border ? "rjs-emptystate--border" : "", className].filter(Boolean).join(" ")
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "rjs-emptystate__iconwrap"
  }, icon || /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "inbox",
    size: 48,
    style: {
      color: "hsl(var(--muted-foreground) / 0.3)"
    }
  })), /*#__PURE__*/React.createElement("h2", {
    className: "rjs-emptystate__title"
  }, title), description ? /*#__PURE__*/React.createElement("p", {
    className: "rjs-emptystate__desc"
  }, description) : null, actions ? /*#__PURE__*/React.createElement("div", {
    className: "rjs-emptystate__actions"
  }, actions) : null);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ErrorState.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.rjs-errorstate{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:64px 24px;border:1px solid hsl(var(--state-critical)/0.1);border-radius:var(--radius-2xl);background:hsl(var(--state-critical)/0.05);font-family:var(--font-sans);}
.rjs-errorstate__iconwrap{margin-bottom:24px;display:flex;align-items:center;justify-content:center;width:80px;height:80px;border-radius:9999px;background:hsl(var(--surface-base));border:1px solid hsl(var(--state-critical)/0.2);box-shadow:var(--shadow-raised-1);color:#be123c;}
.rjs-errorstate__title{font-size:20px;font-weight:var(--font-weight-semibold);color:hsl(var(--text-primary));margin:0;}
.rjs-errorstate__desc{font-size:14px;color:hsl(var(--text-muted));margin:4px 0 0;max-width:28rem;}
.rjs-errorstate__code{margin-top:24px;padding:16px;background:rgba(0,0,0,0.05);border-radius:var(--radius-md);border:1px solid hsl(var(--border)/0.5);max-width:32rem;overflow:auto;font-size:var(--text-micro-size);color:hsl(var(--muted-foreground));white-space:pre-wrap;font-family:monospace;}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-errorstate-css")) {
  const s = document.createElement("style");
  s.id = "rjs-errorstate-css";
  s.textContent = css;
  document.head.appendChild(s);
}
function ErrorState({
  title = "Something went wrong",
  description = "We encountered an error while loading this content. Please try again or contact support if the issue persists.",
  icon,
  onRetry,
  error,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["rjs-errorstate", className].filter(Boolean).join(" ")
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "rjs-errorstate__iconwrap"
  }, icon || /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "alert-circle",
    size: 48
  })), /*#__PURE__*/React.createElement("h2", {
    className: "rjs-errorstate__title"
  }, title), /*#__PURE__*/React.createElement("p", {
    className: "rjs-errorstate__desc"
  }, description), error ? /*#__PURE__*/React.createElement("code", {
    className: "rjs-errorstate__code"
  }, typeof error === "string" ? error : error.message) : null, onRetry ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 32
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "outline",
    onClick: onRetry
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "refresh-cw",
    size: 16
  }), " Try Again")) : null);
}
Object.assign(__ds_scope, { ErrorState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ErrorState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/FeedbackPanel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
  outstanding: {
    badge: "high",
    label: "Outstanding",
    icon: "sparkles",
    color: "#065f46",
    border: "hsl(var(--state-success))"
  },
  satisfactory: {
    badge: "medium",
    label: "Satisfactory",
    icon: "check-circle",
    color: "#075985",
    border: "hsl(var(--state-info))"
  },
  growth: {
    badge: "low",
    label: "Growth Opportunity",
    icon: "target",
    color: "#78350f",
    border: "hsl(var(--state-warning))"
  },
  critical: {
    badge: "destructive",
    label: "Critical Issue",
    icon: "alert-triangle",
    color: "#9f1239",
    border: "hsl(var(--state-critical))"
  }
};
function FeedbackPanel({
  title,
  body,
  assessment,
  icon,
  className = "",
  ...rest
}) {
  const config = assessment ? ASSESSMENT[assessment] : null;
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["rjs-feedbackpanel", className].filter(Boolean).join(" "),
    style: {
      borderLeftColor: config ? config.border : "hsl(var(--primary))"
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "rjs-feedbackpanel__header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rjs-feedbackpanel__titlewrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rjs-feedbackpanel__iconwrap",
    style: {
      color: config ? config.color : "hsl(var(--primary))"
    }
  }, icon || /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: config ? config.icon : "sparkles",
    size: 16
  })), /*#__PURE__*/React.createElement("h4", {
    className: "rjs-feedbackpanel__title"
  }, title)), config ? /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    variant: config.badge
  }, config.label) : null), /*#__PURE__*/React.createElement("div", {
    className: "rjs-feedbackpanel__body"
  }, body));
}
Object.assign(__ds_scope, { FeedbackPanel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/FeedbackPanel.jsx", error: String((e && e.message) || e) }); }

// components/feedback/FeedbackPill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
@keyframes rjs-pill-pop{from{opacity:0;transform:translate(-50%,10px) scale(0.5);}to{opacity:1;transform:translate(-50%,-20px) scale(1);}}
.rjs-feedbackpill{position:absolute;bottom:100%;left:50%;z-index:20;pointer-events:none;padding-bottom:8px;animation:rjs-pill-pop 250ms var(--ease-emphasized) both;}
.rjs-feedbackpill__bubble{background:hsl(var(--state-success));color:hsl(var(--text-inverse));border-radius:9999px;box-shadow:var(--shadow-raised-2);display:flex;align-items:center;justify-content:center;white-space:nowrap;font-family:var(--font-sans);}
.rjs-feedbackpill__bubble--text{padding:2px 8px;gap:4px;}
.rjs-feedbackpill__bubble--icononly{padding:6px;}
.rjs-feedbackpill__label{font-size:10px;font-weight:var(--font-weight-black);text-transform:uppercase;letter-spacing:0.1em;}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-feedbackpill-css")) {
  const s = document.createElement("style");
  s.id = "rjs-feedbackpill-css";
  s.textContent = css;
  document.head.appendChild(s);
}
function FeedbackPill({
  isVisible,
  text = "",
  icon,
  className = "",
  ...rest
}) {
  if (!isVisible) return null;
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["rjs-feedbackpill", className].filter(Boolean).join(" ")
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: `rjs-feedbackpill__bubble rjs-feedbackpill__bubble--${text ? "text" : "icononly"}`
  }, icon || /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 10,
    strokeWidth: 4
  }), text ? /*#__PURE__*/React.createElement("span", {
    className: "rjs-feedbackpill__label"
  }, text) : null));
}
Object.assign(__ds_scope, { FeedbackPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/FeedbackPill.jsx", error: String((e && e.message) || e) }); }

// components/feedback/FeedbackCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
const css = `
.rjs-feedbackcard{position:relative;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:24px;padding:24px;border-radius:2rem;border:1px solid #e9d5ff;background:#faf5ff;box-shadow:var(--shadow-raised-1);transition:box-shadow 500ms;font-family:var(--font-sans);box-sizing:border-box;}
.rjs-feedbackcard:hover{box-shadow:var(--shadow-raised-2);}
.rjs-feedbackcard__title{font-size:18px;font-weight:var(--font-weight-bold);color:#3b0764;margin:0;}
.rjs-feedbackcard__scale{position:relative;display:flex;gap:8px;}
.rjs-feedbackcard__labels{display:flex;justify-content:space-between;width:100%;padding:0 4px;font-size:10px;font-weight:var(--font-weight-bold);text-transform:uppercase;letter-spacing:0.1em;color:rgba(59,7,100,0.7);}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-feedbackcard-css")) {
  const s = document.createElement("style");
  s.id = "rjs-feedbackcard-css";
  s.textContent = css;
  document.head.appendChild(s);
}
function FeedbackCard({
  title,
  scaleType = "emoji",
  successText = "",
  lowLabel,
  highLabel,
  onRate,
  className = "",
  ...rest
}) {
  const [rating, setRating] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const handleRate = val => {
    setRating(val);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 1500);
    if (onRate) onRate(val);
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["rjs-feedbackcard", className].filter(Boolean).join(" ")
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "rjs-feedbackcard__title"
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "rjs-feedbackcard__scale"
  }, __ds_scope.EMOJI_SCALE.map(({
    val,
    emoji
  }) => /*#__PURE__*/React.createElement(__ds_scope.FeedbackChoiceButton, {
    key: val,
    kind: "emoji",
    selected: rating === val,
    onClick: () => handleRate(val),
    title: `Rate ${val}/5`,
    style: scaleType === "numeric" ? {
      fontSize: 20,
      fontWeight: 900,
      fontFamily: "var(--font-display)"
    } : undefined
  }, scaleType === "emoji" ? emoji : val)), /*#__PURE__*/React.createElement(__ds_scope.FeedbackPill, {
    isVisible: showSuccess,
    text: successText
  })), lowLabel || highLabel ? /*#__PURE__*/React.createElement("div", {
    className: "rjs-feedbackcard__labels"
  }, /*#__PURE__*/React.createElement("span", null, lowLabel), /*#__PURE__*/React.createElement("span", null, highLabel)) : null));
}
Object.assign(__ds_scope, { FeedbackCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/FeedbackCard.jsx", error: String((e && e.message) || e) }); }

// components/forms/SearchField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
function SearchField({
  wrapperClassName = "",
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: ["rjs-searchfield", wrapperClassName].filter(Boolean).join(" ")
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "search",
    size: 16,
    className: "rjs-searchfield__icon"
  }), /*#__PURE__*/React.createElement("input", _extends({
    type: "text",
    className: ["rjs-searchfield__input", className].filter(Boolean).join(" ")
  }, rest)));
}
Object.assign(__ds_scope, { SearchField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SearchField.jsx", error: String((e && e.message) || e) }); }

// components/shell/CandidateDisclosureFooter.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
function CandidateDisclosureFooter({
  children,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("footer", _extends({
    className: ["rjs-disclosure", className].filter(Boolean).join(" ")
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "shield-check",
    size: 16,
    className: "rjs-disclosure__icon"
  }), /*#__PURE__*/React.createElement("p", {
    className: "rjs-disclosure__text"
  }, children || "Your answers are used to provide coaching and improve your practice. They are protected by access controls and are not shared with recruiters or employers for hiring decisions."));
}
Object.assign(__ds_scope, { CandidateDisclosureFooter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shell/CandidateDisclosureFooter.jsx", error: String((e && e.message) || e) }); }

// components/shell/CandidateMobileDock.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const DOCK = [{
  label: "Dashboard",
  icon: "layout-dashboard"
}, {
  label: "Practice",
  icon: "mic"
}, {
  label: "Questions",
  icon: "list-checks"
}, {
  label: "Profile",
  icon: "circle-user"
}];
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
function CandidateMobileDock({
  activeLabel = "Dashboard",
  onNavigate,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("nav", _extends({
    className: ["rjs-dock", className].filter(Boolean).join(" ")
  }, rest), DOCK.map(item => {
    const active = item.label === activeLabel;
    return /*#__PURE__*/React.createElement("button", {
      key: item.label,
      className: ["rjs-dock__link", active ? "rjs-dock__link--active" : ""].filter(Boolean).join(" "),
      onClick: () => onNavigate && onNavigate(item.label)
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: item.icon,
      size: 18,
      strokeWidth: active ? 2.4 : 2
    }), item.label);
  }));
}
Object.assign(__ds_scope, { CandidateMobileDock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shell/CandidateMobileDock.jsx", error: String((e && e.message) || e) }); }

// components/shell/CandidateSidebar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const NAV = [{
  label: "Dashboard",
  icon: "layout-dashboard"
}, {
  label: "Practice",
  icon: "mic"
}, {
  label: "Question set",
  icon: "list-checks"
}, {
  label: "Coach updates",
  icon: "sparkles"
}, {
  label: "Profile",
  icon: "circle-user"
}];
const css = `
.rjs-sidebar{display:flex;flex-direction:column;width:16rem;flex-shrink:0;height:100%;padding:24px 16px;background:rgb(var(--candidate-surface));border-right:1px solid rgb(var(--candidate-border)/0.7);font-family:var(--font-sans);box-sizing:border-box;}
.rjs-sidebar__brand{display:flex;align-items:center;gap:10px;padding:0 8px 24px;}
.rjs-sidebar__brand img{height:28px;width:auto;}
.rjs-sidebar__nav{display:flex;flex-direction:column;gap:4px;margin-top:8px;}
.rjs-sidebar__link{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:var(--radius-xl);font-size:14px;font-weight:var(--font-weight-medium);color:rgb(var(--candidate-muted));text-decoration:none;cursor:pointer;border:none;background:transparent;width:100%;text-align:left;transition:transform var(--duration-base) var(--ease-standard),background var(--duration-base),color var(--duration-base);}
.rjs-sidebar__link:hover{background:rgb(var(--candidate-surface-alt));color:rgb(var(--candidate-foreground));transform:scale(1.02);}
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
function CandidateSidebar({
  activeLabel = "Dashboard",
  logoSrc,
  onNavigate,
  footer,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("aside", _extends({
    className: ["rjs-sidebar", className].filter(Boolean).join(" ")
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "rjs-sidebar__brand"
  }, logoSrc ? /*#__PURE__*/React.createElement("img", {
    src: logoSrc,
    alt: "TalentArbor"
  }) : /*#__PURE__*/React.createElement("strong", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 18,
      color: "rgb(var(--candidate-foreground))"
    }
  }, "TalentArbor")), /*#__PURE__*/React.createElement("nav", {
    className: "rjs-sidebar__nav"
  }, NAV.map(item => {
    const active = item.label === activeLabel;
    return /*#__PURE__*/React.createElement("button", {
      key: item.label,
      className: ["rjs-sidebar__link", active ? "rjs-sidebar__link--active" : ""].filter(Boolean).join(" "),
      onClick: () => onNavigate && onNavigate(item.label)
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: item.icon,
      size: 18,
      strokeWidth: active ? 2.4 : 2
    }), item.label);
  })), /*#__PURE__*/React.createElement("div", {
    className: "rjs-sidebar__spacer"
  }), footer ? /*#__PURE__*/React.createElement("div", {
    className: "rjs-sidebar__cta"
  }, footer) : null);
}
Object.assign(__ds_scope, { CandidateSidebar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shell/CandidateSidebar.jsx", error: String((e && e.message) || e) }); }

// components/structure/DataTable.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.rjs-datatable-wrap{border-radius:var(--radius-xl);border:1px solid hsl(var(--border));overflow:hidden;background:hsl(var(--card));font-family:var(--font-sans);}
.rjs-datatable{width:100%;border-collapse:collapse;font-size:14px;}
.rjs-datatable thead th{background:hsl(var(--surface-subtle));text-align:left;padding:12px 16px;font-size:var(--text-micro-size);font-weight:var(--font-weight-bold);text-transform:uppercase;letter-spacing:0.05em;color:hsl(var(--text-muted));border-bottom:1px solid hsl(var(--border));}
.rjs-datatable tbody td{padding:14px 16px;color:hsl(var(--text-primary));border-bottom:1px solid hsl(var(--border)/0.6);}
.rjs-datatable tbody tr:last-child td{border-bottom:none;}
.rjs-datatable tbody tr{transition:background var(--duration-fast);}
.rjs-datatable tbody tr:hover{background:hsl(var(--surface-subtle)/0.6);}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-datatable-css")) {
  const s = document.createElement("style");
  s.id = "rjs-datatable-css";
  s.textContent = css;
  document.head.appendChild(s);
}
function DataTable({
  columns = [],
  rows = [],
  renderCell,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["rjs-datatable-wrap", className].filter(Boolean).join(" ")
  }, rest), /*#__PURE__*/React.createElement("table", {
    className: "rjs-datatable"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map(col => /*#__PURE__*/React.createElement("th", {
    key: col.key,
    style: col.align ? {
      textAlign: col.align
    } : undefined
  }, col.label)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((row, i) => /*#__PURE__*/React.createElement("tr", {
    key: row.id ?? i
  }, columns.map(col => /*#__PURE__*/React.createElement("td", {
    key: col.key,
    style: col.align ? {
      textAlign: col.align
    } : undefined
  }, renderCell ? renderCell(row, col) : row[col.key])))))));
}
Object.assign(__ds_scope, { DataTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/structure/DataTable.jsx", error: String((e && e.message) || e) }); }

// components/structure/PageIntro.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.rjs-pageintro{display:flex;flex-direction:column;gap:8px;font-family:var(--font-sans);}
.rjs-pageintro__eyebrow{font-size:12px;font-weight:var(--font-weight-semibold);text-transform:uppercase;letter-spacing:0.28em;color:rgb(var(--candidate-muted));margin:0;}
.rjs-pageintro__title{font-family:var(--font-display);font-size:clamp(1.75rem,4vw,2.5rem);line-height:1.02;font-weight:var(--font-weight-bold);color:rgb(var(--candidate-foreground));margin:0;}
.rjs-pageintro__description{max-width:42rem;font-size:1.0625rem;line-height:1.9;color:rgb(var(--candidate-muted));margin:0;}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-pageintro-css")) {
  const s = document.createElement("style");
  s.id = "rjs-pageintro-css";
  s.textContent = css;
  document.head.appendChild(s);
}
function PageIntro({
  eyebrow,
  title,
  description,
  actions,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["rjs-pageintro", className].filter(Boolean).join(" ")
  }, rest), eyebrow ? /*#__PURE__*/React.createElement("p", {
    className: "rjs-pageintro__eyebrow"
  }, eyebrow) : null, title ? /*#__PURE__*/React.createElement("h1", {
    className: "rjs-pageintro__title"
  }, title) : null, description ? /*#__PURE__*/React.createElement("p", {
    className: "rjs-pageintro__description"
  }, description) : null, actions ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      display: "flex",
      gap: 12,
      flexWrap: "wrap"
    }
  }, actions) : null);
}
Object.assign(__ds_scope, { PageIntro });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/structure/PageIntro.jsx", error: String((e && e.message) || e) }); }

// components/structure/SectionHeader.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const css = `
.rjs-sectionheader{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;font-family:var(--font-sans);}
.rjs-sectionheader__eyebrow{font-size:var(--text-micro-size);font-weight:var(--font-weight-bold);text-transform:uppercase;letter-spacing:0.1em;color:hsl(var(--text-muted));margin:0 0 4px;}
.rjs-sectionheader__title{font-weight:var(--font-weight-semibold);color:hsl(var(--text-primary));margin:0;line-height:1.2;}
.rjs-sectionheader--md .rjs-sectionheader__title{font-size:18px;}
.rjs-sectionheader--lg .rjs-sectionheader__title{font-size:24px;}
.rjs-sectionheader--sm .rjs-sectionheader__title{font-size:16px;}
.rjs-sectionheader__desc{font-size:14px;color:hsl(var(--text-muted));margin:4px 0 0;}
`;
if (typeof document !== "undefined" && !document.getElementById("rjs-sectionheader-css")) {
  const s = document.createElement("style");
  s.id = "rjs-sectionheader-css";
  s.textContent = css;
  document.head.appendChild(s);
}
function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  size = "md",
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["rjs-sectionheader", `rjs-sectionheader--${size}`, className].filter(Boolean).join(" ")
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, eyebrow ? /*#__PURE__*/React.createElement("p", {
    className: "rjs-sectionheader__eyebrow"
  }, eyebrow) : null, title ? /*#__PURE__*/React.createElement("h2", {
    className: "rjs-sectionheader__title"
  }, title) : null, description ? /*#__PURE__*/React.createElement("p", {
    className: "rjs-sectionheader__desc"
  }, description) : null), actions ? /*#__PURE__*/React.createElement("div", {
    style: {
      flexShrink: 0
    }
  }, actions) : null);
}
Object.assign(__ds_scope, { SectionHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/structure/SectionHeader.jsx", error: String((e && e.message) || e) }); }

// components/structure/PageHeaderBlock.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function PageHeaderBlock({
  eyebrow,
  title,
  description,
  actions,
  children,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: className,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16,
      paddingBottom: 24,
      borderBottom: "1px solid hsl(var(--border))",
      fontFamily: "var(--font-sans)"
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.SectionHeader, {
    eyebrow: eyebrow,
    title: title,
    description: description,
    actions: actions,
    size: "lg"
  }), children);
}
Object.assign(__ds_scope, { PageHeaderBlock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/structure/PageHeaderBlock.jsx", error: String((e && e.message) || e) }); }

// components/structure/SessionPromptShell.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function SessionPromptShell({
  children,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["glass-card", className].filter(Boolean).join(" "),
    style: {
      borderRadius: "2rem",
      padding: 32,
      fontFamily: "var(--font-sans)",
      background: "linear-gradient(to bottom right, hsl(var(--brand-glass-start)), hsl(var(--brand-glass-end)))",
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
      border: "1px solid rgba(255,255,255,0.2)",
      boxShadow: "var(--shadow-floating)"
    }
  }, rest), children);
}
Object.assign(__ds_scope, { SessionPromptShell });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/structure/SessionPromptShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/candidate/Dashboard.jsx
try { (() => {
// Candidate dashboard — the primary self-serve surface.
function Dashboard({
  onStartPractice
}) {
  const NS = window.RangamJobSeekerDesignSystem_7ff43f;
  const {
    Icon,
    SurfaceCard,
    MetricCard,
    StatusBadge,
    InsightCard,
    ActionButton,
    Progress,
    IconBadge,
    FeedbackPanel
  } = NS;
  const D = window.CandidateData;
  const V = D.stateVariant;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100%",
      background: "rgb(248 250 252)"
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      position: "sticky",
      top: 0,
      zIndex: 20,
      background: "linear-gradient(to bottom, rgb(248 250 252 / 0.96), rgb(248 250 252 / 0.7))",
      backdropFilter: "blur(12px)",
      padding: "16px 32px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1120,
      margin: "0 auto",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/TA-logo.png",
    alt: "TalentArbor",
    style: {
      height: 26
    }
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 22,
      fontWeight: 700,
      color: "rgb(15 33 57 / 0.85)",
      margin: 0
    }
  }, "Interview Coach")), /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 28,
      background: "rgba(255,255,255,0.4)",
      backdropFilter: "blur(16px)",
      padding: 4
    }
  }, /*#__PURE__*/React.createElement(ActionButton, {
    onClick: onStartPractice
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "mic",
    size: 16
  }), " Start practice")))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1120,
      margin: "0 auto",
      padding: "24px 32px 48px",
      display: "grid",
      gridTemplateColumns: "minmax(0,1fr) 23rem",
      gap: 32,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 24,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 900,
      textTransform: "uppercase",
      letterSpacing: "0.16em",
      color: "rgb(86 106 131)"
    }
  }, "Target interview"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      borderRadius: 9999,
      border: "1px solid rgb(211 221 232)",
      background: "#fff",
      padding: "6px 14px",
      fontSize: 14,
      fontWeight: 600,
      color: "rgb(15 33 57)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "briefcase",
    size: 15,
    style: {
      color: "rgb(12 97 233)"
    }
  }), " ", D.role, " ", /*#__PURE__*/React.createElement(Icon, {
    name: "chevrons-up-down",
    size: 14,
    style: {
      color: "rgb(148 163 184)"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "surface-blue",
    style: {
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      fontWeight: 900,
      textTransform: "uppercase",
      letterSpacing: "0.16em",
      color: "rgba(255,255,255,0.75)",
      margin: 0
    }
  }, "Coach Update"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 22,
      fontWeight: 700,
      margin: "6px 0 8px",
      color: "#fff"
    }
  }, "You're trending up on specificity"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      lineHeight: 1.7,
      color: "rgba(255,255,255,0.9)",
      margin: 0,
      maxWidth: "38ch"
    }
  }, "Your last three answers had concrete examples. Let's add clearer outcomes to move Behavioral from Clear to Strong.")), /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 28,
    style: {
      color: "rgba(255,255,255,0.9)",
      flexShrink: 0
    }
  }))), /*#__PURE__*/React.createElement(SurfaceCard, {
    eyebrow: "Preparedness Map",
    title: "Where you stand",
    description: "How ready you are across answer skills and question categories."
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      fontWeight: 900,
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      color: "rgb(86 106 131)",
      margin: 0
    }
  }, "Answer skills"), D.skills.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.label
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: "rgb(15 33 57)"
    }
  }, s.label), /*#__PURE__*/React.createElement(StatusBadge, {
    variant: V[s.state],
    size: "sm"
  }, s.state)), /*#__PURE__*/React.createElement(Progress, {
    value: s.pct
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      fontWeight: 900,
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      color: "rgb(86 106 131)",
      margin: 0
    }
  }, "Question categories"), D.categories.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.label,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 14,
      border: "1px solid rgb(211 221 232 / 0.7)",
      background: "rgb(246 250 255)",
      padding: "10px 14px"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: "rgb(15 33 57)"
    }
  }, c.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "rgb(86 106 131)"
    }
  }, c.practiced, "/", c.total, " practiced")), /*#__PURE__*/React.createElement(StatusBadge, {
    variant: V[c.state],
    size: "sm"
  }, c.state)))))), /*#__PURE__*/React.createElement(SurfaceCard, {
    eyebrow: "Coach Plan",
    title: "What I noticed"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(InsightCard, {
    tone: "positive"
  }, /*#__PURE__*/React.createElement("strong", null, "Strength"), " \u2014 you back every claim with a concrete example."), /*#__PURE__*/React.createElement(InsightCard, {
    tone: "caution"
  }, /*#__PURE__*/React.createElement("strong", null, "Grow"), " \u2014 quantify outcomes; add a %, number, or timeline."), /*#__PURE__*/React.createElement(InsightCard, {
    tone: "highlight"
  }, /*#__PURE__*/React.createElement("strong", null, "Try next"), " \u2014 practice one Culture / Fit answer, none logged yet."), /*#__PURE__*/React.createElement(InsightCard, {
    tone: "neutral"
  }, /*#__PURE__*/React.createElement("strong", null, "Reminder"), " \u2014 lead with the result, then the story."))), /*#__PURE__*/React.createElement(SurfaceCard, {
    eyebrow: "Coach Update",
    title: "Recent activity"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, D.recent.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      borderRadius: 16,
      border: "1px solid rgb(211 221 232 / 0.6)",
      background: "#fff",
      padding: "12px 16px"
    }
  }, /*#__PURE__*/React.createElement(IconBadge, {
    variant: r.assessment === "outstanding" ? "success" : "info",
    size: "sm"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: r.assessment === "outstanding" ? "check-circle" : "message-circle-question",
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: "rgb(15 33 57)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, r.q), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "rgb(86 106 131)"
    }
  }, r.cat, " \xB7 ", r.when)), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 16,
    style: {
      color: "rgb(148 163 184)"
    }
  })))))), /*#__PURE__*/React.createElement("aside", {
    style: {
      position: "sticky",
      top: 88,
      display: "flex",
      flexDirection: "column",
      gap: 16,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 28,
      border: "1px solid rgb(211 221 232 / 0.8)",
      background: "#fff",
      padding: 24,
      boxShadow: "var(--candidate-shadow-panel)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      fontWeight: 900,
      textTransform: "uppercase",
      letterSpacing: "0.16em",
      color: "rgb(12 97 233)",
      margin: 0
    }
  }, "Practice next"), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 20,
      fontWeight: 700,
      color: "rgb(15 33 57)",
      margin: "8px 0 6px"
    }
  }, "Sharpen your outcomes"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      lineHeight: 1.6,
      color: "rgb(86 106 131)",
      margin: "0 0 16px"
    }
  }, "Practice one answer with a clear beginning, middle, and measurable ending."), /*#__PURE__*/React.createElement(ActionButton, {
    size: "large",
    onClick: onStartPractice,
    style: {
      width: "100%"
    }
  }, "Start a round ", /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(MetricCard, {
    title: "Sessions",
    value: 8,
    variant: "pill"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(MetricCard, {
    title: "Readiness",
    value: "Clear",
    variant: "pill",
    valueStyle: {
      color: "hsl(217 90% 48%)"
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "1px solid rgb(211 221 232 / 0.7)",
      paddingTop: 16,
      display: "flex",
      gap: 10,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 16,
    style: {
      color: "rgb(14 176 153)",
      flexShrink: 0,
      marginTop: 2
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      lineHeight: 1.6,
      color: "rgb(86 106 131)",
      margin: 0
    }
  }, "Your answers power your coaching and are never shared with recruiters for hiring decisions.")))));
}
window.Dashboard = Dashboard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/candidate/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/candidate/PracticeSession.jsx
try { (() => {
// Active practice question workspace — voice/text answer, coach lens, feedback.
function PracticeSession({
  onExit
}) {
  const NS = window.RangamJobSeekerDesignSystem_7ff43f;
  const {
    Icon,
    Button,
    SessionPromptShell,
    FeedbackPanel,
    StatusBadge,
    ActionButton,
    Progress
  } = NS;
  const D = window.CandidateData;
  const [idx, setIdx] = React.useState(0);
  const [mode, setMode] = React.useState("voice");
  const [recording, setRecording] = React.useState(false);
  const [answer, setAnswer] = React.useState("");
  const [phase, setPhase] = React.useState("answering"); // answering | analyzing | feedback
  const [hintOpen, setHintOpen] = React.useState(false);
  const q = D.questions[idx];
  const isLast = idx === D.questions.length - 1;
  const submit = () => {
    setPhase("analyzing");
    setRecording(false);
    setTimeout(() => setPhase("feedback"), 1400);
  };
  const next = () => {
    if (isLast) {
      onExit();
      return;
    }
    setIdx(i => i + 1);
    setMode("voice");
    setRecording(false);
    setAnswer("");
    setHintOpen(false);
    setPhase("answering");
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100%",
      background: "rgb(248 250 252)",
      padding: "32px 24px",
      display: "flex",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: 720,
      display: "flex",
      flexDirection: "column",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onExit,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: "transparent",
      border: "none",
      cursor: "pointer",
      color: "rgb(86 106 131)",
      fontSize: 13,
      fontWeight: 600,
      fontFamily: "var(--font-sans)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 16
  }), " Exit session"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: "rgb(86 106 131)"
    }
  }, "Question ", idx + 1, " of ", D.questions.length)), /*#__PURE__*/React.createElement(Progress, {
    value: (idx + (phase === "feedback" ? 1 : 0)) / D.questions.length * 100
  }), /*#__PURE__*/React.createElement(SessionPromptShell, null, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      fontWeight: 900,
      textTransform: "uppercase",
      letterSpacing: "0.16em",
      color: "rgb(12 97 233)",
      margin: 0
    }
  }, q.cat), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 26,
      fontWeight: 700,
      lineHeight: 1.15,
      color: "rgb(15 33 57)",
      margin: "10px 0 0"
    }
  }, q.text), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: () => setHintOpen(v => !v)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 15
  }), " Coach lens"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "message-square",
    size: 15
  }), " Read aloud")), hintOpen ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      borderRadius: 16,
      border: "1px solid #e9d5ff",
      background: "#faf5ff",
      padding: "14px 16px"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      fontWeight: 900,
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      color: "#9333ea",
      margin: "0 0 6px"
    }
  }, "Hint"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      lineHeight: 1.6,
      color: "rgb(15 33 57)",
      margin: 0
    }
  }, "Structure it: the situation, the specific action you took, and the measurable outcome. Lead with the result.")) : null), phase === "answering" ? /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 28,
      border: "1px solid rgb(211 221 232 / 0.7)",
      background: "#fff",
      padding: 24,
      boxShadow: "var(--candidate-shadow-card)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      gap: 4,
      padding: 4,
      borderRadius: 9999,
      background: "rgb(248 250 252)",
      border: "1px solid rgb(211 221 232)",
      marginBottom: 20
    }
  }, [["voice", "mic", "Voice"], ["text", "keyboard", "Type"]].map(([m, ic, lbl]) => /*#__PURE__*/React.createElement("button", {
    key: m,
    onClick: () => setMode(m),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 18px",
      borderRadius: 9999,
      border: "none",
      cursor: "pointer",
      fontSize: 13,
      fontWeight: 600,
      fontFamily: "var(--font-sans)",
      background: mode === m ? "#fff" : "transparent",
      color: mode === m ? "rgb(12 97 233)" : "rgb(86 106 131)",
      boxShadow: mode === m ? "var(--shadow-raised-1)" : "none"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 16
  }), " ", lbl))), mode === "voice" ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 16,
      padding: "16px 0"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setRecording(v => !v),
    style: {
      width: 88,
      height: 88,
      borderRadius: 9999,
      border: "none",
      cursor: "pointer",
      background: recording ? "hsl(0 84% 60%)" : "rgb(12 97 233)",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "var(--candidate-shadow-cta)",
      transition: "all 200ms"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "mic",
    size: 34
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: "rgb(86 106 131)",
      margin: 0
    }
  }, recording ? "Recording… tap to stop" : "Tap to record your answer"), recording ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 3,
      alignItems: "flex-end",
      height: 28
    }
  }, [10, 20, 14, 26, 16, 22, 12, 24, 15].map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: 4,
      height: h,
      background: "rgb(12 97 233)",
      borderRadius: 2,
      opacity: 0.7
    }
  }))) : null) : /*#__PURE__*/React.createElement("textarea", {
    value: answer,
    onChange: e => setAnswer(e.target.value),
    placeholder: "Type your answer\u2026",
    style: {
      width: "100%",
      minHeight: 140,
      borderRadius: 16,
      border: "1px solid rgb(211 221 232)",
      background: "rgb(248 250 252)",
      padding: 16,
      fontSize: 14,
      lineHeight: 1.7,
      fontFamily: "var(--font-sans)",
      color: "rgb(15 33 57)",
      boxSizing: "border-box",
      resize: "vertical"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      display: "flex",
      justifyContent: "flex-end"
    }
  }, /*#__PURE__*/React.createElement(ActionButton, {
    onClick: submit,
    disabled: mode === "voice" ? !recording : !answer.trim()
  }, "Submit answer ", /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 16
  })))) : null, phase === "analyzing" ? /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 28,
      border: "1px solid rgb(211 221 232 / 0.7)",
      background: "#fff",
      padding: 40,
      textAlign: "center",
      boxShadow: "var(--candidate-shadow-card)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      animation: "rjs-spin 1s linear infinite",
      color: "rgb(12 97 233)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "loader",
    size: 32
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: "rgb(15 33 57)",
      margin: "14px 0 0"
    }
  }, "The coach is reviewing your answer\u2026"), /*#__PURE__*/React.createElement("style", null, "@keyframes rjs-spin{to{transform:rotate(360deg)}}")) : null, phase === "feedback" ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(StatusBadge, {
    variant: "success"
  }, "Answer reviewed"), /*#__PURE__*/React.createElement(FeedbackPanel, {
    title: "Strong structure and a clear result",
    assessment: "outstanding",
    body: "You led with the outcome and grounded it in a specific situation. The action you took was concrete and easy to follow."
  }), /*#__PURE__*/React.createElement(FeedbackPanel, {
    title: "Add one measurable detail",
    assessment: "growth",
    body: "Great example \u2014 next time, quantify the impact (a %, a timeline, a number) so the result lands even harder."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-end",
      gap: 10,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "refresh-cw",
    size: 16
  }), " Retry"), /*#__PURE__*/React.createElement(ActionButton, {
    onClick: next
  }, isLast ? "Finish session" : "Next question", " ", /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 16
  })))) : null));
}
window.PracticeSession = PracticeSession;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/candidate/PracticeSession.jsx", error: String((e && e.message) || e) }); }

// ui_kits/candidate/SessionEntry.jsx
try { (() => {
// Session entry screen — mirrors CandidateSessionEntryScreen.tsx
function SessionEntry({
  onStart,
  onBack
}) {
  const {
    Icon,
    IconBadge,
    ActionButton
  } = window.RangamJobSeekerDesignSystem_7ff43f;
  const D = window.CandidateData;
  const total = D.plan.reduce((n, p) => n + p.count, 0);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      minHeight: "100%",
      background: "linear-gradient(135deg, #e8f1fd, #dbe8fb)",
      display: "flex",
      justifyContent: "center",
      padding: "48px 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "rgba(255,255,255,0.4)",
      backdropFilter: "blur(24px)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      zIndex: 1,
      width: "100%",
      maxWidth: 560,
      display: "flex",
      flexDirection: "column",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      alignSelf: "flex-start",
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: "transparent",
      border: "none",
      cursor: "pointer",
      color: "rgb(86 106 131)",
      fontSize: 13,
      fontWeight: 600,
      fontFamily: "var(--font-sans)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-left",
    size: 16
  }), " Dashboard"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 30,
      fontWeight: 700,
      lineHeight: 1.1,
      color: "rgb(12 97 233)",
      margin: 0
    }
  }, "Let's get you ready for your interview."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 17,
      lineHeight: 1.7,
      color: "rgb(86 106 131)",
      marginTop: 12
    }
  }, "You'll answer a series of interview-style questions tailored to your target role: ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: "rgb(15 33 57)"
    }
  }, D.role), ".")), /*#__PURE__*/React.createElement("section", {
    style: {
      borderRadius: 24,
      border: "1px solid hsl(217 90% 48% / 0.2)",
      background: "hsl(217 90% 48% / 0.08)",
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(IconBadge, {
    variant: "info",
    size: "md",
    style: {
      borderRadius: 9999
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "list-checks",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      fontWeight: 900,
      textTransform: "uppercase",
      letterSpacing: "0.18em",
      color: "hsl(217 90% 40%)",
      margin: 0
    }
  }, "Your practice plan"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontWeight: 700,
      color: "rgb(15 33 57)",
      margin: "4px 0 12px"
    }
  }, total, " questions \xB7 ", D.stage), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8
    }
  }, D.plan.map(p => /*#__PURE__*/React.createElement("span", {
    key: p.label,
    style: {
      borderRadius: 9999,
      border: "1px solid hsl(217 90% 48% / 0.2)",
      background: "#fff",
      padding: "4px 12px",
      fontSize: 12,
      fontWeight: 700,
      color: "rgb(86 106 131)"
    }
  }, p.label, ": ", p.count)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 20,
      borderRadius: 24,
      border: "1px solid rgb(211 221 232 / 0.6)",
      background: "#fff",
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(IconBadge, {
    variant: "info",
    size: "md",
    style: {
      borderRadius: 9999
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 20
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontWeight: 700,
      color: "rgb(15 33 57)",
      margin: 0
    }
  }, "No time limit"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      lineHeight: 1.6,
      color: "rgb(86 106 131)",
      margin: "2px 0 0"
    }
  }, "Take your time. Thoughtful answers lead to better feedback."))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 40,
      height: 40,
      flexShrink: 0,
      borderRadius: 9999,
      border: "1px solid #e9d5ff",
      background: "#faf5ff",
      color: "#9333ea"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 20
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontWeight: 700,
      color: "rgb(15 33 57)",
      margin: 0
    }
  }, "Private coaching feedback"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      lineHeight: 1.6,
      color: "rgb(86 106 131)",
      margin: "2px 0 0"
    }
  }, "Your answers are used to provide coaching. They are protected by access controls and are not shared with recruiters or employers for hiring decisions.")))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(ActionButton, {
    size: "large",
    onClick: onStart,
    style: {
      width: "100%"
    }
  }, "Start practice session ", /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 18
  })))));
}
window.SessionEntry = SessionEntry;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/candidate/SessionEntry.jsx", error: String((e && e.message) || e) }); }

// ui_kits/candidate/data.js
try { (() => {
// Shared mock data + small helpers for the candidate UI kit.
window.CandidateData = {
  role: "Senior Product Designer",
  stage: "Full-loop interview",
  plan: [{
    label: "Screening",
    count: 2
  }, {
    label: "Behavioral",
    count: 3
  }, {
    label: "Culture / Fit",
    count: 1
  }, {
    label: "Case / Scenario",
    count: 1
  }, {
    label: "Technical / Role-Specific",
    count: 1
  }],
  questions: [{
    id: "q1",
    cat: "Behavioral",
    text: "Tell me about a time you resolved a conflict on your team."
  }, {
    id: "q2",
    cat: "Case / Scenario",
    text: "Walk me through how you'd redesign an onboarding flow with a 40% drop-off."
  }, {
    id: "q3",
    cat: "Screening",
    text: "Why are you interested in this role, and why now?"
  }],
  skills: [{
    label: "Structure",
    state: "Clear",
    pct: 72
  }, {
    label: "Specificity",
    state: "Strong",
    pct: 88
  }, {
    label: "Outcomes",
    state: "Emerging",
    pct: 46
  }, {
    label: "Role fit",
    state: "Clear",
    pct: 64
  }],
  categories: [{
    label: "Screening",
    practiced: 2,
    total: 2,
    state: "Strong"
  }, {
    label: "Behavioral",
    practiced: 2,
    total: 3,
    state: "Clear"
  }, {
    label: "Culture / Fit",
    practiced: 0,
    total: 1,
    state: "Not practiced"
  }, {
    label: "Case / Scenario",
    practiced: 1,
    total: 1,
    state: "Emerging"
  }, {
    label: "Technical",
    practiced: 0,
    total: 1,
    state: "Not practiced"
  }],
  recent: [{
    q: "A time you influenced without authority",
    cat: "Behavioral",
    when: "2h ago",
    assessment: "outstanding"
  }, {
    q: "Prioritizing a roadmap with limited data",
    cat: "Case / Scenario",
    when: "Yesterday",
    assessment: "satisfactory"
  }, {
    q: "Tell me about yourself",
    cat: "Screening",
    when: "Yesterday",
    assessment: "outstanding"
  }],
  stateVariant: {
    "Strong": "readinessHigh",
    "Clear": "progressSolid",
    "Emerging": "readinessMedium",
    "Not practiced": "progressIdle"
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/candidate/data.js", error: String((e && e.message) || e) }); }

__ds_ns.ActionButton = __ds_scope.ActionButton;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.CardHeader = __ds_scope.CardHeader;

__ds_ns.CardTitle = __ds_scope.CardTitle;

__ds_ns.CardDescription = __ds_scope.CardDescription;

__ds_ns.CardContent = __ds_scope.CardContent;

__ds_ns.CardFooter = __ds_scope.CardFooter;

__ds_ns.ContentCard = __ds_scope.ContentCard;

__ds_ns.IconBadge = __ds_scope.IconBadge;

__ds_ns.InsightCard = __ds_scope.InsightCard;

__ds_ns.MetricCard = __ds_scope.MetricCard;

__ds_ns.Progress = __ds_scope.Progress;

__ds_ns.Skeleton = __ds_scope.Skeleton;

__ds_ns.StatusBadge = __ds_scope.StatusBadge;

__ds_ns.SurfaceCard = __ds_scope.SurfaceCard;

__ds_ns.AlertPanel = __ds_scope.AlertPanel;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.ErrorState = __ds_scope.ErrorState;

__ds_ns.FeedbackCard = __ds_scope.FeedbackCard;

__ds_ns.FeedbackPanel = __ds_scope.FeedbackPanel;

__ds_ns.FeedbackPill = __ds_scope.FeedbackPill;

__ds_ns.EMOJI_SCALE = __ds_scope.EMOJI_SCALE;

__ds_ns.FeedbackChoiceButton = __ds_scope.FeedbackChoiceButton;

__ds_ns.FieldGroup = __ds_scope.FieldGroup;

__ds_ns.FieldLabel = __ds_scope.FieldLabel;

__ds_ns.FieldHint = __ds_scope.FieldHint;

__ds_ns.FormField = __ds_scope.FormField;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.SearchField = __ds_scope.SearchField;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.ICON_NAMES = __ds_scope.ICON_NAMES;

__ds_ns.CandidateDisclosureFooter = __ds_scope.CandidateDisclosureFooter;

__ds_ns.CandidateMobileDock = __ds_scope.CandidateMobileDock;

__ds_ns.CandidateSidebar = __ds_scope.CandidateSidebar;

__ds_ns.DataTable = __ds_scope.DataTable;

__ds_ns.PageHeaderBlock = __ds_scope.PageHeaderBlock;

__ds_ns.PageIntro = __ds_scope.PageIntro;

__ds_ns.SectionHeader = __ds_scope.SectionHeader;

__ds_ns.SessionPromptShell = __ds_scope.SessionPromptShell;

})();
