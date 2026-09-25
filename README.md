# rivu

`rivu` is a terminal UI for understanding what is happening across a Git repository.

It brings together local checkout state and related pull request status so that parallel work can be understood from one place.

```text
Repository
├─ main
│  └─ clean
├─ feat/parser
│  ├─ 4 files changed
│  └─ PR #84 · CI passed · Approved
└─ fix/image
   ├─ 2 files changed
   └─ PR #91 · Checks failed
```

## What rivu does

`rivu .` opens the current repository and lets you inspect:

- main checkout and Git worktrees
- branch and local Git status
- ahead / behind state
- related pull request
- CI / review / merge status
- files in each checkout
- source code and Markdown previews
- changed files

A worktree and the pull request associated with its branch are presented together as one **Work**.

## What rivu does not do

`rivu` is primarily read-oriented.

It does not aim to replace:

- `wk` for creating, switching, and removing worktrees
- Hunk for detailed diff review
- `mdvu` for focused Markdown reading
- Git clients for commit, push, merge, or rebase
- editors or terminal multiplexers

Issue / Work Item integration is not part of the initial scope.

## Initial scope

The first version should establish one complete workflow:

1. Open a Git repository with `rivu .`
1. Discover the main checkout and worktrees
1. Show the Git state of each checkout
1. Match a checkout branch with its pull request
1. Show PR, CI, and review status
1. Browse files in the selected checkout
1. Preview source code and Markdown
1. Hand detailed diffs off to Hunk

## Development

`rivu` is built with OpenTUI + TypeScript + Bun ([ADR 0001](docs/adr/0001-tech-stack.md)).

```sh
mise install
bun install
bun run start .
bun test
bun run lint
bun run fmt
bun run typecheck
bun run build
```
