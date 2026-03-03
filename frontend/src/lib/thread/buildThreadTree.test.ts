import { buildThreadTree } from './buildThreadTree';

type Node = {
  id: string;
  parentId: string | null;
  createdAt: string;
  body: string;
};

describe('buildThreadTree', () => {
  it('builds nested tree for unlimited depth', () => {
    const nodes: Node[] = [
      { id: 'c3', parentId: 'c2', createdAt: '2026-03-01T10:03:00.000Z', body: 'depth-3' },
      { id: 'r1', parentId: null, createdAt: '2026-03-01T10:00:00.000Z', body: 'root-1' },
      { id: 'c1', parentId: 'r1', createdAt: '2026-03-01T10:01:00.000Z', body: 'depth-1' },
      { id: 'c2', parentId: 'c1', createdAt: '2026-03-01T10:02:00.000Z', body: 'depth-2' },
    ];

    const tree = buildThreadTree(nodes);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('r1');
    expect(tree[0].children[0].id).toBe('c1');
    expect(tree[0].children[0].children[0].id).toBe('c2');
    expect(tree[0].children[0].children[0].children[0].id).toBe('c3');
  });

  it('treats orphan nodes as root nodes', () => {
    const nodes: Node[] = [
      { id: 'r1', parentId: null, createdAt: '2026-03-01T10:00:00.000Z', body: 'root-1' },
      { id: 'o1', parentId: 'missing', createdAt: '2026-03-01T10:01:00.000Z', body: 'orphan' },
    ];

    const tree = buildThreadTree(nodes);

    expect(tree).toHaveLength(2);
    expect(tree[0].id).toBe('r1');
    expect(tree[1].id).toBe('o1');
  });

  it('sorts siblings by created_at ascending', () => {
    const nodes: Node[] = [
      { id: 'r1', parentId: null, createdAt: '2026-03-01T10:00:00.000Z', body: 'root-1' },
      { id: 'c2', parentId: 'r1', createdAt: '2026-03-01T10:02:00.000Z', body: 'child-2' },
      { id: 'c1', parentId: 'r1', createdAt: '2026-03-01T10:01:00.000Z', body: 'child-1' },
    ];

    const tree = buildThreadTree(nodes);

    expect(tree[0].children.map((child) => child.id)).toEqual(['c1', 'c2']);
  });
});
