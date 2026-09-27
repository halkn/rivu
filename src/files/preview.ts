import { lstat, readlink } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { Preview } from "../work";

export const PREVIEW_LIMIT = 512 * 1024;
const BINARY_SNIFF = 8 * 1024;

export async function loadPreview(root: string, path: string): Promise<Preview> {
  const absolute = resolve(root, path);
  if (!absolute.startsWith(root + sep)) throw new Error(`${path} is outside the checkout`);

  const info = await lstat(absolute).catch(() => undefined);
  if (!info) return { kind: "missing" };
  if (info.isSymbolicLink()) return { kind: "symlink", target: await readlink(absolute) };
  if (!info.isFile()) return { kind: "missing" };

  const bytes = new Uint8Array(await Bun.file(absolute).slice(0, PREVIEW_LIMIT).arrayBuffer());
  if (bytes.subarray(0, BINARY_SNIFF).includes(0)) return { kind: "binary" };
  return {
    kind: "text",
    content: new TextDecoder().decode(bytes),
    truncated: info.size > PREVIEW_LIMIT,
  };
}
