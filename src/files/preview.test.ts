import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PREVIEW_LIMIT, loadPreview } from "./preview";

let root: string;
let outside: string;

beforeAll(async () => {
  const base = await realpath(await mkdtemp(join(tmpdir(), "rivu-preview-")));
  root = join(base, "checkout");
  outside = join(base, "secret.txt");
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src/a.ts"), "export const a = 1;\n");
  await writeFile(join(root, "big.txt"), "x".repeat(PREVIEW_LIMIT + 10));
  await writeFile(join(root, "image.png"), Buffer.from([0x89, 0x50, 0x00, 0x4e]));
  await writeFile(outside, "do not read\n");
  await symlink(outside, join(root, "link"));
});

afterAll(async () => {
  await rm(join(root, ".."), { recursive: true, force: true });
});

describe("loadPreview", () => {
  test("reads a text file", async () => {
    expect(await loadPreview(root, "src/a.ts")).toEqual({
      kind: "text",
      content: "export const a = 1;\n",
      truncated: false,
    });
  });

  test("truncates large files", async () => {
    const preview = await loadPreview(root, "big.txt");
    expect(preview).toMatchObject({ kind: "text", truncated: true });
    expect(preview.kind === "text" && preview.content.length).toBe(PREVIEW_LIMIT);
  });

  test("does not show binary files", async () => {
    expect(await loadPreview(root, "image.png")).toEqual({ kind: "binary" });
  });

  test("shows a symlink's target without following it", async () => {
    expect(await loadPreview(root, "link")).toEqual({ kind: "symlink", target: outside });
  });

  test("a file deleted from the worktree is missing", async () => {
    expect(await loadPreview(root, "gone.ts")).toEqual({ kind: "missing" });
  });

  test("refuses paths outside the checkout", async () => {
    await expect(loadPreview(root, "../secret.txt")).rejects.toThrow("outside");
  });
});
