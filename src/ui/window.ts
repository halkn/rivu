/** The slice of a list to render so that the cursor stays visible within `size` rows. */
export function visibleWindow<T>(items: T[], cursor: number, size: number): T[] {
  if (items.length <= size) return items;
  const start = Math.min(Math.max(0, cursor - Math.floor(size / 2)), items.length - size);
  return items.slice(start, start + size);
}
