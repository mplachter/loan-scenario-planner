---
description: Run local CI checks and open a GitHub PR for the current work
---

Open a pull request for the current changes, running the full local CI suite first. Follow these steps in order and stop to report if any step fails — do not skip a failing check to get to the PR.

## 1. Branch check

Run `git status` and `git branch --show-current`.

- If the current branch is `main`, you must not commit or push directly to it. Look at the staged/unstaged diff and recent changes to infer a short, descriptive `kebab-case` branch name (e.g. `fix-refi-schedule-rounding`, `add-utility-cost-tab`). Propose it to the user, then create and check out the branch with `git checkout -b <name>`.
- If already on a feature branch, continue using it.

## 2. Commit any pending work

If there are uncommitted changes relevant to this PR, stage the specific files (never `git add -A`) and commit with a message describing the "why", following this repo's existing commit style (see `git log` for tone — short, lowercase-friendly, no fluff). Do not commit unrelated or stray files. Confirm with the user before committing if it's unclear whether all pending changes belong in this PR.

## 3. Run local CI, matching CLAUDE.md's bar exactly

Run each of these from the repo root, in order, stopping to fix and re-run on any failure before moving to the next:

1. `npm run format:check` — if it fails, run `npm run format` and re-check the diff it produces before committing the formatting fix.
2. `npm run typecheck`
3. `npm run lint`
4. `npm run test`
5. `npm run build`

All five must be green — CI has no "warnings only" tier. If you fix issues along the way, amend/add commits as appropriate (new commits, not `--amend`, unless the user asks otherwise).

## 4. Push the branch

Push with `git push -u origin <branch>` (only after checks are green and changes are committed).

## 5. Open the PR

- Check for a PR template: look for `pull_request_template.md` or `.github/PULL_REQUEST_TEMPLATE/` in the repo, and use it to structure the description if present.
- Use `gh pr create` (preferred, since this repo has a GitHub remote already configured) with:
  - A concise title (under 70 chars) describing the change.
  - A body with a `## Summary` (1-3 bullets on the why) and a `## Test plan` checklist reflecting the checks actually run in step 3 (format, typecheck, lint, test, build — mark them done).
  - Do not add a Claude Code footer unless the repo's existing PRs show that convention (check `gh pr list` history if unsure) — otherwise keep it plain.
- Report the PR URL back to the user when done.

## Notes

- Never force-push, never skip hooks, never use `--no-verify`.
- If any CI step can't be made to pass without a decision only the user can make (e.g. a genuine test failure requiring a design choice), stop and ask rather than guessing.
