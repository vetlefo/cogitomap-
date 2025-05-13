/**
 * Pipeline Controller
 * 
 * This service initializes and manages the pipeline components (sources,
 * transformers, and embedding models) and provides integration points
 * for using them with the API endpoints.
 */

import { PipelineService } from './pipelineService';
import { ChatSource } from './connectors/chatSource';
import { KeywordExtractionTransformer } from './transformers/keywordExtractionTransformer';
import { OpenaiEmbeddingModel } from './embedding_models/openaiEmbeddingModel';
import { Message, BubbleNode, Edge } from '../../client/src/types';
import { log } from '../vite';

// The singleton instance of the pipeline service
let pipelineServiceInstance: PipelineService | null = null;

// Chat source instance
let chatSourceInstance: ChatSource | null = null;

// The embedding model instance
let embeddingModelInstance: OpenaiEmbeddingModel | null = null;

/**
 * Initialize the pipeline components
 */
export async function initializePipeline(): Promise<void> {
  try {
    log('Initializing Pipeline Service', 'pipeline-service');
    
    // Create pipeline service if it doesn't exist
    if (!pipelineServiceInstance) {
      pipelineServiceInstance = new PipelineService();
    }
    
    // Create and initialize chat source
    if (!chatSourceInstance) {
      chatSourceInstance = new ChatSource();
      await chatSourceInstance.initialize({
        includeSystemMessages: false,
        maxHistoryMessages: 100,
        processMessagesBatch: false,
      });
      
      // Register the chat source with the pipeline
      pipelineServiceInstance.registerSource(chatSourceInstance);
      log('Chat Source initialized and registered', 'pipeline-service');
    }
    
    // Create and initialize embedding model
    if (!embeddingModelInstance) {
      embeddingModelInstance = new OpenaiEmbeddingModel();
      await embeddingModelInstance.initialize({
        // Use environment variable for API key
        apiKey: process.env.OPENAI_API_KEY,
        // Use a newer model if available
        model: 'text-embedding-3-small',
      });
      
      // Set the embedding model for the pipeline
      pipelineServiceInstance.setEmbeddingModel(embeddingModelInstance);
      log('Embedding Model initialized and registered', 'pipeline-service');
    }
    
    // Create and register transformers
    const keywordExtractor = new KeywordExtractionTransformer();
    await keywordExtractor.initialize({
      minKeywordLength: 4,
      maxKeywords: 8,
      minWordOccurrences: 1,
      createTopicNodes: true,
    });
    
    pipelineServiceInstance.registerTransformer(keywordExtractor);
    log('KeywordExtractionTransformer initialized and registered', 'pipeline-service');
    
    log('Pipeline Service initialization complete', 'pipeline-service');
  } catch (error) {
    log(`Error initializing Pipeline Service: ${error}`, 'pipeline-service-error');
    throw error;
  }
}

/**
 * Get the pipeline service instance, initializing it if needed
 */
export async function getPipelineService(): Promise<PipelineService> {
  if (!pipelineServiceInstance) {
    await initializePipeline();
  }
  
  if (!pipelineServiceInstance) {
    throw new Error('Failed to initialize Pipeline Service');
  }
  
  return pipelineServiceInstance;
}

/**
 * Process a new message through the pipeline
 */
export async function processMessage(message: {
  role: 'user' | 'assistant' | 'system';
  content: string;
  userId: string;
}): Promise<{
  nodes: Partial<BubbleNode>[];
  edges: Partial<Edge>[];
}> {
  try {
    const pipeline = await getPipelineService();
    
    log(`Processing message through pipeline`, 'pipeline-message');
    
    const result = await pipeline.processMessage(message);
    
    log(`Pipeline processed message: ${result.nodes.length} nodes, ${result.edges.length} edges created`, 'pipeline-message');
    
    return result;
  } catch (error) {
    log(`Error processing message through pipeline: ${error}`, 'pipeline-message-error');
    throw error;
  }
}

/**
 * Process full message history through the pipeline
 */
export async function processMessageHistory(messages: Message[], userId: string): Promise<{
  nodesCreated: number;
  edgesCreated: number;
}> {
  try {
    const pipeline = await getPipelineService();
    
    // Make sure chat source is available
    if (!chatSourceInstance) {
      await initializePipeline();
    }
    
    // Add all messages to the chat source
    for (const message of messages) {
      chatSourceInstance?.addRawMessage({
        role: message.role as 'user' | 'assistant' | 'system',
        content: message.content,
        userId: userId,
      });
    }
    
    // Run the pipeline
    const result = await pipeline.runPipeline();
    
    log(`Pipeline processed message history: ${result.nodesCreated} nodes, ${result.edgesCreated} edges created`, 'pipeline-batch');
    
    return result;
  } catch (error) {
    log(`Error processing message history through pipeline: ${error}`, 'pipeline-batch-error');
    throw error;
  }
}

/**
 * Generate an embedding using the pipeline's embedding model
 */
export async function generatePipelineEmbedding(text: string): Promise<number[]> {
  try {
    if (!embeddingModelInstance) {
      await initializePipeline();
    }
    
    if (!embeddingModelInstance) {
      throw new Error('Embedding model not initialized');
    }
    
    if (!embeddingModelInstance.isAvailable) {
      throw new Error('Embedding model not available');
    }
    
    return await embeddingModelInstance.generateEmbedding(text);
  } catch (error) {
    log(`Error generating embedding: ${error}`, 'pipeline-embedding-error');
    throw error;
  }
}

/**
 * Calculate 3D position from embedding
 */
export function embedding3DPosition(embedding: number[]): { x: number, y: number, z: number } {
  if (!embeddingModelInstance) {
    // Fallback position if model not available
    return {
      x: (Math.random() * 30) - 15,
      y: (Math.random() * 30) - 15,
      z: (Math.random() * 30) - 15
    };
  }
  
  if (typeof embeddingModelInstance.embedding3DPosition === 'function') {
    return embeddingModelInstance.embedding3DPosition(embedding);
  }
  
  // Fallback method if embedding model doesn't provide positioning
  const chunkSize = Math.floor(embedding.length / 3);
  
  let x = 0, y = 0, z = 0;
  
  for (let i = 0; i < chunkSize; i++) {
    x += embedding[i] * (1 + 0.1 * Math.sin(i));
  }
  
  for (let i = chunkSize; i < 2 * chunkSize; i++) {
    y += embedding[i] * (1 + 0.1 * Math.cos(i));
  }
  
  for (let i = 2 * chunkSize; i < embedding.length; i++) {
    z += embedding[i] * (1 + 0.1 * Math.sin(i * 0.5));
  }
  
  const scaleFactor = 20;
  const normalizeFactor = embedding.length / 3;
  
  return {
    x: (x / normalizeFactor) * scaleFactor,
    y: (y / normalizeFactor) * scaleFactor,
    z: (z / normalizeFactor) * scaleFactor
  };
}