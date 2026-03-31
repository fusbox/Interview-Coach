# Readiness Disposition Plan

Date: 2026-03-31
Status: Decision support document with implementation follow-up

## Purpose

This document captures the options for handling dormant readiness logic and documentation in the current recruiter-led app, now that recruiter-facing readiness is confirmed to be out of current product scope.

The goal is to preserve useful work without letting inactive concepts distort live product scope, architecture, or documentation.

---

## Current Situation

Confirmed reality:
- recruiter-facing readiness is out of scope for the live product
- some readiness-related fields and logic still exist in code and docs
- the existence of those artifacts is creating confusion about what the app currently promises

This creates three problems:
- documentation drift
- misleading architectural weight around inactive concepts
- hesitation to clean up because the work may still be useful later

---

## Options

## Option 1: Leave readiness in place but undocumented

Description:
- stop talking about readiness in current docs
- leave code and dormant fields as-is

Pros:
- lowest immediate code churn
- preserves everything for later

Cons:
- dormant concepts continue shaping the codebase implicitly
- future contributors will still trip over unexplained fields and paths
- easiest path to accidental re-exposure

Assessment:
- not recommended

---

## Option 2: Quarantine readiness as dormant internal capability

Description:
- remove readiness from current product/docs
- keep code only where it is low-risk and not user-facing
- clearly mark remaining code as dormant or future-use

Pros:
- preserves work
- clarifies current scope
- reduces accidental product leakage

Cons:
- still requires some cleanup effort
- dormant code can still age poorly if left unattended for too long

Assessment:
- good option if you want to preserve the concept without letting it drive the current app

---

## Option 3: Archive the concept and remove active code coupling

Description:
- move readiness semantics fully out of current docs
- remove or simplify readiness-specific code from live app paths
- preserve only a reference doc or external note for later reconsideration

Pros:
- maximum clarity in the live app
- lowest long-term confusion
- strongest boundary between current product and speculative future capability

Cons:
- highest short-term cleanup effort
- some prior implementation work is intentionally abandoned from the live codebase

Assessment:
- best option for product clarity if you do not expect recruiter readiness to return soon

---

## Option 4: Keep only low-cost primitives

Description:
- retain only generic internal fields/utilities that have non-readiness value
- remove recruiter-facing semantics, labels, and governance language

Pros:
- preserves some implementation investment
- avoids carrying the full feature concept

Cons:
- requires careful judgment about what is genuinely generic
- easy to accidentally keep too much

Assessment:
- strongest companion strategy to Option 2

---

## Recommendation

Recommended path: Option 2 plus Option 4.

Meaning:
- remove readiness from current scope docs and reading paths now
- mark readiness docs as inactive reference, not current contract
- keep only low-cost underlying primitives if they still help non-readiness flows
- plan a later code cleanup pass to isolate or remove remaining readiness-specific logic from live paths

This balances:
- product clarity
- preservation of prior work
- low regret if the concept returns later

---

## Proposed Execution Sequence

### Phase 1: Documentation cleanup

- remove readiness from current source-of-truth and release-reading paths
- relabel readiness docs as inactive reference
- make recruiter scope explicit in current docs

### Phase 2: Inventory live code coupling

- identify readiness-related fields, branches, and UI references
- separate user-facing exposure from passive stored fields
- decide what is generic enough to keep

### Phase 3: Code quarantine cleanup

- isolate dormant readiness logic behind clearly named internal boundaries
- remove unused recruiter-facing semantics from current flows
- update tests/types as needed

### Phase 4: Future reactivation only by explicit scope change

- no accidental revival through copy or hidden fields
- reactivation requires new requirements, docs, and implementation

---

## Immediate Next Step

The code inventory and initial cleanup have now been completed.

Current state:

- candidate-facing readiness wording has been removed from active UX and prompt framing
- dormant recruiter/dev readiness surfaces have been quarantined as internal-only tooling
- session-level readiness has been removed from the live app contract
- hidden per-answer readiness calibration remains intentionally available for downstream internal tooling

Next useful move:

- decide whether to genericize the remaining readiness-specific design tokens and badge variants, or leave them as low-priority cleanup
