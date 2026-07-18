# Interview Coach Documentation

Status: Active index and documentation-migration ledger
Last updated: 2026-07-18

The current product direction is the candidate V2 cleanroom rebuild on `feature/candidate-v2-rebuild`, while the deployed recruiter-led application remains an important behavior reference. Active V2 docs currently live under `docs/candidate-app` and will be promoted to this level after the active set is thinned and all links are mapped.

## Active Context Stack

Read these first, in order:

1. [Candidate V2 handoff](./candidate-app/HANDOFF.md): current truth, phase progress, risks, and the next slice.
2. [Candidate V2 spec](./candidate-app/SPEC.md): product intent, user journeys, and non-goals.
3. [Candidate V2 data contract](./candidate-app/DATA_CONTRACT.md): durable vocabulary, state, persistence, and payload boundaries.
4. [Candidate docs index](./candidate-app/README.md): targeted architecture, quality, security, operations, and decision references.
5. [Local development bootstrap](./candidate-app/09-dev/local-dev-bootstrap.md): current database, environment, dev-launch, and validation commands.

The implementation and current tests outrank historical documentation when they conflict. Update the active contract or record a deliberate deferral instead of allowing silent drift.

## Documentation Lifecycle

| Label | Meaning |
| --- | --- |
| Active | Governs current implementation or immediate execution. |
| Supporting | Supplies detail for an active contract or release gate. |
| Transitional | Still useful, but should be consolidated or archived before promotion. |
| Historical | Behavior archaeology only; not current implementation instruction. |
| Local-only | Discovery/design output that must not be committed without review. |

## Reference Archives

- [Recruiter-led V1/shared app docs](./reference-archive/recruiter-v1/README.md): former top-level project, requirements, design, architecture, Postgres migration, and quality material.
- [Candidate V1/interim archive](./candidate-app/reference-archive/README.md): earlier candidate-module plans, contracts, SQL, and full handoff snapshots.
- [Accepted V2 rebuild plan](./superpowers/plans/2026-07-06-parallel-v2-rebuild.md): initial cleanroom sequence; current numbered execution lives in the handoff.

## Cleanup And Promotion Roadmap

### Wave 1: Completed In This Pass

- Compacted `HANDOFF.md` and archived its full Slice 85-133 ledger.
- Moved the former top-level recruiter-era `01-project` through `05-quality` tree intact under `reference-archive/recruiter-v1`.
- Reframed this index around the active candidate V2 stack.

### Wave 2: Thin `candidate-app`

Keep and eventually promote:

- `SPEC.md`, `DATA_CONTRACT.md`, `HANDOFF.md`, and a single root `README.md`;
- current setup/auth requirements;
- evidence-first dashboard, question-category, host-launch/prep-context, and V1-reference architecture contracts;
- evaluator/Coach Update contracts and live-validation runbooks;
- security/privacy, observability, incident, release, and local-dev instructions;
- ratified ADRs that still explain current architecture.

Consolidate before promotion:

- `REVIEWER-HANDOFF.md`, `START-WORK-PASS.md`, and `10-agent-workflows/workpass.md` into the root index, local bootstrap, and repository-local senior-pass skills;
- preparedness inventories/maps into `DATA_CONTRACT.md` plus the dashboard architecture contract;
- old dashboard briefs, disposable specs, and UX-contract fragments into the current design/product contracts;
- Azure integration notes and stale backlog mechanics into current ops/release documentation.

Archive after durable content is extracted:

- `00-working-backlog.md` and superseded sequence plans;
- pre-cleanroom candidate contracts and old route assumptions;
- superseded ADRs, one-off audits, obsolete mockups, and fixture-era implementation notes.

Security cleanup requiring an explicit pass:

- remove tracked staging CSV exports from the current tip after confirming no active contract depends on them;
- decide whether repository-history remediation is required for candidate/job discovery rows;
- keep future probe output ignored and local-only.

### Wave 3: Promote The Active Candidate Stack

After Wave 2 and classification of the current untracked design imports:

1. Move active `candidate-app/*` anchors and numbered subdirectories to `docs/*`.
2. Update repository, code-comment, Markdown, and runbook links in one mechanical change.
3. Add redirect/stub files only where external tooling or durable links require them.
4. Run the documentation link check before removing the now-empty `candidate-app` directory.

### Wave 4: Retire Residue

- Remove stale compatibility docs only after their code paths are retired or explicitly preserved.
- Keep dated milestone evidence in the reference archive rather than the active handoff.
- Review the active stack at each phase boundary and archive documents that no longer answer a live implementation or release question.

## Maintenance Rule

Every active document must have one clear job. If content belongs to product truth, durable data, immediate execution, a ratified decision, or an operational gate, put it in that governing document. Otherwise archive it or keep it local-only.
