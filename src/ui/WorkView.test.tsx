import { afterEach, expect, test } from "bun:test";
import { RGBA } from "@opentui/core";
import type { TestRendererSetup } from "@opentui/core/testing";
import { testRender } from "@opentui/react/test-utils";
import type { Checkout } from "../work";
import type { BrowseAction } from "./browse";
import { initialState, reduce, type State } from "./state";
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

function sampleState(): State {
  let state: State = reduce(initialState, {
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
        body: "",
        latestReviews: [
          { author: "alice", state: "APPROVED" },
          { author: "bob", state: "CHANGES_REQUESTED" },
        ],
      },
    },
  });
  state = reduce(state, { type: "prLoaded", path: "/repo", pr: { status: "none" } });
  state = reduce(state, { type: "move", delta: 1 });

  return state;
}

async function render(state: State, height = 30): Promise<string> {
  setup = await testRender(
    <WorkView state={state} height={height} scrollRef={{ current: null }} />,
    { width: 120, height },
  );
  for (let i = 0; i < 20; i++) {
    await setup.renderOnce();
    await Bun.sleep(10);
  }
  return setup.captureCharFrame();
}

test("lists works with their summary and shows the selected overview", async () => {
  const frame = await render(sampleState());

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
  expect(frame).toContain("Tab: focus  1/2/3: tab");
  expect(frame).toContain("[1 Overview]");

  const failed = setup!
    .captureSpans()
    .lines.flatMap((line) => line.spans)
    .find((span) => span.text.includes("CI 1/3 failed"));
  expect(failed?.fg.equals(RGBA.fromHex(toneColors.danger))).toBe(true);
});

test("the files tab shows the tree with change markers and a preview", async () => {
  let state = reduce(sampleState(), { type: "tab", tab: "files" });
  state = reduce(state, { type: "browseStart", path: "/repo-wt/feat" });
  const actions: BrowseAction[] = [
    { type: "filesLoaded", files: { status: "loaded", value: ["b.ts", "a.ts", "docs/guide.md"] } },
    { type: "treeMove", delta: 1 },
    {
      type: "previewLoaded",
      file: "a.ts",
      value: {
        status: "loaded",
        value: { kind: "text", content: "const answer = 42;\n", truncated: false },
      },
    },
  ];
  for (const action of actions) {
    state = reduce(state, { type: "browse", path: "/repo-wt/feat", action });
  }
  const frame = await render(state);
  expect(frame).toContain("[2 Files]");
  expect(frame).toContain("▸ docs");
  expect(frame).toContain("a.ts M");
  expect(frame).toContain("b.ts ??");
  expect(frame).toContain("const answer = 42;");
});

test("the changes tab lists changed files with their status", async () => {
  let state = reduce(sampleState(), { type: "tab", tab: "changes" });
  state = reduce(state, { type: "browseStart", path: "/repo-wt/feat" });
  const frame = await render(state);
  expect(frame).toContain("[3 Changes]");
  expect(frame).toContain("M  a.ts");
  expect(frame).toContain("?? b.ts  new");
});
