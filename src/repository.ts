import { stat } from "node:fs/promises"
import { resolve } from "node:path"
import { GitError, runGit } from "./git"

export type Repository = {
  /** Top-level directory of the checkout that PATH belongs to. */
  root: string
  /** Git directory shared by the main checkout and all linked worktrees. */
  commonDir: string
}

export class RepositoryError extends Error {}

export async function resolveRepository(path: string): Promise<Repository> {
  const dir = resolve(path)
  const info = await stat(dir).catch(() => undefined)
  if (!info) throw new RepositoryError(`${dir} does not exist`)
  if (!info.isDirectory()) throw new RepositoryError(`${dir} is not a directory`)

  let out: string
  try {
    out = await runGit(dir, ["rev-parse", "--path-format=absolute", "--show-toplevel", "--git-common-dir"])
  } catch (error) {
    if (error instanceof GitError) throw new RepositoryError(`${dir} is not inside a Git repository`)
    throw error
  }
  const [root, commonDir] = out.trimEnd().split("\n")
  if (!root || !commonDir) throw new RepositoryError(`unexpected git rev-parse output: ${out}`)
  return { root, commonDir }
}
