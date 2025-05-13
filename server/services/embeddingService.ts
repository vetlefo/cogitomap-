/**
 * Embedding Service
 * Provides methods for generating embeddings from text content
 * and dimensionality reduction for semantic positioning
 */

import { log } from "../vite";
import seedrandom from "seedrandom";

// Embedding model configuration
const EMBEDDING_MODEL = "text-embedding-3-small"; // Using the newer, more efficient model
const DEFAULT_DIMENSIONS = 768; // Using optimized dimensions (reduced from 1536)

// Optional storage dimension (for smaller vectors in Memgraph)
const STORAGE_DIMENSIONS = 384; // Further reduced for efficient storage

// Reduced dimensions for 3D visualization
const VISUALIZATION_DIMENSIONS = 3;

// Maximum length for input text to prevent excessive processing
const MAX_TEXT_LENGTH = 1000; // Adjust as needed based on application requirements

/**
 * Generate an embedding vector for text content using OpenAI's embedding API
 * @param text The text to generate an embedding for
 * @returns A promise resolving to the embedding vector
 */
/**
 * Generate an embedding vector for text content using OpenAI's embedding API
 * 
 * @param text The text to generate an embedding for
 * @param dimensions Optional parameter to control embedding dimensions
 * @returns A promise resolving to the embedding vector
 */
export async function generateEmbedding(
  text: string, 
  dimensions: number = DEFAULT_DIMENSIONS
): Promise<number[]> {
  try {
    // Check if we have API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      log("No OpenAI API key found, using fallback embedding", "embedding-service");
      return generateFallbackEmbedding(text);
    }

    // Normalize text by removing newlines and excessive spaces
    const normalizedText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    if (!normalizedText) {
      log("Empty text provided for embedding, using fallback", "embedding-service");
      return generateFallbackEmbedding("");
    }

    // Call OpenAI API for embedding
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        input: normalizedText,
        model: EMBEDDING_MODEL,
        dimensions: dimensions,
        encoding_format: "float"
      })
    });

    if (!response.ok) {
      const error = await response.text();
      log(`OpenAI embedding API error: ${error}`, "embedding-service");
      return generateFallbackEmbedding(text);
    }

    const data = await response.json();
    
    if (!data.data || !data.data[0] || !data.data[0].embedding) {
      log("Invalid response format from OpenAI API", "embedding-service");
      return generateFallbackEmbedding(text);
    }
    
    const embedding = data.data[0].embedding;
    log(`Generated embedding with dimensions: ${embedding.length}`, "embedding-service-debug");
    
    // Return either full embedding or storage-optimized version based on dimensions parameter
    if (dimensions === STORAGE_DIMENSIONS) {
      return prepareEmbeddingForStorage(embedding, STORAGE_DIMENSIONS);
    }
    
    return embedding;
  } catch (error) {
    log(`Error generating embedding: ${error}`, "embedding-service");
    return generateFallbackEmbedding(text);
  }
}

/**
 * Generate embeddings for multiple texts in a batch
 * 
 * @param texts Array of texts to generate embeddings for
 * @param dimensions Optional parameter to specify embedding dimensions (default: 768)
 * @returns Promise resolving to array of embedding vectors
 */
export async function generateBatchEmbeddings(
  texts: string[], 
  dimensions: number = DEFAULT_DIMENSIONS
): Promise<number[][]> {
  try {
    // Filter out empty strings
    const nonEmptyTexts = texts
      .filter(text => text && text.trim().length > 0)
      .map(text => text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim());
    
    if (nonEmptyTexts.length === 0) {
      log("No valid texts provided for batch embedding", "embedding-service");
      return [];
    }

    // Check if we have API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      log("No OpenAI API key found, using fallback embeddings for batch", "embedding-service");
      return Promise.all(nonEmptyTexts.map(text => generateFallbackEmbedding(text, dimensions)));
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
        model: EMBEDDING_MODEL,
        dimensions: dimensions,
        encoding_format: "float"
      })
    });

    if (!response.ok) {
      const error = await response.text();
      log(`OpenAI batch embedding API error: ${error}`, "embedding-service");
      return Promise.all(nonEmptyTexts.map(text => generateFallbackEmbedding(text, dimensions)));
    }

    const data = await response.json();
    
    if (!data.data || !Array.isArray(data.data)) {
      log("Invalid response format from OpenAI API for batch embeddings", "embedding-service");
      return Promise.all(nonEmptyTexts.map(text => generateFallbackEmbedding(text, dimensions)));
    }
    
    // Sort the embeddings by index to maintain order
    const sortedEmbeddings: number[][] = data.data
      .sort((a: any, b: any) => a.index - b.index)
      .map((item: any) => item.embedding);
    
    log(`Generated batch embeddings with dimensions: ${sortedEmbeddings[0]?.length || dimensions}`, "embedding-service-debug");
    
    // Apply storage optimizations if requested
    if (dimensions === STORAGE_DIMENSIONS) {
      return sortedEmbeddings.map((embedding: number[]) => 
        prepareEmbeddingForStorage(embedding, STORAGE_DIMENSIONS)
      );
    }
    
    return sortedEmbeddings;
  } catch (error) {
    log(`Error generating batch embeddings: ${error}`, "embedding-service");
    return Promise.all(texts.map(text => generateFallbackEmbedding(text, dimensions)));
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
 * Normalize a vector to unit length (L2 normalization)
 * This is important for consistent similarity calculations
 * 
 * @param vector The vector to normalize
 * @returns Normalized vector with unit length
 */
export function normalizeVector(vector: number[]): number[] {
  if (!vector || vector.length === 0) {
    return vector;
  }
  
  // Calculate magnitude (L2 norm)
  let magnitude = 0;
  for (let i = 0; i < vector.length; i++) {
    magnitude += vector[i] * vector[i];
  }
  magnitude = Math.sqrt(magnitude);
  
  // Avoid division by zero
  if (magnitude === 0) {
    return vector;
  }
  
  // Normalize vector
  return vector.map(value => value / magnitude);
}

/**
 * Calculate cosine similarity between two embedding vectors
 * 
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
 * Find similar content by semantic similarity using embeddings
 *
 * @param queryEmbedding Embedding vector for the search query
 * @param embeddings Array of embeddings to search through
 * @param threshold Minimum similarity threshold (0-1)
 * @param limit Maximum number of results to return
 * @returns Array of indices and their similarity scores, sorted by similarity
 */
export function findSimilarEmbeddings(
  queryEmbedding: number[],
  embeddings: number[][],
  threshold: number = 0.7,
  limit: number = 5
): Array<{ index: number; similarity: number }> {
  if (!queryEmbedding || !embeddings || embeddings.length === 0) {
    return [];
  }

  // Calculate similarities and collect indices
  const similarities = embeddings.map((embedding, index) => ({
    index,
    similarity: calculateSimilarity(queryEmbedding, embedding)
  }));

  // Filter by threshold and sort by similarity (descending)
  return similarities
    .filter(item => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Prepare embedding for storage in Memgraph
 * 
 * @param embedding The embedding vector to prepare
 * @param truncateDimensions Optional number of dimensions to truncate to
 * @returns Normalized and potentially truncated embedding ready for storage
 */
export function prepareEmbeddingForStorage(
  embedding: number[],
  truncateDimensions?: number
): number[] {
  if (!embedding || embedding.length === 0) {
    return [];
  }
  
  // Truncate if requested
  let processedEmbedding = embedding;
  if (truncateDimensions && truncateDimensions < embedding.length) {
    processedEmbedding = embedding.slice(0, truncateDimensions);
  }
  
  // Always normalize before storage
  return normalizeVector(processedEmbedding);
}

/**
 * Generates a Cypher query for Memgraph to find semantically similar nodes
 * using cosine similarity on embeddings
 * 
 * @param queryEmbedding The embedding vector to search with
 * @param nodeTypes Optional array of node types to filter by (e.g., ['topic', 'entity'])
 * @param similarityThreshold Minimum similarity threshold (0-1)
 * @param limit Maximum number of results to return
 * @returns Cypher query string for finding similar nodes
 */
export function buildSemanticSearchQuery(
  queryEmbedding: number[],
  nodeTypes?: string[],
  similarityThreshold: number = 0.7,
  limit: number = 5
): { query: string; params: any } {
  // Normalize the query embedding to ensure consistent similarity
  const normalizedEmbedding = normalizeVector(queryEmbedding);
  
  // Create type filter
  let typeFilter = '';
  if (nodeTypes && nodeTypes.length > 0) {
    const typeList = nodeTypes.map(t => `'${t}'`).join(', ');
    typeFilter = `WHERE n.type IN [${typeList}]`;
  }
  
  // Build the Cypher query for semantic search
  // This uses vector operations available in Memgraph
  const query = `
    MATCH (n)
    ${typeFilter}
    WHERE n.embedding IS NOT NULL
    WITH n,
      gds.similarity.cosine(n.embedding, $embedding) AS similarity
    WHERE similarity >= $threshold
    RETURN n, similarity
    ORDER BY similarity DESC
    LIMIT $limit
  `;
  
  return {
    query,
    params: {
      embedding: normalizedEmbedding,
      threshold: similarityThreshold,
      limit: limit
    }
  };
}

/**
 * Generates a Cypher query for advanced GraphRAG retrieval using community detection
 * and multiple retrieval strategies
 * 
 * @param queryEmbedding The embedding vector to search with
 * @param queryText Optional original query text for keyword-based retrieval
 * @param options Advanced retrieval options
 * @returns Cypher query string for GraphRAG retrieval
 */
export function buildGraphRAGQuery(
  queryEmbedding: number[],
  queryText?: string,
  options: {
    nodeTypes?: string[];
    similarityThreshold?: number;
    limit?: number;
    usePageRank?: boolean; 
    useCommunityDetection?: boolean;
    maxHops?: number;
    includeRelationships?: boolean;
  } = {}
): { query: string; params: any } {
  // Default options
  const {
    nodeTypes,
    similarityThreshold = 0.65,
    limit = 10,
    usePageRank = true,
    useCommunityDetection = true,
    maxHops = 2,
    includeRelationships = true
  } = options;

  // Normalize the query embedding
  const normalizedEmbedding = normalizeVector(queryEmbedding);
  
  // Create type filter
  let typeFilter = '';
  if (nodeTypes && nodeTypes.length > 0) {
    const typeList = nodeTypes.map(t => `'${t}'`).join(', ');
    typeFilter = `AND n.type IN [${typeList}]`;
  }
  
  // Build the first part - vector similarity search to find initial relevant nodes
  let query = `
    // Step 1: Initial vector search to find semantically similar nodes
    MATCH (n)
    WHERE n.embedding IS NOT NULL ${typeFilter}
    WITH n, gds.similarity.cosine(n.embedding, $embedding) AS similarity
    WHERE similarity >= $threshold
  `;
  
  // Optional text search if query text is provided
  if (queryText && queryText.trim()) {
    // Add hybrid retrieval with text search
    query += `
    // Step 1b: Hybrid retrieval - combine with text search
    WITH n, similarity
    WHERE n.content CONTAINS $queryText OR
          ANY(kw IN n.keywords WHERE kw CONTAINS $queryText)
    `;
  }
  
  // Optional PageRank for importance weighting
  if (usePageRank) {
    query += `
    // Step 2: Apply PageRank importance weighting
    WITH n, similarity
    CALL pagerank.get(n) YIELD rank
    WITH n, similarity, rank
    ORDER BY similarity * rank DESC
    LIMIT $initialLimit
    `;
  } else {
    query += `
    // Step 2: Select top nodes by similarity
    WITH n, similarity
    ORDER BY similarity DESC
    LIMIT $initialLimit
    `;
  }
  
  // Optional community detection for relationship expansion
  if (useCommunityDetection && includeRelationships) {
    query += `
    // Step 3: Relationship expansion with community detection
    WITH COLLECT(n) AS initialNodes
    UNWIND initialNodes AS seedNode
    MATCH path = (seedNode)-[r*1..${maxHops}]-(related)
    WHERE related.embedding IS NOT NULL
    WITH COLLECT(DISTINCT seedNode) + COLLECT(DISTINCT related) AS expandedNodes, initialNodes
    
    // Step 4: Filter and rank final results
    UNWIND expandedNodes AS node
    WITH node, 
         node IN initialNodes AS isDirectMatch,
         gds.similarity.cosine(node.embedding, $embedding) AS expandedSimilarity
    ORDER BY isDirectMatch DESC, expandedSimilarity DESC
    LIMIT $limit
    RETURN node, expandedSimilarity AS similarity
    `;
  } else {
    // Just return the initial nodes if no expansion is requested
    query += `
    // Step 3: Return results without expansion
    WITH n, similarity
    LIMIT $limit
    RETURN n AS node, similarity
    `;
  }
  
  // Build parameters
  const params: any = {
    embedding: normalizedEmbedding,
    threshold: similarityThreshold,
    initialLimit: Math.min(limit * 2, 20), // Get more initial nodes than final limit
    limit: limit
  };
  
  // Add query text if provided
  if (queryText && queryText.trim()) {
    params.queryText = queryText.trim();
  }
  
  return { query, params };
}

/**
 * Generate a deterministic fallback embedding from text
 * This is used when the OpenAI API is not available
 * @param text The text to generate a fallback embedding for
 * @param dimensions The dimensions for the generated embedding
 * @returns A deterministic embedding vector of the expected dimensionality
 */
function generateFallbackEmbedding(text: string, dimensions: number = DEFAULT_DIMENSIONS): number[] {
  // Initialize embedding with zeros
  const embedding = new Array(dimensions).fill(0);
  
  // Normalize text
  let normalizedText = text.toLowerCase().trim().slice(0, MAX_TEXT_LENGTH);
  
  // Ensure normalizedText length does not exceed MAX_TEXT_LENGTH
  if (normalizedText.length > MAX_TEXT_LENGTH) {
    normalizedText = normalizedText.slice(0, MAX_TEXT_LENGTH);
  }
  
  // Generate a deterministic hash-based embedding
  for (let i = 0; i < normalizedText.length; i++) {
    const charCode = normalizedText.charCodeAt(i);
    const position = (charCode * 17) % dimensions;
    
    // Vary the values based on character and position
    embedding[position] += (charCode / 255) * (i % 2 === 0 ? 1 : -1) * 0.01;
  }
  
  // Return normalized vector
  return normalizeVector(embedding);
}