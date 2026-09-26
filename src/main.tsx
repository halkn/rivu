#!/usr/bin/env bun
import { createCliRenderer, getDataPaths } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer } from "@opentui/react";
import pkg from "../package.json";
import { UsageError, parseCommand, usage } from "./cli";
import { RepositoryError, resolveRepository, type Repository } from "./repository";

function App({ repository }: { repository: Repository }) {
  const renderer = useRenderer();
  useKeyboard((key) => {
    if (key.name === "q") renderer.destroy();
  });
  return (
    <box flexDirection="column" padding={1}>
      <text>{repository.root}</text>
      <text fg="#697098">q: quit</text>
    </box>
  );
}

async function main(argv: string[]): Promise<number> {
  let command;
  try {
    command = parseCommand(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(`rivu: ${error.message}\n\n${usage}`);
    return 2;
  }
  if (command.kind === "help") {
    console.log(usage);
    return 0;
  }
  if (command.kind === "version") {
    console.log(pkg.version);
    return 0;
  }

  let repository;
  try {
    repository = await resolveRepository(command.path);
  } catch (error) {
    if (!(error instanceof RepositoryError)) throw error;
    console.error(`rivu: ${error.message}`);
    return 1;
  }

  // Tree-sitter caches parsers under the data path, which defaults to ~/.local/share/opentui.
  getDataPaths().appName = "rivu";
  const renderer = await createCliRenderer({ exitOnCtrlC: true });
  createRoot(renderer).render(<App repository={repository} />);
  return 0;
}

const code = await main(Bun.argv.slice(2));
if (code !== 0) process.exit(code);
