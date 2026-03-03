type TreeNodeInput = {
  id: string;
  parentId: string | null;
  createdAt: string;
};

export type ThreadTreeNode<T extends TreeNodeInput> = T & {
  children: Array<ThreadTreeNode<T>>;
};

function compareByCreatedAtAsc<T extends TreeNodeInput>(a: T, b: T) {
  const aTime = new Date(a.createdAt).getTime();
  const bTime = new Date(b.createdAt).getTime();
  if (aTime !== bTime) {
    return aTime - bTime;
  }
  return a.id.localeCompare(b.id);
}

export function buildThreadTree<T extends TreeNodeInput>(nodes: T[]): Array<ThreadTreeNode<T>> {
  const sorted = [...nodes].sort(compareByCreatedAtAsc);
  const byId = new Map<string, ThreadTreeNode<T>>();

  sorted.forEach((node) => {
    byId.set(node.id, {
      ...node,
      children: [],
    });
  });

  const roots: Array<ThreadTreeNode<T>> = [];

  sorted.forEach((node) => {
    const current = byId.get(node.id);
    if (!current) return;

    if (!node.parentId || node.parentId === node.id) {
      roots.push(current);
      return;
    }

    const parent = byId.get(node.parentId);
    if (!parent) {
      roots.push(current);
      return;
    }

    parent.children.push(current);
  });

  return roots;
}
