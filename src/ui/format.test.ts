import { describe, expect, test } from "bun:test";
import type { Checkout, LocalState, Work } from "../work";
import { changedFileCount, headLabel, relativeTime, workSummary } from "./format";

const OID = "1234567890abcdef1234567890abcdef12345678";

const checkout: Checkout = {
  path: "/wt/feat",
  isMain: false,
  head: { kind: "branch", name: "feat/parser", oid: OID },
  locked: false,
  prunable: false,
};

const clean: LocalState = {
  upstream: "origin/feat/parser",
  aheadBehind: { ahead: 0, behind: 0 },
  staged: [],
  unstaged: [],
  untracked: [],
  conflicted: [],
  latestCommit: null,
};

function work(local: Partial<LocalState>, overrides: Partial<Checkout> = {}): Work {
  return {
    checkout: { ...checkout, ...overrides },
    local: { status: "loaded", value: { ...clean, ...local } },
  };
}

describe("headLabel", () => {
  test("branch name, or the short oid when detached", () => {
    expect(headLabel(checkout)).toBe("feat/parser");
    expect(headLabel({ ...checkout, head: { kind: "detached", oid: OID } })).toBe(
      "(detached 1234567)",
    );
  });
});

describe("changedFileCount", () => {
  test("counts a file once even if it is both staged and unstaged", () => {
    expect(
      changedFileCount({
        ...clean,
        staged: [{ path: "a", code: "M" }],
        unstaged: [
          { path: "a", code: "M" },
          { path: "b", code: "M" },
        ],
        untracked: ["c"],
        conflicted: ["d"],
      }),
    ).toBe(4);
  });
});

describe("workSummary", () => {
  test("clean and in sync", () => {
    expect(workSummary(work({}))).toBe("clean");
  });

  test("changes, conflicts and divergence from upstream", () => {
    expect(
      workSummary(
        work({
          unstaged: [{ path: "a", code: "M" }],
          conflicted: ["b"],
          aheadBehind: { ahead: 2, behind: 1 },
        }),
      ),
    ).toBe("2 files changed · 1 conflict · ↑2 ↓1");
  });

  test("a branch without upstream is not pushed", () => {
    expect(workSummary(work({ upstream: null, aheadBehind: null, untracked: ["x"] }))).toBe(
      "1 file changed · not pushed",
    );
  });

  test("loading, error and prunable states", () => {
    expect(workSummary({ checkout, local: { status: "loading" } })).toBe("loading…");
    expect(workSummary({ checkout, local: { status: "error", message: "fatal: x" } })).toBe(
      "error: fatal: x",
    );
    expect(workSummary(work({}, { prunable: true }))).toBe("prunable (directory is missing)");
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-09-26T12:00:00Z");
  test("picks the largest fitting unit", () => {
    expect(relativeTime(new Date("2026-09-26T11:59:30Z"), now)).toBe("30 seconds ago");
    expect(relativeTime(new Date("2026-09-26T09:00:00Z"), now)).toBe("3 hours ago");
    expect(relativeTime(new Date("2026-09-24T12:00:00Z"), now)).toBe("2 days ago");
  });
});
