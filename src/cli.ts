import { parseArgs } from "node:util"

export type Command = { kind: "open"; path: string } | { kind: "help" } | { kind: "version" }

export class UsageError extends Error {}

export const usage = `Usage: rivu [PATH]

Show the checkouts and pull requests of the Git repository at PATH (default: .).

Options:
  -h, --help     Show this help
  -V, --version  Show the version`

export function parseCommand(argv: string[]): Command {
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "V" },
      },
    })
  } catch (error) {
    throw new UsageError((error as Error).message)
  }
  if (parsed.values.help) return { kind: "help" }
  if (parsed.values.version) return { kind: "version" }
  if (parsed.positionals.length > 1) {
    throw new UsageError(`expected at most one PATH, got ${parsed.positionals.length}`)
  }
  return { kind: "open", path: parsed.positionals[0] ?? "." }
}
