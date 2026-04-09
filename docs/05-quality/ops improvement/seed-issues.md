# Seed Issues

Use these as the first issues in the system so the operating model becomes real immediately.

## Quick List

### Recruiter App

1. `[Hardening] Stop persisting per-question eval_results beyond live in-session need`
2. `[Hardening] Define retention policy for session summary_narrative and enforce non-lazy cleanup`
3. `[Chore] Finish separation-of-concerns extraction before recruiter app release`

### Candidate App

1. `[Decision] Define candidate dashboard MVP information architecture`
2. `[Policy] Draft disclosures and consent placement for persisted coaching data`
3. `[Research] Create field-by-field persistence matrix for candidate app`

### Shared Ops

1. `[Chore] Stand up GitHub Project operating system across both repos`
2. `[Policy] Define the recurring weekly triage and hardening review routine`

## Suggested Type / Label Pairing

- recruiter hardening items: `Type = Task`, label `hardening`
- retention/disclosure items: `Type = Task`, label `policy`
- candidate dashboard discovery items: `Type = Task`, label `research`
- product implementation ideas: `Type = Feature`, optional label `enhancement`

## Draft Issue Copy

The sections below provide draft copy for the text-input portions of the issue templates. Use the matching template, then paste or adapt the text under the relevant headings.

---

## Recruiter App

### 1. [Hardening] Stop persisting per-question eval_results beyond live in-session need

Recommended template:

- `Hardening / Risk Gap`

Recommended metadata:

- `Type = Task`
- label `hardening`
- add `privacy` if desired
- milestone `Recruiter App Pre-Release Hardening`

#### Problem

The recruiter app currently persists per-question in-session AI feedback in `eval_results`, even though the intended current product posture is conservative exposure with no long-lived need to retain answer-level coach feedback once it has served the live session experience.

#### Why It Matters

This creates a mismatch between intended and actual data exposure. Even if the app no longer presents itself as storing rich evaluative history for recruiter use, the persisted answer-level feedback remains in storage and increases privacy, retention, and governance risk.

#### Current Behavior

Per-question analysis is stored in `eval_results` and can be reloaded later. The app does delete analysis on retry and re-submit, but it does not currently enforce a broader scrub aligned to the conservative posture.

#### Desired Behavior

Per-question in-session coach feedback should only persist for as long as it is operationally necessary to support the live session flow. After that point, it should be scrubbed or never written in the first place, while preserving allowed persisted data such as interview questions and answer transcripts.

#### Data Involved

- answer-level AI feedback payloads
- question-level coaching analysis
- related hidden evaluative artifacts stored with the answer-level feedback

#### Acceptance Criteria

- [ ] The intended retention policy for per-question coach feedback is documented.
- [ ] The implementation no longer keeps `eval_results` longer than the approved live-session need.
- [ ] Questions and answer transcripts continue to persist as intended.
- [ ] The live candidate experience does not regress for submit, review, retry, or summary flows.
- [ ] Tests or validation steps cover the new scrub behavior.

#### Open Questions

- Should answer-level feedback be written at all, or only kept transiently in memory until summary generation is complete?
- If summary generation depends on answer-level analysis, when is the safe scrub point?

---

### 2. [Hardening] Define retention policy for session summary_narrative and enforce non-lazy cleanup

Recommended template:

- `Hardening / Risk Gap`

Recommended metadata:

- `Type = Task`
- label `hardening`
- label `policy` optional
- label `data-retention` optional
- milestone `Recruiter App Pre-Release Hardening`

#### Problem

The recruiter app currently treats `summary_narrative` retention inconsistently. Expiry is only set in certain paths, and cleanup is currently lazy, meaning the summary is only scrubbed when a later fetch happens.

#### Why It Matters

This creates retention ambiguity and means expired summaries can remain in storage indefinitely if no future read triggers cleanup. That is inconsistent with a conservative exposure posture and makes policy harder to explain and enforce.

#### Current Behavior

    `summary_narrative` is persisted on session completion. Expiry is only set when a debrief email is successfully sent. Cleanup happens lazily on later session fetch rather than through a guaranteed retention-enforcement path.

#### Desired Behavior

The app should have a clearly documented retention rule for `summary_narrative`, apply it consistently, and enforce cleanup in a non-lazy way or in a documented, reliable way that does not depend on a later read.

#### Data Involved

- session debrief narrative
- summary expiry metadata
- candidate-facing summary content derived from answers and coaching analysis

#### Acceptance Criteria

- [ ] A retention rule for `summary_narrative` is documented.
- [ ] Expiry behavior is consistent across relevant completion paths.
- [ ] Cleanup is no longer dependent solely on later fetches.
- [ ] The candidate debrief experience still works as intended within the approved retention window.
- [ ] Tests or validation steps cover expiry and cleanup behavior.

#### Open Questions

- Should the retention window remain time-based, or should summary persistence become user-action based?
- Is a scheduled cleanup job warranted, or is there a simpler enforcement mechanism that still meets the posture?

---

### 3. [Chore] Finish separation-of-concerns extraction before recruiter app release

Recommended template:

- `Research / Decision` if framing as an execution-planning issue

Recommended metadata:

- `Type = Task`
- label `chore`
- milestone `Recruiter App Pre-Release Hardening`

#### Decision To Make

Define the final pre-release slice of separation-of-concerns extraction work that should be completed now versus deferred until after release.

#### Context

The recruiter app has a number of improvements in progress around architecture cleanup, operational hardening, and feature extraction. Some of that work is valuable before release, but not all of it should block release if it does not materially reduce risk or improve maintainability in the release window.

#### Options Considered

1. Finish all known extraction work before release.
2. Finish only extraction work that materially improves risk, testability, or maintainability in active surfaces.
3. Defer most extraction work until after release and focus only on product behavior.

#### Recommendation

Finish the extraction work that directly supports pre-release hardening, cleaner ownership boundaries, or safer future changes. Defer cleanup that is mostly aesthetic or low-impact.

#### Inputs Needed

- a list of currently open extraction candidates
- a view of which files or flows are most likely to change again soon
- release-critical versus post-release cleanup boundaries

#### Deadline / Trigger

Before final recruiter app release readiness review.

---

## Candidate App

### 4. [Decision] Define candidate dashboard MVP information architecture

Recommended template:

- `Research / Decision`

Recommended metadata:

- `Type = Task`
- label `research`
- milestone `Candidate Dashboard Definition`

#### Decision To Make

Define the MVP information architecture for the candidate dashboard, including what should be shown in phase 1 and what should be deferred.

#### Context

The candidate-led app is entering a new development phase. The landing and practice pages have been elevated, but the dashboard is still being defined rather than refactored from a complete prior implementation. The dashboard should reflect a conservative exposure posture while still being useful as a private coaching workspace.

#### Options Considered

1. Build a richer analytics-heavy dashboard immediately.
2. Ship a phase 1 dashboard centered on utility, recent sessions, and next actions.
3. Delay the dashboard until richer persistence and longitudinal coaching data are available.

#### Recommendation

Use the phase 1 utility-first dashboard: hero and next step actions, minimal progress strip, recent sessions, lightweight coaching themes, and privacy/disclosure controls. Defer richer evaluative and trend surfaces until the persistence, policy, and disclosure model is intentionally expanded.

#### Inputs Needed

- final decision on what candidate data will persist
- retention and disclosure posture for candidate-facing coaching history
- alignment on which dashboard elements are truly phase 1 versus phase 2

#### Deadline / Trigger

Before candidate dashboard implementation starts in earnest.

---

### 5. [Policy] Draft disclosures and consent placement for persisted coaching data

Recommended template:

- `Hardening / Risk Gap` or `Research / Decision`

Recommended metadata:

- `Type = Task`
- label `policy`
- label `privacy` optional
- milestone `Candidate Dashboard Definition`

#### Problem

The candidate-led app will require meaningful persistence to make the dashboard and longitudinal coaching experience useful. That means disclosures, consent touchpoints, and privacy controls need to be defined before richer persistence is normalized into the product.

#### Why It Matters

Persisted coaching data can be ethically and operationally appropriate, but only if candidates understand what is stored, why it is stored, how long it is retained, and what controls they have. Without that, the product risks drifting into opaque or overexposed behavior.

#### Current Behavior

The recruiter-led app has conservative posture goals but still contains persistence patterns that outlived the earlier PoC assumptions. The candidate-led app is earlier in its lifecycle, which makes now the right time to define disclosures and consent intentionally.

#### Desired Behavior

The candidate-led app should have clear disclosure copy, consent placement decisions, and a documented policy for how persisted coaching data is explained and governed.

#### Data Involved

- transcripts
- summaries
- coaching themes
- session history
- any future persisted coaching insights or derived guidance

#### Acceptance Criteria

- [ ] Draft disclosure copy exists for the key candidate touchpoints.
- [ ] Consent or acknowledgement placement is defined for first use and ongoing use.
- [ ] Privacy controls that need to exist in product are identified.
- [ ] The policy aligns with the actual persistence model being implemented.

#### Open Questions

- Which disclosures belong at sign-up versus first session versus dashboard settings?
- Which persisted coaching artifacts require explicit consent versus general product disclosure?

---

### 6. [Research] Create field-by-field persistence matrix for candidate app

Recommended template:

- `Research / Decision`

Recommended metadata:

- `Type = Task`
- label `research`
- label `privacy` optional
- label `data-retention` optional
- milestone `Candidate Dashboard Definition`

#### Decision To Make

Define exactly which data fields in the candidate app should be persisted, for how long, and for what product purpose.

#### Context

The candidate app cannot deliver a useful dashboard or longitudinal coaching experience without persistence. The right next step is not implementation-by-default, but an explicit persistence matrix that maps each data class to purpose, retention, controls, and disclosure needs.

#### Options Considered

1. Persist broadly now and reduce later.
2. Persist only what is needed for phase 1 dashboard value, then expand intentionally.
3. Minimize persistence so heavily that the dashboard remains mostly static or non-personalized.

#### Recommendation

Create a field-by-field persistence matrix and use it as the gating artifact before richer candidate dashboard implementation. Start with the minimum data needed for useful phase 1 value and document expansion paths separately.

#### Inputs Needed

- candidate dashboard phase 1 scope
- security and privacy posture
- retention expectations by data class
- any future analytics ambitions that could influence schema design

#### Deadline / Trigger

Before building candidate dashboard persistence or longitudinal coaching features.

---

## Shared Ops

### 7. [Chore] Stand up GitHub Project operating system across both repos

Recommended template:

- `Research / Decision`

Recommended metadata:

- `Type = Task`
- label `chore`

#### Decision To Make

Define and complete the minimal setup required to run work across both repos through one repeatable GitHub-based operating system.

#### Context

The team wants a system that prevents ideas and tasks from getting lost, supports weekly triage, and creates a low-friction operating rhythm across both repos without overbuilding process.

#### Options Considered

1. Keep managing work informally in chat and notes.
2. Use one org-level project with standardized issue templates, labels, fields, and routines.
3. Create separate systems per repo and reconcile manually later.

#### Recommendation

Use one org-level GitHub Project with repo-level issue forms, light labels, structured project fields, built-in workflows, and a weekly cadence.

#### Inputs Needed

- confirmation of final field set
- confirmation of final label set
- confirmation of seed issues and milestone names

#### Deadline / Trigger

Immediately, so that current hardening and candidate dashboard work starts inside the system.

---

### 8. [Policy] Define the recurring weekly triage and hardening review routine

Recommended template:

- `Hardening / Risk Gap` or `Research / Decision`

Recommended metadata:

- `Type = Task`
- label `policy`
- label `ops` optional if you create it later

#### Problem

A GitHub project setup alone will not create the desired operating discipline unless the team also establishes a recurring review routine for triage, blocker management, and risk review.

#### Why It Matters

Without a cadence, backlog systems decay quickly. Hardening and privacy work especially tend to get buried under feature work unless there is a deliberate routine that keeps them visible.

#### Current Behavior

Work capture and prioritization have historically been more informal, which increases the risk that useful ideas, hardening tasks, and unresolved decisions get scattered or forgotten.

#### Desired Behavior

Establish a recurring weekly routine for inbox triage, blocker review, active-work review, and privacy/security/hardening visibility.

#### Data Involved

- issue metadata
- project status and prioritization fields
- milestone progress
- hardening and privacy work items

#### Acceptance Criteria

- [ ] A weekly triage checklist exists and is agreed on.
- [ ] The project views used during triage are defined.
- [ ] The expected outputs of each triage session are clear.
- [ ] The routine is lightweight enough to be sustained.

#### Open Questions

- Who owns the weekly pass?
- Should recruiter hardening and candidate discovery be reviewed in one meeting or separate passes?
