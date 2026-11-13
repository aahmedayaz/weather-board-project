---
description: Switch to dev, pull, and create a feat/<name> branch
argument-hint: <feature-name>
allowed-tools: Bash(git status:*), Bash(git switch:*), Bash(git pull:*), Bash(git branch:*), Bash(git rev-parse:*)
---

Start a new feature branch named from: `$ARGUMENTS`

1. If `$ARGUMENTS` is empty, stop and ask for a feature name.
2. Normalize the name: strip a leading `feat/` if present, lowercase it, and turn spaces/underscores into hyphens. It must match `^[a-z0-9]+(-[a-z0-9]+)*$`; otherwise stop and say why. The branch is `feat/<name>`.
3. Run `git status --porcelain -- . ':!PROMPTS.md'`. If there are uncommitted changes, stop and list them — do not stash or discard anything. `PROMPTS.md` is excluded: the prompt-log hook rewrites it on every prompt, and its changes simply carry over to the new branch.
4. If `feat/<name>` already exists locally (`git rev-parse --verify --quiet refs/heads/feat/<name>`), stop and say so.
5. `git switch dev`
6. `git pull --ff-only origin dev` — if it fails, stop and report the error.
7. `git switch -c feat/<name>`
8. Report the new branch and the commit it was cut from (`git rev-parse --short HEAD`).
