#!/usr/bin/env bash
# Fills an empty GitHub repository with branches and pull requests in the states rivu displays,
# and checks each branch out as a worktree.
#
# Usage:
#   gh repo create OWNER/rivu-playground --private
#   scripts/playground/github.sh OWNER/rivu-playground [DIR]   (default: ${TMPDIR:-/tmp}/rivu-playground-github)
#   bun run start DIR/repo
#
# Writes to GitHub: pushes branches, opens PRs, merges one and closes one, and sets a commit status.
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 OWNER/REPO [DIR]" >&2
  exit 2
fi
slug="$1"
dir="${2:-${TMPDIR:-/tmp}/rivu-playground-github}"
marker="$dir/.rivu-playground"
repo="$dir/repo"
wt="$dir/wt"

if ! branches="$(gh api "repos/$slug/branches" --jq length)"; then
  echo "could not read $slug; create it first with: gh repo create $slug --private" >&2
  exit 1
fi
if [[ $branches != 0 ]]; then
  echo "refusing to use $slug: it already has branches" >&2
  exit 1
fi
if [[ -e $dir ]]; then
  if [[ ! -e $marker ]]; then
    echo "refusing to overwrite $dir: it was not created by this script" >&2
    exit 1
  fi
  rm -rf "$dir"
fi
mkdir -p "$dir"
touch "$marker"

gh repo clone "$slug" "$repo" -- -q
git -C "$repo" symbolic-ref HEAD refs/heads/main

commit() { # commit <worktree> <file> <content> <message>
  mkdir -p "$(dirname "$1/$2")"
  printf '%s\n' "$3" >"$1/$2"
  git -C "$1" add "$2"
  git -C "$1" commit -q -m "$4"
}

pr() { # pr <branch> <title> [gh pr create flags...]
  local branch="$1" title="$2"
  shift 2
  gh pr create -R "$slug" --head "$branch" --base main --title "$title" --body "rivu playground" "$@"
}

branch() { # branch <name>: creates a worktree for a new branch off main with one commit and pushes it
  git -C "$repo" worktree add -q -b "$1" "$wt/${1//\//-}" main
  commit "$wt/${1//\//-}" "${1//\//-}.txt" "$1" "work on $1"
  git -C "$wt/${1//\//-}" push -q -u origin "$1"
}

commit "$repo" README.md "shared line" "initial commit"
commit "$repo" .github/workflows/ci.yml 'name: playground
on:
  pull_request:
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Fail on ci/fail branches
        env:
          HEAD_REF: ${{ github.head_ref }}
        run: |
          case "$HEAD_REF" in
            ci/fail*) echo "failing on purpose"; exit 1 ;;
          esac' "add playground CI"
git -C "$repo" push -q -u origin main

branch feat/ci-pass
pr feat/ci-pass "CI passes"

branch ci/fail
pr ci/fail "CI fails"

branch feat/pending
pr feat/pending "Commit status stays pending"
gh api -X POST "repos/$slug/statuses/$(git -C "$wt/feat-pending" rev-parse HEAD)" \
  -f state=pending -f context=playground/pending -f description="never finishes" >/dev/null

branch feat/draft
pr feat/draft "Draft" --draft

git -C "$repo" worktree add -q -b feat/conflict "$wt/feat-conflict" main
commit "$wt/feat-conflict" README.md "branch line" "change shared line on branch"
git -C "$wt/feat-conflict" push -q -u origin feat/conflict
pr feat/conflict "Conflicts with main"

branch feat/merged
pr feat/merged "Already merged"
gh pr merge -R "$slug" feat/merged --merge

branch feat/closed
pr feat/closed "Closed without merging"
gh pr close -R "$slug" feat/closed

# The local branch name differs from the PR's head branch.
git -C "$repo" worktree add -q -b feat/local-name "$wt/feat-local-name" main
commit "$wt/feat-local-name" local-name.txt "local" "work under a different local name"
git -C "$wt/feat-local-name" push -q -u origin feat/local-name:feat/remote-name
pr feat/remote-name "Head branch differs from the local branch"

branch feat/no-pr

# Advance main so that feat/conflict conflicts and the other branches fall behind.
git -C "$repo" pull -q --ff-only
commit "$repo" README.md "main line" "change shared line on main"
git -C "$repo" push -q

cat <<EOF
created $repo
run: bun run start $repo

Review states need manual setup:
- REVIEW_REQUIRED: require pull request reviews for main in the repository's branch protection or rulesets.
- APPROVED / CHANGES_REQUESTED: review a PR from another account (you cannot review your own PR).
EOF
