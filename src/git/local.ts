import type { Checkout, Commit, LocalState } from "../work";
import { loadLineStats } from "./files";
import { runGit } from "./run";
import { parseStatus } from "./status";
import { parseWorktreeList } from "./worktrees";

// `git worktree list` reports an unborn branch with an all-zero HEAD.
const UNBORN_OID = /^0+$/;

export async function listCheckouts(cwd: string): Promise<Checkout[]> {
  return parseWorktreeList(await runGit(cwd, ["worktree", "list", "--porcelain", "-z"]));
}

export async function loadLocalState(checkout: Checkout): Promise<LocalState> {
  const unborn = UNBORN_OID.test(checkout.head.oid);
  const [status, latestCommit, upstreamBranch, lineStats] = await Promise.all([
    runGit(checkout.path, [
      "--no-optional-locks",
      "status",
      "--porcelain=v2",
      "--branch",
      "-z",
    ]).then(parseStatus),
    unborn ? null : loadLatestCommit(checkout.path),
    checkout.head.kind === "branch" ? loadUpstreamBranch(checkout.path, checkout.head.name) : null,
    unborn ? null : loadLineStats(checkout.path),
  ]);
  return { ...status, latestCommit, upstreamBranch, lineStats };
}

async function loadUpstreamBranch(cwd: string, branch: string): Promise<string | null> {
  const out = await runGit(cwd, [
    "for-each-ref",
    "--format=%(upstream:remotename)%00%(upstream:remoteref)",
    `refs/heads/${branch}`,
  ]);
  return parseUpstreamBranch(out);
}

// A local upstream is reported with "." as its remote name.
export function parseUpstreamBranch(out: string): string | null {
  const [remote, ref] = out.trimEnd().split("\0");
  if (!remote || remote === "." || !ref?.startsWith("refs/heads/")) return null;
  return ref.slice("refs/heads/".length);
}

async function loadLatestCommit(cwd: string): Promise<Commit | null> {
  return parseLatestCommit(await runGit(cwd, ["log", "-1", "--format=%H%x00%s%x00%ct"]));
}

export function parseLatestCommit(out: string): Commit | null {
  const [oid, subject, committedAt] = out.trimEnd().split("\0");
  if (!oid || subject === undefined || !committedAt) return null;
  return { oid, subject, committedAt: new Date(Number(committedAt) * 1000) };
}
