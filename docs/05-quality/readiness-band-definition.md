# Readiness Band Definition

Status: Inactive reference for a future recruiter-facing interpretation model

## Current Scope Note

Recruiter-facing readiness is not part of the active product scope for the live recruiter-led app in this repo.

This document is being retained only as a reference artifact for possible future use. It must not be treated as:
- a current release gate
- an active recruiter UX contract
- a source of truth for the live dashboard

Current recruiter scope is operational tracking plus raw answer evidence, not recruiter-facing readiness interpretation.

Authoritative current scope references:
- `docs/02-requirements/user-stories.md`
- `docs/05-quality/readiness-disposition-plan_2026-03-31.md`

---

## Why This Still Exists

This document captures a prior model for how recruiter-facing readiness could be framed if the product later reintroduces that capability.

Keeping it as an inactive reference preserves:
- prior product thinking
- language and exclusion constraints
- potential future semantics

without forcing the live app to pretend this feature is currently active.

---

## Preserved Future-State Concept

If recruiter-facing readiness is ever reintroduced, the intended goals were:
- preparation-focused, not evaluative
- human-readable, not numeric
- stable across model and UI changes
- conservative under ambiguity
- explicitly not a hiring recommendation

Any future reactivation should happen only if:
- recruiter product scope changes intentionally
- current requirements and dashboards are updated
- docs are promoted back from inactive reference to live contract
- implementation and QA coverage are added to support it

---

## Reactivation Rule

Do not revive this concept by reusing dormant fields or copy in the UI casually.

Reactivation requires:
- a documented scope decision
- updated requirements
- updated architecture and QA docs
- explicit implementation work

Until then, this document is reference-only.
