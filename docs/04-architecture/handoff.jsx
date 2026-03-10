import { useState } from "react";

const Section = ({ id, title, children, accent = "#00E5CC" }) => {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: "2rem", borderLeft: `3px solid ${accent}`, paddingLeft: "1.5rem" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: "0.75rem",
          color: "#E8F4F0", fontFamily: "'DM Mono', monospace", fontSize: "0.75rem",
          letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1rem", padding: 0
        }}
      >
        <span style={{ color: accent, fontSize: "0.65rem" }}>{open ? "▼" : "▶"}</span>
        <span style={{ color: "#6B9E8A", marginRight: "0.25rem" }}>{id}</span>
        {title}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
};

const Badge = ({ children, color = "#00E5CC" }) => (
  <span style={{
    background: color + "18", border: `1px solid ${color}44`,
    color: color, fontSize: "0.68rem", fontFamily: "'DM Mono', monospace",
    padding: "0.2rem 0.6rem", borderRadius: "3px", letterSpacing: "0.08em"
  }}>{children}</span>
);

const Card = ({ children, style = {} }) => (
  <div style={{
    background: "#0D1F1A", border: "1px solid #1E3A30",
    borderRadius: "6px", padding: "1.25rem", ...style
  }}>{children}</div>
);

const StackItem = ({ label, items, color }) => (
  <div style={{ marginBottom: "1rem" }}>
    <div style={{ color: color, fontFamily: "'DM Mono', monospace", fontSize: "0.7rem", letterSpacing: "0.12em", marginBottom: "0.5rem", textTransform: "uppercase" }}>{label}</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
      {items.map(i => <Badge key={i} color={color}>{i}</Badge>)}
    </div>
  </div>
);

// Architecture flow diagram
const ArchDiagram = () => {
  const nodes = [
    { id: "recruiter", label: "Recruiter UI", x: 40, y: 60, color: "#00E5CC" },
    { id: "candidate", label: "Candidate UI", x: 40, y: 140, color: "#00E5CC" },
    { id: "audio", label: "Audio Hooks", x: 40, y: 220, color: "#00E5CC" },
    { id: "api", label: "API Routes", x: 220, y: 140, color: "#7B61FF" },
    { id: "orch", label: "Orchestrator", x: 380, y: 100, color: "#7B61FF" },
    { id: "ai", label: "AI Services", x: 380, y: 180, color: "#7B61FF" },
    { id: "repo", label: "Repositories", x: 380, y: 260, color: "#7B61FF" },
    { id: "auth", label: "Supabase Auth", x: 560, y: 60, color: "#FF6B6B" },
    { id: "db", label: "Supabase DB", x: 560, y: 180, color: "#FF6B6B" },
    { id: "gemini", label: "Google Gemini", x: 560, y: 300, color: "#FFB74D" },
  ];
  const edges = [
    ["recruiter","api"],["candidate","api"],["audio","api"],
    ["api","orch"],["api","ai"],["orch","repo"],["ai","gemini"],
    ["repo","db"],["api","auth"]
  ];
  const getNode = id => nodes.find(n => n.id === id);
  const cx = n => n.x + 60; const cy = n => n.y + 20;
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox="0 0 700 360" style={{ width: "100%", maxWidth: 700, minWidth: 500 }}>
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#2A4A40" />
          </marker>
        </defs>
        {edges.map(([a, b], i) => {
          const na = getNode(a), nb = getNode(b);
          return <line key={i} x1={cx(na)} y1={cy(na)} x2={cx(nb)} y2={cy(nb)}
            stroke="#2A4A40" strokeWidth="1.5" markerEnd="url(#arrow)" />;
        })}
        {nodes.map(n => (
          <g key={n.id}>
            <rect x={n.x} y={n.y} width={120} height={36} rx={5}
              fill={n.color + "12"} stroke={n.color + "55"} strokeWidth="1.5" />
            <text x={n.x + 60} y={n.y + 22} textAnchor="middle"
              fill={n.color} fontSize="11" fontFamily="DM Mono, monospace">{n.label}</text>
          </g>
        ))}
        {/* Labels */}
        {[["Client", 40, 300, "#00E5CC"], ["Server", 310, 300, "#7B61FF"], ["External", 530, 300, "#FF6B6B"]].map(([l,x,y,c]) => (
          <text key={l} x={x} y={y} fill={c + "88"} fontSize="9" fontFamily="DM Mono, monospace" letterSpacing="2">{l.toUpperCase()}</text>
        ))}
        <line x1={185} y1={20} x2={185} y2={340} stroke="#1E3A30" strokeWidth="1" strokeDasharray="4,4" />
        <line x1={525} y1={20} x2={525} y2={340} stroke="#1E3A30" strokeWidth="1" strokeDasharray="4,4" />
      </svg>
    </div>
  );
};

// ER diagram
const ERDiagram = () => {
  const entities = [
    { id: "sessions", x: 220, y: 20, color: "#00E5CC" },
    { id: "questions", x: 60, y: 130, color: "#7B61FF" },
    { id: "answers", x: 220, y: 200, color: "#7B61FF" },
    { id: "eval_results", x: 380, y: 130, color: "#7B61FF" },
    { id: "events", x: 60, y: 220, color: "#FFB74D" },
    { id: "tokens", x: 380, y: 220, color: "#FF6B6B" },
    { id: "projection", x: 220, y: 300, color: "#4CAF7D" },
  ];
  const edges = [
    ["sessions","questions"],["sessions","answers"],["sessions","eval_results"],
    ["sessions","events"],["sessions","tokens"],["sessions","projection"],
    ["questions","answers"],["questions","eval_results"]
  ];
  const get = id => entities.find(e => e.id === id);
  const cx = n => n.x + 55; const cy = n => n.y + 16;
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox="0 0 530 360" style={{ width: "100%", maxWidth: 530, minWidth: 400 }}>
        <defs>
          <marker id="arr2" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L7,3 z" fill="#2A4A40" />
          </marker>
        </defs>
        {edges.map(([a, b], i) => {
          const na = get(a), nb = get(b);
          return <line key={i} x1={cx(na)} y1={cy(na)} x2={cx(nb)} y2={cy(nb)}
            stroke="#2A4A40" strokeWidth="1.5" markerEnd="url(#arr2)" />;
        })}
        {entities.map(n => (
          <g key={n.id}>
            <rect x={n.x} y={n.y} width={110} height={32} rx={4}
              fill={n.color + "12"} stroke={n.color + "66"} strokeWidth="1.5" />
            <text x={n.x + 55} y={n.y + 20} textAnchor="middle"
              fill={n.color} fontSize="10" fontFamily="DM Mono, monospace">{n.id}</text>
          </g>
        ))}
      </svg>
    </div>
  );
};

// Sequence diagram for candidate submit
const SequenceDiagram = () => {
  const actors = ["Candidate UI", "POST /submit", "Token Validator", "AI Service", "Repository", "Postgres"];
  const cols = actors.map((_, i) => 60 + i * 110);
  const steps = [
    [0, 1, "answer + token"],
    [1, 2, "validate token"],
    [2, 1, "ok ✓"],
    [1, 3, "analyze answer"],
    [3, 1, "analysis payload"],
    [1, 4, "persist results"],
    [4, 5, "upsert rows"],
    [1, 0, "session response"],
  ];
  const rowH = 34; const topY = 70;
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox="0 0 720 380" style={{ width: "100%", maxWidth: 720, minWidth: 560 }}>
        {actors.map((a, i) => (
          <g key={a}>
            <rect x={cols[i] - 46} y={8} width={92} height={28} rx={4}
              fill="#0D1F1A" stroke="#2A4A40" strokeWidth="1.5" />
            <text x={cols[i]} y={27} textAnchor="middle"
              fill="#6ECFB3" fontSize="9" fontFamily="DM Mono, monospace">{a}</text>
            <line x1={cols[i]} y1={36} x2={cols[i]} y2={topY + steps.length * rowH + 10}
              stroke="#1E3A30" strokeWidth="1" strokeDasharray="3,3" />
          </g>
        ))}
        {steps.map(([from, to, label], idx) => {
          const y = topY + idx * rowH;
          const dir = from < to ? 1 : -1;
          const x1 = cols[from] + dir * 8; const x2 = cols[to] - dir * 8;
          const isReturn = from > to;
          return (
            <g key={idx}>
              <line x1={x1} y1={y} x2={x2} y2={y}
                stroke={isReturn ? "#2A4A40" : "#3A6A58"} strokeWidth={isReturn ? 1 : 1.5}
                strokeDasharray={isReturn ? "4,3" : "0"} markerEnd="url(#seqarr)" />
              <text x={(cols[from] + cols[to]) / 2} y={y - 5}
                textAnchor="middle" fill="#4A8A70" fontSize="8.5" fontFamily="DM Mono, monospace">{label}</text>
            </g>
          );
        })}
        <defs>
          <marker id="seqarr" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L7,3 z" fill="#3A6A58" />
          </marker>
        </defs>
      </svg>
    </div>
  );
};

// Retry flow
const RetryFlow = () => {
  const steps = [
    { label: "Candidate requests retry", color: "#00E5CC" },
    { label: "POST /retry + token", color: "#7B61FF" },
    { label: "Server validates token", color: "#7B61FF" },
    { label: "Clear prior eval state", color: "#FF6B6B" },
    { label: "Increment attempt state", color: "#FFB74D" },
    { label: "Client reopens input", color: "#4CAF7D" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", background: s.color + "18",
              border: `2px solid ${s.color}55`, display: "flex", alignItems: "center",
              justifyContent: "center", color: s.color,
              fontFamily: "'DM Mono', monospace", fontSize: "0.7rem"
            }}>{i + 1}</div>
            {i < steps.length - 1 && <div style={{ width: 2, height: 20, background: "#1E3A30" }} />}
          </div>
          <span style={{ color: "#C0D8CF", fontFamily: "'DM Mono', monospace", fontSize: "0.8rem" }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const tabs = ["overview", "stack", "data", "flows", "security"];

  return (
    <div style={{
      background: "#060F0C", minHeight: "100vh", color: "#C0D8CF",
      fontFamily: "'DM Mono', monospace",
      backgroundImage: "radial-gradient(ellipse at 20% 20%, #0A2018 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, #0A1A25 0%, transparent 60%)"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1E3A30", padding: "2rem 2.5rem 1.5rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ color: "#3A6A58", fontSize: "0.65rem", letterSpacing: "0.2em", marginBottom: "0.4rem" }}>TECHNICAL DESIGN HANDOFF</div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.8rem", fontWeight: 800, color: "#E8F4F0", margin: 0, letterSpacing: "-0.02em" }}>
              Interview Coach <span style={{ color: "#00E5CC" }}>App</span>
            </h1>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Badge color="#00E5CC">Next.js 14</Badge>
            <Badge color="#7B61FF">Supabase</Badge>
            <Badge color="#FFB74D">Gemini AI</Badge>
            <Badge color="#4CAF7D">v1.0</Badge>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0", marginTop: "1.5rem", borderBottom: "1px solid #1E3A30" }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "0.5rem 1.2rem", fontSize: "0.68rem", letterSpacing: "0.12em",
              textTransform: "uppercase", fontFamily: "'DM Mono', monospace",
              color: activeTab === t ? "#00E5CC" : "#3A6A58",
              borderBottom: activeTab === t ? "2px solid #00E5CC" : "2px solid transparent",
              marginBottom: "-1px", transition: "color 0.2s"
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "2rem 2.5rem", maxWidth: 900, margin: "0 auto" }}>

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div>
            <Section id="§1" title="System Snapshot" accent="#00E5CC">
              <Card>
                <p style={{ margin: 0, lineHeight: 1.8, color: "#8ABFAA", fontSize: "0.85rem" }}>
                  Full-stack <strong style={{ color: "#00E5CC" }}>Next.js 14</strong> application supporting recruiter-authenticated workflows and candidate token-based interview practice. AI-driven analysis, response generation, tips, and TTS powered by <strong style={{ color: "#FFB74D" }}>Google Gemini</strong>. Persistent state in <strong style={{ color: "#7B61FF" }}>Supabase Postgres</strong>.
                </p>
                <div style={{ marginTop: "1.25rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem" }}>
                  {[
                    { label: "Recruiter Auth", desc: "Invite creation + review", color: "#00E5CC" },
                    { label: "Candidate Flow", desc: "Token-based, no login", color: "#7B61FF" },
                    { label: "AI Analysis", desc: "Gemini 2.5 Flash", color: "#FFB74D" },
                    { label: "TTS Playback", desc: "Audio prefetch cache", color: "#4CAF7D" },
                  ].map(i => (
                    <div key={i.label} style={{ background: "#060F0C", borderRadius: 5, padding: "0.75rem", border: `1px solid ${i.color}22` }}>
                      <div style={{ color: i.color, fontSize: "0.7rem", letterSpacing: "0.1em" }}>{i.label}</div>
                      <div style={{ color: "#4A8A70", fontSize: "0.72rem", marginTop: "0.25rem" }}>{i.desc}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </Section>

            <Section id="§5" title="Runtime Architecture" accent="#7B61FF">
              <Card>
                <div style={{ color: "#3A6A58", fontSize: "0.65rem", letterSpacing: "0.15em", marginBottom: "1rem" }}>CLIENT → SERVER → EXTERNAL</div>
                <ArchDiagram />
                <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                  {[["Client", "#00E5CC", "UI + Audio Hooks"], ["Server", "#7B61FF", "API + AI + Repos"], ["External", "#FF6B6B", "Auth + DB + Gemini"]].map(([l,c,d]) => (
                    <div key={l} style={{ borderLeft: `2px solid ${c}44`, paddingLeft: "0.5rem" }}>
                      <div style={{ color: c, fontSize: "0.65rem" }}>{l}</div>
                      <div style={{ color: "#4A8A70", fontSize: "0.68rem" }}>{d}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </Section>

            <Section id="§5.1" title="Layering Contract" accent="#4CAF7D">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {[
                  { layer: "API Routes", rule: "Input validation · Auth/token checks · Delegation only", color: "#00E5CC" },
                  { layer: "Orchestration", rule: "Owns state transitions", color: "#7B61FF" },
                  { layer: "Repositories", rule: "Database persistence + mapping", color: "#FFB74D" },
                  { layer: "AI Services", rule: "Prompts · Model calls · Response parsing", color: "#FF6B6B" },
                  { layer: "Client", rule: "Interaction state + progressive UX", color: "#4CAF7D" },
                ].map(l => (
                  <div key={l.layer} style={{ display: "flex", alignItems: "center", gap: "1rem", background: "#0D1F1A", borderRadius: 4, padding: "0.6rem 0.9rem", border: `1px solid ${l.color}22` }}>
                    <Badge color={l.color}>{l.layer}</Badge>
                    <span style={{ color: "#6B9E8A", fontSize: "0.78rem" }}>{l.rule}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* STACK TAB */}
        {activeTab === "stack" && (
          <div>
            <Section id="§2" title="Technology Stack" accent="#00E5CC">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Card>
                  <StackItem label="Framework" items={["Next.js 14", "React 18", "TypeScript"]} color="#00E5CC" />
                  <StackItem label="UI & Styling" items={["Tailwind CSS", "Radix UI", "Framer Motion"]} color="#7B61FF" />
                </Card>
                <Card>
                  <StackItem label="Data & Persistence" items={["Supabase Postgres", "Supabase Auth"]} color="#FFB74D" />
                  <StackItem label="Testing" items={["Vitest", "Testing Library", "ESLint"]} color="#4CAF7D" />
                </Card>
              </div>
            </Section>

            <Section id="§2.4" title="AI Model Allocation" accent="#FFB74D">
              <Card>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {[
                    { use: "Answer Analysis", model: "gemini-2.5-flash", status: "live" },
                    { use: "Strong Response Gen", model: "gemini-2.5-flash", status: "live" },
                    { use: "Tips Generation", model: "gemini-2.5-flash", status: "live" },
                    { use: "Text-to-Speech", model: "gemini-2.5-flash-preview-tts", status: "live" },
                    { use: "Question Generation", model: "gemini-2.5-flash", status: "mocked" },
                  ].map(r => (
                    <div key={r.use} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid #1E3A30" }}>
                      <span style={{ color: "#8ABFAA", fontSize: "0.8rem" }}>{r.use}</span>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <Badge color="#FFB74D">{r.model}</Badge>
                        <Badge color={r.status === "live" ? "#4CAF7D" : "#FF6B6B"}>{r.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </Section>

            <Section id="§4" title="Environment Variables" accent="#FF6B6B">
              <Card>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  {[
                    { key: "NEXT_PUBLIC_SUPABASE_URL", scope: "public" },
                    { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", scope: "public" },
                    { key: "SUPABASE_SERVICE_ROLE_KEY", scope: "secret" },
                    { key: "GEMINI_API_KEY", scope: "secret" },
                    { key: "DATABASE_URL", scope: "server" },
                    { key: "ENCRYPTION_SECRET", scope: "secret" },
                    { key: "NEXT_PUBLIC_APP_URL", scope: "public" },
                    { key: "NEXT_PUBLIC_SHOW_DEMO_TOOLS", scope: "flag" },
                  ].map(e => (
                    <div key={e.key} style={{ background: "#060F0C", borderRadius: 4, padding: "0.5rem 0.75rem", border: "1px solid #1E3A30", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <code style={{ color: "#8ABFAA", fontSize: "0.68rem" }}>{e.key.replace("NEXT_PUBLIC_", "").replace("_", "_​")}</code>
                      <Badge color={e.scope === "secret" ? "#FF6B6B" : e.scope === "public" ? "#4CAF7D" : "#7B61FF"}>{e.scope}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </Section>
          </div>
        )}

        {/* DATA TAB */}
        {activeTab === "data" && (
          <div>
            <Section id="§6" title="Data Model" accent="#7B61FF">
              <Card>
                <div style={{ color: "#3A6A58", fontSize: "0.65rem", letterSpacing: "0.15em", marginBottom: "1rem" }}>ENTITY RELATIONSHIPS</div>
                <ERDiagram />
              </Card>
              <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
                {[
                  { name: "sessions", desc: "Lifecycle root aggregate. Metadata + status + progress.", color: "#00E5CC" },
                  { name: "questions", desc: "Ordered per session.", color: "#7B61FF" },
                  { name: "answers", desc: "Keyed by (question_id, attempt_number).", color: "#7B61FF" },
                  { name: "eval_results", desc: "AI evaluation payload + metadata.", color: "#7B61FF" },
                  { name: "events", desc: "Append-only. Never mutable state.", color: "#FFB74D" },
                  { name: "candidate_tokens", desc: "Hashed token-to-session mapping.", color: "#FF6B6B" },
                  { name: "projection_session_now", desc: "Materialized current session view.", color: "#4CAF7D" },
                ].map(e => (
                  <div key={e.name} style={{ background: "#0D1F1A", borderRadius: 5, padding: "0.75rem", border: `1px solid ${e.color}22` }}>
                    <Badge color={e.color}>{e.name}</Badge>
                    <p style={{ color: "#4A8A70", fontSize: "0.72rem", marginTop: "0.5rem", marginBottom: 0, lineHeight: 1.5 }}>{e.desc}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="§7" title="API Surface" accent="#00E5CC">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Card style={{ borderColor: "#00E5CC22" }}>
                  <div style={{ color: "#00E5CC", fontSize: "0.65rem", letterSpacing: "0.15em", marginBottom: "0.75rem" }}>CANDIDATE-FACING</div>
                  {["POST /api/session/start","GET|PATCH /api/session/[id]","PUT /api/.../answer","POST /api/.../submit","POST /api/.../retry","POST /api/.../analysis","POST /api/tts","POST /api/response/generate","POST /api/tips/generate"].map(e => (
                    <div key={e} style={{ padding: "0.3rem 0", borderBottom: "1px solid #1E3A30", color: "#6ECFB3", fontSize: "0.72rem" }}>{e}</div>
                  ))}
                </Card>
                <Card style={{ borderColor: "#7B61FF22" }}>
                  <div style={{ color: "#7B61FF", fontSize: "0.65rem", letterSpacing: "0.15em", marginBottom: "0.75rem" }}>RECRUITER / DEV</div>
                  {["POST /api/recruiter/invites","GET /api/dev/export-session/[id]","POST /api/dev/generate-questions","POST /api/analysis"].map(e => (
                    <div key={e} style={{ padding: "0.3rem 0", borderBottom: "1px solid #1E3A30", color: "#A48FFF", fontSize: "0.72rem" }}>{e}</div>
                  ))}
                  <div style={{ marginTop: "1rem" }}>
                    <div style={{ color: "#3A6A58", fontSize: "0.65rem", letterSpacing: "0.12em", marginBottom: "0.5rem" }}>SECURITY MODEL</div>
                    <div style={{ color: "#4A8A70", fontSize: "0.72rem", lineHeight: 1.7 }}>
                      Recruiter → Supabase Auth session<br />
                      Candidate → x-candidate-token header<br />
                      Service role → server-side only
                    </div>
                  </div>
                </Card>
              </div>
            </Section>
          </div>
        )}

        {/* FLOWS TAB */}
        {activeTab === "flows" && (
          <div>
            <Section id="§8.2" title="Candidate Submit → Evaluation Flow" accent="#00E5CC">
              <Card>
                <div style={{ color: "#3A6A58", fontSize: "0.65rem", letterSpacing: "0.15em", marginBottom: "1rem" }}>SEQUENCE DIAGRAM</div>
                <SequenceDiagram />
              </Card>
            </Section>

            <Section id="§8.3" title="Retry Flow" accent="#FFB74D">
              <Card>
                <RetryFlow />
              </Card>
            </Section>

            <Section id="§8.1" title="Recruiter Creates Invite" accent="#7B61FF">
              <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
                  {[
                    { step: "Recruiter UI", detail: "role + candidates\n+ questions", color: "#00E5CC" },
                    { step: "→" },
                    { step: "POST /invites", detail: "API Route", color: "#7B61FF" },
                    { step: "→" },
                    { step: "Supabase Auth", detail: "getUser()", color: "#FF6B6B" },
                    { step: "→" },
                    { step: "Postgres DB", detail: "create sessions\n+ tokens", color: "#FFB74D" },
                    { step: "→" },
                    { step: "Invite Links", detail: "/s/{token}", color: "#4CAF7D" },
                  ].map((s, i) => s.step === "→" ? (
                    <span key={i} style={{ color: "#2A4A40", fontSize: "1.2rem", margin: "0 0.25rem" }}>→</span>
                  ) : (
                    <div key={i} style={{ background: s.color + "12", border: `1px solid ${s.color}44`, borderRadius: 5, padding: "0.6rem 0.75rem", textAlign: "center", minWidth: 90 }}>
                      <div style={{ color: s.color, fontSize: "0.7rem" }}>{s.step}</div>
                      {s.detail && <div style={{ color: "#3A6A58", fontSize: "0.62rem", marginTop: "0.2rem", whiteSpace: "pre-line" }}>{s.detail}</div>}
                    </div>
                  ))}
                </div>
              </Card>
            </Section>
          </div>
        )}

        {/* SECURITY TAB */}
        {activeTab === "security" && (
          <div>
            <Section id="§10" title="Security & Privacy Design" accent="#FF6B6B">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                {[
                  { title: "Candidate Access", items: ["Token-gated (hashed server-side)", "x-candidate-token header validation", "No raw token in client storage"], color: "#00E5CC" },
                  { title: "Recruiter Access", items: ["Supabase Auth session", "Middleware cookie refresh", "RLS on all recruiter data paths"], color: "#7B61FF" },
                  { title: "Secret Management", items: ["Service role key → server-only", "Gemini key → server-only", "Encryption secret → server-only"], color: "#FF6B6B" },
                  { title: "Privacy Guarantees", items: ["No keystroke logging", "No background surveillance", "No interpretive labels stored"], color: "#4CAF7D" },
                ].map(g => (
                  <Card key={g.title} style={{ borderColor: g.color + "22" }}>
                    <div style={{ color: g.color, fontSize: "0.68rem", letterSpacing: "0.12em", marginBottom: "0.75rem" }}>{g.title.toUpperCase()}</div>
                    {g.items.map(i => (
                      <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", marginBottom: "0.4rem" }}>
                        <span style={{ color: g.color, marginTop: "0.1rem" }}>·</span>
                        <span style={{ color: "#6B9E8A", fontSize: "0.78rem" }}>{i}</span>
                      </div>
                    ))}
                  </Card>
                ))}
              </div>
            </Section>

            <Section id="§11" title="Hardening Opportunities" accent="#FFB74D">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {[
                  { n: 1, item: "Replace mock QuestionService with Gemini-backed generation + schema validation", priority: "high" },
                  { n: 2, item: "Idempotency protection on submit/retry routes (request-level keys)", priority: "high" },
                  { n: 3, item: "Explicit API versioning strategy (/api/v1/...) before external expansion", priority: "medium" },
                  { n: 4, item: "Observability spans around AI latency, parse failures, DB write timing", priority: "medium" },
                ].map(r => (
                  <div key={r.n} style={{ display: "flex", gap: "1rem", alignItems: "flex-start", background: "#0D1F1A", borderRadius: 4, padding: "0.75rem 1rem", border: "1px solid #1E3A30" }}>
                    <div style={{ color: "#3A6A58", fontFamily: "'DM Mono', monospace", fontSize: "0.7rem", minWidth: 20 }}>0{r.n}</div>
                    <span style={{ color: "#8ABFAA", fontSize: "0.8rem", flex: 1 }}>{r.item}</span>
                    <Badge color={r.priority === "high" ? "#FF6B6B" : "#FFB74D"}>{r.priority}</Badge>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="§12" title="Deployment Runbook" accent="#4CAF7D">
              <Card>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {[
                    "Stand up Supabase + configure env vars",
                    "Apply migrations — verify base schema",
                    "npm run dev — smoke tests: npm test",
                    "Verify recruiter auth + invite generation",
                    "Verify candidate token → answer → analysis → retry",
                    "Validate recruiter dashboard session visibility",
                    "Establish dashboards: API errors · AI failures · DB latency",
                  ].map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#4CAF7D18", border: "1px solid #4CAF7D44", display: "flex", alignItems: "center", justifyContent: "center", color: "#4CAF7D", fontSize: "0.62rem", flexShrink: 0 }}>{i + 1}</div>
                      <span style={{ color: "#6B9E8A", fontSize: "0.78rem" }}>{s}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </Section>
          </div>
        )}

      </div>
    </div>
  );
}