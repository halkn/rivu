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
  lineStats: [],
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

describe("tabs, focus and browsing", () => {
  test("focus toggles between the works list and the pane, and tabs switch", () => {
    const focused = reduce(loaded, { type: "focusToggle" });
    expect(focused.focus).toBe("pane");
    expect(reduce(focused, { type: "focusToggle" }).focus).toBe("works");
    expect(reduce(loaded, { type: "tab", tab: "files" }).tab).toBe("files");
  });

  test("browse actions apply only to the checkout they were started for", () => {
    const started = reduce(loaded, { type: "browseStart", path: "/main" });
    const files = { status: "loaded" as const, value: ["a.ts"] };
    const applied = reduce(started, {
      type: "browse",
      path: "/main",
      action: { type: "filesLoaded", files },
    });
    expect(applied.browse?.files).toEqual(files);
    const stale = reduce(started, {
      type: "browse",
      path: "/wt/a",
      action: { type: "filesLoaded", files },
    });
    expect(stale.browse?.files).toEqual({ status: "loading" });
  });

  test("selecting another work or reloading drops the browse state", () => {
    const started = reduce(loaded, { type: "browseStart", path: "/main" });
    expect(reduce(started, { type: "move", delta: 1 }).browse).toBeNull();
    expect(
      reduce(started, { type: "checkoutsLoaded", checkouts: [checkout("/main", "main")] }).browse,
    ).toBeNull();
  });

  test("a message is shown until replaced", () => {
    const state = reduce(loaded, { type: "message", text: "hunk is not installed" });
    expect(state.message).toBe("hunk is not installed");
    expect(reduce(state, { type: "message", text: null }).message).toBeNull();
  });
});
