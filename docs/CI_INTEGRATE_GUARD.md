# CI integration guard

Automates two manual checks on **integration pull requests** (and safe cache-bust checks on every PR).

## What runs in GitHub Actions

Workflow: [`.github/workflows/ci-integrate-guard.yml`](../.github/workflows/ci-integrate-guard.yml) (read-only: `contents: read`, `pull-requests: read`).

### 1. Cache-bust no-regression (every PR)

For each **HTML/JS file changed** in the PR (three-dot diff vs base):

- Find every `?v=` query on asset URLs in that file.
- Compare version on the PR head vs the same file on the base branch (`main` SHA in Actions).
- **Fail** if any shared asset path has a **lower** version on head (numeric segment-wise comparison, e.g. `26.10.13.1`).
- Equal or higher versions are allowed.
- Prints a table of regressions when any are found.

This catches downgrades vs **main** when main still had the higher number.

When the PR body includes an **`integrates`** block, check 1 also loads each listed source PR that touched the same HTML/JS file and requires head `?v=` to be **≥ the maximum** across **main and all those source heads** (per asset path). That catches the #209 pattern: main `v=20`, source `v=22`, integration head `v=20` → **fail** even though main-only compare passes.

### 2. Integration provenance (opt-in)

If the PR description contains a source-PR list, the job also compares file contents to those PR heads via the GitHub API.

**Format** (either works):

1. Fenced block tagged `integrates`, one `#NNN` per source PR:

   ` ```integrates ` → newline → `#182 #185 #201` → closing fence

2. Generic fence with an `integrates:` header line:

   ` ```text ` → `integrates: #182 #185` → closing fence

For each file changed in the integration PR:

- If no listed source PR touched that path → **warning**
- If content at integration head does not exactly match the head of any source PR that touched it → **warning**

Provenance mismatches are **warnings only**. The job still **fails only** on cache-bust regressions from check 1.

**Limitations**

- Text files only; binary paths are skipped when content cannot be fetched.
- Renames, conflict resolutions, and edits after cherry-pick may differ from a single source PR head without being wrong.
- Does not reconstruct a three-way merge; exact match to at least one source PR head is the heuristic.
- Requires `GITHUB_TOKEN` (provided in Actions). Local provenance needs `GITHUB_TOKEN` or `GH_TOKEN` with read access to the repo.

## Run locally (agents / before opening a PR)

From the repository root (full git history recommended):

```bash
# Compare integration branch to main
node tools/ci-integrate-guard/run.js --base origin/main --head cursor/your-integration-branch

# Or explicit SHAs
node tools/ci-integrate-guard/run.js --base origin/main --head da1e0fe

# Unit tests
node --test tools/ci-integrate-guard/test/version.test.js
```

Provenance locally: save a `pull_request` event JSON or use Actions; provenance runs when `--event` is passed and the body includes an `integrates` block.

`--skip-provenance` runs only the cache-bust check.

## Example regression output

```
CACHE-BUST VERSION REGRESSIONS (head lower than base):
File                              Asset                                    Base ?v=  Head ?v=
--------------------------------  ---------------------------------------  --------  --------
modules/accounting/ledger_history.html  ../../shared/js/accounting_lightbox.js  22        20
```

## Related

- Product cache-bust comments in HTML often document why a version was bumped; keep those in sync when merging integration branches.
