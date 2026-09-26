import type { Checkout, Commit, LocalState } from "../work";
import { runGit } from "./run";
import { parseStatus } from "./status";
import { parseWorktreeList } from "./worktrees";

// `git worktree list` reports an unborn branch with an all-zero HEAD.
const UNBORN_OID = /^0+$/;

export async function listCheckouts(cwd: string): Promise<Checkout[]> {
  return parseWorktreeList(await runGit(cwd, ["worktree", "list", "--porcelain", "-z"]));
}

export async function loadLocalState(checkout: Checkout): Promise<LocalState> {
  const [status, latestCommit] = await Promise.all([
    runGit(checkout.path, [
      "--no-optional-locks",
      "status",
      "--porcelain=v2",
      "--branch",
      "-z",
    ]).then(parseStatus),
    UNBORN_OID.test(checkout.head.oid) ? null : loadLatestCommit(checkout.path),
  ]);
  return { ...status, latestCommit };
}

async function loadLatestCommit(cwd: string): Promise<Commit | null> {
  return parseLatestCommit(await runGit(cwd, ["log", "-1", "--format=%H%x00%s%x00%ct"]));
}

export function parseLatestCommit(out: string): Commit | null {
  const [oid, subject, committedAt] = out.trimEnd().split("\0");
  if (!oid || subject === undefined || !committedAt) return null;
  return { oid, subject, committedAt: new Date(Number(committedAt) * 1000) };
}
