/**
 * Graph type definitions for the CogitoMap application
 * These types define the structure of nodes and edges in the knowledge graph
 */

/**
 * Position of a node in 3D space
 */
export interface Position {
  x: number;
  y: number;
  z: number;
}

/**
 * Base Node interface representing a node in the knowledge graph
 */
export interface BubbleNode {
  id: string;
  type: string;
  title?: string;
  content?: string;
  description?: string;
  position: Position;
  importance: number;
  keywords?: string[];
  embedding?: number[];
  // Fields added by semantic search results
  similarity?: number;
  isDirectMatch?: boolean;
  source?: string;
  // Additional properties
  [key: string]: any;
}

/**
 * Edge interface representing a connection between nodes
 */
export interface Edge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  weight?: number;
  properties?: Record<string, any>;
}

/**
 * Interface for graph statistics
 */
export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  usingFallback: boolean;
}

/**
 * Type for node types in the knowledge graph
 */
export type NodeType = 
  | 'user_message'
  | 'ai_message'
  | 'topic' 
  | 'entity'
  | 'concept'
  | 'document'
  | 'image';

/**
 * Type for relationship types between nodes
 */
export type RelationshipType =
  | 'contains'
  | 'relates_to'
  | 'references'
  | 'precedes'
  | 'follows'
  | 'similar_to'
  | 'part_of'
  | 'instance_of'
  | 'responds_to';

/**
 * Search result with metadata from semantic search
 */
export interface SearchResult {
  query: string;
  results: BubbleNode[];
  searchType: 'vector' | 'keyword';
  timestamp: string;
}

/**
 * Parameters for semantic search
 */
export interface SemanticSearchParams {
  query: string;
  nodeTypes?: string[];
  maxResults?: number;
  minSimilarity?: number;
  includeRelated?: boolean;
  maxHops?: number;
  useEmbedding?: boolean;
  requireKeywords?: string[];
}