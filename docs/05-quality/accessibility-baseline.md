# Accessibility Baseline

Date: 2026-07-19
Status: Ratified candidate quality baseline

## Purpose

This document defines the minimum accessibility expectations for candidate-facing work.

The candidate app should be usable by keyboard, screen reader, and assistive technology users from the beginning rather than retrofitted late.

## Conformance Target

Candidate-facing production routes target WCAG 2.2 Level AA. Level AA includes all applicable Level A and Level AA success criteria across each responsive variation of a full page.

Automated checks are a regression gate, not a conformance claim. Browser automation cannot establish every semantic, cognitive, motion, screen-reader, zoom, or real-device outcome, so release acceptance also requires the manual checks below.

## Baseline Requirements

### Keyboard

- all interactive controls are keyboard reachable
- visible focus states are present
- focus order matches visual and workflow order
- modals, drawers, and future upload/capture flows manage focus intentionally

### Semantics

- form controls have labels
- validation errors are associated with their fields
- buttons and links use the correct element for the action
- page headings follow a useful hierarchy

### Visual Design

- text and control contrast should meet WCAG AA targets
- text should not overlap or clip at supported viewport sizes
- UI should support browser zoom
- icon-only controls need accessible labels or tooltips

### Motion And Timing

- essential loading states are announced visually and textually
- no critical action depends on a short timer
- future animations should respect reduced-motion preferences where practical

### Media And Capture

- future voice, camera, upload, and OCR flows need non-camera/non-voice alternatives
- errors should be recoverable without restarting the entire setup flow

## Test Expectations

Current automated baseline:

- `src/test/accessibility.ts` checks one main landmark, one page h1, image alt attributes, and accessible names for links, buttons, and form controls
- landing route smoke applies the baseline to `/`
- component tests apply the baseline to practice setup, candidate session, dashboard, and summary surfaces
- the candidate-led demonstration smoke checks setup and dashboard at `1440x900` and `390x844` for one main landmark, one H1, accessible interactive names, image alternatives, horizontal overflow, and browser/runtime errors
- staged feedback and Coach Update tests cover intentional focus movement, named carousel/slide regions, hidden inactive content, and removal of inactive controls from the tab order
- the deterministic candidate browser journey runs `@axe-core/playwright` against setup, the practice landing, live practice, dashboard, Coach Update, and the unavailable-coaching fallback using WCAG 2.2 A/AA rule tags

Before production pilot:

- browser smoke tests cover keyboard navigation for primary flows
- automated accessibility checks are green on public landing, practice setup, practice landing, session, dashboard, Coach Update, and applicable failure states
- manual review validates focus order and screen-reader labels for critical paths
- manual review validates keyboard-only completion, 200% and 400% zoom/reflow, reduced motion, Windows high-contrast behavior, and representative screen-reader announcements
- unresolved accessibility defects have an owner, severity, user impact, and release disposition

## External Alignment To Confirm

- whether TalentArbor or RangamWorks policy imposes requirements beyond WCAG 2.2 Level AA
- which browser, device, and assistive-technology combinations the pilot formally supports

Reference: [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/).
