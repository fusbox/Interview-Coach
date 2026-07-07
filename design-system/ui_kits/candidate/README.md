# Candidate UI kit — Interview Coach (job seeker)

Interactive recreation of the job-seeker flow, composed from the design-system components.

## Screens & flow
`index.html` runs the full click-through:

1. **Dashboard** (`Dashboard.jsx`) — the landing surface. Sticky glass header, target-interview switcher, blue Coach Update panel, Preparedness Map (answer skills × question categories), "What I noticed" coach plan, recent activity, and a sticky **Practice next** rail. Recreates `CandidateDashboardPage.tsx`.
2. **Session entry** (`SessionEntry.jsx`) — glass backdrop, practice-plan summary, No-time-limit + Private-feedback reassurance cards, primary CTA. Recreates `CandidateSessionEntryScreen.tsx`.
3. **Practice session** (`PracticeSession.jsx`) — glass prompt shell with the live question, Coach lens hint, voice/text answer toggle, record button + waveform, an analyzing state, then coach FeedbackPanels. Advances through the question set. Recreates `CandidateActiveQuestionWorkspace.tsx`.

`data.js` holds the mock role, plan, question set, skills, categories, and recent activity.

## Notes
- Composes DS components: `SurfaceCard`, `SessionPromptShell`, `FeedbackPanel`, `StatusBadge`, `MetricCard`, `InsightCard`, `Progress`, `ActionButton`, `Button`, `IconBadge`, `Icon`.
- Screens are registered on `window` (each Babel script has its own scope); `index.html` mounts once all three are present.
- Cosmetic recreation — real transcription, TTS, and AI feedback are faked.
