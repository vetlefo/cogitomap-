/**
 * Embedding Service
 * Provides methods for generating embeddings from text content
 * and dimensionality reduction for semantic positioning
 */

import { log } from "../vite";

// Default embedding dimensions for OpenAI ada-002
const EMBEDDING_DIMENSIONS = 1536;

// Reduced dimensions for 3D visualization
const VISUALIZATION_DIMENSIONS = 3;

/**
 * Generate an embedding vector for text content using OpenAI's embedding API
 * @param text The text to generate an embedding for
 * @returns A promise resolving to the embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Check if we have API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      log("No OpenAI API key found, using fallback embedding", "embedding-service");
      return generateFallbackEmbedding(text);
    }

    // Call OpenAI API for embedding
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        input: text,
        model: "text-embedding-ada-002"
      })
    });

    if (!response.ok) {
      const error = await response.text();
      log(`OpenAI embedding API error: ${error}`, "embedding-service");
      return generateFallbackEmbedding(text);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    log(`Error generating embedding: ${error}`, "embedding-service");
    return generateFallbackEmbedding(text);
  }
}

/**
 * Generate embeddings for multiple texts in a batch
 * @param texts Array of texts to generate embeddings for
 * @returns Promise resolving to array of embedding vectors
 */
export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    // Filter out empty strings
    const nonEmptyTexts = texts.filter(text => text.trim().length > 0);
    
    if (nonEmptyTexts.length === 0) {
      return [];
    }

    // Check if we have API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      log("No OpenAI API key found, using fallback embeddings for batch", "embedding-service");
      return Promise.all(nonEmptyTexts.map(generateFallbackEmbedding));
    }

    // Call OpenAI API for embeddings
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        input: nonEmptyTexts,
        model: "text-embedding-ada-002"
      })
    });

    if (!response.ok) {
      const error = await response.text();
      log(`OpenAI batch embedding API error: ${error}`, "embedding-service");
      return Promise.all(nonEmptyTexts.map(generateFallbackEmbedding));
    }

    const data = await response.json();
    
    // Sort the embeddings by index to maintain order
    const sortedEmbeddings = data.data
      .sort((a: any, b: any) => a.index - b.index)
      .map((item: any) => item.embedding);
      
    return sortedEmbeddings;
  } catch (error) {
    log(`Error generating batch embeddings: ${error}`, "embedding-service");
    return Promise.all(texts.map(generateFallbackEmbedding));
  }
}

/**
 * Generate a semantic 3D position from an embedding vector using a simplified PCA-inspired approach
 * @param embedding Full embedding vector
 * @returns 3D position coordinates
 */
export function embedding3DPosition(embedding: number[]): { x: number, y: number, z: number } {
  // If no embedding is provided, return a random position
  if (!embedding || embedding.length === 0) {
    return {
      x: (Math.random() * 20) - 10,
      y: (Math.random() * 10) - 5,
      z: (Math.random() * 20) - 10
    };
  }

  // Divide the embedding into three sections for x, y, z
  const sectionSize = Math.floor(embedding.length / 3);
  
  // Calculate the weighted sum of each section
  let x = 0, y = 0, z = 0;
  
  // x - use first section
  for (let i = 0; i < sectionSize; i++) {
    x += embedding[i] * (1 - i/sectionSize); // Weight decreases with index
  }
  
  // y - use second section
  for (let i = sectionSize; i < 2 * sectionSize; i++) {
    y += embedding[i] * (1 - (i-sectionSize)/sectionSize);
  }
  
  // z - use third section
  for (let i = 2 * sectionSize; i < embedding.length; i++) {
    z += embedding[i] * (1 - (i-2*sectionSize)/(embedding.length-2*sectionSize));
  }
  
  // Scale values to reasonable range for visualization
  // Normalize to a range of -15 to 15 for X and Z, -8 to 8 for Y
  const scale = 15;
  const yScale = 8;
  
  return {
    x: x * scale,
    y: y * yScale,
    z: z * scale
  };
}

/**
 * Calculate cosine similarity between two embedding vectors
 * @param embedA First embedding vector
 * @param embedB Second embedding vector
 * @returns Similarity score between 0 and 1
 */
export function calculateSimilarity(embedA: number[], embedB: number[]): number {
  if (!embedA || !embedB || embedA.length === 0 || embedB.length === 0) {
    return 0;
  }
  
  // Make sure vectors are same length
  const length = Math.min(embedA.length, embedB.length);
  
  // Calculate dot product
  let dotProduct = 0;
  for (let i = 0; i < length; i++) {
    dotProduct += embedA[i] * embedB[i];
  }
  
  // Calculate magnitudes
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < length; i++) {
    magA += embedA[i] * embedA[i];
    magB += embedB[i] * embedB[i];
  }
  
  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);
  
  // Avoid division by zero
  if (magA === 0 || magB === 0) {
    return 0;
  }
  
  // Return cosine similarity
  return dotProduct / (magA * magB);
}

/**
 * Generate a deterministic fallback embedding from text
 * This is used when the OpenAI API is not available
 * @param text The text to generate a fallback embedding for
 * @returns A deterministic embedding vector of the expected dimensionality
 */
function generateFallbackEmbedding(text: string): number[] {
  // Initialize embedding with zeros
  const embedding = new Array(EMBEDDING_DIMENSIONS).fill(0);
  
  // Normalize text
  const normalizedText = text.toLowerCase().trim();
  
  // Generate a deterministic hash-based embedding
  for (let i = 0; i < normalizedText.length; i++) {
    const charCode = normalizedText.charCodeAt(i);
    const position = (charCode * 17) % EMBEDDING_DIMENSIONS;
    
    // Vary the values based on character and position
    embedding[position] += (charCode / 255) * (i % 2 === 0 ? 1 : -1) * 0.01;
  }
  
  // Normalize the vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] = embedding[i] / magnitude;
    }
  }
  
  return embedding;
}