// Maps a key press to what the app should do, given the current focus and tab. See docs/design.md.
import type { BrowseAction } from "./browse";
import type { Action, State, Tab } from "./state";

export type Command =
  | { kind: "quit" }
  | { kind: "reload" }
  | { kind: "hunk" }
  | { kind: "hunkSelectedChange" }
  | { kind: "dispatch"; action: Action }
  | { kind: "browse"; action: BrowseAction }
  | { kind: "changeMove"; delta: number }
  | { kind: "scroll"; lines: number }
  | { kind: "scroll"; pages: number };

type Key = { name: string; ctrl: boolean };

const TABS: Record<string, Tab> = { "1": "overview", "2": "files", "3": "changes" };

function direction(name: string): number {
  if (name === "j" || name === "down") return 1;
  if (name === "k" || name === "up") return -1;
  return 0;
}

const isEnter = (name: string) => name === "return" || name === "enter";

export function keyCommand(key: Key, state: State): Command | null {
  if (key.ctrl) {
    if (state.focus === "pane" && key.name === "d") return { kind: "scroll", pages: 0.5 };
    if (state.focus === "pane" && key.name === "u") return { kind: "scroll", pages: -0.5 };
    return null;
  }
  if (key.name === "q") return { kind: "quit" };
  if (key.name === "r") return { kind: "reload" };
  if (key.name === "d") return { kind: "hunk" };
  if (key.name === "tab") return { kind: "dispatch", action: { type: "focusToggle" } };
  const tab = TABS[key.name];
  if (tab) return { kind: "dispatch", action: { type: "tab", tab } };

  const delta = direction(key.name);
  if (state.focus === "works") {
    return delta === 0 ? null : { kind: "dispatch", action: { type: "move", delta } };
  }
  switch (state.tab) {
    case "overview":
      return delta === 0 ? null : { kind: "scroll", lines: delta };
    case "files":
      if (delta !== 0) return { kind: "browse", action: { type: "treeMove", delta } };
      if (isEnter(key.name) || key.name === "l")
        return { kind: "browse", action: { type: "treeOpen" } };
      if (key.name === "h") return { kind: "browse", action: { type: "treeClose" } };
      return null;
    case "changes":
      if (delta !== 0) return { kind: "changeMove", delta };
      if (isEnter(key.name)) return { kind: "hunkSelectedChange" };
      return null;
  }
}
