/**
 * OpenAI Embedding Model Implementation
 * 
 * Provides text embedding functionality using OpenAI's embedding API.
 * Supports the text-embedding-ada-002 model by default.
 */

import { BaseEmbeddingModel } from './_baseEmbeddingModel';

export class OpenaiEmbeddingModel implements BaseEmbeddingModel {
  readonly modelId: string = 'openai-embedding';
  readonly modelName: string = 'OpenAI Embeddings';
  
  // We'll store the actual dimensions here and reference it
  private _dimensions: number = 1536; // text-embedding-ada-002 dimensions
  readonly maxTokens: number = 8191; // Maximum tokens for text-embedding-ada-002
  
  private _isAvailable: boolean = false;
  private apiKey: string | null = null;
  private embeddingModel: string = 'text-embedding-ada-002';
  private baseURL: string = 'https://api.openai.com/v1/embeddings';
  
  /**
   * Get dimensions of the embedding vectors
   */
  get dimensions(): number {
    return this._dimensions;
  }
  
  /**
   * Check if the model is available (has API key)
   */
  get isAvailable(): boolean {
    return this._isAvailable;
  }
  
  /**
   * Initialize the embedding model with configuration
   */
  async initialize(config?: Record<string, any>): Promise<void> {
    // Use provided API key or fall back to environment variable
    this.apiKey = (config?.apiKey as string) || process.env.OPENAI_API_KEY || null;
    
    // Use provided model or fall back to default
    this.embeddingModel = (config?.model as string) || this.embeddingModel;
    
    // Set dimensions based on the model
    if (this.embeddingModel === 'text-embedding-3-small') {
      this._dimensions = 1536;
    } else if (this.embeddingModel === 'text-embedding-3-large') {
      this._dimensions = 3072;
    }
    
    // Update availability based on API key presence
    this._isAvailable = !!this.apiKey;
    
    if (!this._isAvailable) {
      console.warn('OpenAI embedding model initialized without API key. Embeddings will not be available.');
    }
  }
  
  /**
   * Generate an embedding for a single text string
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required for embedding generation');
    }

    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          model: this.embeddingModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as Record<string, any>;
        throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json() as {
        data: Array<{
          embedding: number[];
          index: number;
          object: string;
        }>;
        model: string;
        object: string;
        usage: {
          prompt_tokens: number;
          total_tokens: number;
        };
      };
      
      const embedding = data.data[0]?.embedding;
      
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding format returned from OpenAI API');
      }
      
      console.debug(`[embedding-service-debug] Generated embedding with dimensions: ${embedding.length}`);
      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to generate embedding: ${error.message}`);
      } else {
        throw new Error('Failed to generate embedding: Unknown error');
      }
    }
  }
  
  /**
   * Generate embeddings for multiple texts in a batch
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required for embedding generation');
    }

    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: texts,
          model: this.embeddingModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as Record<string, any>;
        throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json() as {
        data: Array<{
          embedding: number[];
          index: number;
          object: string;
        }>;
        model: string;
        object: string;
        usage: {
          prompt_tokens: number;
          total_tokens: number;
        };
      };
      
      // Sort embeddings by index to ensure they match the input order
      const sortedEmbeddings = data.data
        .sort((a, b) => a.index - b.index)
        .map(item => item.embedding);
      
      console.debug(`[embedding-service-debug] Generated ${sortedEmbeddings.length} embeddings in batch`);
      return sortedEmbeddings;
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to generate batch embeddings: ${error.message}`);
      } else {
        throw new Error('Failed to generate batch embeddings: Unknown error');
      }
    }
  }
  
  /**
   * Calculate cosine similarity between two embedding vectors
   */
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }
    
    // Calculate dot product
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }
    
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
    
    // Handle zero magnitude (avoid division by zero)
    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }
    
    // Cosine similarity
    return dotProduct / (magnitude1 * magnitude2);
  }
  
  /**
   * Calculate 3D position from embedding for visualization
   * 
   * This uses PCA-like dimensionality reduction to map
   * the high-dimensional embedding to 3D space.
   */
  embedding3DPosition(embedding: number[]): { x: number, y: number, z: number } {
    // Modified dimensional reduction approach based on dot products with different
    // projection vectors to capture different semantic dimensions
    
    const chunkSize = Math.floor(embedding.length / 3);
    const dim = embedding.length;
    
    // Create three different projection vectors
    const projectionX = Array(dim).fill(0).map((_, i) => 
      Math.sin(i * 2 * Math.PI / dim) * (1 - i/dim)
    );
    
    const projectionY = Array(dim).fill(0).map((_, i) => 
      Math.cos(i * 2 * Math.PI / dim) * (i/dim)
    );
    
    const projectionZ = Array(dim).fill(0).map((_, i) => 
      Math.sin(i * 4 * Math.PI / dim) * Math.cos(i * 2 * Math.PI / dim)
    );
    
    // Project the embedding onto these vectors
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < dim; i++) {
      x += embedding[i] * projectionX[i];
      y += embedding[i] * projectionY[i];
      z += embedding[i] * projectionZ[i];
    }
    
    // Scale for visualization
    const scale = 15;
    
    return {
      x: x * scale,
      y: y * scale,
      z: z * scale
    };
  }
}