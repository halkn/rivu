import { describe, expect, test } from "bun:test";
import { buildTree, parentDir, visibleRows } from "./tree";

const paths = ["src/ui/App.tsx", "README.md", "src/cli.ts", "docs/design.md", "src/ui/tree.ts"];

function names(expanded: string[]) {
  return visibleRows(buildTree(paths), new Set(expanded)).map(
    (row) => `${"  ".repeat(row.depth)}${row.name}${row.kind === "dir" ? "/" : ""}`,
  );
}

describe("visibleRows", () => {
  test("directories first, then files, each sorted; closed directories hide their children", () => {
    expect(names([])).toEqual(["docs/", "src/", "README.md"]);
  });

  test("open directories show their children, nested by depth", () => {
    expect(names(["src", "src/ui"])).toEqual([
      "docs/",
      "src/",
      "  ui/",
      "    App.tsx",
      "    tree.ts",
      "  cli.ts",
      "README.md",
    ]);
  });

  test("rows carry their full path and whether they are open", () => {
    const rows = visibleRows(buildTree(paths), new Set(["src"]));
    expect(rows.find((row) => row.name === "ui")).toEqual({
      path: "src/ui",
      name: "ui",
      depth: 1,
      kind: "dir",
      open: false,
    });
  });
});

describe("parentDir", () => {
  test("the directory containing a path, or null at the top", () => {
    expect(parentDir("src/ui/App.tsx")).toBe("src/ui");
    expect(parentDir("README.md")).toBeNull();
  });
});
