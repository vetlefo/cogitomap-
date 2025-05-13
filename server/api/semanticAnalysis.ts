/**
 * API endpoints for semantic analysis capabilities
 */

import { Request, Response } from 'express';
import { 
  extractKeywordsFromConversation, 
  findSemanticRelationships,
  generateSemanticConnections,
  createSummaryNode,
  runAsyncSemanticAnalysis
} from '../services/semanticAnalysisService';
import { generateEmbedding } from '../services/embeddingService';
import { 
  vectorSearch,
  initMageVectorService 
} from '../services/mageVectorService';
import { Message } from '../../client/src/types';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { log } from '../vite';

// Schema for semantic analysis request
const SemanticAnalysisRequestSchema = z.object({
  messageHistory: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string()
  })),
  keywords: z.array(z.string()).optional(),
  analysisMode: z.enum(['full', 'keywords_only', 'relationships_only', 'summary_only']).optional(),
  analysisOptions: z.object({
    includeMessageContext: z.boolean().optional(),
    maxKeywords: z.number().min(5).max(30).optional(),
    minConnectionStrength: z.number().min(1).max(10).optional()
  }).optional()
});

// Schema for semantic search request
const SemanticSearchRequestSchema = z.object({
  query: z.string().min(3),
  nodeTypes: z.array(z.string()).optional(),
  maxResults: z.number().min(1).max(50).optional(),
  minSimilarity: z.number().min(0.1).max(1.0).optional(),
  includeRelated: z.boolean().optional(),
  maxHops: z.number().min(1).max(3).optional(),
  useEmbedding: z.boolean().optional(),
  requireKeywords: z.array(z.string()).optional()
});

type SemanticAnalysisRequest = z.infer<typeof SemanticAnalysisRequestSchema>;
type SemanticSearchRequest = z.infer<typeof SemanticSearchRequestSchema>;

/**
 * Endpoint to extract keywords from a conversation
 */
export async function extractKeywordsHandler(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = SemanticAnalysisRequestSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      return res.status(400).json({ error: errorMessage });
    }
    
    const { messageHistory } = validationResult.data;
    
    // Extract keywords
    const keywords = await extractKeywordsFromConversation(messageHistory);
    
    return res.json({ keywords });
  } catch (error) {
    console.error('Error extracting keywords:', error);
    return res.status(500).json({ 
      error: 'Internal server error extracting keywords',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Endpoint to find semantic relationships between keywords
 */
export async function findRelationshipsHandler(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = SemanticAnalysisRequestSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      return res.status(400).json({ error: errorMessage });
    }
    
    const { keywords, messageHistory } = validationResult.data;
    
    if (!keywords || keywords.length === 0) {
      return res.status(400).json({ error: 'Keywords are required for relationship analysis' });
    }
    
    // Find relationships
    const relationshipData = await findSemanticRelationships(
      keywords, 
      messageHistory
    );
    
    return res.json(relationshipData);
  } catch (error) {
    console.error('Error finding semantic relationships:', error);
    return res.status(500).json({ 
      error: 'Internal server error finding semantic relationships',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Main endpoint to run asynchronous semantic analysis
 */
export async function runSemanticAnalysisHandler(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = SemanticAnalysisRequestSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      return res.status(400).json({ error: errorMessage });
    }
    
    const { messageHistory, analysisMode = 'full' } = validationResult.data;
    
    if (messageHistory.length < 2) {
      return res.status(400).json({ 
        error: 'Not enough message history for meaningful analysis',
        minimumRequired: 2,
        provided: messageHistory.length
      });
    }
    
    // Choose the analysis method based on mode
    let result;
    
    switch (analysisMode) {
      case 'keywords_only':
        const keywords = await extractKeywordsFromConversation(messageHistory);
        result = { keywords, mode: 'keywords_only' };
        break;
        
      case 'relationships_only':
        // First extract keywords, then find relationships
        const extractedKeywords = await extractKeywordsFromConversation(messageHistory);
        const relationships = await findSemanticRelationships(extractedKeywords, messageHistory);
        result = { ...relationships, keywords: extractedKeywords, mode: 'relationships_only' };
        break;
        
      case 'summary_only':
        // Create a summary of recent messages
        const extractedKeywordsForSummary = await extractKeywordsFromConversation(messageHistory);
        const summaryNode = await createSummaryNode(extractedKeywordsForSummary, messageHistory);
        result = { summaryNode, keywords: extractedKeywordsForSummary, mode: 'summary_only' };
        break;
        
      case 'full':
      default:
        // Run the complete analysis pipeline
        result = await runAsyncSemanticAnalysis(messageHistory);
        break;
    }
    
    return res.json(result);
  } catch (error) {
    console.error('Error running semantic analysis:', error);
    return res.status(500).json({ 
      error: 'Internal server error during semantic analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Endpoint for semantic vector search in the knowledge graph
 * Uses MAGE's vector search capabilities for efficient similarity search
 */
export async function semanticSearchHandler(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = SemanticSearchRequestSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      return res.status(400).json({ error: errorMessage });
    }
    
    const { 
      query, 
      nodeTypes = [], 
      maxResults = 10, 
      minSimilarity = 0.65,
      includeRelated = true,
      maxHops = 2,
      useEmbedding = true,
      requireKeywords = []
    } = validationResult.data;
    
    log(`Performing semantic search for query: "${query}"`, "semantic-search-api");
    
    // Initialize the MAGE vector service if using embeddings
    if (useEmbedding) {
      try {
        await initMageVectorService();
      } catch (error) {
        log(`Error initializing MAGE: ${error}`, "semantic-search-api-error");
        // Continue anyway, as we'll use fallback storage
      }
    }
    
    let results: any[] = [];
    
    // If embeddings are requested, generate and use them
    if (useEmbedding) {
      try {
        // Generate embedding for query
        const queryEmbedding = await generateEmbedding(query);
        
        // Perform vector-based semantic search using the new vectorSearch function
        const directResults = await vectorSearch(
          queryEmbedding,
          minSimilarity,
          maxResults,
          nodeTypes
        );
        
        results = directResults;
        log(`Found ${directResults.length} semantic matches using vector search`, "semantic-search-api");
      } catch (error) {
        log(`Error in vector search, falling back to keyword search: ${error}`, "semantic-search-api-error");
        
        // Fallback to basic keyword search
        results = await performKeywordSearch(query, nodeTypes, maxResults);
      }
    } else {
      // Perform keyword-based search
      results = await performKeywordSearch(query, nodeTypes, maxResults);
      log(`Found ${results.length} matches using keyword search`, "semantic-search-api");
    }
    
    return res.json({
      query,
      results,
      searchType: useEmbedding ? 'vector' : 'keyword',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log(`Error in semantic search: ${error}`, "semantic-search-api-error");
    return res.status(500).json({ 
      error: 'Internal server error during semantic search',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Helper function for basic keyword search in the graph
 */
async function performKeywordSearch(
  query: string, 
  nodeTypes: string[] = [], 
  limit: number = 10
): Promise<Array<{id: string, type: string, content: string, similarity: number, isDirectMatch: boolean}>> {
  try {
    const searchTerms = query.toLowerCase().split(/\s+/);
    
    // Build type filter
    let typeFilter = '';
    if (nodeTypes && nodeTypes.length > 0) {
      const typeList = nodeTypes.map(t => `n.type = '${t}'`).join(' OR ');
      typeFilter = `AND (${typeList})`;
    }
    
    // Crude keyword matching query
    const keywordQuery = `
      MATCH (n)
      WHERE n.content IS NOT NULL ${typeFilter}
      WITH n, n.content AS content
      WHERE ${searchTerms.map(term => `toLower(content) CONTAINS '${term.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`).join(' OR ')}
      RETURN n.id AS id, n.type AS type, n.content AS content
      LIMIT ${limit}
    `;
    
    // This is a placeholder - in a real implementation, use the memgraphClient directly
    // For now, return a mock result
    return [{
      id: 'keyword-search-not-implemented',
      type: 'info',
      content: 'Keyword search fallback not fully implemented. Please use vector search.',
      similarity: 1.0,
      isDirectMatch: true
    }];
  } catch (error) {
    log(`Error in keyword search: ${error}`, "semantic-search-api-error");
    return [];
  }
}