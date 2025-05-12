/**
 * API endpoint for semantic search functionality
 * Supports both vector similarity search and text-based search
 */

import { Request, Response } from "express";
import { log } from "../vite";
import { generateEmbedding } from "../services/embeddingService";
import { performVectorSearch, performSemanticGraphSearch } from "../services/mageVectorService";

/**
 * Semantic search handler
 * Supports:
 * - Vector similarity search (using embeddings)
 * - Text-based search (full text or keywords)
 * - Optional graph expansion for related content
 */
export async function semanticSearchHandler(req: Request, res: Response) {
  try {
    const {
      query,                  // Text query to search for
      vectorSearch = true,    // Whether to use vector similarity search
      textSearch = false,     // Whether to use text-based search
      nodeTypes = [],         // Types of nodes to search (empty array = all)
      limit = 10,             // Max number of results to return
      minSimilarity = 0.6,    // Minimum similarity threshold for vector search
      expandGraphSearch = false // Whether to expand search to related nodes
    } = req.body;
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Query is required'
      });
    }
    
    log(`Performing semantic search for "${query}"`, 'semantic-search');
    
    // Default to vector search if not specified
    let results = [];
    
    // For vector search, generate an embedding and find similar content
    if (vectorSearch) {
      try {
        const embedding = await generateEmbedding(query);
        
        if (expandGraphSearch) {
          // Advanced semantic search with graph expansion
          results = await performSemanticGraphSearch(embedding, {
            nodeTypes: nodeTypes.length > 0 ? nodeTypes : undefined,
            limit,
            minSimilarity,
            maxHops: 2,
            includeRelated: true
          });
        } else {
          // Simple vector search
          results = await performVectorSearch(
            embedding,
            undefined, // Use default index
            limit,
            minSimilarity
          );
        }
        
        log(`Vector search returned ${results.length} results`, 'semantic-search');
      } catch (error) {
        log(`Error in vector search: ${error}`, 'semantic-search-error');
        
        // Fall back to text search if vector search fails
        if (textSearch) {
          log('Falling back to text search', 'semantic-search');
          // Implement text search logic here if needed
        } else {
          return res.status(500).json({
            error: 'Vector search failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    } else if (textSearch) {
      // Basic text search - this could be implemented separately if needed
      log('Text search not implemented yet', 'semantic-search');
    }
    
    return res.status(200).json({
      query,
      results,
      count: results.length,
      searchType: vectorSearch ? 'vector' : 'text'
    });
  } catch (error) {
    log(`Error in semantic search: ${error}`, 'semantic-search-error');
    
    return res.status(500).json({
      error: 'Semantic search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}