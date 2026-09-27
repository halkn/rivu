import { afterEach, expect, test } from "bun:test";
import { RGBA } from "@opentui/core";
import type { TestRendererSetup } from "@opentui/core/testing";
import { testRender } from "@opentui/react/test-utils";
import type { Checkout } from "../work";
import { initialState, reduce } from "./state";
import { toneColors } from "./theme";
import { WorkView } from "./WorkView";

let setup: TestRendererSetup | undefined;

afterEach(() => {
  setup?.renderer.destroy();
  setup = undefined;
});

function checkout(path: string, name: string): Checkout {
  return {
    path,
    isMain: path === "/repo",
    head: { kind: "branch", name, oid: "abcdef0".padEnd(40, "0") },
    locked: false,
    prunable: false,
  };
}

test("lists works with their summary and shows the selected overview", async () => {
  let state = reduce(initialState, {
    type: "checkoutsLoaded",
    checkouts: [checkout("/repo", "main"), checkout("/repo-wt/feat", "feat/parser")],
  });
  state = reduce(state, {
    type: "localLoaded",
    path: "/repo-wt/feat",
    local: {
      status: "loaded",
      value: {
        upstream: null,
        aheadBehind: null,
        staged: [{ path: "a.ts", code: "M" }],
        unstaged: [],
        untracked: ["b.ts"],
        conflicted: [],
        upstreamBranch: null,
        lineStats: [],
        latestCommit: {
          oid: "abcdef0".padEnd(40, "0"),
          subject: "add parser\x1b[2J",
          committedAt: new Date(),
        },
      },
    },
  });
  state = reduce(state, {
    type: "prLoaded",
    path: "/repo-wt/feat",
    pr: {
      status: "found",
      value: {
        number: 84,
        title: "Add parser",
        url: "https://github.com/o/r/pull/84",
        state: "OPEN",
        isDraft: false,
        reviewDecision: "APPROVED",
        checks: { passed: 2, failed: 1, pending: 0 },
        mergeable: "MERGEABLE",
        mergeStateStatus: "BLOCKED",
        updatedAt: new Date(Date.now() - 3 * 3600 * 1000),
        latestReviews: [
          { author: "alice", state: "APPROVED" },
          { author: "bob", state: "CHANGES_REQUESTED" },
        ],
      },
    },
  });
  state = reduce(state, { type: "prLoaded", path: "/repo", pr: { status: "none" } });
  state = reduce(state, { type: "move", delta: 1 });

  setup = await testRender(<WorkView state={state} />, { width: 120, height: 30 });
  await setup.renderOnce();
  const frame = setup.captureCharFrame();

  expect(frame).toContain("main (main checkout)");
  expect(frame).toContain("loading…");
  expect(frame).toContain("2 files changed · not pushed");
  expect(frame).toContain("/repo-wt/feat");
  expect(frame).toContain("1 staged · 0 unstaged · 1 untracked · 0 conflicted");
  expect(frame).toContain("abcdef0 add parser[2J");
  expect(frame).toContain("no PR");
  expect(frame).toContain("  #84 Add parser");
  expect(frame).toContain("     ✗ CI 1/3 failed · ✓ Approved · Blocked");
  expect(frame).toContain("#84 Add parser");
  expect(frame).toContain("2 passed · 1 failed · 0 pending");
  expect(frame).toContain("Updated   3 hours ago");
  expect(frame).toContain("Reviews   alice approved · bob requested changes");
  expect(frame).toContain("j/k: select  r: reload  q: quit");

  const failed = setup
    .captureSpans()
    .lines.flatMap((line) => line.spans)
    .find((span) => span.text.includes("CI 1/3 failed"));
  expect(failed?.fg.equals(RGBA.fromHex(toneColors.danger))).toBe(true);
});
