import { describe, expect, test } from "bun:test";
import type { Checkout, LocalState, PullRequest, Work } from "../work";
import {
  changeRows,
  changedFileCount,
  lineTotals,
  headLabel,
  localSegments,
  prHeadline,
  prStatus,
  relativeTime,
  reviewsText,
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
  upstreamBranch: null,
  lineStats: [],
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

function found(value: PullRequest) {
  return { status: "found", value } as const;
}

function text(segments: { text: string }[]): string {
  return segments.map((segment) => segment.text).join(" · ");
}

describe("pull request lines", () => {
  const pr: PullRequest = {
    number: 1,
    title: "CI passes",
    url: "https://github.com/o/r/pull/1",
    state: "OPEN",
    isDraft: false,
    reviewDecision: "REVIEW_REQUIRED",
    checks: { passed: 3, failed: 0, pending: 0 },
    mergeable: "MERGEABLE",
    mergeStateStatus: "CLEAN",
    updatedAt: new Date("2026-09-26T09:00:00Z"),
    body: "",
    latestReviews: [],
  };

  test("headline shows the number, title and a draft or closed marker", () => {
    expect(text(prHeadline(found(pr)))).toBe("#1 CI passes");
    expect(prHeadline(found({ ...pr, isDraft: true })).at(-1)).toEqual({
      text: "[draft]",
      tone: "muted",
    });
    expect(text(prHeadline(found({ ...pr, state: "MERGED" })))).toBe("#1 CI passes · [merged]");
    expect(text(prHeadline(found({ ...pr, state: "CLOSED" })))).toBe("#1 CI passes · [closed]");
  });

  test("status shows CI, review and merge state with tones", () => {
    expect(prStatus(found(pr))).toEqual([
      { text: "✓ CI 3/3", tone: "success" },
      { text: "○ Review required", tone: "warning" },
      { text: "Mergeable", tone: "success" },
    ]);
  });

  test("failing and running checks", () => {
    const failing = { ...pr, checks: { passed: 1, failed: 1, pending: 0 }, reviewDecision: null };
    expect(text(prStatus(found({ ...failing, mergeStateStatus: "UNSTABLE" })))).toBe(
      "✗ CI 1/2 failed · Mergeable",
    );
    const running = { ...pr, checks: { passed: 1, failed: 0, pending: 2 }, reviewDecision: null };
    expect(prStatus(found(running))[0]).toEqual({ text: "○ CI 1/3", tone: "warning" });
  });

  test("reviews", () => {
    expect(prStatus(found({ ...pr, reviewDecision: "APPROVED" }))[1]).toEqual({
      text: "✓ Approved",
      tone: "success",
    });
    expect(prStatus(found({ ...pr, reviewDecision: "CHANGES_REQUESTED" }))[1]).toEqual({
      text: "✗ Changes requested",
      tone: "danger",
    });
  });

  function merge(overrides: Partial<PullRequest>) {
    const quiet = { checks: { passed: 0, failed: 0, pending: 0 }, reviewDecision: null };
    return prStatus(found({ ...pr, ...quiet, ...overrides }));
  }

  test("merge states", () => {
    expect(merge({ mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" })).toEqual([
      { text: "✗ Conflicts", tone: "danger" },
    ]);
    expect(merge({ mergeStateStatus: "BEHIND" })).toEqual([
      { text: "Behind base", tone: "warning" },
    ]);
    expect(merge({ mergeStateStatus: "BLOCKED" })).toEqual([{ text: "Blocked", tone: "warning" }]);
    expect(merge({ mergeable: "UNKNOWN", mergeStateStatus: "UNKNOWN" })).toEqual([]);
  });

  test("merged and closed PRs have no status line", () => {
    expect(prStatus(found({ ...pr, state: "MERGED" }))).toEqual([]);
  });

  test("states without a PR are shown on the headline only", () => {
    expect(text(prHeadline({ status: "none" }))).toBe("no PR");
    expect(text(prHeadline({ status: "loading" }))).toBe("PR loading…");
    expect(text(prHeadline({ status: "unavailable", reason: "gh is not installed" }))).toBe(
      "PR unavailable: gh is not installed",
    );
    expect(text(prHeadline({ status: "error", message: "HTTP 502" }))).toBe("PR error: HTTP 502");
    expect(prStatus({ status: "none" })).toEqual([]);
  });
});

describe("reviewsText", () => {
  test("lists each reviewer's latest state", () => {
    expect(
      reviewsText([
        { author: "alice", state: "APPROVED" },
        { author: "bob", state: "CHANGES_REQUESTED" },
        { author: "carol", state: "COMMENTED" },
        { author: "dave", state: "DISMISSED" },
      ]),
    ).toBe("alice approved · bob requested changes · carol commented · dave dismissed");
    expect(reviewsText([])).toBe("no reviews");
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

describe("changes", () => {
  const local: LocalState = {
    ...clean,
    staged: [
      { path: "src/a.ts", code: "M" },
      { path: "src/new.ts", code: "A" },
    ],
    unstaged: [
      { path: "src/a.ts", code: "M" },
      { path: "README.md", code: "D" },
    ],
    untracked: ["notes.txt"],
    conflicted: ["src/conflict.ts"],
    lineStats: [
      { path: "src/a.ts", added: 3, deleted: 1 },
      { path: "src/new.ts", added: 10, deleted: 0 },
      { path: "README.md", added: 0, deleted: 5 },
      { path: "logo.png", added: null, deleted: null },
    ],
  };

  test("a binary change has no line counts", () => {
    const rows = changeRows({ ...local, unstaged: [{ path: "logo.png", code: "M" }] });
    expect(rows.find((row) => row.path === "logo.png")?.binary).toBe(true);
    expect(rows.find((row) => row.path === "notes.txt")?.binary).toBe(false);
  });

  test("one row per path with its staged/unstaged status and line counts", () => {
    expect(changeRows(local)).toEqual([
      { path: "notes.txt", status: "??", added: null, deleted: null, binary: false },
      { path: "README.md", status: " D", added: 0, deleted: 5, binary: false },
      { path: "src/a.ts", status: "MM", added: 3, deleted: 1, binary: false },
      { path: "src/conflict.ts", status: "UU", added: null, deleted: null, binary: false },
      { path: "src/new.ts", status: "A ", added: 10, deleted: 0, binary: false },
    ]);
  });

  test("line totals skip binary files", () => {
    expect(lineTotals(local.lineStats)).toEqual({ added: 13, deleted: 6 });
    expect(lineTotals(null)).toBeNull();
  });

  test("the work summary includes the line totals", () => {
    expect(
      workSummary(
        work({
          unstaged: [{ path: "a", code: "M" }],
          lineStats: [{ path: "a", added: 12, deleted: 3 }],
        }),
      ),
    ).toBe("1 file changed · +12 −3");
  });
});
