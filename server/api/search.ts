/**
 * API endpoints for search functionality
 * Includes both text search and semantic vector search
 */

import { Request, Response } from "express";
import { log } from "../vite";
import { generateEmbedding } from "../services/embeddingService";
import { performSemanticGraphSearch } from "../services/mageVectorService";

/**
 * Semantic search handler using embeddings and vector similarity
 * This accepts a text query, generates an embedding, and finds similar nodes
 */
export async function semanticSearchHandler(req: Request, res: Response) {
  try {
    const { 
      query, 
      minSimilarity = 0.65, 
      limit = 10,
      includeRelated = true,
      maxHops = 2,
      nodeTypes
    } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        error: 'Search query is required and must be a string' 
      });
    }
    
    log(`Semantic search for: "${query}"`, "semantic-search");
    
    // Generate embedding for the search query
    const embedding = await generateEmbedding(query);
    
    if (!embedding) {
      return res.status(500).json({ 
        error: 'Failed to generate embedding for search query' 
      });
    }
    
    // Perform the search with the embedding
    const results = await performSemanticGraphSearch(embedding, {
      minSimilarity: Number(minSimilarity),
      limit: Number(limit),
      includeRelated: Boolean(includeRelated),
      maxHops: Number(maxHops),
      nodeTypes: nodeTypes ? (Array.isArray(nodeTypes) ? nodeTypes : [nodeTypes]) : undefined
    });
    
    return res.json({
      results,
      meta: {
        query,
        resultCount: results.length,
        minSimilarity,
        includeRelated,
        maxHops,
        nodeTypes
      }
    });
  } catch (error) {
    log(`Error in semantic search: ${error}`, "semantic-search-error");
    return res.status(500).json({
      error: 'Error performing semantic search',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Text search handler using string matching
 * This performs a simple text-based search without embeddings
 */
export async function textSearchHandler(req: Request, res: Response) {
  try {
    const { 
      query, 
      limit = 10,
      caseSensitive = false,
      nodeTypes
    } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        error: 'Search query is required and must be a string' 
      });
    }
    
    log(`Text search for: "${query}"`, "text-search");
    
    // This is a placeholder implementation
    // In a real implementation, we would query the database for nodes
    // containing the search text
    return res.json({
      results: [],
      meta: {
        query,
        resultCount: 0,
        caseSensitive,
        nodeTypes,
        status: "Text search not yet implemented"
      }
    });
  } catch (error) {
    log(`Error in text search: ${error}`, "text-search-error");
    return res.status(500).json({
      error: 'Error performing text search',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}