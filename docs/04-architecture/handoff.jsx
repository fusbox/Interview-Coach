import { useState } from "react";
import { cn } from "@/lib/cn";

const Section = ({ id, title, children, accent = "var(--state-info)" }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-8 pl-6 border-l-2 transition-all duration-300 ease-in-out" style={{ borderColor: accent }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 bg-transparent border-none cursor-pointer p-0 mb-4 font-mono text-[10px] uppercase tracking-[0.15em] hover:opacity-80 transition-opacity"
      >
        <span className="text-[8px] transition-transform duration-300" style={{ color: accent, transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
        <span className="text-text-muted">{id}</span>
        <span className="text-text-primary font-bold">{title}</span>
      </button>
      {open && <div className="animate-in fade-in slide-in-from-left-2 duration-300">{children}</div>}
    </div>
  );
};

const Badge = ({ children, color = "var(--state-info)" }) => (
  <span 
    className="inline-flex items-center px-2 py-0.5 rounded-sm font-mono text-[10px] tracking-wider border transition-all"
    style={{ 
      backgroundColor: `color-mix(in srgb, ${color}, transparent 80%)`,
      borderColor: `color-mix(in srgb, ${color}, transparent 60%)`,
      color: color 
    }}
  >
    {children}
  </span>
);

const Card = ({ children, className }) => (
  <div className={cn(
    "bg-surface-subtle border border-border/50 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow duration-300",
    className
  )}>
    {children}
  </div>
);

const StackItem = ({ label, items, color = "var(--state-info)" }) => (
  <div className="mb-4">
    <div className="font-mono text-[9px] uppercase tracking-wider mb-2" style={{ color }}>{label}</div>
    <div className="flex flex-wrap gap-2">
      {items.map(i => <Badge key={i} color={color}>{i}</Badge>)}
    </div>
  </div>
);

// Architecture flow diagram
const ArchDiagram = () => {
  const nodes = [
    { id: "recruiter", label: "Recruiter UI", x: 40, y: 60, color: "var(--state-info)" },
    { id: "candidate", label: "Candidate UI", x: 40, y: 140, color: "var(--state-info)" },
    { id: "audio", label: "Audio Hooks", x: 40, y: 220, color: "var(--state-info)" },
    { id: "api", label: "API Routes", x: 220, y: 140, color: "var(--accent-alt)" },
    { id: "orch", label: "Orchestrator", x: 380, y: 100, color: "var(--accent-alt)" },
    { id: "ai", label: "AI Services", x: 380, y: 180, color: "var(--accent-alt)" },
    { id: "repo", label: "Repositories", x: 380, y: 260, color: "var(--accent-alt)" },
    { id: "auth", label: "Supabase Auth", x: 560, y: 60, color: "var(--state-critical)" },
    { id: "db", label: "Supabase DB", x: 560, y: 180, color: "var(--state-critical)" },
    { id: "gemini", label: "Google Gemini", x: 560, y: 300, color: "var(--state-warning)" },
  ];
  const edges = [
    ["recruiter","api"],["candidate","api"],["audio","api"],
    ["api","orch"],["api","ai"],["orch","repo"],["ai","gemini"],
    ["repo","db"],["api","auth"]
  ];
  const getNode = id => nodes.find(n => n.id === id);
  const cx = n => n.x + 60; const cy = n => n.y + 20;
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <svg viewBox="0 0 700 360" className="w-full max-w-[700px] min-w-[500px]">
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="hsl(var(--muted-foreground) / 0.5)" />
          </marker>
        </defs>
        {edges.map(([a, b], i) => {
          const na = getNode(a), nb = getNode(b);
          return <line key={i} x1={cx(na)} y1={cy(na)} x2={cx(nb)} y2={cy(nb)}
            stroke="hsl(var(--muted-foreground) / 0.4)" strokeWidth="1.5" markerEnd="url(#arrow)" />;
        })}
        {nodes.map(n => (
          <g key={n.id}>
            <rect x={n.x} y={n.y} width={120} height={36} rx={5}
              fill={`color-mix(in srgb, ${n.color}, transparent 90%)`} 
              stroke={`color-mix(in srgb, ${n.color}, transparent 50%)`} 
              strokeWidth="1.5" />
            <text x={n.x + 60} y={n.y + 22} textAnchor="middle"
              fill={n.color} fontSize="11" className="font-mono font-bold">{n.label}</text>
          </g>
        ))}
        {/* Labels */}
        {[["Client", 40, 300, "var(--state-info)"], ["Server", 310, 300, "var(--accent-alt)"], ["External", 530, 300, "var(--state-critical)"]].map(([l,x,y,c]) => (
          <text key={l} x={x} y={y} fill={c} fontSize="9" className="font-mono font-bold tracking-[0.2em]">{l.toUpperCase()}</text>
        ))}
        <line x1={185} y1={20} x2={185} y2={340} stroke="hsl(var(--border))" strokeWidth="1.5" strokeDasharray="4,4" />
        <line x1={525} y1={20} x2={525} y2={340} stroke="hsl(var(--border))" strokeWidth="1.5" strokeDasharray="4,4" />
      </svg>
    </div>
  );
};

// ER diagram
const ERDiagram = () => {
  const entities = [
    { id: "sessions", x: 220, y: 20, color: "var(--state-info)" },
    { id: "questions", x: 60, y: 130, color: "var(--accent-alt)" },
    { id: "answers", x: 220, y: 200, color: "var(--accent-alt)" },
    { id: "eval_results", x: 380, y: 130, color: "var(--accent-alt)" },
    { id: "events", x: 60, y: 220, color: "var(--state-warning)" },
    { id: "tokens", x: 380, y: 220, color: "var(--state-critical)" },
    { id: "projection", x: 220, y: 300, color: "var(--state-success)" },
  ];
  const edges = [
    ["sessions","questions"],["sessions","answers"],["sessions","eval_results"],
    ["sessions","events"],["sessions","tokens"],["sessions","projection"],
    ["questions","answers"],["questions","eval_results"]
  ];
  const get = id => entities.find(e => e.id === id);
  const cx = n => n.x + 55; const cy = n => n.y + 16;
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <svg viewBox="0 0 530 360" className="w-full max-w-[530px] min-w-[400px]">
        <defs>
          <marker id="arr2" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L7,3 z" fill="hsl(var(--muted-foreground) / 0.5)" />
          </marker>
        </defs>
        {edges.map(([a, b], i) => {
          const na = get(a), nb = get(b);
          return <line key={i} x1={cx(na)} y1={cy(na)} x2={cx(nb)} y2={cy(nb)}
            stroke="hsl(var(--muted-foreground) / 0.4)" strokeWidth="1.5" markerEnd="url(#arr2)" />;
        })}
        {entities.map(n => (
          <g key={n.id}>
            <rect x={n.x} y={n.y} width={110} height={32} rx={4}
              fill={`color-mix(in srgb, ${n.color}, transparent 90%)`} 
              stroke={`color-mix(in srgb, ${n.color}, transparent 50%)`} 
              strokeWidth="1.5" />
            <text x={n.x + 55} y={n.y + 20} textAnchor="middle"
              fill={n.color} fontSize="10" className="font-mono font-bold">{n.id}</text>
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
    <div className="overflow-x-auto custom-scrollbar">
      <svg viewBox="0 0 720 380" className="w-full max-w-[720px] min-w-[560px]">
        <defs>
          <marker id="seqarr" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L7,3 z" fill="hsl(var(--muted-foreground) / 0.5)" />
          </marker>
        </defs>
        {actors.map((a, i) => (
          <g key={a}>
            <rect x={cols[i] - 46} y={8} width={92} height={28} rx={4}
              fill="hsl(var(--surface-subtle))" stroke="hsl(var(--border))" strokeWidth="1.5" />
            <text x={cols[i]} y={27} textAnchor="middle"
              fill="hsl(var(--text-primary))" fontSize="9" className="font-mono">{a}</text>
            <line x1={cols[i]} y1={36} x2={cols[i]} y2={topY + steps.length * rowH + 10}
              stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="3,3" opacity="0.3" />
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
                stroke={isReturn ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))"} 
                strokeWidth={isReturn ? 1.5 : 2}
                strokeDasharray={isReturn ? "4,3" : "0"} markerEnd="url(#seqarr)" />
              <text x={(cols[from] + cols[to]) / 2} y={y - 5}
                textAnchor="middle" fill="hsl(var(--text-primary))" fontSize="8.5" className="font-mono font-bold">{label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// Retry flow
const RetryFlow = () => {
  const steps = [
    { label: "Candidate requests retry", color: "var(--state-info)" },
    { label: "POST /retry + token", color: "var(--accent-alt)" },
    { label: "Server validates token", color: "var(--accent-alt)" },
    { label: "Clear prior eval state", color: "var(--state-critical)" },
    { label: "Increment attempt state", color: "var(--state-warning)" },
    { label: "Client reopens input", color: "var(--state-success)" },
  ];
  return (
    <div className="flex flex-col items-start gap-0">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <div 
              className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-mono text-[10px] transition-all"
              style={{ 
                backgroundColor: `color-mix(in srgb, ${s.color}, transparent 90%)`,
                borderColor: `color-mix(in srgb, ${s.color}, transparent 70%)`,
                color: s.color 
              }}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && <div className="w-0.5 h-6 bg-border opacity-30" />}
          </div>
          <span className="text-text-secondary font-mono text-sm">{s.label}</span>
        </div>
      ))}
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const tabs = ["overview", "stack", "data", "flows", "security"];

  return (
    <div className="min-h-screen bg-background text-text-primary font-mono selection:bg-primary/20">
      {/* Header */}
      <div className="border-b border-border p-8 md:p-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="text-[10px] text-text-muted tracking-[0.2em] uppercase mb-2">TECHNICAL DESIGN HANDOFF</div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-text-primary">
              Interview Coach <span className="text-primary italic">App</span>
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge color="var(--state-success)">Next.js 14</Badge>
            <Badge color="var(--accent-alt)">Supabase</Badge>
            <Badge color="var(--state-warning)">Gemini AI</Badge>
            <Badge color="var(--state-info)">v1.0</Badge>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border/50">
          {tabs.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={cn(
              "px-6 py-2 text-[10px] uppercase tracking-[0.15em] font-mono transition-all border-b-2 -mb-[1px]",
              activeTab === t 
                ? "text-primary border-primary font-bold bg-primary/5" 
                : "text-text-muted border-transparent hover:text-text-primary"
            )}>{t}</button>
          ))}
        </div>
      </div>

      <div className="px-8 py-10 md:px-10 max-w-5xl mx-auto">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="flex flex-col gap-10">
            <Section id="§1" title="System Snapshot" accent="var(--state-success)">
              <Card>
                <p className="m-0 leading-relaxed text-text-secondary text-sm">
                  Full-stack <strong className="text-text-primary font-bold italic">Next.js 14</strong> application supporting recruiter-authenticated workflows and candidate token-based interview practice. AI-driven analysis, response generation, tips, and TTS powered by <strong className="text-state-warning font-bold">Google Gemini</strong>. Persistent state in <strong className="text-accent-alt font-bold">Supabase Postgres</strong>.
                </p>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Recruiter Auth", desc: "Invite creation + review", color: "var(--state-success)" },
                    { label: "Candidate Flow", desc: "Token-based, no login", color: "var(--accent-alt)" },
                    { label: "AI Analysis", desc: "Gemini 2.5 Flash", color: "var(--state-warning)" },
                    { label: "TTS Playback", desc: "Audio prefetch cache", color: "var(--state-info)" },
                  ].map(i => (
                    <div key={i.label} className="bg-surface-base border border-border/50 rounded-lg p-4 shadow-sm">
                      <div className="text-[10px] uppercase tracking-wider mb-1 font-bold" style={{ color: i.color }}>{i.label}</div>
                      <div className="text-text-secondary text-[11px] leading-tight font-display">{i.desc}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </Section>

            <Section id="§5" title="Runtime Architecture" accent="var(--accent-alt)">
              <Card>
                <div className="text-[10px] text-text-muted uppercase tracking-[0.15em] mb-4">CLIENT → SERVER → EXTERNAL</div>
                <ArchDiagram />
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[["Client", "var(--state-info)", "UI + Audio Hooks"], ["Server", "var(--accent-alt)", "API + AI + Repos"], ["External", "var(--state-critical)", "Auth + DB + Gemini"]].map(([l,c,d]) => (
                    <div key={l} className="border-l-2 pl-4" style={{ borderColor: c }}>
                      <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: c }}>{l}</div>
                      <div className="text-text-secondary text-xs font-display">{d}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </Section>

            <Section id="§5.1" title="Layering Contract" accent="var(--state-success)">
              <div className="flex flex-col gap-3">
                {[
                  { layer: "API Routes", rule: "Input validation · Auth/token checks · Delegation only", color: "var(--state-info)" },
                  { layer: "Orchestration", rule: "Owns state transitions", color: "var(--accent-alt)" },
                  { layer: "Repositories", rule: "Database persistence + mapping", color: "var(--state-warning)" },
                  { layer: "AI Services", rule: "Prompts · Model calls · Response parsing", color: "var(--state-critical)" },
                  { layer: "Client", rule: "Interaction state + progressive UX", color: "var(--state-success)" },
                ].map(l => (
                  <div key={l.layer} className="flex flex-col md:flex-row md:items-center gap-3 bg-surface-subtle border border-border/30 rounded-lg p-4 hover:border-border transition-colors">
                    <Badge color={l.color}>{l.layer}</Badge>
                    <span className="text-text-secondary text-[13px] font-display">{l.rule}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* STACK TAB */}
        {activeTab === "stack" && (
          <div className="flex flex-col gap-10">
            <Section id="§2" title="Technology Stack" accent="var(--state-info)">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <StackItem label="Framework" items={["Next.js 14", "React 18", "TypeScript"]} color="var(--state-info)" />
                  <StackItem label="UI & Styling" items={["Tailwind CSS", "Radix UI", "Framer Motion"]} color="var(--accent-alt)" />
                </Card>
                <Card>
                  <StackItem label="Data & Persistence" items={["Supabase Postgres", "Supabase Auth"]} color="var(--state-warning)" />
                  <StackItem label="Testing" items={["Vitest", "Testing Library", "ESLint"]} color="var(--state-success)" />
                </Card>
              </div>
            </Section>

            <Section id="§2.4" title="AI Model Allocation" accent="var(--state-warning)">
              <Card>
                <div className="flex flex-col gap-1">
                  {[
                    { use: "Answer Analysis", model: "gemini-2.5-flash", status: "live" },
                    { use: "Strong Response Gen", model: "gemini-2.5-flash", status: "live" },
                    { use: "Tips Generation", model: "gemini-2.5-flash", status: "live" },
                    { use: "Text-to-Speech", model: "gemini-2.5-flash-preview-tts", status: "live" },
                    { use: "Question Generation", model: "gemini-2.5-flash", status: "mocked" },
                  ].map(r => (
                    <div key={r.use} className="flex justify-between items-center py-4 border-b border-border/30 last:border-0 hover:bg-primary/[0.02] px-2 rounded-lg transition-colors">
                      <span className="text-text-secondary text-sm font-display">{r.use}</span>
                      <div className="flex gap-2 items-center">
                        <Badge color="var(--state-warning)">{r.model}</Badge>
                        <Badge color={r.status === "live" ? "var(--state-success)" : "var(--state-critical)"}>{r.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </Section>

            <Section id="§4" title="Environment Variables" accent="var(--state-critical)">
              <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    <div key={e.key} className="bg-surface-base border border-border/50 rounded-lg p-3 flex justify-between items-center group hover:border-border transition-colors">
                      <code className="text-[11px] text-text-secondary group-hover:text-text-primary transition-colors">{e.key.replace("NEXT_PUBLIC_", "").replace("_", "_\u200B")}</code>
                      <Badge color={e.scope === "secret" ? "var(--state-critical)" : e.scope === "public" ? "var(--state-success)" : "var(--accent-alt)"}>{e.scope}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </Section>
          </div>
        )}

        {/* DATA TAB */}
        {activeTab === "data" && (
          <div className="flex flex-col gap-10">
            <Section id="§6" title="Data Model" accent="var(--accent-alt)">
              <Card>
                <div className="text-[10px] text-text-muted uppercase tracking-[0.15em] mb-6">ENTITY RELATIONSHIPS</div>
                <ERDiagram />
              </Card>
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { name: "sessions", desc: "Lifecycle root aggregate. Metadata + status + progress.", color: "var(--state-success)" },
                  { name: "questions", desc: "Ordered per session.", color: "var(--accent-alt)" },
                  { name: "answers", desc: "Keyed by (question_id, attempt_number).", color: "var(--accent-alt)" },
                  { name: "eval_results", desc: "AI evaluation payload + metadata.", color: "var(--accent-alt)" },
                  { name: "events", desc: "Append-only. Never mutable state.", color: "var(--state-warning)" },
                  { name: "candidate_tokens", desc: "Hashed token-to-session mapping.", color: "var(--state-critical)" },
                  { name: "projection_session_now", desc: "Materialized current session view.", color: "var(--state-success)" },
                ].map(e => (
                  <div key={e.name} className="bg-surface-subtle border border-border/30 rounded-lg p-5 hover:border-border transition-colors">
                    <Badge color={e.color}>{e.name}</Badge>
                    <p className="text-text-secondary text-[12px] mt-4 leading-relaxed font-display">{e.desc}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="§7" title="API Surface" accent="var(--state-success)">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-state-success/20">
                  <div className="text-[10px] text-state-success uppercase tracking-[0.15em] mb-4">CANDIDATE-FACING</div>
                  <div className="flex flex-col gap-1">
                    {["POST /api/session/start","GET|PATCH /api/session/[id]","PUT /api/.../answer","POST /api/.../submit","POST /api/.../retry","POST /api/.../analysis","POST /api/tts","POST /api/response/generate","POST /api/tips/generate"].map(e => (
                      <div key={e} className="py-2 border-b border-border/30 last:border-0 text-text-secondary text-[11px] font-mono hover:text-state-success transition-colors">{e}</div>
                    ))}
                  </div>
                </Card>
                <Card className="border-accent-alt/20">
                  <div className="text-[10px] text-accent-alt uppercase tracking-[0.15em] mb-4">RECRUITER / DEV</div>
                  <div className="flex flex-col gap-1">
                    {["POST /api/recruiter/invites","GET /api/dev/export-session/[id]","POST /api/dev/generate-questions","POST /api/analysis"].map(e => (
                      <div key={e} className="py-2 border-b border-border/30 last:border-0 text-text-secondary text-[11px] font-mono hover:text-accent-alt transition-colors">{e}</div>
                    ))}
                  </div>
                  <div className="mt-8 pt-6 border-t border-border/30">
                    <div className="text-[10px] text-text-muted uppercase tracking-[0.12em] mb-3">SECURITY MODEL</div>
                    <div className="text-text-secondary text-[12px] leading-6 font-display">
                      Recruiter \u2192 <span className="text-primary font-bold">Supabase Auth</span> session<br />
                      Candidate \u2192 <span className="text-accent-alt font-bold italic">x-candidate-token</span> header<br />
                      Service role \u2192 server-side only
                    </div>
                  </div>
                </Card>
              </div>
            </Section>
          </div>
        )}

        {/* FLOWS TAB */}
        {activeTab === "flows" && (
          <div className="flex flex-col gap-10">
            <Section id="\u00A78.2" title="Candidate Submit \u2192 Evaluation Flow" accent="var(--state-success)">
              <Card>
                <div className="text-[10px] text-text-muted uppercase tracking-[0.15em] mb-6">SEQUENCE DIAGRAM</div>
                <SequenceDiagram />
              </Card>
            </Section>

            <Section id="\u00A78.3" title="Retry Flow" accent="var(--state-warning)">
              <Card>
                <RetryFlow />
              </Card>
            </Section>

            <Section id="\u00A78.1" title="Recruiter Creates Invite" accent="var(--accent-alt)">
              <Card>
                <div className="flex flex-wrap items-center gap-4">
                  {[
                    { step: "Recruiter UI", detail: "role + candidates\n+ questions", color: "var(--state-info)" },
                    { step: "\u2192" },
                    { step: "POST /invites", detail: "API Route", color: "var(--accent-alt)" },
                    { step: "\u2192" },
                    { step: "Supabase Auth", detail: "getUser()", color: "var(--state-critical)" },
                    { step: "\u2192" },
                    { step: "Postgres DB", detail: "create sessions\n+ tokens", color: "var(--state-warning)" },
                    { step: "\u2192" },
                    { step: "Invite Links", detail: "/s/{token}", color: "var(--state-success)" },
                  ].map((s, i) => s.step === "\u2192" ? (
                    <span key={i} className="text-border text-lg font-bold opacity-60">\u2192</span>
                  ) : (
                    <div key={i} className="bg-surface-subtle border border-border/30 rounded-lg p-4 text-center min-w-[120px] hover:border-border transition-colors">
                      <div className="text-[10px] uppercase font-bold tracking-wider mb-2" style={{ color: s.color }}>{s.step}</div>
                      {s.detail && <div className="text-text-primary text-[10px] leading-tight font-display whitespace-pre-line font-bold">{s.detail}</div>}
                    </div>
                  ))}
                </div>
              </Card>
            </Section>
          </div>
        )}

        {/* SECURITY TAB */}
        {activeTab === "security" && (
          <div className="flex flex-col gap-10">
            <Section id="\u00A710" title="Security & Privacy Design" accent="var(--state-critical)">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { title: "Candidate Access", items: ["Token-gated (hashed server-side)", "x-candidate-token header validation", "No raw token in client storage"], color: "var(--state-info)" },
                  { title: "Recruiter Access", items: ["Supabase Auth session", "Middleware cookie refresh", "RLS on all recruiter data paths"], color: "var(--accent-alt)" },
                  { title: "Secret Management", items: ["Service role key \u2192 server-only", "Gemini key \u2192 server-only", "Encryption secret \u2192 server-only"], color: "var(--state-critical)" },
                  { title: "Privacy Guarantees", items: ["No keystroke logging", "No background surveillance", "No interpretive labels stored"], color: "var(--state-success)" },
                ].map(g => (
                  <Card key={g.title} className="hover:border-border/50 border-l-4" style={{ borderLeftColor: g.color }}>
                    <div className="text-[10px] uppercase tracking-[0.15em] mb-4 font-bold" style={{ color: g.color }}>{g.title.toUpperCase()}</div>
                    <div className="flex flex-col gap-3">
                      {g.items.map(i => (
                        <div key={i} className="flex gap-3 items-start">
                          <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: g.color }} />
                          <span className="text-text-primary text-sm font-display leading-tight font-medium">{i}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </Section>

            <Section id="\u00A711" title="Hardening Opportunities" accent="var(--state-warning)">
              <div className="flex flex-col gap-4">
                {[
                  { n: 1, item: "Replace mock QuestionService with Gemini-backed generation + schema validation", priority: "high" },
                  { n: 2, item: "Idempotency protection on submit/retry routes (request-level keys)", priority: "high" },
                  { n: 3, item: "Explicit API versioning strategy (/api/v1/...) before external expansion", priority: "medium" },
                  { n: 4, item: "Observability spans around AI latency, parse failures, DB write timing", priority: "medium" },
                ].map(r => (
                  <div key={r.n} className="flex gap-6 items-start bg-surface-base border border-border/30 rounded-xl p-5 hover:border-border transition-colors group">
                    <div className="font-mono text-xs opacity-50 group-hover:opacity-100 transition-opacity mt-1">0{r.n}</div>
                    <span className="text-text-primary text-base font-display flex-1 leading-relaxed font-medium">{r.item}</span>
                    <Badge color={r.priority === "high" ? "var(--state-critical)" : "var(--state-warning)"}>{r.priority}</Badge>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="\u00A712" title="Deployment Runbook" accent="var(--state-success)">
              <Card>
                <div className="flex flex-col gap-4">
                  {[
                    "Stand up Supabase + configure env vars",
                    "Apply migrations \u2014 verify base schema",
                    "npm run dev \u2014 smoke tests: npm test",
                    "Verify recruiter auth + invite generation",
                    "Verify candidate token \u2192 answer \u2192 analysis \u2192 retry",
                    "Validate recruiter dashboard session visibility",
                    "Establish dashboards: API errors \u00B7 AI failures \u00B7 DB latency",
                  ].map((s, i) => (
                    <div key={i} className="flex gap-4 items-center group">
                      <div className="w-7 h-7 rounded-sm border border-state-success/60 flex items-center justify-center text-state-success font-mono text-[10px] transition-all group-hover:bg-state-success group-hover:text-white shrink-0 shadow-sm">{i + 1}</div>
                      <span className="text-text-primary text-sm font-display font-medium">{s}</span>
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