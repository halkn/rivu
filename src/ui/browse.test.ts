import { describe, expect, test } from "bun:test";
import { initialBrowse, reduceBrowse, selectedFile, treeRows, type Browse } from "./browse";

const files = ["README.md", "src/cli.ts", "src/ui/App.tsx"];

function loaded(): Browse {
  return reduceBrowse(initialBrowse("/repo"), {
    type: "filesLoaded",
    files: { status: "loaded", value: files },
  });
}

function apply(browse: Browse, ...actions: Parameters<typeof reduceBrowse>[1][]): Browse {
  return actions.reduce(reduceBrowse, browse);
}

describe("reduceBrowse", () => {
  test("loading files puts the cursor on the first row", () => {
    const browse = loaded();
    expect(treeRows(browse).map((row) => row.path)).toEqual(["src", "README.md"]);
    expect(browse.cursor).toBe("src");
    expect(selectedFile(browse)).toBeNull();
  });

  test("opening a directory shows its children and moving selects a file", () => {
    const browse = apply(loaded(), { type: "treeOpen" }, { type: "treeMove", delta: 2 });
    expect(treeRows(browse).map((row) => row.path)).toEqual([
      "src",
      "src/ui",
      "src/cli.ts",
      "README.md",
    ]);
    expect(selectedFile(browse)).toBe("src/cli.ts");
  });

  test("opening an open directory steps into it", () => {
    const browse = apply(loaded(), { type: "treeOpen" }, { type: "treeOpen" });
    expect(browse.cursor).toBe("src/ui");
  });

  test("closing from a file goes to its directory and closes it", () => {
    const browse = apply(
      loaded(),
      { type: "treeOpen" },
      { type: "treeMove", delta: 2 },
      { type: "treeClose" },
    );
    expect(browse.cursor).toBe("src");
    expect(treeRows(browse).map((row) => row.path)).toEqual(["src", "README.md"]);
  });

  test("the cursor stays within the rows", () => {
    expect(apply(loaded(), { type: "treeMove", delta: 10 }).cursor).toBe("README.md");
    expect(apply(loaded(), { type: "treeMove", delta: -10 }).cursor).toBe("src");
  });

  test("a preview is kept only for the file it was loaded for", () => {
    const browse = apply(loaded(), { type: "treeMove", delta: 1 });
    const text = { status: "loaded", value: { kind: "binary" } } as const;
    expect(
      reduceBrowse(browse, { type: "previewLoaded", file: "README.md", value: text }).preview,
    ).toEqual({
      file: "README.md",
      value: text,
    });
    expect(
      reduceBrowse(browse, { type: "previewLoaded", file: "src/cli.ts", value: text }).preview,
    ).toBeNull();
  });

  test("the change cursor stays within the change list", () => {
    const browse = apply(loaded(), { type: "changeMove", delta: 5, count: 3 });
    expect(browse.changeIndex).toBe(2);
    expect(reduceBrowse(browse, { type: "changeMove", delta: -5, count: 3 }).changeIndex).toBe(0);
  });
});
