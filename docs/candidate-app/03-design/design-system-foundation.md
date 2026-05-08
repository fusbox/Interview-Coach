# Design System Foundation

Date: 2026-03-31
Status: Current truth

## Purpose

This document captures the small operational design system that ships with the initial scaffold.

## Principles

### Practical before expansive

The system should start with a few primitives that are easy to apply consistently:

- shell
- card
- navigation
- type hierarchy

### Semantic tokens, not page-specific colors

The initial token set is:

- `--background`
- `--surface`
- `--surface-alt`
- `--border`
- `--foreground`
- `--muted`
- `--primary`
- `--primary-soft`
- `--accent`

These tokens should be reused across features before new ones are introduced.

### One layout language across breakpoints

- desktop uses a persistent sidebar shell
- mobile uses a fixed dock
- cards and spacing should feel like one system, not separate mobile and desktop products

### Avoid premature component sprawl

Only promote a pattern into a reusable component when:

- it already appears in more than one place
- it meaningfully protects consistency
- its API is still obvious and small

## Implemented Primitives

### `SurfaceCard`

Used for:

- section framing
- content grouping
- placeholder modules

### `CandidateSidebar`

Used for:

- suite navigation
- interview-only nested navigation

### `CandidateMobileDock`

Used for:

- mobile route switching inside the interview module

## Typography Direction

- `Space Grotesk` for display moments
- `Manrope` for body and interface text

This is intentional and should be preserved unless the product chooses a new visual direction across the app.
