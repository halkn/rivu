import { describe, expect, test } from "bun:test";
import type { Checkout, PullRequest } from "../work";
import { GhError } from "./gh";
import type { PullListItem } from "./pulls";
import { resolvePr } from "./resolve";

const checkout: Checkout = {
  path: "/wt",
  isMain: false,
  head: { kind: "branch", name: "feat/x", oid: "a".repeat(40) },
  locked: false,
  prunable: false,
};

const pulls: PullListItem[] = [
  { number: 7, headRefName: "feat/x", isCrossRepository: false, state: "OPEN" },
];

const pr: PullRequest = {
  number: 7,
  title: "Add x",
  url: "https://github.com/o/r/pull/7",
  state: "OPEN",
  isDraft: false,
  reviewDecision: null,
  checks: { passed: 1, failed: 0, pending: 0 },
  mergeable: "MERGEABLE",
  mergeStateStatus: "CLEAN",
  updatedAt: new Date("2026-09-26T09:00:00Z"),
  latestReviews: [],
};

describe("resolvePr", () => {
  test("fetches the detail of the matching PR", async () => {
    const fetched: number[] = [];
    const state = await resolvePr(
      checkout,
      null,
      Promise.resolve({ pulls, defaultBranch: "main" }),
      async (n) => {
        fetched.push(n);
        return pr;
      },
    );
    expect(state).toEqual({ status: "found", value: pr });
    expect(fetched).toEqual([7]);
  });

  test("falls back to the remote branch the checkout tracks", async () => {
    const renamed: Checkout = {
      ...checkout,
      head: { kind: "branch", name: "local", oid: "a".repeat(40) },
    };
    const state = await resolvePr(
      renamed,
      "feat/x",
      Promise.resolve({ pulls, defaultBranch: "main" }),
      async () => pr,
    );
    expect(state).toEqual({ status: "found", value: pr });
  });

  test("no matching PR does not fetch any detail", async () => {
    const other: Checkout = {
      ...checkout,
      head: { kind: "branch", name: "feat/y", oid: "a".repeat(40) },
    };
    const state = await resolvePr(
      other,
      "main",
      Promise.resolve({ pulls, defaultBranch: "main" }),
      async () => {
        throw new Error("must not be called");
      },
    );
    expect(state).toEqual({ status: "none" });
  });

  test("a detached checkout has no PR", async () => {
    const detached: Checkout = { ...checkout, head: { kind: "detached", oid: "a".repeat(40) } };
    expect(
      await resolvePr(
        detached,
        null,
        Promise.resolve({ pulls, defaultBranch: "main" }),
        async () => pr,
      ),
    ).toEqual({
      status: "none",
    });
  });

  test("gh being unusable makes PRs unavailable", async () => {
    const failing = Promise.reject(new GhError("missing", "gh is not installed"));
    expect(await resolvePr(checkout, null, failing, async () => pr)).toEqual({
      status: "unavailable",
      reason: "gh is not installed",
    });
  });

  test("a failed detail request is an error for this work only", async () => {
    const state = await resolvePr(
      checkout,
      null,
      Promise.resolve({ pulls, defaultBranch: "main" }),
      async () => {
        throw new GhError("failed", "HTTP 502");
      },
    );
    expect(state).toEqual({ status: "error", message: "HTTP 502" });
  });
});
