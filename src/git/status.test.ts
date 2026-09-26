import { describe, expect, test } from "bun:test";
import { parseStatus } from "./status";

const H = "0".repeat(40);

function entries(...lines: string[]): string {
  return lines.map((line) => `${line}\0`).join("");
}

describe("parseStatus", () => {
  test("clean branch with upstream", () => {
    const out = entries(
      `# branch.oid ${H}`,
      "# branch.head main",
      "# branch.upstream origin/main",
      "# branch.ab +2 -1",
    );
    expect(parseStatus(out)).toEqual({
      upstream: "origin/main",
      aheadBehind: { ahead: 2, behind: 1 },
      staged: [],
      unstaged: [],
      untracked: [],
      conflicted: [],
    });
  });

  test("no upstream means ahead/behind is unknown", () => {
    const out = entries(`# branch.oid ${H}`, "# branch.head feat/x");
    expect(parseStatus(out)).toMatchObject({ upstream: null, aheadBehind: null });
  });

  test("upstream whose commit is missing has no ahead/behind", () => {
    const out = entries("# branch.head feat/x", "# branch.upstream origin/feat/x");
    expect(parseStatus(out)).toMatchObject({ upstream: "origin/feat/x", aheadBehind: null });
  });

  test("splits staged and unstaged sides of ordinary entries", () => {
    const out = entries(
      `1 M. N... 100644 100644 100644 ${H} ${H} src/staged.ts`,
      `1 .M N... 100644 100644 100644 ${H} ${H} src/unstaged.ts`,
      `1 MM N... 100644 100644 100644 ${H} ${H} src/both.ts`,
      `1 A. N... 000000 100644 100644 ${H} ${H} path with space.md`,
    );
    const status = parseStatus(out);
    expect(status.staged).toEqual([
      { path: "src/staged.ts", code: "M" },
      { path: "src/both.ts", code: "M" },
      { path: "path with space.md", code: "A" },
    ]);
    expect(status.unstaged).toEqual([
      { path: "src/unstaged.ts", code: "M" },
      { path: "src/both.ts", code: "M" },
    ]);
  });

  test("renamed entries consume the NUL-separated original path", () => {
    const out = entries(
      `2 R. N... 100644 100644 100644 ${H} ${H} R100 new.ts`,
      "old.ts",
      "? untracked.txt",
    );
    const status = parseStatus(out);
    expect(status.staged).toEqual([{ path: "new.ts", code: "R", origPath: "old.ts" }]);
    expect(status.untracked).toEqual(["untracked.txt"]);
  });

  test("unmerged entries are conflicts", () => {
    const out = entries(`u UU N... 100644 100644 100644 100644 ${H} ${H} ${H} conflict.ts`);
    expect(parseStatus(out)).toMatchObject({
      conflicted: ["conflict.ts"],
      staged: [],
      unstaged: [],
    });
  });

  test("unknown headers are ignored", () => {
    const out = entries("# stash 3", "# branch.head main");
    expect(parseStatus(out).untracked).toEqual([]);
  });
});
