import { describe, expect, test } from "bun:test";
import { parseWorktreeList } from "./worktrees";

const OID_A = "a".repeat(40);
const OID_B = "b".repeat(40);
const OID_C = "c".repeat(40);

function porcelain(...records: string[][]): string {
  return records.map((lines) => lines.map((line) => `${line}\0`).join("") + "\0").join("");
}

describe("parseWorktreeList", () => {
  test("main checkout first, then linked worktrees", () => {
    const out = porcelain(
      ["worktree /repo", `HEAD ${OID_A}`, "branch refs/heads/main"],
      ["worktree /repo-wt/feat", `HEAD ${OID_B}`, "branch refs/heads/feat/parser"],
    );
    expect(parseWorktreeList(out)).toEqual([
      {
        path: "/repo",
        isMain: true,
        head: { kind: "branch", name: "main", oid: OID_A },
        locked: false,
        prunable: false,
      },
      {
        path: "/repo-wt/feat",
        isMain: false,
        head: { kind: "branch", name: "feat/parser", oid: OID_B },
        locked: false,
        prunable: false,
      },
    ]);
  });

  test("detached, locked with reason and prunable worktrees", () => {
    const out = porcelain(
      ["worktree /repo", `HEAD ${OID_A}`, "branch refs/heads/main"],
      ["worktree /wt/detached", `HEAD ${OID_B}`, "detached", "locked reason\nwith newline"],
      [
        "worktree /wt/gone",
        `HEAD ${OID_C}`,
        "detached",
        "prunable gitdir file points to non-existent location",
      ],
    );
    const [, detached, gone] = parseWorktreeList(out);
    expect(detached).toMatchObject({ head: { kind: "detached", oid: OID_B }, locked: true });
    expect(gone).toMatchObject({ path: "/wt/gone", prunable: true });
  });

  test("a bare main repository is not a checkout", () => {
    const out = porcelain(
      ["worktree /repo.git", "bare"],
      ["worktree /wt/main", `HEAD ${OID_A}`, "branch refs/heads/main"],
    );
    expect(parseWorktreeList(out)).toEqual([
      {
        path: "/wt/main",
        isMain: false,
        head: { kind: "branch", name: "main", oid: OID_A },
        locked: false,
        prunable: false,
      },
    ]);
  });

  test("paths keep spaces and unknown attributes are ignored", () => {
    const out = porcelain([
      "worktree /my repo",
      `HEAD ${OID_A}`,
      "branch refs/heads/main",
      "future-attr x",
    ]);
    expect(parseWorktreeList(out)[0]?.path).toBe("/my repo");
  });
});
