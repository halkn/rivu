import { describe, expect, test } from "bun:test";
import type { Checkout, LocalState } from "../work";
import { initialState, reduce, selectedWork } from "./state";

function checkout(path: string, name: string): Checkout {
  return {
    path,
    isMain: path === "/main",
    head: { kind: "branch", name, oid: "a".repeat(40) },
    locked: false,
    prunable: false,
  };
}

const local: LocalState = {
  upstream: null,
  aheadBehind: null,
  staged: [],
  unstaged: [],
  untracked: [],
  conflicted: [],
  upstreamBranch: null,
  latestCommit: null,
};

const loaded = reduce(initialState, {
  type: "checkoutsLoaded",
  checkouts: [checkout("/main", "main"), checkout("/wt/a", "feat/a"), checkout("/wt/b", "feat/b")],
});

describe("reduce", () => {
  test("loaded checkouts start with their local state loading", () => {
    expect(loaded.works.status).toBe("loaded");
    expect(loaded.works.status === "loaded" && loaded.works.value.map((w) => w.local)).toEqual([
      { status: "loading" },
      { status: "loading" },
      { status: "loading" },
    ]);
  });

  test("PR state starts loading and is attached to the matching checkout", () => {
    expect(loaded.works.status === "loaded" && loaded.works.value[0]?.pr).toEqual({
      status: "loading",
    });
    const state = reduce(loaded, { type: "prLoaded", path: "/wt/b", pr: { status: "none" } });
    expect(state.works.status === "loaded" && state.works.value.map((w) => w.pr.status)).toEqual([
      "loading",
      "loading",
      "none",
    ]);
  });

  test("local state is attached to the matching checkout", () => {
    const state = reduce(loaded, {
      type: "localLoaded",
      path: "/wt/a",
      local: { status: "loaded", value: local },
    });
    expect(state.works.status === "loaded" && state.works.value[1]?.local).toEqual({
      status: "loaded",
      value: local,
    });
  });

  test("selection moves within bounds", () => {
    const down = reduce(
      reduce(reduce(loaded, { type: "move", delta: 1 }), { type: "move", delta: 1 }),
      {
        type: "move",
        delta: 1,
      },
    );
    expect(selectedWork(down)?.checkout.path).toBe("/wt/b");
    expect(selectedWork(reduce(loaded, { type: "move", delta: -1 }))?.checkout.path).toBe("/main");
  });

  test("reloading keeps the selected checkout when it still exists", () => {
    const selected = reduce(loaded, { type: "move", delta: 2 });
    const reloaded = reduce(selected, {
      type: "checkoutsLoaded",
      checkouts: [checkout("/main", "main"), checkout("/wt/b", "feat/b")],
    });
    expect(selectedWork(reloaded)?.checkout.path).toBe("/wt/b");
  });

  test("reloading falls back to the main checkout when the selection is gone", () => {
    const selected = reduce(loaded, { type: "move", delta: 2 });
    const reloaded = reduce(selected, {
      type: "checkoutsLoaded",
      checkouts: [checkout("/main", "main")],
    });
    expect(selectedWork(reloaded)?.checkout.path).toBe("/main");
  });

  test("a failure to list checkouts is shown instead of the works", () => {
    const state = reduce(initialState, { type: "checkoutsFailed", message: "boom" });
    expect(state.works).toEqual({ status: "error", message: "boom" });
    expect(selectedWork(state)).toBeUndefined();
  });
});
