import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listCheckouts, loadLocalState } from "./local";

let base: string;
let main: string;

function git(cwd: string, ...args: string[]) {
  const result = Bun.spawnSync(
    ["git", "-c", "user.name=test", "-c", "user.email=test@example.com", ...args],
    { cwd },
  );
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
}

beforeAll(async () => {
  base = await realpath(await mkdtemp(join(tmpdir(), "rivu-local-")));
  main = join(base, "main");
  git(base, "init", "-q", "-b", "main", main);
  await writeFile(join(main, "a.txt"), "a\n");
  await writeFile(join(main, "b.txt"), "b\n");
  git(main, "add", ".");
  git(main, "commit", "-q", "-m", "first commit");
  git(main, "worktree", "add", "-q", "-b", "feat/x", join(base, "wt"));

  await writeFile(join(main, "a.txt"), "a2\n");
  git(main, "add", "a.txt");
  await writeFile(join(main, "b.txt"), "b2\n");
  await writeFile(join(main, "new.txt"), "new\n");
});

afterAll(async () => {
  await rm(base, { recursive: true, force: true });
});

describe("listCheckouts", () => {
  test("lists the main checkout and linked worktrees", async () => {
    const checkouts = await listCheckouts(main);
    expect(
      checkouts.map((c) => [c.path, c.isMain, c.head.kind === "branch" && c.head.name]),
    ).toEqual([
      [main, true, "main"],
      [join(base, "wt"), false, "feat/x"],
    ]);
  });
});

describe("loadLocalState", () => {
  test("reads changes and the latest commit", async () => {
    const [checkout] = await listCheckouts(main);
    const state = await loadLocalState(checkout!);
    expect(state.staged).toEqual([{ path: "a.txt", code: "M" }]);
    expect(state.unstaged).toEqual([{ path: "b.txt", code: "M" }]);
    expect(state.untracked).toEqual(["new.txt"]);
    expect(state.upstream).toBeNull();
    expect(state.upstreamBranch).toBeNull();
    expect(state.latestCommit?.subject).toBe("first commit");
    expect(state.latestCommit?.committedAt).toBeInstanceOf(Date);
    expect(state.lineStats).toEqual([
      { path: "a.txt", added: 1, deleted: 1 },
      { path: "b.txt", added: 1, deleted: 1 },
    ]);
  });

  test("a clean worktree has no changes", async () => {
    const [, worktree] = await listCheckouts(main);
    const state = await loadLocalState(worktree!);
    expect([state.staged, state.unstaged, state.untracked]).toEqual([[], [], []]);
  });

  test("upstreamBranch is the branch name on the remote, and null for a local upstream", async () => {
    const repo = join(base, "tracking");
    git(base, "init", "-q", "--bare", "-b", "main", join(base, "origin.git"));
    git(base, "init", "-q", "-b", "main", repo);
    git(repo, "commit", "-q", "--allow-empty", "-m", "init");
    git(repo, "remote", "add", "origin", join(base, "origin.git"));
    git(repo, "push", "-q", "-u", "origin", "main");
    git(repo, "push", "-q", "origin", "main:feat/remote-name");
    git(
      repo,
      "worktree",
      "add",
      "-q",
      "-b",
      "local-name",
      join(base, "remote-up"),
      "origin/feat/remote-name",
    );
    git(repo, "worktree", "add", "-q", "-b", "stacked", join(base, "local-up"));
    git(repo, "branch", "-q", "--set-upstream-to", "local-name", "stacked");

    const states = await Promise.all((await listCheckouts(repo)).map(loadLocalState));
    expect(states.map((state) => [state.upstream, state.upstreamBranch])).toEqual([
      ["origin/main", "main"],
      ["local-name", null],
      ["origin/feat/remote-name", "feat/remote-name"],
    ]);
  });

  test("a branch without commits has no latest commit", async () => {
    const empty = join(base, "empty");
    git(base, "init", "-q", "-b", "main", empty);
    const [checkout] = await listCheckouts(empty);
    const state = await loadLocalState(checkout!);
    expect(state.latestCommit).toBeNull();
    expect(state.lineStats).toBeNull();
  });
});
