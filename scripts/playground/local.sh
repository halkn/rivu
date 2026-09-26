#!/usr/bin/env bash
# Builds a local-only repository whose worktrees cover the checkout states rivu displays.
# No network: "origin" is a bare repository next to the checkout.
#
# Usage: scripts/playground/local.sh [DIR]   (default: ${TMPDIR:-/tmp}/rivu-playground-local)
# Then:  bun run start DIR/repo
set -euo pipefail

dir="${1:-${TMPDIR:-/tmp}/rivu-playground-local}"
marker="$dir/.rivu-playground"

if [[ -e $dir ]]; then
  if [[ ! -e $marker ]]; then
    echo "refusing to overwrite $dir: it was not created by this script" >&2
    exit 1
  fi
  rm -rf "$dir"
fi
mkdir -p "$dir"
touch "$marker"

# Isolate from the user's git config (signing, hooks, default branch) so the result is reproducible.
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=playground GIT_AUTHOR_EMAIL=playground@example.com
export GIT_COMMITTER_NAME=playground GIT_COMMITTER_EMAIL=playground@example.com

repo="$dir/repo"
wt="$dir/wt"

commit() { # commit <worktree> <file> <content> <message>
  printf '%s\n' "$3" >"$1/$2"
  git -C "$1" add "$2"
  git -C "$1" commit -q -m "$4"
}

git init -q --bare -b main "$dir/origin.git"
git init -q -b main "$repo"
git -C "$repo" remote add origin "$dir/origin.git"
commit "$repo" README.md "shared line" "initial commit"
commit "$repo" notes.md "# Notes" "add notes"
git -C "$repo" push -q -u origin main

# Staged, unstaged and untracked changes, including a path with a space.
git -C "$repo" worktree add -q -b feat/dirty "$wt/dirty"
git -C "$wt/dirty" push -q -u origin feat/dirty
printf 'staged\n' >>"$wt/dirty/README.md"
git -C "$wt/dirty" add README.md
printf 'unstaged\n' >>"$wt/dirty/notes.md"
printf 'new\n' >"$wt/dirty/untracked file.txt"

# 1 commit ahead of and 2 behind its upstream.
git -C "$repo" worktree add -q -b feat/diverged "$wt/diverged"
commit "$wt/diverged" a.txt "remote 1" "remote commit 1"
commit "$wt/diverged" b.txt "remote 2" "remote commit 2"
git -C "$wt/diverged" push -q -u origin feat/diverged
git -C "$wt/diverged" reset -q --hard HEAD~2
commit "$wt/diverged" c.txt "local" "local commit"

# Never pushed.
git -C "$repo" worktree add -q -b feat/unpushed "$wt/unpushed"
commit "$wt/unpushed" d.txt "unpushed" "unpushed work"

# Merge in progress with a conflict.
git -C "$repo" worktree add -q -b feat/conflict "$wt/conflict"
commit "$wt/conflict" README.md "branch line" "change shared line on branch"
commit "$repo" README.md "main line" "change shared line on main"
git -C "$repo" push -q
git -C "$wt/conflict" merge -q main >/dev/null 2>&1 || true

# Commit subject with terminal escape sequences, which rivu must not pass through.
git -C "$repo" worktree add -q -b feat/escape "$wt/escape"
commit "$wt/escape" e.txt "escape" $'title \e]0;pwned\a with \e[31mred\e[0m escapes'

git -C "$repo" worktree add -q --detach "$wt/detached" HEAD~1

git -C "$repo" worktree add -q -b feat/locked "$wt/locked"
git -C "$repo" worktree lock --reason "on a removable disk" "$wt/locked"

# Prunable: the worktree directory is gone.
git -C "$repo" worktree add -q -b feat/gone "$wt/gone"
rm -rf "$wt/gone"

# A branch without any commit.
git -C "$repo" worktree add -q --orphan -b feat/unborn "$wt/unborn"

echo "created $repo"
echo "run: bun run start $repo"
