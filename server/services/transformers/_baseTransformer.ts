import { BubbleNode, Edge } from '../../../client/src/types';

/**
 * Base interface for data transformers
 * 
 * Transformers process BubbleNode objects and perform operations like:
 * - Extracting keywords or entities
 * - Generating embeddings
 * - Creating summarizations
 * - Establishing relationships between nodes
 * 
 * They can modify the incoming nodes directly or generate new nodes.
 */
export interface BaseTransformer {
  /**
   * Unique identifier for this transformer
   */
  readonly transformerId: string;
  
  /**
   * Human-readable name of the transformer
   */
  readonly name: string;
  
  /**
   * Description of what this transformer does
   */
  readonly description: string;
  
  /**
   * Configuration schema for this transformer
   */
  readonly configSchema?: Record<string, any>;
  
  /**
   * Transform a batch of nodes
   * 
   * This method should modify or augment the provided nodes, or generate
   * completely new nodes based on the input.
   * 
   * @param nodes Partial BubbleNode objects to transform
   * @param context Additional context for the transformation
   * @returns An array of transformed nodes, potentially including new generated nodes
   */
  transform(
    nodes: Partial<BubbleNode>[], 
    context?: any
  ): Promise<{ 
    nodes: Partial<BubbleNode>[], 
    edges?: Partial<Edge>[] 
  }>;
  
  /**
   * Initialize the transformer with configuration
   * 
   * @param config Configuration parameters
   */
  initialize?(config?: Record<string, any>): Promise<void>;
}