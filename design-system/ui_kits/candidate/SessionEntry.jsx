// Session entry screen — mirrors CandidateSessionEntryScreen.tsx
function SessionEntry({ onStart, onBack }) {
  const { Icon, IconBadge, ActionButton } = window.RangamJobSeekerDesignSystem_7ff43f;
  const D = window.CandidateData;
  const total = D.plan.reduce((n, p) => n + p.count, 0);
  return (
    <div style={{ position: "relative", minHeight: "100%", background: "linear-gradient(135deg, #e8f1fd, #dbe8fb)", display: "flex", justifyContent: "center", padding: "48px 24px" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.4)", backdropFilter: "blur(24px)" }} />
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 24 }}>
        <button onClick={onBack} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", color: "rgb(86 106 131)", fontSize: 13, fontWeight: 600, fontFamily: "var(--font-sans)" }}>
          <Icon name="chevron-left" size={16} /> Dashboard
        </button>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, lineHeight: 1.1, color: "rgb(12 97 233)", margin: 0 }}>Let's get you ready for your interview.</h1>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "rgb(86 106 131)", marginTop: 12 }}>
            You'll answer a series of interview-style questions tailored to your target role: <strong style={{ color: "rgb(15 33 57)" }}>{D.role}</strong>.
          </p>
        </div>

        <section style={{ borderRadius: 24, border: "1px solid hsl(217 90% 48% / 0.2)", background: "hsl(217 90% 48% / 0.08)", padding: 20 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <IconBadge variant="info" size="md" style={{ borderRadius: 9999 }}><Icon name="list-checks" size={20} /></IconBadge>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.18em", color: "hsl(217 90% 40%)", margin: 0 }}>Your practice plan</p>
              <h2 style={{ fontWeight: 700, color: "rgb(15 33 57)", margin: "4px 0 12px" }}>{total} questions · {D.stage}</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {D.plan.map((p) => (
                  <span key={p.label} style={{ borderRadius: 9999, border: "1px solid hsl(217 90% 48% / 0.2)", background: "#fff", padding: "4px 12px", fontSize: 12, fontWeight: 700, color: "rgb(86 106 131)" }}>{p.label}: {p.count}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, borderRadius: 24, border: "1px solid rgb(211 221 232 / 0.6)", background: "#fff", padding: 20 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <IconBadge variant="info" size="md" style={{ borderRadius: 9999 }}><Icon name="clock" size={20} /></IconBadge>
            <div>
              <h2 style={{ fontWeight: 700, color: "rgb(15 33 57)", margin: 0 }}>No time limit</h2>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgb(86 106 131)", margin: "2px 0 0" }}>Take your time. Thoughtful answers lead to better feedback.</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, flexShrink: 0, borderRadius: 9999, border: "1px solid #e9d5ff", background: "#faf5ff", color: "#9333ea" }}><Icon name="shield-check" size={20} /></div>
            <div>
              <h2 style={{ fontWeight: 700, color: "rgb(15 33 57)", margin: 0 }}>Private coaching feedback</h2>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgb(86 106 131)", margin: "2px 0 0" }}>Your answers are used to provide coaching. They are protected by access controls and are not shared with recruiters or employers for hiring decisions.</p>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <ActionButton size="large" onClick={onStart} style={{ width: "100%" }}>Start practice session <Icon name="arrow-right" size={18} /></ActionButton>
        </div>
      </div>
    </div>
  );
}
window.SessionEntry = SessionEntry;
