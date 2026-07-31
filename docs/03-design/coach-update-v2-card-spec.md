# Coach Update Transcript Canvas Contract

Status: Ratified implementation contract
Last updated: 2026-07-19

This contract defines how accepted V2 evaluation facts become candidate-visible indicators in Coach Update. It supersedes the earlier demo-only tokenizer and score-colored card concepts. The dashboard demo remains a visual exploration, not a runtime data contract.

## Product Purpose

Coach Update should let a candidate see how the coach reached a useful observation without turning practice into a score. The candidate's submitted answer is the evidence canvas. Exact excerpts may be annotated when the system can do so predictably and safely. Whole-answer observations and missing expected signals remain useful even when no excerpt can or should be highlighted.

The governing rule is:

> Evaluate broadly, annotate narrowly, and fail quietly.

Evaluation validity does not depend on candidate-visible annotation eligibility. If an annotation cannot be admitted, the accepted answer, candidate-safe coaching, and follow-up actions still render.

## Non-Goals

- No score, readiness percentage, pass/fail state, rank, or hidden-band color treatment.
- No invented inline insertion point for absent evidence.
- No provider-authored HTML, CSS class, display label, or tooltip behavior.
- No new evaluator or annotation-verifier model call in the first implementation slice.
- No exposure of internal criterion bands, reason codes, sensitive-content categories, or technical conclusions without the required trusted reference.
- No requirement that every accepted evaluator signal become a visible annotation.

## Three Evidence Bases

Every candidate-visible indicator has one explicit evidence basis.

```ts
type CandidateSignalBasis =
    | { kind: "span"; spanIds: string[] }
    | { kind: "whole_answer"; signalId: string }
    | { kind: "missing_expected_signal"; signalId: string };
```

### Span Evidence

The answer contains identifiable text supporting an accepted observation. A span carries an exact quote and zero-based UTF-16 code-unit offsets into the immutable submitted answer. One range may support multiple markers or claims, and ranges may overlap.

### Whole-Answer Evidence

The signal applies to the response as a whole rather than one excerpt. Examples include a very short response, an off-topic response, an unclear transcription, or a privacy-safe professional reframe. These indicators belong beside the transcript and must not be attached to an arbitrary phrase.

### Missing Expected Signal

The question lens expected a signal that was not observed. The signal has no span by definition. It may produce one prioritized pattern-gap callout and suggested answer shape. `not_elicited`, `not_applicable`, `insufficient_data`, `unscoreable`, and `technicalAccuracy: not_assessed` are not candidate deficiencies and must not be presented as missing evidence.

## Source Fact Ontology

The existing evidence-first evaluator remains authoritative for machine-readable facts.

### Span-Capable Evidence Markers

`direct_answer`, `context`, `example`, `specific_detail`, `personal_action`, `outcome`, `tradeoff`, `role_skill_signal`, `takeaway`, `reasoning`, `problem_framing`, `priority`, `recommendation`, `next_step`, `learning`, `role_connection`, `stakeholder_awareness`, `practical_application`, `motivation`, `self_awareness`, `logistics`, and `professional_boundary`.

### Whole-Answer Markers

`answeredQuestion`, `hasDirectAnswer`, `hasExample`, `hasSpecificDetails`, `hasPersonalAction`, `hasOutcomeOrTakeaway`, `hasTradeoffOrConstraint`, `hasRoleRelevantSkillSignal`, `isOverlyLong`, and `isVeryShort`, plus answer-usability and technical-reference posture.

### Category Signals

- Behavioral: context, personal action, result, learning, constraint.
- Technical / role-specific: direct technical answer, correct concept, reasoning, practical application, tradeoff.
- Scenario: problem framing, priority, stakeholder awareness, tradeoff, recommendation, next step.
- Culture / fit: motivation, specific example, role connection, self-awareness, growth orientation, constructive framing.
- Screening: role connection, next-step readiness, logistics clarity, professional boundary.

Category signals retain `observed`, `not_observed`, `not_applicable`, and `unscoreable` semantics. The first canvas slice does not change evaluator appraisal behavior. It separates annotation admission from that behavior.

## Candidate-Safe Projection

New Coach Update artifacts may carry one optional transcript-canvas projection per practiced question. Existing V2 development artifacts without this projection continue to render the plain transcript and coaching fallback.

```ts
type CandidateTranscriptCanvasProjection = {
    status: "candidate_transcript_canvas_v1";
    answerAttemptId: string;
    evaluationRunId: string;
    inputFingerprint: string;
    transcriptFingerprint: string;
    annotations: CandidateTranscriptAnnotation[];
    wholeAnswerIndicators: CandidateWholeAnswerIndicator[];
    primaryGap: CandidateTranscriptGap | null;
};

type CandidateTranscriptAnnotation = {
    id: string;
    quote: string;
    start: number;
    end: number;
    basis: { kind: "span"; spanIds: string[] };
    markerIds: string[];
    indicators: Array<{
        kind: "acknowledgement" | "primary_strength";
        label: string;
        message: string;
    }>;
};

type CandidateWholeAnswerIndicator = {
    id: string;
    basis: { kind: "whole_answer"; signalId: string };
    label: string;
    message: string;
};

type CandidateTranscriptGap = {
    id: string;
    basis: { kind: "missing_expected_signal"; signalId: string };
    label: "Try next";
    message: string;
    suggestedShape: string[];
};
```

The projection is derived from one accepted evaluator run and one immutable answer attempt. It is not generated independently by Coach Update synthesis.

## Annotation Admission

A span is candidate-visible only when every applicable rule passes:

1. The evaluator run is completed and accepted.
2. The run, answer attempt, input fingerprint, and displayed answer refer to the same immutable submission.
3. `answer.slice(start, end) === quote`.
4. The quote has one exact occurrence in the answer. Ambiguous repeated quotes are omitted until the extractor provides a disambiguating anchor contract.
5. The marker is in the evaluator's fixed ontology.
6. The span is cited by accepted feedback `claimEvidence` as acknowledgement or primary-strength evidence. Uncited evaluator spans remain internal facts.
7. Referenced claim text comes from the accepted candidate-safe feedback projection.
8. Sensitive disclosure, unsafe inference, malformed evidence, stale fingerprints, and unknown references suppress annotation.

Annotation omission does not reject the evaluation or Coach Update artifact. It records no user-visible error and falls back to the unannotated transcript.

### Semantic Precision

Structural validation proves that quoted text exists; it does not independently prove that a model-assigned marker is semantically perfect. The first implementation therefore admits only claim-cited spans and uses fixed application-owned marker labels. A later annotation-verifier stage may broaden visible marker coverage after human-reviewed precision evidence justifies it.

## Exact-Range And Overlap Rules

- Offsets use JavaScript/Node UTF-16 code units and are tied to the exact immutable answer string.
- Presentation code never recomputes an admitted range using `indexOf`.
- Duplicate-quote detection may omit an otherwise structurally valid span from the candidate projection.
- Ranges may overlap or share identical boundaries.
- Rendering splits the answer at every unique start/end boundary.
- Each rendered segment carries all active annotations covering that interval.
- Adjacent segments with the same annotation set may be merged.
- Invalid, out-of-bounds, or zero-length ranges are omitted from the candidate projection.

This prevents duplicate text, dropped annotations, and character-index collisions.

## Whole-Answer Indicators

The first projection may expose only a small application-owned allowlist:

- Very short answer: more support is needed before a useful pattern can be seen.
- Overly long answer: the main point may be hard to place.
- Off-topic or non-answer: answer the question directly before adding support.
- Unclear transcription: capture a clear answer before evaluating content.
- Sensitive disclosure: use the accepted professional-reframe message without naming the sensitive category or highlighting the disclosed text.

Generic booleans such as `answeredQuestion` are not automatically useful candidate UI and remain internal. A signal may inform evaluation without receiving a visible indicator.

## Missing Signals And Pattern Gaps

Only the accepted deterministic `patternGap` becomes the primary missing-signal callout. It appears below or beside the transcript, never inserted at a fabricated character position.

- `reinforce_effective_pattern` is supportive feedforward, not a warning.
- Missing category evidence may be shown only when the question category expected it.
- `not_elicited`, `not_applicable`, `insufficient_data`, and `unscoreable` never become negative gap language.
- Technical contradiction requires a trusted versioned technical reference and accepted supporting evidence.
- `technicalAccuracy: not_assessed` produces no deficiency indicator.

## Sensitive And Unsafe Content

- Sensitive answers render as the candidate's own transcript but receive no inline annotation.
- Candidate-visible content must not name or infer a protected trait.
- Privacy-safe professional reframe guidance may appear as a whole-answer indicator.
- Unsafe-inference or unsupported-evidence evaluator runs remain terminal without candidate feedback and cannot produce a canvas projection.
- Canvas data is never placed in URLs, client logs, analytics events, or error text.

## Interaction And Accessibility

- Transcript text remains selectable.
- An annotation is keyboard focusable and opens on click, Enter, Space, or pointer tap; hover is enhancement only.
- The popover names the fixed evidence label and accepted candidate-safe claim.
- The compact opened-dashboard presentation may rename the popover header to `What I noticed` and omit a repeated indicator label such as `Coach noticed`; it must not suppress or rewrite the accepted candidate-safe claim or fixed evidence-marker label.
- The compact presentation may reveal on mouse hover in addition to the required click, keyboard, and pointer-tap paths. Hover exit may dismiss only a hover-opened popover; it must not make a clicked or keyboard-opened popover unstable.
- Opening a new annotation closes the previous one. Escape closes it and returns focus to the trigger.
- Annotation meaning does not depend on color. Underline, background, label, and focus treatment work together.
- Focus mode may dim unannotated text only while a specific annotation is hovered or focused, never for the entire canvas by default.
- Non-current carousel slides remain hidden and their annotations are not tabbable.
- A screen reader can read the answer continuously without repeated or reordered text, then inspect an annotation's details.
- Whole-answer and missing-signal indicators are separate named regions.

## Lifecycle And Fallbacks

| State | Candidate behavior |
| --- | --- |
| No accepted evaluator run | Existing unavailable/pending Coach Update behavior; no canvas. |
| Accepted run, no admitted annotations | Plain selectable transcript plus accepted coaching. |
| Accepted annotations | Annotated transcript with accessible details. |
| Whole-answer signal only | Plain transcript plus answer-level note. |
| Missing expected signal | Plain or annotated transcript plus one adjacent gap callout. |
| Legacy V2 artifact | Plain transcript fallback; no invented regeneration during render. |
| Stale/malformed projection | Ignore projection and render plain transcript. |
| Sensitive disclosure | Plain transcript plus professional reframe; no inline highlights. |

## Scenario Matrix

The implementation and tests must cover:

- One unique exact span.
- Multiple non-overlapping spans.
- Identical and partially overlapping spans carrying different markers.
- Repeated quote text in different answer locations.
- Smart punctuation, emoji, and other surrogate-pair text under UTF-16 offsets.
- Leading/trailing whitespace retained in the immutable answer.
- Empty claim-evidence references with an otherwise accepted evaluation.
- Unknown span references and malformed/out-of-bounds ranges.
- Stale answer-attempt id, fingerprint, or transcript fingerprint.
- Very short, overly long, off-topic, non-answer, and unclear-transcription responses.
- Expected category signal absent versus signal not elicited or not applicable.
- Technical supported, contradicted, and not-assessed postures.
- Sensitive disclosure and forbidden-inference rejection.
- First attempt, in-session feedback retry, and later-session repeat practice.
- Existing artifact without canvas projection.
- Desktop, mobile, keyboard-only, touch, screen-reader reading order, and reduced-motion behavior.

## Acceptance Evidence

The slice is complete when:

- Projection tests prove the provenance, safety, ambiguity, fallback, and absence rules.
- Tokenizer tests prove exact text reconstruction with overlapping annotations and Unicode.
- Component tests prove keyboard/touch disclosure, selectable text, noncurrent-slide tab suppression, and plain-transcript fallback.
- Existing Coach Update, practice-now, queue, carousel, recovery, and ownership tests remain green.
- Real accepted fixture data produces at least one admitted annotation when claim evidence is available.
- Sensitive and ambiguous examples produce no inline annotation.
- Desktop and mobile browser checks show no overlap or horizontal overflow.

## Deferred Expansion

- A dedicated semantic annotation-verifier model stage.
- Provider-supplied unique quote anchors for repeated text.
- Candidate-visible coverage of accepted but uncited evidence markers.
- Precise inline insertion anchors for missing transitions.
- Voice-timestamp and photo-region annotations.
- Multi-round annotation comparisons and progress visualization.
