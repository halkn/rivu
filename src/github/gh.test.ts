import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GhError, runGh } from "./gh";

let dir: string;

async function fakeGh(name: string, script: string): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, `#!/bin/sh\n${script}\n`);
  await chmod(path, 0o755);
  return path;
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "rivu-gh-"));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("runGh", () => {
  test("returns stdout and runs non-interactively", async () => {
    const bin = await fakeGh(
      "ok",
      'echo "$GH_PROMPT_DISABLED:$NO_COLOR:$*"; read -r line || echo "no stdin"',
    );
    expect(await runGh(dir, ["pr", "list"], bin)).toBe("1:1:pr list\nno stdin\n");
  });

  test("a missing gh is reported as not installed", async () => {
    const error = await runGh(dir, ["pr", "list"], join(dir, "missing")).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GhError);
    expect(error).toMatchObject({ kind: "missing" });
  });

  test("exit code 4 means gh is not authenticated", async () => {
    const bin = await fakeGh(
      "auth",
      "echo 'To get started with GitHub CLI, please run: gh auth login' >&2; exit 4",
    );
    await expect(runGh(dir, [], bin)).rejects.toMatchObject({ kind: "unauthenticated" });
  });

  test("other failures keep the first line of stderr", async () => {
    const bin = await fakeGh(
      "fail",
      "printf 'none of the git remotes point to a known GitHub host\\nmore\\n' >&2; exit 1",
    );
    await expect(runGh(dir, [], bin)).rejects.toMatchObject({
      kind: "failed",
      message: "none of the git remotes point to a known GitHub host",
    });
  });
});
