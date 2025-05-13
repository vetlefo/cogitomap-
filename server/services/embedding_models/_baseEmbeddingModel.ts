/**
 * Base interface for embedding models
 * 
 * Embedding models are responsible for converting text into numerical
 * vector representations that capture semantic meaning. These embeddings
 * are used for similarity search, positioning in 3D space, and other
 * semantic operations.
 */
export interface BaseEmbeddingModel {
  /**
   * Unique identifier for this model
   */
  readonly modelId: string;
  
  /**
   * Human-readable name of the model
   */
  readonly modelName: string;
  
  /**
   * Number of dimensions in the embedding vectors this model produces
   */
  readonly dimensions: number;
  
  /**
   * Maximum token length this model can process
   */
  readonly maxTokens?: number;
  
  /**
   * Whether this model is currently available
   */
  readonly isAvailable: boolean;
  
  /**
   * Initialize the model with configuration
   * 
   * @param config Configuration parameters
   */
  initialize(config?: Record<string, any>): Promise<void>;
  
  /**
   * Generate embedding for a single text input
   * 
   * @param text The text to generate an embedding for
   * @returns A vector of floating point numbers representing the embedding
   */
  generateEmbedding(text: string): Promise<number[]>;
  
  /**
   * Generate embeddings for multiple text inputs in a batch
   * 
   * @param texts Array of texts to generate embeddings for
   * @returns Array of embedding vectors
   */
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
  
  /**
   * Calculate similarity between two embeddings
   * 
   * @param embedding1 First embedding vector
   * @param embedding2 Second embedding vector
   * @returns Similarity score (higher means more similar)
   */
  calculateSimilarity?(embedding1: number[], embedding2: number[]): number;
  
  /**
   * Map embeddings to 3D coordinates for visualization
   * 
   * @param embedding Embedding vector
   * @returns 3D coordinates {x, y, z}
   */
  embedding3DPosition?(embedding: number[]): { x: number, y: number, z: number };
}