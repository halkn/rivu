export type TreeNode = { name: string; path: string; children: Map<string, TreeNode> | null };

export type TreeRow = {
  path: string;
  name: string;
  depth: number;
  kind: "dir" | "file";
  open: boolean;
};

export function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: "", path: "", children: new Map() };
  for (const path of paths) {
    const parts = path.split("/");
    let node = root;
    parts.forEach((name, index) => {
      const isFile = index === parts.length - 1;
      let child = node.children!.get(name);
      if (!child) {
        child = {
          name,
          path: parts.slice(0, index + 1).join("/"),
          children: isFile ? null : new Map(),
        };
        node.children!.set(name, child);
      }
      node = child;
    });
  }
  return root;
}

function sortedChildren(node: TreeNode): TreeNode[] {
  return [...node.children!.values()].toSorted((a, b) => {
    if ((a.children === null) !== (b.children === null)) return a.children === null ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

export function visibleRows(root: TreeNode, open: Set<string>): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (node: TreeNode, depth: number) => {
    for (const child of sortedChildren(node)) {
      const isDir = child.children !== null;
      const isOpen = isDir && open.has(child.path);
      rows.push({
        path: child.path,
        name: child.name,
        depth,
        kind: isDir ? "dir" : "file",
        open: isOpen,
      });
      if (isOpen) walk(child, depth + 1);
    }
  };
  walk(root, 0);
  return rows;
}

export function parentDir(path: string): string | null {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? null : path.slice(0, slash);
}
