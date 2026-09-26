import { describe, expect, test } from "bun:test";
import { UsageError, parseCommand } from "./cli";

describe("parseCommand", () => {
  test("defaults to the current directory", () => {
    expect(parseCommand([])).toEqual({ kind: "open", path: "." });
  });

  test("takes a repository path", () => {
    expect(parseCommand(["../repo"])).toEqual({ kind: "open", path: "../repo" });
  });

  test("recognizes help and version", () => {
    expect(parseCommand(["--help"])).toEqual({ kind: "help" });
    expect(parseCommand(["-h"])).toEqual({ kind: "help" });
    expect(parseCommand(["--version"])).toEqual({ kind: "version" });
    expect(parseCommand(["-V"])).toEqual({ kind: "version" });
  });

  test("rejects unknown options and extra paths", () => {
    expect(() => parseCommand(["--watch"])).toThrow(UsageError);
    expect(() => parseCommand(["a", "b"])).toThrow(UsageError);
  });
});
