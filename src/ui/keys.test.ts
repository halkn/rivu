import { describe, expect, test } from "bun:test";
import type { Checkout } from "../work";
import { keyCommand } from "./keys";
import { initialState, reduce, type State } from "./state";

const checkout: Checkout = {
  path: "/repo",
  isMain: true,
  head: { kind: "branch", name: "main", oid: "a".repeat(40) },
  locked: false,
  prunable: false,
};

const base = reduce(initialState, { type: "checkoutsLoaded", checkouts: [checkout] });

function key(name: string, ctrl = false) {
  return { name, ctrl };
}

function pane(tab: State["tab"]): State {
  return reduce(reduce(base, { type: "focusToggle" }), { type: "tab", tab });
}

describe("keyCommand", () => {
  test("global keys work from any focus", () => {
    expect(keyCommand(key("q"), base)).toEqual({ kind: "quit" });
    expect(keyCommand(key("r"), pane("files"))).toEqual({ kind: "reload" });
    expect(keyCommand(key("d"), pane("changes"))).toEqual({ kind: "hunk" });
    expect(keyCommand(key("tab"), base)).toEqual({
      kind: "dispatch",
      action: { type: "focusToggle" },
    });
    expect(keyCommand(key("2"), base)).toEqual({
      kind: "dispatch",
      action: { type: "tab", tab: "files" },
    });
  });

  test("j/k move the works selection when the works list has focus", () => {
    expect(keyCommand(key("j"), base)).toEqual({
      kind: "dispatch",
      action: { type: "move", delta: 1 },
    });
    expect(keyCommand(key("up"), base)).toEqual({
      kind: "dispatch",
      action: { type: "move", delta: -1 },
    });
  });

  test("in the files pane, keys drive the tree and scroll the preview", () => {
    const state = pane("files");
    expect(keyCommand(key("j"), state)).toEqual({
      kind: "browse",
      action: { type: "treeMove", delta: 1 },
    });
    expect(keyCommand(key("return"), state)).toEqual({
      kind: "browse",
      action: { type: "treeOpen" },
    });
    expect(keyCommand(key("l"), state)).toEqual({ kind: "browse", action: { type: "treeOpen" } });
    expect(keyCommand(key("h"), state)).toEqual({ kind: "browse", action: { type: "treeClose" } });
    expect(keyCommand(key("d", true), state)).toEqual({ kind: "scroll", pages: 0.5 });
    expect(keyCommand(key("u", true), state)).toEqual({ kind: "scroll", pages: -0.5 });
  });

  test("in the changes pane, Enter opens the selected file in Hunk", () => {
    const state = pane("changes");
    expect(keyCommand(key("k"), state)).toEqual({ kind: "changeMove", delta: -1 });
    expect(keyCommand(key("return"), state)).toEqual({ kind: "hunkSelectedChange" });
  });

  test("in the overview pane, j/k scroll line by line", () => {
    expect(keyCommand(key("j"), pane("overview"))).toEqual({ kind: "scroll", lines: 1 });
  });

  test("unknown keys do nothing", () => {
    expect(keyCommand(key("x"), base)).toBeNull();
  });
});
