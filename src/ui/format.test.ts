import { describe, expect, test } from "bun:test";
import type { Checkout, LocalState, PullRequest, Work } from "../work";
import {
  changedFileCount,
  headLabel,
  localSegments,
  prSummary,
  relativeTime,
  workSummary,
} from "./format";

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
    pr: { status: "none" },
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
    expect(workSummary({ checkout, local: { status: "loading" }, pr: { status: "none" } })).toBe(
      "loading…",
    );
    expect(
      workSummary({
        checkout,
        local: { status: "error", message: "fatal: x" },
        pr: { status: "none" },
      }),
    ).toBe("error: fatal: x");
    expect(workSummary(work({}, { prunable: true }))).toBe("prunable (directory is missing)");
  });
});

describe("localSegments", () => {
  test("each part carries a tone for coloring", () => {
    expect(
      localSegments(
        work({ unstaged: [{ path: "a", code: "M" }], conflicted: ["b"], upstream: null }),
      ),
    ).toEqual([
      { text: "2 files changed", tone: "warning" },
      { text: "1 conflict", tone: "danger" },
      { text: "not pushed", tone: "accent" },
    ]);
    expect(localSegments(work({}))).toEqual([{ text: "clean", tone: "success" }]);
  });
});

describe("prSummary", () => {
  const pr: PullRequest = {
    number: 84,
    title: "Add parser",
    url: "https://github.com/o/r/pull/84",
    state: "OPEN",
    isDraft: false,
    reviewDecision: "APPROVED",
    checks: { passed: 3, failed: 0, pending: 0 },
    mergeable: "MERGEABLE",
    mergeStateStatus: "CLEAN",
  };

  test("open PR with passing CI and approval", () => {
    expect(prSummary({ status: "found", value: pr })).toBe("PR #84 · CI passed · Approved");
  });

  test("failing, running and missing checks", () => {
    const failed = { ...pr, checks: { passed: 2, failed: 1, pending: 1 }, reviewDecision: null };
    expect(prSummary({ status: "found", value: failed })).toBe("PR #84 · Checks failed");
    const running = { ...pr, checks: { passed: 2, failed: 0, pending: 1 } };
    expect(prSummary({ status: "found", value: running })).toBe("PR #84 · CI running · Approved");
    const none = { ...pr, checks: { passed: 0, failed: 0, pending: 0 }, reviewDecision: null };
    expect(prSummary({ status: "found", value: none })).toBe("PR #84");
  });

  test("draft, conflicting and behind PRs", () => {
    const pr2 = {
      ...pr,
      isDraft: true,
      reviewDecision: "CHANGES_REQUESTED" as const,
      mergeable: "CONFLICTING" as const,
      mergeStateStatus: "DIRTY" as const,
    };
    expect(prSummary({ status: "found", value: pr2 })).toBe(
      "PR #84 (draft) · CI passed · Changes requested · Conflicts",
    );
    const behind = { ...pr, mergeStateStatus: "BEHIND" as const };
    expect(prSummary({ status: "found", value: behind })).toBe(
      "PR #84 · CI passed · Approved · Behind base",
    );
  });

  test("merged and closed PRs only show their state", () => {
    expect(prSummary({ status: "found", value: { ...pr, state: "MERGED" } })).toBe(
      "PR #84 · Merged",
    );
    expect(prSummary({ status: "found", value: { ...pr, state: "CLOSED" } })).toBe(
      "PR #84 · Closed",
    );
  });

  test("states without a PR", () => {
    expect(prSummary({ status: "none" })).toBe("no PR");
    expect(prSummary({ status: "loading" })).toBe("PR loading…");
    expect(prSummary({ status: "unavailable", reason: "gh is not installed" })).toBe(
      "PR unavailable: gh is not installed",
    );
    expect(prSummary({ status: "error", message: "HTTP 502" })).toBe("PR error: HTTP 502");
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
