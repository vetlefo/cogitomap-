/**
 * Base interface for all transformers
 * 
 * Transformers are responsible for extracting meaning and relationships
 * from raw content, generating derived nodes and connections.
 */

import { BubbleNode, Edge } from '../../../client/src/types';

/**
 * Result of a transformer operation
 */
export interface TransformerResult {
  nodes: Partial<BubbleNode>[];
  edges: Partial<Edge>[];
}

/**
 * Context provided to transformers with information about the input
 */
export interface TransformContext {
  node: BubbleNode;
  content: string;
  type: string;
  metadata?: Record<string, any>;
}

/**
 * Base interface that all transformers must implement
 */
export interface BaseTransformer {
  /**
   * Unique identifier for this transformer
   */
  readonly transformerId: string;
  
  /**
   * Human-readable name of the transformer
   */
  readonly transformerName: string;
  
  /**
   * Initialize the transformer with configuration options
   */
  initialize(config?: Record<string, any>): Promise<void>;
  
  /**
   * Process input content and extract derived nodes and relationships
   */
  transform(context: TransformContext): Promise<TransformerResult>;
}