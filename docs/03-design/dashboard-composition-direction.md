# Candidate Dashboard Composition Direction

Status: Ratified direction; focused two-mode Coach Desk remediation in progress
Last updated: 2026-08-07

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

The home has exactly one dominant commitment at a time. That commitment may be expressed through one spanning stage or through a deliberately composed action group; it is not required to occupy one fixed hero card. A supporting component may remain visible when its content is truthful, but it must not present a second primary commitment or comparable attention weight.

The adaptive attention model preserves this logical reading order without fixing every module to a permanent row:

1. sticky identity and prep-context header;
2. a dismissible continuity notice when unfinished practice exists, or a state-owning interruption when an unseen Coach Update exists;
3. the current practice commitment or coherent action group;
4. Plan progress and its Plan/Next Round workbench entry;
5. quiet history or reference handoffs;
6. deliberate drilldowns outside the home composition.

Modules may change span, proportion, material, and relative vertical placement by lifecycle state while semantic DOM and focus order continue to follow this priority. A missing peer causes the remaining module to recompose and occupy the available row; the dashboard does not preserve an empty half-cell as decorative negative space. Wider layouts may form a true responsive bento rather than keeping the complete mobile column at a fixed narrow width.

This is the **Coach Desk**. It replaces the transitional pattern of Coach Update, Practice Next, Coach Plan, and preparedness appearing as separate peers with repeated card chrome.

## Fixed And Open Surfaces

| Surface | Fixed product contract | Open design work |
| --- | --- | --- |
| Dashboard header | Candidate identity, selected owned prep context, and context switcher | Final compact geometry |
| State priority | Active practice continuity, unread Coach Update, Practice Next, then executable Plan progress | Hero proportions and supporting-surface placement |
| Coach Update | Lifecycle, practiced-only meaning, sparse entry, one accessible detail experience | Presence treatment and artifact-authored home summary |
| Practice Next | Feedback-driven or plan-progress action with truthful source meaning | Hero and quiet-secondary variants |
| Coach Plan | Stable selected-context teaching and inventory object | Plan summary, opened information architecture, and navigation |
| Next-round builder | Durable selected-context draft, authoritative count, add/remove/reorder/clear/launch behavior, and one eligible Coach Plan inventory | Further composition with the broader reference-only Plan |
| Strong-of-plan completion | Overall progress toward completing the practice plan: highest-earned Strong count over canonical baseline count; complete only at Strong Y of Y | Exact compact Plan-rail visual |
| Pattern view | Category/question status pattern using the canonical projection | Whether a chart adds value beyond Plan and transcript evidence, plus its form and placement |
| Criteria balance | Five universal criteria from an accepted candidate-owned projection | Whether a radar is needed after transcript-canvas evaluation, plus its form and placement |
| History, resume versions, library browse | Secondary or deferred | No home-card placement is ratified |

Fixed means the product role and boundary may not be reinterpreted during visual work. It does not make the current provisional markup pixel-locked.

## State Priority Script

| State | Stage owner | Primary action | Supporting treatment |
| --- | --- | --- | --- |
| Unfinished round | Continue round | Resume the canonical session | A dismissible continuity notice reports saved progress; One-question round remains the bite-size alternative; Coach Update and Plan remain subordinate |
| Ready unseen Coach Update | Coach Update | Open update | Practice Next is suppressed; truthful Plan/Next Round support may remain quiet |
| Coach Update opened or previously seen | Practice Next | Start, finish coverage, or practice from feedback | Coach Update remains a quiet review entry |
| No new feedback, executable plan work | Practice Next or Plan progress, according to the read model | The one executable next move | Other regions remain reference-only |
| Cold start or no practice evidence | Plan start state | Start the first recommended practice | No empty gauge or evaluative chart |
| Missing or invalid prep context | Setup entry | Prep for a role | No mixed-role dashboard fallback |

The missing-context fallback is not another lifecycle stage or Coach Plan variant. It is one centered, conventional empty-state block built from the neutral surface and primary button primitives, with a visible heading as its accessible name, one normally wrapped explanation, and no blue wash, accent edge, synthetic plan state, or decorative coaching chrome.

Opening Coach Update may clear browser-local `New` emphasis. It does not delete the update, change learning evidence, or create a durable review fact.

## Component Contracts

### Header

The sticky header contains:

- the configured deployment mark in its own quiet brand row above the working controls (TalentArbor by default, NJ Career only when the demo-brand flag is explicit);
- candidate initials as the leading identity anchor in the control row;
- one compact selected prep-context control;
- `Prep for a new role` inside the owned-context menu.

For app-account access, activating the initials opens the account disclosure and `Sign out` is its first action. The dashboard does not render a separate logout button. Host-launched access retains the initials as a noninteractive identity marker because that access source has no app-account logout command.

The switcher never contains a progress gauge, qualitative band, readiness claim, queue state, or active/completed/answered activity summary for another prep context. Its disclosure is headed `Switch or add a role to practice`, lists role names only, and ends with `Prep for a new role`. Its compact 44px control keeps full-pill geometry without increasing height. On mobile the role truncates safely. With the detached queue destination retired, the account avatar is the row's fixed leading control and the role switcher consumes all remaining width through the trailing content edge. The header reserves no empty queue slot and introduces no replacement utility there; Plan and Next-round work stay in the working canvas.

### Coach Update Presence And Entry

Presence and entry are two presentation depths of one Coach Update object, not separate notifications or destinations.

- `ready + unseen`: may use a compact presence treatment and owns the hero stage;
- `ready + seen`: remains available as a quiet review entry;
- `pending`: communicates that practice is saved and the update is being prepared;
- `unavailable`: confirms saved work and exposes only the bounded repair action;
- `awaiting practice`: explains that completed practice creates the first update.

If both a presence treatment and hero entry appear, presence stays one line and both open the same detail experience. The unseen-update hero acknowledges the practiced question set and names its bounded range, such as `Questions 1–3`, before asking the candidate to open the debrief. It does not repeat that range or an answer count in a secondary fact row once the heading and acknowledgement already establish the update's scope. It does not preview one question's tactical coaching as though that observation summarized the round. Tactical coaching, exact question text, and transcript evidence stay inside the debrief, where each guidance block identifies its source question by plan number, exact text, or both.

### Active Practice Continuity

An unfinished canonical session still outranks repeat practice and post-practice recommendations, but it no longer occupies a persistent feature card. On dashboard entry it may render one compact, full-width notification above the Coach Desk bento with `Practice in progress`, truthful answered/total progress, compact segmented progress, one `Resume practice` action, and an explicit close control. It uses the low-chroma raised surface and shallow row elevation rather than glass or another feature-card material, so its short inline-notification morphology remains clear in both themes. It contains no question text.

Closing the notification changes browser-held presentation only. Dismissal is keyed to the candidate and active practice-session identity, may persist for that session, and never changes durable practice state. A different active session may show a new notification. The green `Continue round` action remains the durable resume path after dismissal, while `One-question round` resumes the same canonical session with the one-question pace. The notification therefore uses status rather than urgent-alert semantics and may be closed without stranding the candidate.

### Practice Next

Practice Next is the feedforward action surface. It distinguishes:

- plan progress or missing baseline coverage;
- practice from accepted feedback;
- an ordered pair of those tasks only when the product contract requires both.

When Practice Next owns the stage, its compact home launcher presents the commitment and canonical question reference without duplicating coaching detail. Activating it opens the focused one-question sheet, which names the promoted question by Plan number and exact text before explaining the accepted next useful move and exposing the existing direct/queue actions. When an unfinished round or unseen Coach Update owns the stage, Practice Next is suppressed rather than becoming a competing secondary instruction.

### Accepted production direction: practice commitment bento

The production home composes `Practice next` and a nonempty `Next round` as one authored `Field + Object` family rather than two generic cards. They share a large title, one short guidance line, one bare corner direction cue, one bottom-right graphical mark, and one lower context line, but deliberately differ in material because one recommends a single coached move and the other represents an assembled multi-question commitment. The arrow cues use no visible badge surface. The lightning and count marks alone retain equal-size circular objects, with the Next round count remaining its dominant mark through type and placement rather than extra diameter. The pair uses action-family `--accent-*` and `--primary-*` roles rather than `--prep-strong`, so green-family action color cannot be misread as a preparedness result. In the reviewed state, the two actions are equal-height full-width rails stacked in reading order on mobile. At wider bento widths they remain stacked as the left column and their combined height aligns with the complete Plan progress surface in the right column. Their lower labels remain single-line and never collide with the count mark. If the queue is empty, Practice next recomposes across the complete row; the layout does not preserve an empty peer cell. If an unseen Coach Update or Active Round owns the view, the pair yields to that higher-priority commitment.

### Accepted production direction: adaptive state compositions

The five lifecycle probes share semantic order and component contracts, but they do not repeat one fixed stack. Each state receives an authored bento arrangement based on the object that owns the candidate's attention:

| State | Primary field | Supporting composition |
| --- | --- | --- |
| Ready unseen Coach Update | Intrinsic full-width Coach Update spotlight | The complete Plan Dial paired with the green Next round object when the queue is nonempty; the Plan expands when it is empty |
| Coach Update reviewed | `Practice next` recommendation field | `Next round` commitment object when nonempty, then the complete Plan Dial and quiet Coach Update history entry |
| Unfinished round | Green `Continue round` action with a dismissible continuity notice above the bento | `One-question round` and the complete Plan Dial form the supporting commitment group; quiet Coach Update status spans below when truthful |
| Cold start | Plan ignition field with the canonical question sequence in an unevaluated state and the first recommended question emphasized | A compact Next round object only when the candidate has already assembled one; no completion gauge or preparedness chart |
| Executable Plan focus | One integrated Plan workspace that combines the Plan Dial with the remaining evidence gap and its practice action | A compact Next round object only when nonempty; no duplicate Plan-progress surface |

When preparedness evidence exists, the Plan pulse reuses the same Plan Dial component and material construction as the complete progress surface rather than maintaining a second compact gauge. The centered Strong-of-plan gauge, lit perimeter plate, raised center well, badge geometry, and clockwise placement are shared; only the surrounding card header, optional legend, and data-driven number of canonical question badges may differ. The pulse may omit the full legend because its accessible name supplies the complete summary and its action opens the same Plan. The cold-start sequence is not a zero-value version of that dial: before evidence exists it shows inventory and recommended order only.

Primary-stage question references use the available inline measure; they do not retain a fixed prose cap that forces early wrapping inside an otherwise wider surface. In the near-square bento support cell, the full-width header sits above the shared Plan Dial, whose Strong gauge remains geometrically centered regardless of canonical question count. At narrow widths, the card stacks the header and shared dial; only the pre-evidence inventory treatment may use the shorter horizontal composition.

The question nodes are circular status objects, not text rows. Every number and Strong check is explicitly centered inside its node with a one-line glyph box; it must not inherit left alignment from a surrounding card, button, or interactive Plan surface.

The supporting row may remain a two-object bento at supported mobile widths when both objects preserve legibility and effective targets. At narrower widths it reflows structurally in DOM order. A state owner never receives a second full-size peer merely to keep the page populated.

The Coach Desk has two page-level layout modes only: a single semantic stack and an asymmetric two-column bento inside the focused application frame. It does not introduce a three-column viewport mode. Component-internal adaptation responds to the inline size of its actual container rather than assuming that a wide viewport supplies a wide card. The two-column mode may deliberately align the combined height of a semantically paired action stack with the Plan instrument, but unrelated status and history surfaces remain intrinsic and span their own row. A missing object recomposes the row instead of leaving an empty track.

Every surface remains in normal document flow. The layout preserves intrinsic content height and explicit sibling gaps; it never stretches a spotlight action, notification, quiet Coach Update entry, or unrelated card merely to equal the height of a neighboring stack.

### Plan Rail

The Plan rail is the stable home-base reference within the adaptive dashboard composition. It combines what the transitional dashboard currently splits across Coach Plan and the standalone preparedness block. It may move ahead of quiet history/supporting rows when that gives visual progress a meaningful place in the working flow; it does not have to remain the final card on the page.

The home surface uses the short standard-case label `Coach plan`; it does not repeat that meaning with `Coach plan progress` or `Progress toward plan completion`. One simple arrow remains the visible action while its accessible name is `View Coach Plan`, keeping the progress field below reserved for the progress read. The same component is used in the primary progress cell and the supporting shelf rather than maintaining separate full and pulse variants. It contains:

- one integrated Plan Dial with the enlarged Strong-of-plan completion ring at its center;
- one ordered circular node per canonical question around the ring, using preparedness fill, contour, and non-color marks plus a compact present-state legend;
- one icon-only `View Coach Plan` action with a complete accessible name and effective target.

The ring and question nodes are one instrument, not two competing charts: the ring answers how close the full Plan is to completion, while the clockwise node map explains which canonical questions contribute. The gauge uses semantic `--prep-strong`, a quieter track, and restrained ring depth. Its center remains transparent to the card glass rather than becoming another badge surface. Strong alone uses the filled ramp value plus a checkmark; every other state uses a lighter preparedness-ramp fill with a distinct contour or mark. The home nodes are not separate controls; an accessible summary and compact legend preserve meaning without a vertical explanatory list. At narrow widths or 200% zoom, the nodes may unfold into an ordered compact grid. The rail does not repeat state through horizontal segments or add prose that narrates visible counts.

The ratified material replaces the Phase 1 glass probe with semantic `surface-plan`: one opaque matte-blue `--radius-card` surface with white ink, no visible border or backdrop blur, `--elevation-panel`, and one restrained inset top contour. It is a stable reference object below the gradient Coach Update spotlight in emphasis and does not depend on the canvas color for legibility. Light and dark themes use separate contrast-checked blue fills from the solid-fill family. The same material continues through the compact header, dial field, legend, and bottom padding. The dial remains part of that single surface and exposes no second progress model. Within the instrument, a translucent lit powder-blue perimeter plate and raised center well separate the green Strong ring and preparedness nodes from the blue card. The perimeter lets the parent blue partially influence its value while preserving the existing directional gradient and highlight. Their shared lighting direction and blue-tinted depth make them one mounted instrument rather than nested cards or independent metrics. In dark mode, only the center well shifts to a restrained navy material with softer highlight, rim, and contour roles plus light gauge ink; the outer plate keeps its established construction. The present-state legend is standardized across compact and opened Plan Dials as a calm, theme-aware neutral tray with the existing preparedness swatches, keeping the legend legible without adding another luminous instrument layer.

It does not contain a full question grid, criterion radar, pattern chart, matrix, or second practice builder. If those views survive design review, they belong in the opened Plan, an evidence drilldown, or another explicitly ratified surface.

### Opened Coach Plan

Production uses `Questions` as its operational default and `Categories` as a secondary context lens; it does not add equal `Skills` or `Question Set` faces. The opened Plan is a map-and-detail workspace rather than a long form or a stack of similarly weighted cards. Its persistent header places the visible `Questions` / `Categories` switch in a subordinate centered row because it changes the lens for the complete opened surface. The left interaction map then uses the theme-aware raised neutral surface solely for the exact mounted Plan Dial component reused from home. The shared component explicitly owns its `card` or `reference` layout and its `plan` or `neutral` material; neither construction may be inferred from an incidental ancestor surface. The switch uses a quiet neutral rail with a primary-blue selected tab and white selected text, matching the light-field interaction grammar without competing with the dial. The mounted instrument owns one stable-width layout envelope with section-level clearance above its orbit and a separate cluster gap before its legend; selected-node position, question count, and legend wrapping therefore cannot make either layer collide with the switch or with one another. The ring retains the overall Strong-of-plan meaning while each question node becomes a 44px-effective control. Strong interactive nodes retain their `Q#` identity and add a check as a secondary confirmation mark. The selected node receives the primary-blue halo so selection stands apart from both the neutral field and the node's truthful preparedness state. Switching to `Categories` makes the dial nodes visibly noninteractive and removes the question-selection halo.

The count, stage, and category orientation block is omitted because the header, dial, selected detail, and category lens already carry that context. The selected question owns a quiet neutral detail field rather than another powder-blue or glass layer. Within it, question text remains the only flat region. Answer-shape teaching and `Watch for` share one subordinate semantic Coach Plan blue surface with sufficiently contrasting on-color text. The answer shape reuses the setup workflow timeline geometry, aligns on one baseline at wide widths, and stacks vertically on narrow sheets. In the vertical construction, every connector remains centered on the shared node rail and terminates in the open interval between adjacent nodes; it never crosses a translucent node. Its nodes and the `Watch for` pill use the same `on-color-glass` material so the teaching sequence reads as one system without creating nested opaque cards. Existing `Review your answer`, `Practice this now`, and `Add to next round` behaviors follow without acquiring a second navigation model. Practiced-question evidence may still reuse the Coach Update answer-review composition when necessary; it does not occupy the default question-reading region. Category content remains a secondary orientation and teaching lens rather than an equal competing evidence face. Any category Strong count must derive from the same canonical per-question preparedness projection as the Plan Dial; `X of Y practiced`, category averages, and category scores must not become a parallel completion system.

The category lens remains explicit through the same `Questions` / `Categories` switch rather than a hidden flip-card affordance. The provisional row of large rounded numbered category selectors is retired because it looks like a second tab system. Production now uses an aligned category pattern field: canonical category rows place one labeled question mark in each question's truthful preparedness lane. The pattern card uses the semantic Coach Plan blue surface and places the complete matrix inside one restrained `on-color-glass` table so every preparedness badge retains separation. The selected category then receives the same answer-shape timeline and single `Watch for` cue used by the Questions lens, rendered as a raised light-surface variant with primary-blue timeline nodes and white node ink. Redundant category-view headings, purpose copy, answer-rhythm labels, and constituent-question text navigation are omitted. The persistent Plan Dial continues to show overall question preparedness but removes its selected-question halo while Categories owns focus. On the raised neutral map, the dial's outer plate uses quieter neutral surface roles; its legend retains the same calm neutral material used by the compact home Plan. Categories remains contextual navigation, not a second completion model or an equal owner of evidence and practice actions.

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

- Coach Update, Coach Plan, and Next round share one persistent header anatomy: one left-aligned identity block, one 44px circular close target, one neutral overlay material, and one title scale. Optional content preserves role rather than creating header variants: Coach Plan uses a context line plus its view switch in a subordinate centered row, Next round places its authoritative count beside the title, and multi-question Coach Update places question navigation in the same subordinate header row;
- Coach Update opens a bottom-anchored mobile sheet with a visible grabber and downward drag dismissal, or a wider centered modal; explicit close, Escape, and permitted tapaway remain available;
- opened Coach Update keeps question context outside the evidence surface. The nested evidence surface contains only the `Your answer` eyebrow and the selectable transcript; accepted whole-answer notes and the single `Try next` gap sit below it as separate, question-owned guidance;
- Coach Plan opens its selected-context reference surface;
- a nonempty durable queue adds one sheet-level `Next round` label with a circular count badge and `Review next round` handoff below opened Coach Update and Coach Plan content. It persists across question selection, stays outside the question card, and opens the shared builder without losing the selected question;
- the dashboard mirrors that nonempty state through exactly one view-level handoff below the active panel, never through repeated card footers or a detached header utility;
- the next-round builder opens as a centered desktop workspace or the same grabbed, downward-dismissible bottom sheet used by mobile Coach Update. Its ordered queue is assembled inside one elevated blue tray with translucent on-color rows, without per-row ordinal badges because the authoritative total already appears in the header; question content consumes the released width. The eligible `Coach Plan` / `Available to add` inventory uses one quieter raised neutral list with flat, separated rows; its Add action is a labeled pill on wider layouts and a true 44px circle when icon-only on mobile, with a theme-aware blue control material. The lifted footer ends with the primary `Start practice` action;
- any retained pattern or criteria-balance detail opens from its explicitly ratified owner;
- transcript evidence uses the existing provenance-safe interaction.

Top-level surfaces close with Escape, explicit close, and permitted clickaway/tapaway. Nested detail uses a back action rather than another clickaway layer.

Dashboard cards use `--radius-card`, with the ready Coach Update retaining `--radius-panel` through `.surface-spotlight`. Opened Coach Update and Coach Plan sheets use `--radius-feedback-modal`; their contained evidence and guidance surfaces use `--radius-card`, while a Coach Update carousel item adds no outer card plane. These semantic shape roles do not select or alter elevation.

## Mobile-First Composition

Mobile uses one semantic stage stack with one deliberate exception: the compact Practice-next/Next-round commitment pair may share a row when both remain legible at the supported width. This is an authored relationship, not permission to compress the dashboard into a generic two-column card grid.

- The first viewport contains one primary action.
- The hero owns most of the first viewport's visual mass.
- Supporting content uses reduced height, quieter color, and text-level actions.
- Header, intro, hero, secondary, and Plan rail keep the visual rhythm established by the mobile reference.
- Long content moves into sheets or drilldowns rather than lengthening every home card.
- All visible controls meet the effective 44px target contract and remain stable at 320px and 200% zoom.

Wider layouts use the focused `64rem` application frame and preserve the same DOM and reading order while allowing modules to change span and proportion. A lone half-width module expands or deliberately repositions; it never leaves a stable-zone hole. The Plan rail remains a distinct full-width or stable side reference according to available space. The former `72rem` canvas plus three-column topology is retired because it coupled card height to unrelated neighboring stacks and created state-dependent empty tracks.

Long question copy inside dashboard stages uses normal greedy line wrapping so available inline space is consumed predictably across browser zoom levels and responsive widths. Editorial `pretty` or balanced wrapping is reserved for shorter headings; it must not manufacture early breaks in functional question text.

## Visual Meaning

- Coach Update uses the primary-blue family because it represents the current coaching read.
- Opened Coach Update uses hierarchy rather than repeated labels to explain itself: a category-only eyebrow and quiet prompt, a larger answer transcript, optional answer-level note, one next move, then review actions. `Q#` remains in carousel navigation and is not repeated in the question eyebrow or guidance headers. Its compact annotation popover leads with `What I noticed`, omits the repeated `Coach noticed` indicator label, reduces header chrome so the accepted claim is visually primary, and reveals on mouse hover as well as click, keyboard activation, or pointer tap. It keeps only the marker labels needed to explain the selected span, and those marker chips use the theme-aware primary-soft surface. The separate `What I noticed` and `Try next` callouts below the transcript rely on typography and material rather than decorative leading icon badges, allowing their copy to use the full responsive width. Their quiet locator uses the shared `--type-eyebrow-*` role, their guidance uses the more readable `--type-body-*` role, and `--space-2` separates the two levels without turning the label into a detached header. `Try next` uses a neutral `--surface-base` plane with soft elevation; its eyebrow uses the accessible accent-green derivative without tinting the whole surface. A supplied answer shape follows the guidance as an unlabeled compact template strip on the muted `--accent-soft` surface, making its shared primary-gap relationship legible rather than presenting unexplained slash-separated copy. The practice-now action uses the solid-primary family and the next-round toggle uses a neutral raised surface in both themes.
- The ready, unseen Coach Update is the one spotlight surface in that dashboard state. It uses the shared `.surface-spotlight` contract intact: the token gradient, subtle light border, `--shadow-panel`, and `--radius-panel`. A local solid fill, tighter radius, or replacement shadow must not approximate that material.
- Coach Update state identity uses the production compass variants rather than substitute glyphs where the mark carries identity: `cta` for the unseen spotlight action, `calm` when the same colored surface is in active review, and `surface` on the compact reviewed home entry. The opened review sheet header is utility chrome and deliberately omits the avatar so its title and close action remain the complete header. The unseen presence row has no pill rim. A bounded blue-to-viridian accent follows the spotlight's top edge, while a subtle radial light may sit within the upper card field and become more legible in dark mode without replacing the spotlight gradient. Because primary blue disappears against the lighter spotlight fill, the light-theme edge uses the higher-luminance blue, ice, and mint rim colors already present in the production CTA compass; dark mode keeps the semantic primary-to-viridian ramp.
- After review, the quiet Coach Update entry becomes an opaque blue docket rather than clear glass: powder blue with blue ink in light mode and deep ink blue with light ink in dark mode. Compact height, short row elevation, and one inset light contour keep it available without competing with the active stage; blue communicates coaching availability, not preparedness, and the surface never becomes a second spotlight.
- The spotlight action remains the shared white `.on-color-action` treatment in the Phase 1 probe. Dark mode may reduce its optical glare with a restrained cool-white falloff and tighter shadow, but it must continue to read as white rather than gray, translucent, or dark. Final white-versus-dark action direction remains a human-review decision before production work.
- Practice next may use a pale accent field when it participates in the reviewed-state commitment bento. The field is materially lighter and broader than the saturated Next round object. Its brief `Sharpen one answer.` guidance explains the commitment without previewing generated coaching, while the lower question reference preserves exact Plan identity. Its bottom-right lightning object remains the visible action mark. This is an action-family use of viridian through `--accent-*`; it never consumes the preparedness `--prep-strong` role or implies that the question is Strong.
- Next round uses the cooler saturated accent/primary blend whenever it represents a nonempty assembled commitment. Its `Build a focused round.` guidance distinguishes assembly from direct practice; the lower label states the authoritative ready count. Its circular count matches the lightning object's diameter, with prominence supplied by the metric typography and lower-right placement. Size, placement, and elevation may demote it, but a white or neutral-glass variant must not erase the established green action identity.
- The two commitment widgets use the same internal grammar without forced symmetry. Practice next leads at `3fr`, Next round at `2fr`; a lone widget uses the full row. Color, surface mass, and count are purposeful semantic differences rather than arbitrary variation.
- Coach Plan and progress use neutral surfaces with restrained primary accents.
- The production dashboard canvas uses the blue-only `Quiet runway` treatment in both themes. A restrained top-to-bottom blue atmosphere replaces the former ambiguous diagonal wash, while one broad center-aligned linear light field gives the working bento a compositional stage without becoming a card, glow, or state signal. The runway continues through the transparent dashboard header, softens toward the outer gutters, expands into near-uniformity on narrow screens, and is deliberately fainter in dark mode. Cards remain the primary color-bearing surfaces. Ambient radial fields and blue decorative blobs are excluded from the dashboard canvas, rectangular dashboard cards, and opened Coach Plan sheet; the Coach Update spotlight's intentional material light and the Plan wheel's structural rings are separate retained effects. The role switcher uses restrained glass material so its label and action remain legible against the runway. The former teal/green canvas stops and the `Diagonal confluence` / `Cool horizon` / `Peripheral mesh` comparison studies remain lab history, not production variants.
- Strong, Clear, Emerging, unpracticed, incomplete, and unavailable colors appear only inside progress or Plan contexts. They do not recolor the dashboard stage.
- One spotlight surface is allowed in a view. Lower-prominence regions use negative space before another container.
- A state probe must not invent a secondary status or action merely to occupy the quiet-secondary slot. In particular, an unfinished-round state renders no saved-question confirmation row when the application read model supplies no distinct secondary object; the dominant resume stage already owns those facts.

Color distinguishes product roles; it is never a hidden score, hiring judgment, or claim of interview readiness.

## Gesture And Motion Budget

Each viewport uses at most one dominant progressive interaction:

- swipe for Coach Update question cards;
- direct Plan-node or category-rail selection for Coach Plan;
- tap/focus for transcript annotations and chart details;
- sheet transition for debrief, Plan, and builder.

Do not stack carousel, flip, hover reveal, and nested modal behavior in one viewport. Motion communicates state, lasts within the shared control/surface durations, preserves readable default content, and reduces to a crossfade or immediate transition under reduced motion.

## Explicit Prune Inventory

Production maturation removes or demotes:

- the always-peer Coach Update, Practice Next, and Coach Plan card grid;
- the standalone fifth preparedness block;
- a home-level readiness percentage or readiness gauge as the organizing story; the compact Strong-of-plan completion indicator remains;
- duplicate Coach Plan and progress entry points;
- the detached header-level next-round trigger;
- multiple primary buttons produced by independently actionable cards;
- standalone resume management or reference-library home modules;
- any use of the unfinished non-mobile mockup as implementation authority.

The underlying read models, lifecycle states, opened experiences, and durable action seams remain reusable.

## Implementation Sequence

1. Keep the production-backed dashboard prototype in `.untracked/ui-lab` isolated from mockup authority.
2. Produce and review mobile and wider probes for the five priority states, commitment-bento variants, and opened-surface structures.
3. Migrate the closed-home adaptive bento, Plan Dial, contextual Next Round object, and focused one-question lane without changing durable behavior.
4. Verify lifecycle priority, question identity, durable actions, mobile reflow, theme variants, keyboard behavior, focus return, and overflow.
5. Migrate the opened Plan map/detail and builder composition only after their separate visual and interaction review.
6. Add a pattern or criteria-balance view only if the probes establish a distinct candidate need and the required core projection exists.

Steps 1–5 established the production components and durable wiring. The 2026-08-07 composition remediation narrows the page-level grammar to stacked and focused two-column modes, makes active-practice status dismissible, preserves intrinsic surface sizing, and standardizes the green Next round identity without changing the read model or durable actions. The Criteria radar remains lab-only because production does not yet expose the accepted candidate-owned prep-context criterion aggregate and coverage gate.

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
