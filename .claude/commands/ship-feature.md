---
description: Verify, push the current feature branch, and open a PR into dev
argument-hint: [optional PR title]
allowed-tools: Bash(npm run verify:*), Bash(git status:*), Bash(git branch:*), Bash(git log:*), Bash(git add PROMPTS.md), Bash(git commit:*), Bash(git push:*), Bash(gh pr create:*), Bash(gh pr view:*)
---

Ship the current feature branch as a PR into `dev`.

1. Get the branch with `git branch --show-current`. If it does not start with `feat/`, stop — never ship from `dev` or `main`.
2. Run `git status --porcelain -- . ':!PROMPTS.md'`. If there are uncommitted changes, stop and list them. If only `PROMPTS.md` changed (the prompt-log hook rewrites it on every prompt), commit it as `docs: update prompt log` so the log ships with the feature.
3. Run `npm run verify` (lint, typecheck, tests, build, e2e). If anything fails, stop, show the failing output, and do not push.
4. `git push -u origin HEAD`
5. If a PR already exists for this branch (`gh pr view --json url`), report its URL and stop.
6. Open the PR:
   - Title: `$ARGUMENTS` if given, otherwise a Conventional Commits title summarizing `git log --oneline origin/dev..HEAD`.
   - Body: a short summary of the change, the commit list, and a checklist confirming the definition of done from CLAUDE.md (lint, typecheck, tests, build, e2e) passed.
   - `gh pr create --base dev --head <branch> --title "<title>" --body "<body>"`
7. Report the PR URL.
