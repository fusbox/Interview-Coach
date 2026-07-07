// Active practice question workspace — voice/text answer, coach lens, feedback.
function PracticeSession({ onExit }) {
  const NS = window.RangamJobSeekerDesignSystem_7ff43f;
  const { Icon, Button, SessionPromptShell, FeedbackPanel, StatusBadge, ActionButton, Progress } = NS;
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
    if (isLast) { onExit(); return; }
    setIdx((i) => i + 1);
    setMode("voice"); setRecording(false); setAnswer(""); setHintOpen(false); setPhase("answering");
  };

  return (
    <div style={{ minHeight: "100%", background: "rgb(248 250 252)", padding: "32px 24px", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 720, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={onExit} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", color: "rgb(86 106 131)", fontSize: 13, fontWeight: 600, fontFamily: "var(--font-sans)" }}>
            <Icon name="x" size={16} /> Exit session
          </button>
          <span style={{ fontSize: 12, fontWeight: 700, color: "rgb(86 106 131)" }}>Question {idx + 1} of {D.questions.length}</span>
        </div>
        <Progress value={((idx + (phase === "feedback" ? 1 : 0)) / D.questions.length) * 100} />

        <SessionPromptShell>
          <p style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.16em", color: "rgb(12 97 233)", margin: 0 }}>{q.cat}</p>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, lineHeight: 1.15, color: "rgb(15 33 57)", margin: "10px 0 0" }}>{q.text}</h2>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <Button variant="outline" size="sm" onClick={() => setHintOpen((v) => !v)}><Icon name="sparkles" size={15} /> Coach lens</Button>
            <Button variant="ghost" size="sm"><Icon name="message-square" size={15} /> Read aloud</Button>
          </div>
          {hintOpen ? (
            <div style={{ marginTop: 14, borderRadius: 16, border: "1px solid #e9d5ff", background: "#faf5ff", padding: "14px 16px" }}>
              <p style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9333ea", margin: "0 0 6px" }}>Hint</p>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgb(15 33 57)", margin: 0 }}>Structure it: the situation, the specific action you took, and the measurable outcome. Lead with the result.</p>
            </div>
          ) : null}
        </SessionPromptShell>

        {phase === "answering" ? (
          <div style={{ borderRadius: 28, border: "1px solid rgb(211 221 232 / 0.7)", background: "#fff", padding: 24, boxShadow: "var(--candidate-shadow-card)" }}>
            <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 9999, background: "rgb(248 250 252)", border: "1px solid rgb(211 221 232)", marginBottom: 20 }}>
              {[["voice", "mic", "Voice"], ["text", "keyboard", "Type"]].map(([m, ic, lbl]) => (
                <button key={m} onClick={() => setMode(m)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 9999, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "var(--font-sans)", background: mode === m ? "#fff" : "transparent", color: mode === m ? "rgb(12 97 233)" : "rgb(86 106 131)", boxShadow: mode === m ? "var(--shadow-raised-1)" : "none" }}>
                  <Icon name={ic} size={16} /> {lbl}
                </button>
              ))}
            </div>
            {mode === "voice" ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "16px 0" }}>
                <button onClick={() => setRecording((v) => !v)} style={{ width: 88, height: 88, borderRadius: 9999, border: "none", cursor: "pointer", background: recording ? "hsl(0 84% 60%)" : "rgb(12 97 233)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--candidate-shadow-cta)", transition: "all 200ms" }}>
                  <Icon name="mic" size={34} />
                </button>
                <p style={{ fontSize: 14, color: "rgb(86 106 131)", margin: 0 }}>{recording ? "Recording… tap to stop" : "Tap to record your answer"}</p>
                {recording ? (
                  <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 28 }}>
                    {[10, 20, 14, 26, 16, 22, 12, 24, 15].map((h, i) => (<span key={i} style={{ width: 4, height: h, background: "rgb(12 97 233)", borderRadius: 2, opacity: 0.7 }} />))}
                  </div>
                ) : null}
              </div>
            ) : (
              <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer…" style={{ width: "100%", minHeight: 140, borderRadius: 16, border: "1px solid rgb(211 221 232)", background: "rgb(248 250 252)", padding: 16, fontSize: 14, lineHeight: 1.7, fontFamily: "var(--font-sans)", color: "rgb(15 33 57)", boxSizing: "border-box", resize: "vertical" }} />
            )}
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <ActionButton onClick={submit} disabled={mode === "voice" ? !recording : !answer.trim()}>Submit answer <Icon name="arrow-right" size={16} /></ActionButton>
            </div>
          </div>
        ) : null}

        {phase === "analyzing" ? (
          <div style={{ borderRadius: 28, border: "1px solid rgb(211 221 232 / 0.7)", background: "#fff", padding: 40, textAlign: "center", boxShadow: "var(--candidate-shadow-card)" }}>
            <div style={{ display: "inline-flex", animation: "rjs-spin 1s linear infinite", color: "rgb(12 97 233)" }}><Icon name="loader" size={32} /></div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "rgb(15 33 57)", margin: "14px 0 0" }}>The coach is reviewing your answer…</p>
            <style>{"@keyframes rjs-spin{to{transform:rotate(360deg)}}"}</style>
          </div>
        ) : null}

        {phase === "feedback" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <StatusBadge variant="success">Answer reviewed</StatusBadge>
            <FeedbackPanel title="Strong structure and a clear result" assessment="outstanding" body="You led with the outcome and grounded it in a specific situation. The action you took was concrete and easy to follow." />
            <FeedbackPanel title="Add one measurable detail" assessment="growth" body="Great example — next time, quantify the impact (a %, a timeline, a number) so the result lands even harder." />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <Button variant="outline"><Icon name="refresh-cw" size={16} /> Retry</Button>
              <ActionButton onClick={next}>{isLast ? "Finish session" : "Next question"} <Icon name="arrow-right" size={16} /></ActionButton>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
window.PracticeSession = PracticeSession;
