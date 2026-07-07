// Candidate dashboard — the primary self-serve surface.
function Dashboard({ onStartPractice }) {
  const NS = window.RangamJobSeekerDesignSystem_7ff43f;
  const { Icon, SurfaceCard, MetricCard, StatusBadge, InsightCard, ActionButton, Progress, IconBadge, FeedbackPanel } = NS;
  const D = window.CandidateData;
  const V = D.stateVariant;

  return (
    <div style={{ minHeight: "100%", background: "rgb(248 250 252)" }}>
      {/* header */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "linear-gradient(to bottom, rgb(248 250 252 / 0.96), rgb(248 250 252 / 0.7))", backdropFilter: "blur(12px)", padding: "16px 32px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="../../assets/TA-logo.png" alt="TalentArbor" style={{ height: 26 }} />
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "rgb(15 33 57 / 0.85)", margin: 0 }}>Interview Coach</h1>
          </div>
          <div style={{ borderRadius: 28, background: "rgba(255,255,255,0.4)", backdropFilter: "blur(16px)", padding: 4 }}>
            <ActionButton onClick={onStartPractice}><Icon name="mic" size={16} /> Start practice</ActionButton>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "24px 32px 48px", display: "grid", gridTemplateColumns: "minmax(0,1fr) 23rem", gap: 32, alignItems: "start" }}>
        {/* main column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
          {/* target switcher */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.16em", color: "rgb(86 106 131)" }}>Target interview</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 9999, border: "1px solid rgb(211 221 232)", background: "#fff", padding: "6px 14px", fontSize: 14, fontWeight: 600, color: "rgb(15 33 57)" }}>
              <Icon name="briefcase" size={15} style={{ color: "rgb(12 97 233)" }} /> {D.role} <Icon name="chevrons-up-down" size={14} style={{ color: "rgb(148 163 184)" }} />
            </span>
          </div>

          {/* coach update */}
          <div className="surface-blue" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.16em", color: "rgba(255,255,255,0.75)", margin: 0 }}>Coach Update</p>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, margin: "6px 0 8px", color: "#fff" }}>You're trending up on specificity</h2>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.9)", margin: 0, maxWidth: "38ch" }}>Your last three answers had concrete examples. Let's add clearer outcomes to move Behavioral from Clear to Strong.</p>
              </div>
              <Icon name="sparkles" size={28} style={{ color: "rgba(255,255,255,0.9)", flexShrink: 0 }} />
            </div>
          </div>

          {/* preparedness map */}
          <SurfaceCard eyebrow="Preparedness Map" title="Where you stand" description="How ready you are across answer skills and question categories.">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgb(86 106 131)", margin: 0 }}>Answer skills</p>
                {D.skills.map((s) => (
                  <div key={s.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "rgb(15 33 57)" }}>{s.label}</span>
                      <StatusBadge variant={V[s.state]} size="sm">{s.state}</StatusBadge>
                    </div>
                    <Progress value={s.pct} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgb(86 106 131)", margin: 0 }}>Question categories</p>
                {D.categories.map((c) => (
                  <div key={c.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 14, border: "1px solid rgb(211 221 232 / 0.7)", background: "rgb(246 250 255)", padding: "10px 14px" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "rgb(15 33 57)" }}>{c.label}</div>
                      <div style={{ fontSize: 11, color: "rgb(86 106 131)" }}>{c.practiced}/{c.total} practiced</div>
                    </div>
                    <StatusBadge variant={V[c.state]} size="sm">{c.state}</StatusBadge>
                  </div>
                ))}
              </div>
            </div>
          </SurfaceCard>

          {/* what I noticed */}
          <SurfaceCard eyebrow="Coach Plan" title="What I noticed">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <InsightCard tone="positive"><strong>Strength</strong> — you back every claim with a concrete example.</InsightCard>
              <InsightCard tone="caution"><strong>Grow</strong> — quantify outcomes; add a %, number, or timeline.</InsightCard>
              <InsightCard tone="highlight"><strong>Try next</strong> — practice one Culture / Fit answer, none logged yet.</InsightCard>
              <InsightCard tone="neutral"><strong>Reminder</strong> — lead with the result, then the story.</InsightCard>
            </div>
          </SurfaceCard>

          {/* recent activity */}
          <SurfaceCard eyebrow="Coach Update" title="Recent activity">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {D.recent.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, borderRadius: 16, border: "1px solid rgb(211 221 232 / 0.6)", background: "#fff", padding: "12px 16px" }}>
                  <IconBadge variant={r.assessment === "outstanding" ? "success" : "info"} size="sm"><Icon name={r.assessment === "outstanding" ? "check-circle" : "message-circle-question"} size={16} /></IconBadge>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "rgb(15 33 57)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.q}</div>
                    <div style={{ fontSize: 12, color: "rgb(86 106 131)" }}>{r.cat} · {r.when}</div>
                  </div>
                  <Icon name="chevron-right" size={16} style={{ color: "rgb(148 163 184)" }} />
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>

        {/* sticky rail */}
        <aside style={{ position: "sticky", top: 88, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div style={{ borderRadius: 28, border: "1px solid rgb(211 221 232 / 0.8)", background: "#fff", padding: 24, boxShadow: "var(--candidate-shadow-panel)" }}>
            <p style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.16em", color: "rgb(12 97 233)", margin: 0 }}>Practice next</p>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "rgb(15 33 57)", margin: "8px 0 6px" }}>Sharpen your outcomes</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgb(86 106 131)", margin: "0 0 16px" }}>Practice one answer with a clear beginning, middle, and measurable ending.</p>
            <ActionButton size="large" onClick={onStartPractice} style={{ width: "100%" }}>Start a round <Icon name="arrow-right" size={16} /></ActionButton>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <div style={{ flex: 1 }}><MetricCard title="Sessions" value={8} variant="pill" /></div>
              <div style={{ flex: 1 }}><MetricCard title="Readiness" value="Clear" variant="pill" valueStyle={{ color: "hsl(217 90% 48%)" }} /></div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgb(211 221 232 / 0.7)", paddingTop: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Icon name="shield-check" size={16} style={{ color: "rgb(14 176 153)", flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 12, lineHeight: 1.6, color: "rgb(86 106 131)", margin: 0 }}>Your answers power your coaching and are never shared with recruiters for hiring decisions.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
window.Dashboard = Dashboard;
