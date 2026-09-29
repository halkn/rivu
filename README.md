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

## Usage

```sh
rivu [PATH]
```

The left pane lists the Works; the right pane shows the selected Work in three tabs:

- **Overview**: branch, upstream, local changes, latest commit, and the pull request with its checks, reviews and description
- **Files**: the checkout's files (without `.gitignore`d ones) with a source or Markdown preview
- **Changes**: changed files with their status and line counts

| Key                 | Action                                                            |
| ------------------- | ----------------------------------------------------------------- |
| `Tab`               | Move focus between the Works list and the tab                     |
| `1` / `2` / `3`     | Show Overview / Files / Changes                                   |
| `j` / `k`           | Move within the focused pane                                      |
| `Enter` / `l`, `h`  | Open / close a directory (Files); open the file in Hunk (Changes) |
| `Ctrl-d` / `Ctrl-u` | Scroll the preview or Overview                                    |
| `d`                 | Open the selected Work's changes in Hunk                          |
| `r`                 | Reload                                                            |
| `q`                 | Quit                                                              |

### Requirements

- `git`
- `gh`, authenticated, for pull request status. Without it, local state is still shown.
- `hunk`, for detailed diffs

## Development

`rivu` is built with OpenTUI + TypeScript + Bun ([ADR 0001](docs/adr/0001-tech-stack.md)).

```sh
bun install
bun run start .
bun test
bun run lint
bun run fmt
bun run typecheck
bun run build
```
