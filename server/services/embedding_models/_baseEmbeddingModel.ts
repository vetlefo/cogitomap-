/**
 * Base interface for embedding models
 * 
 * Embedding models convert text to vector representations that capture semantic meaning.
 * These vectors enable similarity comparisons, clustering, and other semantic operations.
 */

/**
 * Base interface that all embedding models must implement
 */
export interface BaseEmbeddingModel {
  /**
   * Unique identifier for this embedding model
   */
  readonly modelId: string;
  
  /**
   * Human-readable name of the embedding model
   */
  readonly modelName: string;
  
  /**
   * Number of dimensions in the embedding vectors
   */
  readonly dimensions: number;
  
  /**
   * Maximum number of tokens the model can process at once
   */
  readonly maxTokens: number;
  
  /**
   * Initialize the embedding model with configuration
   */
  initialize(config?: Record<string, any>): Promise<void>;
  
  /**
   * Generate an embedding vector for a text string
   */
  generateEmbedding(text: string): Promise<number[]>;
  
  /**
   * Generate embedding vectors for multiple text strings
   */
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
  
  /**
   * Calculate similarity between two embedding vectors
   * (typically cosine similarity)
   */
  calculateSimilarity(embedding1: number[], embedding2: number[]): number;
  
  /**
   * Calculate a 3D position from an embedding vector for visualization
   */
  embedding3DPosition?(embedding: number[]): { x: number, y: number, z: number };
  
  /**
   * Whether the embedding model is available and ready to use
   */
  get isAvailable(): boolean;
}