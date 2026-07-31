# Candidate Dashboard Composition Direction

Status: Ratified production UI direction
Last updated: 2026-07-30

## Purpose

The candidate dashboard is the home base between practice activities. Its job is to make one coaching loop legible:

1. practice;
2. review what the coach learned;
3. understand the next useful move;
4. shape or launch the next round;
5. return with new evidence.

The dashboard is not an analytics report, a readiness score, or a collection of equally weighted feature cards. This document ratifies the **Coach Desk** composition: one state-owned stage, quiet supporting surfaces, and one stable Plan system.

Behavior and claims remain governed by [SPEC](../SPEC.md), the [Evidence-First Dashboard Information Architecture](../04-architecture/evidence-first-dashboard-information-architecture.md), and the [Question Preparedness Progress Contract](../04-architecture/question-preparedness-progress-contract.md). Visualization meaning is governed by [Dashboard Progress Visualization](./dashboard-progress-visualization-contract.md). Coach Update detail remains governed by the [Transcript Canvas Contract](./coach-update-v2-card-spec.md).

## Source Disposition

`.untracked/design-system-maturation/Candidate Dashboard Mobile A.dc.html` is the visual-look reference for the dashboard. It informs the neutral canvas, compact header, mobile gutters, type scale, blue/viridian/neutral hierarchy, spotlight treatment, density, and vertical rhythm. It does not define product components, state, data meaning, copy, or information architecture.

The unfinished non-mobile dashboard mockup is excluded. Wider layouts derive from the same semantic component tree and state priority as mobile; they do not preserve a separate mockup composition.

`.untracked/ui-lab` is a disposable implementation and design-probe workspace. Nothing already present there is a mockup reference or product authority. Lab work may be replaced freely and becomes production direction only after explicit human review.

The tracked [Design System Foundation](./design-system-foundation.md) governs tokens, reusable surfaces, radii, elevation, motion, and accessibility. Reference-screen values that conflict with the tracked system are reconciled through the production UI workstream rather than copied as local raw values.

## Composition Invariant

The home has exactly one dominant stage at a time. A supporting component may remain visible when its content is truthful, but it must not present a second primary action or comparable visual mass.

The stable vertical model is:

1. sticky identity and prep-context header;
2. compact role-led introduction;
3. optional Coach Update presence treatment;
4. state-owned hero stage;
5. quiet secondary action or reference;
6. Plan rail;
7. deliberate drilldowns outside the home stack.

This is the **Coach Desk**. It replaces the transitional pattern of Coach Update, Practice Next, Coach Plan, and preparedness appearing as separate peers with repeated card chrome.

## Fixed And Open Surfaces

| Surface | Fixed product contract | Open design work |
| --- | --- | --- |
| Dashboard header | Candidate identity, selected owned prep context, context switcher, truthful next-round draft entry/count | Final compact geometry and transition into opened surfaces |
| Practice home introduction | Selected role and one-line orientation to the practice/review/plan loop | Exact line breaks and breakpoint spacing |
| State priority | Active Round, unread Coach Update, Practice Next, then executable Plan progress | Hero proportions and supporting-surface placement |
| Coach Update | Lifecycle, practiced-only meaning, sparse entry, one accessible detail experience | Presence treatment and artifact-authored home summary |
| Practice Next | Feedback-driven or plan-progress action with truthful source meaning | Hero and quiet-secondary variants |
| Coach Plan | Stable selected-context teaching and inventory object | Plan summary, opened information architecture, and navigation |
| Next-round builder | Durable selected-context draft, authoritative count, add/remove/reorder/clear/launch behavior | Anchored desktop and sheet-based mobile presentation |
| Strong-of-plan completion | Overall progress toward completing the practice plan: highest-earned Strong count over canonical baseline count; complete only at Strong Y of Y | Exact compact Plan-rail visual |
| Pattern view | Category/question status pattern using the canonical projection | Whether a chart adds value beyond Plan and transcript evidence, plus its form and placement |
| Criteria balance | Five universal criteria from an accepted candidate-owned projection | Whether a radar is needed after transcript-canvas evaluation, plus its form and placement |
| History, resume versions, library browse | Secondary or deferred | No home-card placement is ratified |

Fixed means the product role and boundary may not be reinterpreted during visual work. It does not make the current provisional markup pixel-locked.

## State Priority Script

| State | Stage owner | Primary action | Supporting treatment |
| --- | --- | --- | --- |
| Unfinished round | Active Round | Resume round | Coach Update, Practice Next, and Plan remain quiet |
| Ready unseen Coach Update | Coach Update | Open update | Practice Next becomes a compact secondary; Plan rail remains available |
| Coach Update opened or previously seen | Practice Next | Start, finish coverage, or practice from feedback | Coach Update remains a quiet review entry |
| No new feedback, executable plan work | Practice Next or Plan progress, according to the read model | The one executable next move | Other regions remain reference-only |
| Cold start or no practice evidence | Plan start state | Start the first recommended practice | No empty gauge or evaluative chart |
| Missing or invalid prep context | Setup entry | Prep for a role | No mixed-role dashboard fallback |

Opening Coach Update may clear browser-local `New` emphasis. It does not delete the update, change learning evidence, or create a durable review fact.

## Component Contracts

### Header

The sticky header contains:

- the configured deployment mark in its own quiet brand row above the working controls (TalentArbor by default, NJ Career only when the demo-brand flag is explicit);
- candidate initials as the leading identity anchor in the control row;
- one compact selected prep-context control;
- one persistent next-round draft trigger with authoritative queued count when a durable draft resolves;
- `Prep for a new role` inside the owned-context menu.

For app-account access, activating the initials opens the account disclosure and `Sign out` is its first action. The dashboard does not render a separate logout button. Host-launched access retains the initials as a noninteractive identity marker because that access source has no app-account logout command.

The switcher never contains a progress gauge, qualitative band, readiness claim, or queue state for another prep context. Its compact 44px control keeps full-pill geometry without increasing height. On mobile the role truncates safely and the draft trigger may reduce to icon plus badge. Wider layouts may show the label without changing its meaning.

### Coach Update Presence And Entry

Presence and entry are two presentation depths of one Coach Update object, not separate notifications or destinations.

- `ready + unseen`: may use a compact presence treatment and owns the hero stage;
- `ready + seen`: remains available as a quiet review entry;
- `pending`: communicates that practice is saved and the update is being prepared;
- `unavailable`: confirms saved work and exposes only the bounded repair action;
- `awaiting practice`: explains that completed practice creates the first update.

If both a presence treatment and hero entry appear, presence stays one line and both open the same detail experience. The unseen-update hero acknowledges the practiced question set and names its bounded range, such as `Questions 1–3`, before asking the candidate to open the debrief. It does not repeat that range or an answer count in a secondary fact row once the heading and acknowledgement already establish the update's scope. It does not preview one question's tactical coaching as though that observation summarized the round. Tactical coaching, exact question text, and transcript evidence stay inside the debrief, where each guidance block identifies its source question by plan number, exact text, or both.

### Active Round

Active Round always outranks post-practice content. It shows the selected role, truthful progress, and one Resume action. Mobile may use a bottom resume action only while this state owns the stage; persistent bottom chrome is not used for ordinary dashboard states.

### Practice Next

Practice Next is the feedforward action surface. It distinguishes:

- plan progress or missing baseline coverage;
- practice from accepted feedback;
- an ordered pair of those tasks only when the product contract requires both.

When Practice Next owns the stage, it may show one primary action and one secondary customization path. Feedback-based guidance names the promoted question by plan number and exact text before explaining the next useful move; plan-progress guidance names the question it will start when that question is already resolved. When Practice Next does not own the stage, it becomes a compact row or text-action surface and carries no equal-weight solid CTA, but it still preserves that question reference. That quiet row uses the lightning-bolt practice cue and three deliberately separated type levels: source plus question number, recommended move, then exact question text.

### Plan Rail

The Plan rail is the stable home-base reference beneath the action stage. It combines what the transitional dashboard currently splits across Coach Plan and the standalone preparedness block.

The rail uses the eyebrow `Coach plan progress` as its sufficient title; it does not repeat that meaning with a `Progress toward plan completion` heading. `View plan` stays as a strengthened text action in this header so the progress field below is reserved for the progress read. It contains:

- one enlarged Strong-of-plan completion indicator using natural `X of Y` language in a left `Overall` cell;
- one compact vertical `Questions` list in a right cell, where consistently aligned circular markers and a short visible state label distinguish each canonical question's prep state without relying on color alone;
- one `View Coach Plan` action.

The overall indicator and question list are one hierarchy, not two competing charts: the gauge answers how close the full Plan is to completion, while the vertical list explains which questions contribute to that result. Their two cells are equal-width and separated only by a shortened low-contrast divider so neither reads as an accessory to the other. `Overall` remains horizontally centered but shares the same top baseline as `Questions`; the gauge aligns directly beneath it rather than vertically centering against the entire question list. The gauge uses the semantic `--prep-strong` progress stroke, a quieter track, and `--shadow-raised-1` drop-shadow depth on the SVG rings beneath the rail's `--shadow-raised-2`. Its center remains transparent to the card glass rather than becoming another badge surface. Every prep-state badge is circular. Strong alone uses the filled ramp value plus a checkmark; every other state uses its lighter preparedness-ramp treatment so it remains legible but secondary. Question rows receive enough vertical rhythm to scan cleanly without becoming another card or table. The rail does not repeat the same state through horizontal line segments or add a paragraph that merely narrates the visible counts.

The Phase 1 material probe treats the rail as one restrained glassmorphic `--radius-card` surface rather than another opaque dashboard card. One slightly more opaque glass color/material continues through the `44px` header, full `32px` side gutters, progress field, and compact bottom padding. The `Coach plan progress` eyebrow uses `--text-secondary` so it reads as an intermediate neutral rather than another blue action cue. The obsolete empty footer band is removed. The card has no visible border and uses `--shadow-raised-2` for visible but sub-panel elevation, plus one restrained inset top highlight. The progress grid remains an unfilled layout field with only the shortened shared cell divider; it has no second surface color, radius, inset highlight, or elevation beyond the deliberately raised gauge.

It does not contain a full question grid, criterion radar, pattern chart, matrix, or second practice builder. If those views survive design review, they belong in the opened Plan, an evidence drilldown, or another explicitly ratified surface.

### Opened Coach Plan

The production opened Coach Plan uses `Questions` as its operational default and `Categories` as a secondary context lens; it does not add equal `Skills` or `Question Set` faces. `Why this plan` is quiet orientation on the sheet canvas rather than a soft-blue nested card. Within Questions, a fully rounded horizontal `Q#` tab group spans the canonical plan and owns question switching; the separate bottom question-set control is removed. The active tab updates the visible canonical question reference, preserves keyboard arrow/Home/End navigation, and keeps every tab at an effective 44px target. Each tab also exposes the question's highest-earned prep state without introducing another progress model. Opened-Plan orientation and selected-question copy use the available sheet width; compact text measures from dashboard question references must not force premature wrapping in this wider context.

The current maturation direction treats the canonical question set as the operational spine: questions own selection, evidence, and practice actions. Practiced-question evidence opens through `Review your answer` and reuses the Coach Update answer-review composition: `Your answer`, its provenance-safe transcript, accepted whole-answer observation when present, and one `Try next` gap when present. Category content remains a secondary orientation and teaching lens rather than an equal competing face. When category teaching appears in the selected-question flow, it explains why that category is represented, preserves the useful answer-shape and weak-pattern guidance from the live reference, and may summarize `Strong X of Y` questions in that category. That count must derive from the same canonical per-question preparedness projection as the Plan rail; `X of Y practiced`, category averages, and category scores must not become a parallel completion system. The category lens may later move to a progress drilldown or question-selection flow if that produces a clearer composition.

The accepted category lens is explicit through the same `Questions` / `Categories` tab pair rather than a hidden flip-card affordance. `Categories` uses the original maturation plan's category-first, question-peek pattern: a compact category selector opens role- and stage-specific purpose, a useful answer shape, one weak-pattern warning, the category's `Strong X of Y` count, and the constituent questions with their canonical prep states. Selecting a constituent question returns to its question detail. Categories remains contextual navigation, not a second completion model or an equal owner of evidence and practice actions. A flip transition is intentionally excluded because the opened Plan already contains question navigation and evidence reveal interactions, and the gesture budget allows only one dominant progressive interaction per viewport.

Possible content domains are:

- plan/category teaching;
- the canonical question set and practice capability;
- practiced-question progress;
- candidate-safe criterion teaching or balance;
- accepted answer evidence through the provenance-safe transcript canvas.

These domains may resolve as one adaptive Plan surface, progressive sections, question-first navigation, or a smaller set of drilldowns. They must not be forced into tabs, cards, faces, swipe, flip, or carousel navigation simply because those patterns appeared in an earlier plan.

The transcript canvas is a design gate. If exact answer evidence, whole-answer signals, and the next useful gap provide sufficient explanation, Coach Plan should not duplicate that explanation in a separate Skills face or dashboard radar. A chart earns a place only when it answers a distinct cross-question question that the transcript canvas cannot.

### Opened Surfaces

Depth belongs in opened surfaces rather than expanding every home component:

- Coach Update opens the existing top-anchored mobile sheet or wider modal;
- opened Coach Update keeps question context outside the evidence surface. The nested evidence surface contains only the `Your answer` eyebrow and the selectable transcript; accepted whole-answer notes and the single `Try next` gap sit below it as separate, question-owned guidance;
- Coach Plan opens its selected-context reference surface;
- the next-round builder opens from the persistent draft trigger;
- any retained pattern or criteria-balance detail opens from its explicitly ratified owner;
- transcript evidence uses the existing provenance-safe interaction.

Top-level surfaces close with Escape, explicit close, and permitted clickaway/tapaway. Nested detail uses a back action rather than another clickaway layer.

Dashboard cards use `--radius-card`, with the ready Coach Update retaining `--radius-panel` through `.surface-spotlight`. Opened Coach Update and Coach Plan sheets use `--radius-feedback-modal`; their contained answer-review cards use `--radius-card`. These semantic shape roles do not select or alter elevation.

## Mobile-First Composition

Mobile is a single-column stage stack, not a compressed desktop grid.

- The first viewport contains one primary action.
- The hero owns most of the first viewport's visual mass.
- Supporting content uses reduced height, quieter color, and text-level actions.
- Header, intro, hero, secondary, and Plan rail keep the visual rhythm established by the mobile reference.
- Long content moves into sheets or drilldowns rather than lengthening every home card.
- All visible controls meet the effective 44px target contract and remain stable at 320px and 200% zoom.

Wider layouts preserve the same DOM and reading order. They may place one quiet secondary beside the hero when that improves scanning, but the secondary must not become a co-equal card. The Plan rail remains a distinct full-width or stable side reference according to available space.

## Visual Meaning

- Coach Update uses the primary-blue family because it represents the current coaching read.
- Opened Coach Update uses hierarchy rather than repeated labels to explain itself: question context, answer evidence, optional answer-level note, one next move, then review actions. Its compact annotation popover leads with `What I noticed`, omits the repeated `Coach noticed` indicator label, reduces header chrome so the accepted claim is visually primary, and reveals on mouse hover as well as click, keyboard activation, or pointer tap. It keeps only the marker labels needed to explain the selected span. `Try next` uses a neutral white `--surface-base` plane with soft elevation; secondary-brand icon and eyebrow accents distinguish the guidance without tinting the whole surface. It remains distinct from success green, Coach Update blue, and preparedness colors and reads as guidance, not a warning or score.
- The ready, unseen Coach Update is the one spotlight surface in that dashboard state. It uses the shared `.surface-spotlight` contract intact: the token gradient, subtle light border, `--shadow-panel`, and `--radius-panel`. A local solid fill, tighter radius, or replacement shadow must not approximate that material.
- Coach Update state identity uses the production compass variants rather than substitute glyphs: `cta` for the unseen spotlight action, `calm` when the same colored surface is in active review, and `surface` on neutral reviewed/detail entries. The unseen presence row has no pill rim. A bounded blue-to-viridian accent follows the spotlight's top edge, while a subtle radial light may sit within the upper card field and become more legible in dark mode without replacing the spotlight gradient. Because primary blue disappears against the lighter spotlight fill, the light-theme edge uses the higher-luminance blue, ice, and mint rim colors already present in the production CTA compass; dark mode keeps the semantic primary-to-viridian ramp.
- The spotlight action remains the shared white `.on-color-action` treatment in the Phase 1 probe. Dark mode may reduce its optical glare with a restrained cool-white falloff and tighter shadow, but it must continue to read as white rather than gray, translucent, or dark. Final white-versus-dark action direction remains a human-review decision before production work.
- Practice Next uses a neutral surface. When promoted, its bounded directional light begins with viridian in the upper-left and fades into the neutral surface. Its border uses a matching gradient-light treatment rather than a uniform green stroke. Viridian remains limited to semantic accents, strokes, icons, path cues, or that bounded directional gradient; it does not fill the complete stage.
- The quiet, unpromoted Phase 1 Practice Next probe may instead use negative space as its material: its existing background and border hooks remain in the lab for easy comparison, but both render transparent at rest. Its `36px` lightning badge uses clear low-opacity glass rather than an opaque accent fill, and the badge midline aligns with the eyebrow text instead of centering against the complete three-level copy block. Dashboard Coach Update compasses use the same `36px` visible-core scale; their one-pixel outer ring may grow to `38px` rather than shrinking the compass artwork. Because the eyebrow already names the question, the trailing action reads `Start` without repeating the question number; its midline aligns with the same eyebrow row as the lightning badge. The lightning badge, typographic hierarchy, action color, spacing, and focus treatment carry the affordance without introducing another visible card plane. This does not change the promoted Practice Next surface or opened-feedback avatar sizing.
- Promoted Practice Next uses the same lightning-bolt vocabulary as its quiet form. The bolt sits inside a small white circular surface badge so the action cue remains crisp against both light and dark directional materials.
- Coach Plan and progress use neutral surfaces with restrained primary accents.
- The production dashboard canvas uses the reviewed blue-only `Diagonal confluence` field in both themes. Its washed, low-chroma blue stops remain a background layer rather than a progress or readiness signal, and cards remain the primary color-bearing surfaces. Production preserves the lab's narrow-frame geometry at mobile widths, then clamps the two radial fields around the centered Coach Desk on wider viewports so the diagonal confluence remains visible instead of flattening into a uniform page wash. The canvas continues through the transparent dashboard header; only the role switcher and practice-queue control use restrained glass material so their labels and actions remain legible against it. The former teal/green canvas stops and the `Cool horizon` / `Peripheral mesh` comparison studies remain lab history, not production variants.
- Strong, Clear, Emerging, unpracticed, incomplete, and unavailable colors appear only inside progress or Plan contexts. They do not recolor the dashboard stage.
- One spotlight surface is allowed in a view. Lower-prominence regions use negative space before another container.
- A state probe must not invent a secondary status or action merely to occupy the quiet-secondary slot. In particular, an unfinished-round state renders no saved-question confirmation row when the application read model supplies no distinct secondary object; the dominant resume stage already owns those facts.

Color distinguishes product roles; it is never a hidden score, hiring judgment, or claim of interview readiness.

## Gesture And Motion Budget

Each viewport uses at most one dominant progressive interaction:

- swipe for Coach Update question cards;
- swipe or face transition for Coach Plan;
- tap/focus for transcript annotations and chart details;
- sheet transition for debrief, Plan, and builder.

Do not stack carousel, flip, hover reveal, and nested modal behavior in one viewport. Motion communicates state, lasts within the shared control/surface durations, preserves readable default content, and reduces to a crossfade or immediate transition under reduced motion.

## Explicit Prune Inventory

Production maturation removes or demotes:

- the always-peer Coach Update, Practice Next, and Coach Plan card grid;
- the standalone fifth preparedness block;
- a home-level readiness percentage or readiness gauge as the organizing story; the compact Strong-of-plan completion indicator remains;
- duplicate Coach Plan and progress entry points;
- multiple primary buttons produced by independently actionable cards;
- standalone resume management or reference-library home modules;
- any use of the unfinished non-mobile mockup as implementation authority.

The underlying read models, lifecycle states, opened experiences, and durable action seams remain reusable.

## Implementation Sequence

1. Replace or isolate the existing unrelated dashboard prototype in `.untracked/ui-lab`; do not treat it as a reference.
2. Produce mobile first-viewport probes for the five priority states and alternative opened-Plan structures.
3. Evaluate the production transcript canvas with representative accepted evaluator outputs, exact-span fallbacks, and candidate review.
4. Pass human review for next-action clarity and evidence usefulness before production edits.
5. Recompose the home into stage, quiet secondary, and Plan rail without changing durable behavior.
6. Wire Strong-of-plan to the existing preparedness projection.
7. Add a pattern or criteria-balance view only if the probes establish a distinct candidate need and the required core projection exists.
8. Complete sheet, responsive, motion, and accessibility polish.

Steps 1–6 and the opened-surface portion of step 8 are now implemented on the rebuild route. Step 7 remains conditional and must not be inferred from the presence of the Categories lens.

Each production slice consumes existing read/mutation contracts and follows the [Production UI Workstream](./production-ui-workstream.md). No slice may introduce a second preparedness truth or move ownership/persistence logic into presentation code.

## Acceptance

Before the composition is declared production-ready:

- the candidate can identify the next action within five seconds in every priority state;
- exactly one component owns primary visual and action weight;
- Strong-of-plan, coverage, latest feedback, and latest-attempt coaching remain visibly distinct;
- unanswered questions remain neutral;
- mobile, tablet/reflow, and wider layouts preserve one semantic order;
- 320px, representative mobile, 200% zoom, long role/question text, reduced motion, keyboard, screen-reader naming, focus return, and overflow are verified;
- visual review confirms that the complete page—not only individual components—matches the mobile reference's calm hierarchy and density.
