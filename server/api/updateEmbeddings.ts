/**
 * API endpoint to update embeddings for nodes in the database
 */

import { Request, Response } from 'express';
import { runEmbeddingUpdate } from '../services/updateEmbeddings';
import { log } from '../vite';

/**
 * Handler for updating embeddings on existing nodes
 * This is useful for retroactively adding embeddings to nodes created before
 * the embedding functionality was implemented or fixed
 */
export async function updateEmbeddingsHandler(req: Request, res: Response) {
  try {
    log("Received update embeddings request", "update-embeddings-api");
    
    // Run the embedding update process
    const result = await runEmbeddingUpdate();
    
    // Return results
    return res.json(result);
  } catch (error) {
    log(`Error in updateEmbeddingsHandler: ${error}`, "update-embeddings-api-error");
    
    return res.status(500).json({
      success: false,
      message: `Server error during embeddings update: ${error instanceof Error ? error.message : error}`
    });
  }
}