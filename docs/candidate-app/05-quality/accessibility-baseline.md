# Accessibility Baseline

Date: 2026-05-07
Status: Working quality baseline

## Purpose

This document defines the minimum accessibility expectations for candidate-facing work.

The candidate app should be usable by keyboard, screen reader, and assistive technology users from the beginning rather than retrofitted late.

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

Before production pilot:

- browser smoke tests cover keyboard navigation for primary flows
- automated accessibility checks run on landing, practice, session, dashboard, and summary pages
- manual review validates focus order and screen-reader labels for critical paths

## Open Questions

- Which accessibility standard level is required by company policy?
- Should the app target WCAG 2.2 AA explicitly?
- Will candidate-facing flows require additional accommodations from RangamWorks accessibility standards?
