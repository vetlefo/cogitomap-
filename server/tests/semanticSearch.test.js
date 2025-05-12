/**
 * Unit tests for semantic search functionality
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { fallbackStorage } from '../db/fallbackStorage.js';
import { vectorSearch } from '../services/mageVectorService.js';

// Mock the embedding service
vi.mock('../services/embeddingService.js', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
}));

// Mock the vector search in memgraph
vi.mock('../db/memgraphClient.js', () => ({
  runMemgraphQuery: vi.fn().mockRejectedValue(new Error('Memgraph unavailable')),
}));

describe('Semantic Search Functionality', () => {
  // Test nodes
  const testNodes = [
    {
      id: 'topic-semantic-search',
      content: 'Semantic search uses AI to find content based on meaning rather than exact keywords',
      type: 'topic',
      position: { x: 10, y: 5, z: -8 },
      importance: 0.85,
      keywords: ['semantic search', 'AI', 'meaning', 'search'],
      embedding_vector: new Array(768).fill(0.1),
    },
    {
      id: 'entity-vector-embeddings',
      content: 'Vector embeddings represent text as numerical vectors capturing semantic meaning',
      type: 'entity',
      position: { x: -5, y: 2, z: -12 },
      importance: 0.8,
      keywords: ['vector embeddings', 'numerical vectors', 'semantics', 'text representation'],
      embedding_vector: new Array(768).fill(0.2),
    },
    {
      id: 'user_message-question-about-search',
      content: 'How can I find information that\'s related by meaning?',
      type: 'user_message',
      position: { x: 3, y: -4, z: -6 },
      importance: 0.75,
      keywords: ['search', 'information', 'meaning', 'related'],
      embedding_vector: new Array(768).fill(0.15),
    },
  ];

  // Setup: Add test nodes to fallback storage
  beforeAll(() => {
    // Clear fallback storage
    fallbackStorage.clear();
    
    // Add test nodes
    testNodes.forEach(node => {
      fallbackStorage.createNode(node);
    });
    
    // Add edges between nodes
    fallbackStorage.addEdge(
      'topic-semantic-search',
      'entity-vector-embeddings',
      'elaborates',
      { strength: 0.8 }
    );
    
    fallbackStorage.addEdge(
      'user_message-question-about-search',
      'topic-semantic-search',
      'mentions',
      { strength: 0.75 }
    );
  });
  
  // Clean up
  afterAll(() => {
    fallbackStorage.clear();
  });
  
  it('should create and retrieve nodes properly', () => {
    const result = fallbackStorage.getAllNodes();
    expect(result.nodes.length).toBe(3);
    expect(result.total).toBe(3);
  });
  
  it('should filter nodes by type', () => {
    const result = fallbackStorage.getAllNodes(0, 50, 'topic');
    expect(result.nodes.length).toBe(1);
    expect(result.nodes[0].id).toBe('topic-semantic-search');
  });
  
  it('should perform vector search in fallback mode', async () => {
    // Create a test query vector
    const queryVector = new Array(768).fill(0.1);
    
    // Perform search
    const results = await fallbackStorage.vectorSearch(
      queryVector, 
      0.5,  // minSimilarity
      5,    // limit
      []    // No type filter
    );
    
    // Verify results
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].similarity).toBeGreaterThan(0.5);
  });
  
  it('should handle type filters in vector search', async () => {
    // Create a test query vector
    const queryVector = new Array(768).fill(0.1);
    
    // Perform search with type filter
    const results = await fallbackStorage.vectorSearch(
      queryVector, 
      0.5,        // minSimilarity
      5,          // limit
      ['topic']   // Only search for topics
    );
    
    // Verify results
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('topic');
  });
  
  it('should rank results by similarity', async () => {
    // Create a test query vector more similar to entity-vector-embeddings
    const queryVector = new Array(768).fill(0.2);
    
    // Perform search
    const results = await fallbackStorage.vectorSearch(
      queryVector, 
      0.5,  // minSimilarity
      5,    // limit
      []    // No type filter
    );
    
    // Verify results
    expect(results[0].id).toBe('entity-vector-embeddings');
  });
  
  it('should handle edge retrieval', () => {
    const result = fallbackStorage.getAllEdges();
    expect(result.edges.length).toBe(2);
    expect(result.total).toBe(2);
  });
  
  it('should filter edges by relationship type', () => {
    const result = fallbackStorage.getAllEdges(0, 50, 'elaborates');
    expect(result.edges.length).toBe(1);
    expect(result.edges[0].relationship).toBe('elaborates');
  });
});