import { describe, expect, test } from "bun:test";
import type { Checkout } from "../work";
import { findPull, parsePullDetail, parsePullList, pullBranchName } from "./pulls";

const detail = await Bun.file(new URL("./fixtures/pr-view.json", import.meta.url)).text();

describe("parsePullDetail", () => {
  test("keeps the PR fields and summarizes checks", () => {
    expect(parsePullDetail(detail)).toEqual({
      number: 14519,
      title: "Document search operator support in `gh search` help",
      url: "https://github.com/cli/cli/pull/14519",
      state: "OPEN",
      isDraft: false,
      reviewDecision: "CHANGES_REQUESTED",
      // CheckRun: SUCCESS, FAILURE, IN_PROGRESS (SKIPPED is not counted); StatusContext: SUCCESS, PENDING.
      checks: { passed: 2, failed: 1, pending: 2 },
      mergeable: "MERGEABLE",
      mergeStateStatus: "BLOCKED",
      updatedAt: new Date("2026-09-26T06:51:47Z"),
      latestReviews: [
        { author: "BagToad", state: "COMMENTED" },
        { author: "copilot-pull-request-reviewer", state: "COMMENTED" },
      ],
    });
  });

  test("an empty review decision means no review is required", () => {
    const json = JSON.stringify({
      ...JSON.parse(detail),
      reviewDecision: "",
      statusCheckRollup: [],
    });
    expect(parsePullDetail(json)).toMatchObject({
      reviewDecision: null,
      checks: { passed: 0, failed: 0, pending: 0 },
    });
  });
});

const list = JSON.stringify([
  { number: 30, headRefName: "feat/x", isCrossRepository: true, state: "OPEN" },
  { number: 20, headRefName: "feat/x", isCrossRepository: false, state: "MERGED" },
  { number: 10, headRefName: "feat/x", isCrossRepository: false, state: "OPEN" },
  { number: 5, headRefName: "fix/y", isCrossRepository: false, state: "CLOSED" },
  { number: 4, headRefName: "fix/y", isCrossRepository: false, state: "MERGED" },
]);

describe("findPull", () => {
  const pulls = parsePullList(list);

  test("prefers an open PR from this repository", () => {
    expect(findPull(pulls, "feat/x")?.number).toBe(10);
  });

  test("falls back to the newest PR when none is open", () => {
    expect(findPull(pulls, "fix/y")?.number).toBe(5);
  });

  test("no PR for an unknown branch", () => {
    expect(findPull(pulls, "main")).toBeUndefined();
  });
});

describe("pullBranchName", () => {
  const checkout: Checkout = {
    path: "/wt",
    isMain: false,
    head: { kind: "branch", name: "local-name", oid: "a".repeat(40) },
    locked: false,
    prunable: false,
  };

  test("uses the upstream branch without the remote name", () => {
    expect(pullBranchName(checkout, "origin/feat/remote-name")).toBe("feat/remote-name");
  });

  test("uses the local branch when there is no upstream", () => {
    expect(pullBranchName(checkout, null)).toBe("local-name");
  });

  test("a detached checkout has no branch to match", () => {
    expect(
      pullBranchName({ ...checkout, head: { kind: "detached", oid: "a".repeat(40) } }, null),
    ).toBeNull();
  });
});
