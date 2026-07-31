# Production UI Workstream

Status: Active operating contract; first candidate integration milestone completed
Last updated: 2026-07-31

## Purpose

Production UI work may proceed in parallel with core V2 completion, but it must not create a second implementation of domain behavior or make the integration branch absorb unfinished visual experiments. This contract defines branch, worktree, ownership, and verification rules for moving accepted UI concepts into tracked product routes.

## Branch And Worktree Model

| Lane | Branch | Worktree | Owns |
| --- | --- | --- | --- |
| Core/integration | `feature/candidate-v2-rebuild` | `C:\tmp\Interview-Coach-Recruiter-postgres` | Domain contracts, persistence, providers, routes/API behavior, migrations, security, operations, canonical docs, and final integration |
| Production UI | `feature/candidate-v2-production-ui` | `C:\tmp\Interview-Coach-Recruiter-production-ui` | Accepted tracked surface composition, design-system evolution, presentation tests, responsive/accessibility validation, and UI-specific documentation |
| Exploratory UI | no tracked branch | `.untracked/ui-lab` | Disposable live mockups and visual experiments with no production imports |

Do not run two coding agents against the same dirty worktree. Start the UI branch from an accepted core milestone, keep commits small enough to review by surface, and merge or cherry-pick accepted UI commits back through the core/integration branch.

For the current dashboard migration, concurrent production-UI work is inactive and the repository owner has explicitly transferred the bounded implementation lane to `feature/candidate-v2-rebuild` in `C:\tmp\Interview-Coach-Recruiter-postgres`. The shared-file lock and small-slice verification rules still apply. Do not resume parallel edits in the dedicated UI worktree until this transfer is closed or explicitly reassigned.

## Ownership Boundary

### Design Source

The global runtime foundation is governed by [Design System Foundation](./design-system-foundation.md). Production UI consumes one unprefixed token namespace and one RGB runtime color format across every audience. The maturation package's `Design System Reference.dc.html` is the highest visual-intent source; its gap log is not canonical. `legacy-compat.css` exists only to keep provisional surfaces stable while they are replaced and is owned by the integration lane unless explicitly handed to the UI lane.

The latest local Claude Design snapshot currently supplies mature-but-not-final mobile references for candidate setup, the dashboard initial view, the session landing screen, and the active question screen. These are accepted production-direction inputs, not pixel-locked specifications. Other screens and experiments in the package remain exploratory until reviewed.

The package is reconciled rather than copied wholesale. Its current reference screens use only tokens already present in the installed runtime. Any future token delta must be adapted to the global unprefixed RGB contract before it becomes active.

#### Candidate setup source contract

For `/candidate/setup`, `Candidate Setup Mobile A.dc.html` is production-ready visual authority after removing preview-only phone/OS chrome and authoring runtime. There is no separate desktop reference. Desktop and tablet are deliberate responsive derivations of the mobile hierarchy using the same DOM, controls, states, copy, and design-system roles.

- Preserve the current V2 setup state machine, draft recovery, trusted-host read-only context, resume processing/review/privacy boundary, duplicate-context choice, validation focus, idempotent start, and route transition.
- Reproduce the mobile brand row, coach spotlight, Role/Resume/Interview details panels, compact round summary, in-flow start action, and two-destination Dashboard/New role navigation.
- Use the 56rem form-flow frame for the desktop header, spotlight, and form. The 70rem workflow frame remains available for builders with a compact context rail, while the 76rem default remains reserved for broad dashboard and operations workspaces.
- Treat Paste text, Upload resume, and Take photo as one mutually exclusive mode selector. Only the active mode receives the selected surface; hover and keyboard focus must remain distinguishable from selection. Restore the last explicit mode with an unsubmitted draft without retaining raw source bytes.
- Keep the photo workspace unframed inside the Resume panel. Its capture, existing-photo, review, and fallback controls provide the hierarchy; it must not inherit a decorative wash, oversized radius, or accent stripe.
- Close the setup flow with one spotlight labeled `Your practice round`. Its glass summary presents Resume, Stage, Recommended, and Selected in that order, using the same accepted-artifact label/fallback contract as the pre-session landing. On wider screens, a compressed summary occupies the left column and the Start practice action occupies the right; on mobile they stack in that reading order. Start practice remains in normal flow and is not a second mobile footer competing with the navigation dock.
- Keep setup as one continuous semantic form on mobile and desktop. A full-height vertical timeline occupies the left rail, marks Role, Resume, and Interview details with numbered nodes, updates its active node when a section reaches the reading position, and distinguishes completed from merely visited work.
- Guide progression with explicit actions and preserve the complete scroll chain: valid Role/JD to Resume; accepted resume or explicit continue-without-resume to Interview details; stage to count; count to Start practice. Do not advance on processing, review-required, or failure states, steal keyboard focus, or animate when reduced motion is requested. Manual scrolling remains available and downstream content is not conditionally removed.
- Keep resume submission action-first. Before processing, show the enabled action without coach-voiced explanatory copy. During processing, the status rail explains contact-detail removal and preparation; after processing, it tells the candidate to review and edit the prepared text before acceptance. Editing previously accepted text returns the same rail to review with `Use this resume`, removes resume inclusion from the round summary, and keeps Start practice unavailable until the replacement version is accepted. Errors remain explicit and recoverable.
- Present Role, Resume, and Interview details as blue eyebrow labels. All three section panels use `--surface-alt` with `--elevation-card`, while their text-entry and inactive-selection surfaces use `--surface-base`. Coach interpretation uses the reusable **coach-voice surface**: `--surface-base`, a 2px primary-blue edge, the surface compass mark, 24px `--radius-card`, and restrained `--shadow-raised-1` elevation. Resume processing/review status and the stage-specific count recommendation share this composition. Selected input-mode, stage, and count controls use opaque `--primary-wash`, a softened primary-blue border and blue content color, and the shared tight inset/outer contour; input-mode and stage controls use 16px `--radius-widget`, while the shorter count controls keep their compact role. Stage choices present names only in one five-choice desktop row and reflow to usable targets on narrow screens. Inactive mode, stage, and count controls change border color only on hover, with no hover fill. Primary actions on neutral surfaces use the shared short neutral-first, faint-blue drop shadow through `--elevation-cta`. The closing spotlight's Start practice action uses the reusable opaque-white, brand-blue `.on-color-action` treatment; its four-fact summary uses `.on-color-glass`.
- On mobile, show the candidate navigation dock on arrival and near the top, hide it during deliberate downward reading, and reveal it on upward movement or keyboard focus. Wider header navigation remains stable.
- Use only 3, 5, 7, and 10 as promoted count choices. The planner may accept intermediate counts, but they do not express a distinct setup strategy and eight mobile pills would weaken target sizing and choice clarity.
- Install and use the authored calm, surface, and CTA light/dark compass SVG variants as the app's coach identity. Calm belongs on the spotlight; surface uses the theme's primary-blue needle half on light coach-voice surfaces; CTA remains its own authored treatment. Do not replace them with a general icon.

#### Candidate pre-session source contract

For the initial candidate-led, follow-up candidate-led, and invited pre-session landing, `Candidate Pre-Session Mobile A.dc.html` is the visual authority after removing preview-only phone/OS chrome and authoring runtime. Its composition, spacing rhythm, density, alignment, sizing relationships, and hierarchy are implementation requirements rather than loose inspiration. The implementation may depart only where the real product requires a distinct audience disclosure, recovery action, failure state, responsive derivation, or a separately ratified correction.

- Preserve the shared landing lifecycle, first-question audio prefetch, route-owned start actions, entering-practice transition, unavailable-question failure, and candidate-led/invited ownership boundaries.
- Use one shared semantic composition for initial, follow-up, and invited landings. Adapt copy and facts for the audience without creating visually divergent page families.
- Keep the role and round status inside one spotlight. The compact on-color fact rail presents Stage, Questions, and Resume for candidate-led practice; invited practice omits resume because recruiter-provided visibility follows the invited contract. Estimated minutes remain retired.
- Present the exact immutable questions staged for the round as the `Question plan`; question inclusion on this landing is a ratified product contract. Long wording starts in a measured three-line collapsed state and receives an accessible `Show more` / `Show less` control only when the rendered text actually overflows. The complete wording remains available without navigation and must remain readable at 320px, 200% zoom, and with unusually long roles or categories.
- Keep reassurance visually quiet and adjacent to the actions. Candidate-led practice states that progress saves and practice is not used for hiring decisions; invited practice retains its invitation recovery and recruiter-visibility disclosure.
- Mobile follows the reference's single reading column. Desktop preserves the same reading order and relative importance but is not bound to a fixed column recipe. The round summary remains the visual anchor, the question plan remains the primary reading path, and reassurance and actions remain supporting content. Their placement is decided by the composition at each breakpoint. DOM and keyboard order remain mobile-first.
- On desktop, allow the round-status body copy to use the spotlight's available text measure rather than imposing a narrower prose cap. Present Return to Coach Plan before Start practice in a right-aligned inline action cluster. Let each action size intrinsically from the shared control height and horizontal padding rather than equalizing or stretching widths, and wrap whole controls only when the available width requires it. Mobile keeps its primary-first actions stacked and full-width.
- Use the installed `surface-spotlight`, `on-color-glass`, focused application frame, typography roles, spacing tokens, semantic radii, and shared action treatments. Do not add local raw color values or new global tokens for this slice. Record any mockup/DS disparity and whether the system or the mockup governs.
- Retain the shared candidate brand header even though the local mobile artifact shows only the TalentArbor mark. The tracked header is the app-wide navigation/identity primitive and removing it on one landing would create shell drift.
- Exclude the preview bezel, status bar, home indicator, dark-mode preview control, `<x-dc>`/`sc-*` runtime, and mock-only state handlers.
- Verify the full resume state family, missing/invalid fields, preparing/failure states, duplicate-context dialog, narrow-mobile reflow, desktop derivation, keyboard order, focus visibility, zoom, overflow, and reduced motion.

#### Candidate live-session source contract

For candidate-led and invited live practice, `Candidate Session Mobile A.dc.html` is the visual authority after removing preview-only device chrome and replacing mock handlers with the accepted session runtime. Candidate-led and invited routes must remain thin audience adapters over one shared semantic shell.

- Preserve the compact context header, segmented progress, soft-blue cutout question anchor, question assistance notch, lower cutout response composer, question audio, safe audience-specific exit, typed/voice lifecycle, immutable answer acceptance, coaching states, retry, continuation, completion, autosave, and exact recovery.
- Blue remains the structural session color. Green is limited to hints and other supportive coach guidance. Purple uses the existing `accent-alt` family only for the response-framework disclosure and its trigger; it is a narrow session semantic, not a second app brand or a general V2 surface color.
- Hints and Strong response are separate durable candidate-session artifacts rather than question wording. Hints begin generating automatically when the current question loads; Strong response generates only after explicit candidate request. Both expose truthful loading, unavailable, and retry states, replay accepted output across recovery and tabs, never become candidate answer evidence, and never enter recruiter transcript visibility. Their server-owned generation context may include only the immutable session question/setup facts and accepted resume snapshot.
- The closed assistance controls retain semantic surfaces rather than inheriting neutral black icon treatment: Hints uses supportive green and Strong response uses the narrow session-purple family. Their open states use the corresponding contrast-checked solid fill and `solid-foreground` icon color, including the duplicated toggles inside the drawer. Opening either control creates one body-level elevated drawer anchored to the exact question-surface bounds, with a fixed transparent interaction shield above the rest of the session. The drawer is not a centered dialog. It repeats both controls as persistent toggles, switches between them with a direction-aware horizontal slide, and closes when the active toggle is chosen again. Open and close use a short vertical crossfade; trapped focus, Escape, clickaway dismissal, scroll blocking, and reduced-motion behavior follow the shared accessibility contract.
- Keep the mockup's cutout geometry and placement relationships, but derive dimensions, colors, radii, elevation, motion, and accessible states from the design system. Each cutout is a three-layer primitive: a full rounded recess surface below the shaped layer, a quiet directional inset contour on that recess, and the shaped SVG edge with a tighter raised shadow. The question contour catches its upper/end edge; the composer reverses that light direction at its lower/start edge. Thirty-six-pixel visible notch controls retain at least a 44px effective target and sit vertically centered inside the 44px cutout depth. The composed edge, notch controls, category label, question text, audio action, and composer must remain stable for long roles, long questions, zoom/reflow, RTL geometry, and state transitions.
- The text and voice composer modes share one 14.25rem resting surface height, matching the question-stage rhythm, so switching modes does not move the surrounding session. The session column uses flex geometry to place the composer at the safe bottom of the live-practice viewport while the composer retains its normal-flow footprint; question content scrolls above it and is never covered by it. The text field flexes within that footprint; exceptional status, review, submitted-answer, zoom, or reflow content may grow the surface rather than clip. Routine dirty, saving, and successful autosave states stay visually silent; failures, answer acceptance, and coaching remain visible. Typed drafts and voice transcript drafts remain mode-owned inputs, and the accepted-answer presentation never borrows content from the inactive mode. The voice composer must be designed as part of the shared cutout surface rather than appearing as a legacy form inserted into it. It must clearly compose idle, permission, recording, captured, playback, retry/discard, quick submit, transcription, review/edit, failure, and recovery states while preserving the accepted lowest-friction answer contract. Recording time counts upward without a target, countdown, or automatic three-minute stop.
- Visible circular controls may be smaller than 44px only when their effective interactive target is at least 44px and adjacent targets remain separated. Keyboard focus, status announcements, Escape/close behavior, reduced motion, forced colors, and high contrast must remain complete.
- Mobile is the reference composition. Wider layouts preserve one focused task column with intentional breathing room rather than turning the question and response into competing dashboard panels. Validate at 320px, representative mobile, tablet/zoom reflow, and desktop before acceptance.

#### Post-answer coaching source contract

The v0.5 submit-to-feedback sequence is the interaction reference for V2, while
the V2 evidence-first evaluator and staged feedback projection remain the
content authority.

- After the candidate explicitly submits a typed answer, quick-submits a voice
  transcript, or submits an edited voice-review transcript, cover the live
  workspace with one shared coaching-progress overlay while answer acceptance
  and the first evaluator request are genuinely in progress. Do not show it
  while the candidate is merely reviewing a transcript. A voice quick-submit
  enters this shared overlay before transcription begins; the voice composer
  must not render a second `Preparing your transcript` or `Saving your answer`
  loader beneath it. Transcript preparation remains visible only when the
  candidate explicitly chooses Review.
- The progress sequence is candidate-facing orientation, not a provider
  pipeline trace. Typed answers use `Taking a look...`, `Reviewing answer
  content...`, and `Creating feedback...` with the v0.5 3,000ms step cadence.
  Every submitted voice transcript uses the four-step v0.5 variant with a
  2,500ms cadence by inserting `Noting your speaking delivery...`. That extra
  step is modality-based orientation only: it does not depend on marker
  detection, analyze tone or raw audio, or claim that a delivery issue exists.
  Complete/current/upcoming states, a bounded progress indicator, and short
  state motion may imply work in progress but must not claim that an internal
  provider stage completed.
- The overlay follows the real mutation boundary. Answer-save failure returns
  to the editable mode-owned draft. Accepted-answer analysis failure, timeout,
  or terminal unavailability exits to the existing saved-answer recovery
  actions. Recovered or newly opened coaching-ready work reveals feedback
  directly and never replays the loader.
- Coaching-ready feedback is a body-level immersive modal work surface over the
  session, not another card in the answer composer. It uses the dedicated
  `--radius-feedback-modal` semantic alias at 32px and a stable tall viewport so
  short feedback does not collapse into a shallow banner. Its visible header
  contains only the correctly layered coach identity and stage progress:
  scaffold labels and headings such as `Coach read`, `First, here is what I
  heard.`, and `What is working` do not compete with the coaching. A hidden
  dialog title and hidden current-step description preserve accessible
  orientation. Acknowledgement, content coaching, optional delivery coaching,
  and next-step body copy share the promoted feedback reading size. It
  preserves acknowledgement-first staging, persisted
  explore/skip/retry/continue/finish actions, immutable answer-attempt identity,
  focus movement, and the V2 candidate-safe coaching contents. Candidate-led
  and invited routes use the same component.
- Use the current coach identity, surface/elevation/radius/action roles, and a
  restrained 150-250ms state transition. The surface traps focus while open,
  prevents background interaction and scroll, and retains readable overflow at
  320px, 200% zoom, and reduced motion.
- The official light/dark coach artwork occupies one shared image layer. The
  inactive theme asset must not participate in layout or create a clipped
  second needle.
- One practice launch has one transition owner. Same-route initial and invited
  launches may let the mounted session release the transition over the first
  question. A follow-up form POST leaves transition presentation to the
  destination session route across both its loading fallback and mounted
  session; its source landing does not show a competing overlay or expose a
  session skeleton during entry.
- When voice is available and the session has no saved answer-mode preference,
  Record is the initial mode. An explicit saved Type or Record choice still
  wins on recovery. During recording, the visualizer is driven by an analyser
  attached to the live microphone stream. It is presentation-only, tolerates
  browsers without Web Audio by remaining quiet, and creates no additional
  recording, provider input, or persisted artifact.
- Acknowledgement tone is provider-authored but evidence-bounded. It is one
  natural conversational sentence, addresses the candidate directly, names a
  grounded detail or answer pattern when available, and matches the code-owned
  move-on, polish, or remediate posture. It avoids generic praise, repeated
  stock openings, evaluator vocabulary, and invented strengths. Later feedback
  stages and their evidence meaning are unchanged by this UI milestone.

#### Recruiter invitation-create source contract

For `/recruiter/create`, preserve the accepted invitation workflow and reinterpret
the v0.5 three-step progress component through the current design system. This
is a focused operational flow, not a page that needs a separate title, product
explanation, or marketing introduction.

- The progress stepper is the only page-level orientation above the active form. It persists across Questions, Candidates, Review, and the invitation-ready result, and exposes current, completed, and upcoming state semantically as well as visually.
- The complete desktop reading column, including the stepper and every phase surface, uses a maximum width of `56rem`. Mobile keeps one reading column without horizontal overflow.
- Every phase uses `--surface-alt`, `--elevation-card`, and 24px `--radius-card`. Interview-stage choices use `--surface-base` and 16px `--radius-widget`; their selected state shares the candidate setup `--primary-wash`, primary-border, blue-content, and refined contour treatment. All text-entry areas, including generated read-only question fields, use `--surface-base` and the 12px radius tier; read-only state is communicated without introducing a separate fill variant.
- The Questions phase begins directly with its section heading. The retired `Recruiter invitations`, `Create a practice invitation`, explanatory introduction, and `Interview context` eyebrow must not compete with the stepper or the form.
- Preserve fixed stage-driven question counts, generation/manual acceptance, locked accepted questions, Start over, candidate entry, review, creation, delivery, copy fallbacks, and all failure/retry states. This presentation pass does not change the invitation domain contract.
- Validate each progress state, keyboard and screen-reader orientation, long role/question/candidate content, mobile reflow, focus visibility, loading, errors, and the invitation-ready result.

#### Candidate account-entry source contract

For `/candidate/login` and `/candidate/register`, preserve the complete app-owned
candidate account lifecycle while bringing the public entry surfaces into the
same form language as candidate setup and recruiter invitation creation. This
is a presentation contract only: registration fields, validation, consent,
verification, recovery, bounded return targets, loading, errors, and account
security behavior do not change.

- Retire the blue-filled introduction band. Page orientation is a neutral,
  unframed heading block on the app canvas; form surfaces begin below it.
- Login is a deliberately compact single-purpose column rather than a stretched
  `56rem` workflow. Its form uses one `--surface-alt` outer card,
  `--elevation-card`, 24px `--radius-card`, `--surface-base` inputs, 12px
  `--radius-row`, and the 44px workflow-action baseline. Primary actions use
  the canonical pill-shaped `--radius-control` role rather than inheriting an
  input or nested-card radius.
- Registration may use the wider form-flow frame because it contains several
  related data and consent groups. Each fieldset is an independent
  `--surface-alt` section card with the same elevation and radius roles; inputs
  and bounded selection/consent rows use `--surface-base` and the appropriate
  nested 12px or 16px radius tier.
- Existing form order and semantic fieldsets remain intact. Section labels use
  the same blue eyebrow hierarchy as setup/create; helper, policy, resend, and
  account-switch actions remain visibly subordinate to the primary task.
- The TalentArbor brand header remains neutral and shared. Header utility links
  use the compact secondary-action treatment rather than introducing another
  page banner or competing primary action.
- Validate login and registration at narrow mobile and desktop widths, with
  realistic validation errors, password visibility, contact selections,
  consent copy, submission progress, verification resend expansion, keyboard
  focus, 200% zoom/reflow, and reduced motion.

#### Composed-page acceptance

Production UI work is not complete when components merely use valid tokens and
fit within the viewport. Each target viewport must be rendered, reviewed as a
whole, and revised until the page clears all of these checks:

- The reading order is unmistakable without relying on borders or decoration.
- Visual mass is balanced; no region looks unintentionally empty, crowded,
  detached, or dominant.
- Whitespace groups related content and separates changes in task or meaning.
- Text measure, density, and hierarchy are appropriate to each component's role.
- Major edges, baselines, and action placement feel deliberately related.
- Supporting content remains visibly subordinate to the primary task.
- The primary action appears where the user is ready to take it.
- Long realistic content does not create orphaned labels, weakly anchored
  regions, accidental symmetry, or unstable wrapping.

Responsive implementation therefore uses a mandatory render-review-revise loop
at representative mobile, tablet, and desktop viewports. Breakpoints may
require recomposition, not only stacking or resizing. When a design-system
token produces a visibly weaker result, record the gap and prefer the better
composition rather than silently adding an override.

### Core Lane

- Owns types, repositories, services, route authorization, actions, provider calls, idempotency, persistence, and durable state transitions.
- Supplies explicit loading, empty, partial, success, failure, retry, stale, conflict, unauthorized, and recovered-state contracts.
- Does not restyle a surface concurrently owned by the UI lane unless correcting a blocking behavior defect.

### UI Lane

- Consumes existing read and mutation contracts; it does not bypass repositories/actions or add fixture-only production behavior.
- Owns layout, hierarchy, typography, color, motion, component composition, responsive behavior, focus management, and candidate-facing copy within ratified product meaning.
- May improve the design system when the change is reusable and documented. Surface-specific exceptions must be deliberate and narrowly scoped.
- Keeps demo/mock claims out of production. Preparedness scores, employer sharing, evaluator strictness, resume replacement, and reference-library behavior require separate product/data decisions.

## Shared-File Lock

The following are integration files and have one active writer at a time:

- `src/index.css`;
- shared design-system components and tokens;
- `src/app/**/page.tsx`, layouts, and route-level actions;
- shared candidate/invited session shells;
- `package.json` and lockfiles;
- `SPEC.md`, `DATA_CONTRACT.md`, and `HANDOFF.md`.

Before editing one, identify the owning lane in the current task update. If both lanes need it, land the core contract first, update the UI branch from that commit, and then apply the presentation change. Do not resolve shared-file conflicts by accepting one side wholesale.

## Autonomous Surface Milestones

Production UI may run as a bounded autonomous milestone under [Autonomous Development Operating Model](../07-ops/autonomous-development-operating-model.md).

The lead integrator must define:

- the accepted reference composition and design-system source;
- the complete state and action inventory for every included surface;
- desktop, narrow-mobile, long-text, zoom/reflow, and reduced-motion cases;
- the route, shared component, token, and `src/index.css` writer for each internal slice;
- behavior contracts that the UI consumes but does not reimplement;
- screenshot, geometry, accessibility, and browser-journey evidence;
- design decisions that may proceed and be recorded versus pivots that require user review.

Subagents may inspect V1 behavior, build state inventories, implement isolated components in separate worktrees, or run visual/accessibility review. One lead agent owns final composition, shared files, design-system changes, and milestone judgment.

## Surface Pass

Each production surface pass should:

1. Read its current route, component, tests, governing product/design contract, and relevant V1 behavior.
2. Inventory every supported state and action before replacing markup.
3. Separate behavior defects from presentation work; fix behavior on the core lane when practical.
4. Implement the smallest coherent surface or shared primitive.
5. Verify desktop and mobile layout, long text, zoom/reflow, keyboard/focus, reduced motion, loading, empty, error, recovery, and mutation-in-progress states.
6. Run focused tests plus typecheck/lint; run the broader candidate/recruiter and production browser gates when shared UI changes.
7. Commit the accepted surface independently and record any design-system override or unresolved product decision.

The acceptance matrix must include representative long role/question/candidate text, loading and mutation-pending states, empty and partial evidence, provider-unavailable behavior, stale/conflict recovery, and the audience-specific exit/completion destinations that apply. Automated screenshots should use stable desktop and mobile viewports; geometry checks should fail on viewport overflow, incoherent overlap, clipped controls, or text that escapes its component.

## Integration Gate

An accepted UI commit may enter the core branch when:

- no domain/persistence/provider logic was duplicated or moved into presentation code;
- behavior and ownership tests remain green;
- supported failure/recovery states remain truthful;
- desktop/mobile, overflow, and WCAG checks pass for the affected surface;
- public, candidate-led, invited, recruiter, and QA audience boundaries remain intact;
- shared-token or primitive changes have been checked against existing consumers;
- the canonical docs are updated on the integration branch.

Full milestone and release gates remain governed by the senior-pass skills and [Production Hardening And Deployment Controls](../07-ops/production-hardening-and-deployment-controls.md).

## First Integration Evidence

Slice 194 exercised this operating model on the core/integration branch as the sole shared-file writer. It integrated candidate setup, pre-session landing, live practice, and dashboard composition without moving or duplicating domain behavior. The later Coach Desk home migration used the explicit lane transfer above to replace the production dashboard scaffold with the accepted Phase 1 composition while continuing to consume the existing read model, lifecycle priority, dialogs, repair action, practice actions, and next-round builder. The accepted evidence and bounded follow-ups are recorded in [Candidate Production UI Milestone](../05-quality/candidate-production-ui-milestone.md).

Future UI work should use that milestone as a behavioral and validation baseline, not as a pixel-locked endpoint. The Coach Desk home and its opened Coach Update and Coach Plan surfaces now share the production composition and answer-review contract. Invited, recruiter, QA, dashboard compatibility cleanup, and remaining provisional surfaces still require their own state inventories and acceptance evidence.
