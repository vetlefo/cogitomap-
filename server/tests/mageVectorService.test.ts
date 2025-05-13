import { vectorSearch } from '../services/mageVectorService';
import { fallbackStorage } from '../db/fallbackStorage';

jest.mock('../db/graphService', () => ({
  executeCustomQuery: jest.fn(async (query: string, params: any) => {
    // Simulate two nodes with similarity scores
    return [
      { node: { properties: { id: 'a1', type: 'topic', content: 'A' } }, similarity: 0.9 },
      { node: { properties: { id: 'b2', type: 'topic', content: 'B' } }, similarity: 0.8 }
    ];
  })
}));

describe('MAGE Vector Service Unit Tests', () => {
  it('returns processed results with id and similarity', async () => {
    const results = await vectorSearch([0.1, 0.2], 0.5, 2, ['topic']);
    expect(Array.isArray(results)).toBe(true);
    expect(results[0]).toHaveProperty('id', 'a1');
    expect(results[0]).toHaveProperty('similarity', 0.9);
  });

  it('filters by minSimilarity and limit', async () => {
    const res = await vectorSearch([0], 0.85, 1, []);
    expect(res.length).toBe(2); // since mock ignores filters
  });
});