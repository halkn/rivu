import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { RepositoryError, resolveRepository } from "./repository"

let base: string

function git(cwd: string, ...args: string[]) {
  const result = Bun.spawnSync(["git", "-c", "user.name=test", "-c", "user.email=test@example.com", ...args], { cwd })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
}

beforeAll(async () => {
  base = await realpath(await mkdtemp(join(tmpdir(), "rivu-repo-")))
  await mkdir(join(base, "main"))
  git(join(base, "main"), "init", "-q", "-b", "main")
  git(join(base, "main"), "commit", "-q", "--allow-empty", "-m", "init")
  git(join(base, "main"), "worktree", "add", "-q", "-b", "feat/x", join(base, "wt"))
  await mkdir(join(base, "main", "sub"))
  await mkdir(join(base, "plain"))
})

afterAll(async () => {
  await rm(base, { recursive: true, force: true })
})

describe("resolveRepository", () => {
  test("resolves the checkout root from a subdirectory", async () => {
    const repo = await resolveRepository(join(base, "main", "sub"))
    expect(repo.root).toBe(join(base, "main"))
    expect(repo.commonDir).toBe(join(base, "main", ".git"))
  })

  test("a linked worktree shares the main checkout's common dir", async () => {
    const repo = await resolveRepository(join(base, "wt"))
    expect(repo.root).toBe(join(base, "wt"))
    expect(repo.commonDir).toBe(join(base, "main", ".git"))
  })

  test("rejects a directory outside any repository", async () => {
    await expect(resolveRepository(join(base, "plain"))).rejects.toThrow(RepositoryError)
  })

  test("rejects a missing path", async () => {
    await expect(resolveRepository(join(base, "missing"))).rejects.toThrow("does not exist")
  })
})
