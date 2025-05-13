import { fallbackStorage } from '../db/fallbackStorage';

describe('FallbackStorage Unit Tests', () => {
  beforeEach(() => {
    fallbackStorage.clear();
  });

  it('should create and retrieve a node', () => {
    const node = { id: 'n1', type: 'topic', content: 'Node1' } as any;
    const created = fallbackStorage.createNode(node);
    expect(created.id).toBe('n1');
    const retrieved = fallbackStorage.getNode('n1');
    expect(retrieved?.content).toBe('Node1');
  });

  it('should create and retrieve an edge', () => {
    fallbackStorage.createNode({ id: 'n1', type: 'topic', content: '' } as any);
    fallbackStorage.createNode({ id: 'n2', type: 'topic', content: '' } as any);
    const edge = fallbackStorage.createEdge('n1', 'n2', 'mentions', { strength: 0.8 }) as any;
    expect(edge).not.toBeNull();
    expect(edge?.relationship).toBe('mentions');
    const neighbors = fallbackStorage.getNodeNeighbors('n1');
    expect(neighbors.length).toBe(1);
    expect(neighbors[0].node.id).toBe('n2');
  });

  it('should paginate nodes correctly', () => {
    for (let i = 0; i < 10; i++) {
      fallbackStorage.createNode({ id: `node${i}`, type: 'topic', content: '' } as any);
    }
    const page0 = fallbackStorage.getAllNodes(0, 5, null);
    expect(page0.nodes.length).toBe(5);
    expect(page0.total).toBe(10);
    const page1 = fallbackStorage.getAllNodes(1, 5, null);
    expect(page1.nodes.length).toBe(5);
  });
});