import { afterEach, expect, test } from "bun:test";
import type { TestRendererSetup } from "@opentui/core/testing";
import { testRender } from "@opentui/react/test-utils";
import type { Checkout } from "../work";
import { initialState, reduce } from "./state";
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
        latestCommit: {
          oid: "abcdef0".padEnd(40, "0"),
          subject: "add parser\x1b[2J",
          committedAt: new Date(),
        },
      },
    },
  });
  state = reduce(state, { type: "move", delta: 1 });

  setup = await testRender(<WorkView state={state} />, { width: 120, height: 20 });
  await setup.renderOnce();
  const frame = setup.captureCharFrame();

  expect(frame).toContain("main (main checkout)");
  expect(frame).toContain("loading…");
  expect(frame).toContain("2 files changed · not pushed");
  expect(frame).toContain("/repo-wt/feat");
  expect(frame).toContain("1 staged · 0 unstaged · 1 untracked · 0 conflicted");
  expect(frame).toContain("abcdef0 add parser[2J");
});
