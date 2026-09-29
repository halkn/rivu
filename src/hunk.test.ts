import { expect, test } from "bun:test";
import { hunkArgs } from "./hunk";

test("compares against HEAD, optionally for one file", () => {
  expect(hunkArgs({ unborn: false })).toEqual(["diff", "HEAD"]);
  expect(hunkArgs({ unborn: false, path: "src/a b.ts" })).toEqual([
    "diff",
    "HEAD",
    "--",
    "src/a b.ts",
  ]);
});

test("a branch without commits has no HEAD to compare against", () => {
  expect(hunkArgs({ unborn: true, path: "a.ts" })).toEqual(["diff", "--", "a.ts"]);
});
