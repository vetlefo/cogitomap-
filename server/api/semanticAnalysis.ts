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
import { Message } from '../../client/src/types';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';

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

type SemanticAnalysisRequest = z.infer<typeof SemanticAnalysisRequestSchema>;

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