import { describe, expect, test } from "bun:test";
import { parseLsFiles, parseNumstat } from "./files";

describe("parseNumstat", () => {
  test("text, binary and renamed files from `git diff --numstat -z`", () => {
    const out = "-\t-\tbin.dat\x001\t0\t\x00old.txt\x00new.txt\x001\t1\tsp ace.txt\x00";
    expect(parseNumstat(out)).toEqual([
      { path: "bin.dat", added: null, deleted: null },
      { path: "new.txt", added: 1, deleted: 0 },
      { path: "sp ace.txt", added: 1, deleted: 1 },
    ]);
  });

  test("no changes", () => {
    expect(parseNumstat("")).toEqual([]);
  });
});

describe("parseLsFiles", () => {
  test("sorted unique paths from `git ls-files -z`", () => {
    // A file that is both tracked and deleted from the worktree may be listed twice.
    expect(parseLsFiles("src/b.ts\x00README.md\x00src/a.ts\x00README.md\x00")).toEqual([
      "README.md",
      "src/a.ts",
      "src/b.ts",
    ]);
  });
});
