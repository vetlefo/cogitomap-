import { BaseSource } from './connectors/_baseSource';
import { BaseTransformer } from './transformers/_baseTransformer';
import { BaseEmbeddingModel } from './embedding_models/_baseEmbeddingModel';
import { BubbleNode, Edge } from '../../client/src/types';
import { createNode, createEdge } from '../db/graphService'; 

/**
 * Pipeline Processing Service
 * 
 * This service orchestrates the flow of data from sources through transformers
 * to the graph database. It manages the execution order and ensures that data
 * is properly processed at each stage.
 */
export class PipelineService {
  private sources: BaseSource[] = [];
  private transformers: BaseTransformer[] = [];
  private embeddingModel: BaseEmbeddingModel | null = null;
  
  /**
   * Register a data source with the pipeline
   */
  registerSource(source: BaseSource): void {
    this.sources.push(source);
  }
  
  /**
   * Register a transformer with the pipeline
   */
  registerTransformer(transformer: BaseTransformer): void {
    this.transformers.push(transformer);
  }
  
  /**
   * Set the embedding model for the pipeline
   */
  setEmbeddingModel(model: BaseEmbeddingModel): void {
    this.embeddingModel = model;
  }
  
  /**
   * Process a single source, applying all transformers and saving to the graph
   */
  async processSource(source: BaseSource): Promise<{
    nodesCreated: number;
    edgesCreated: number;
  }> {
    if (!this.embeddingModel) {
      throw new Error('Embedding model must be set before processing sources');
    }
    
    let nodesCreated = 0;
    let edgesCreated = 0;
    
    try {
      // Process entities from the source
      for await (const entityData of source.getEntities()) {
        let currentNodes: Partial<BubbleNode>[] = [entityData];
        let currentEdges: Partial<Edge>[] = [];
        
        // Apply each transformer in sequence
        for (const transformer of this.transformers) {
          const result = await transformer.transform(currentNodes);
          currentNodes = result.nodes;
          if (result.edges) {
            currentEdges = [...currentEdges, ...result.edges];
          }
        }
        
        // Process each node
        for (const nodeData of currentNodes) {
          if (!nodeData.content) continue;
          
          // Generate embedding if not present
          if (!nodeData.embedding_vector && this.embeddingModel) {
            try {
              nodeData.embedding_vector = await this.embeddingModel.generateEmbedding(nodeData.content);
              
              // Calculate 3D position from embedding
              if (this.embeddingModel.embedding3DPosition) {
                nodeData.position = this.embeddingModel.embedding3DPosition(nodeData.embedding_vector);
              } else {
                // Default random position if no positioning function
                nodeData.position = {
                  x: (Math.random() * 20) - 10,
                  y: (Math.random() * 20) - 10,
                  z: (Math.random() * 20) - 10
                };
              }
            } catch (error) {
              console.error('Error generating embedding:', error);
              // Provide fallback position if embedding fails
              nodeData.position = {
                x: (Math.random() * 20) - 10,
                y: (Math.random() * 20) - 10,
                z: (Math.random() * 20) - 10
              };
            }
          }
          
          // Create the node in the graph
          try {
            await createNode(nodeData);
            nodesCreated++;
          } catch (error) {
            console.error(`Error creating node:`, error);
          }
        }
        
        // Process edges
        for (const edgeData of currentEdges) {
          try {
            await createEdge(edgeData);
            edgesCreated++;
          } catch (error) {
            console.error(`Error creating edge:`, error);
          }
        }
      }
      
      return { nodesCreated, edgesCreated };
    } catch (error) {
      console.error('Error processing source:', error);
      throw error;
    }
  }
  
  /**
   * Run the full pipeline by processing all registered sources
   */
  async runPipeline(): Promise<{
    nodesCreated: number;
    edgesCreated: number;
  }> {
    let totalNodesCreated = 0;
    let totalEdgesCreated = 0;
    
    try {
      // Process each source
      for (const source of this.sources) {
        const result = await this.processSource(source);
        totalNodesCreated += result.nodesCreated;
        totalEdgesCreated += result.edgesCreated;
      }
      
      return {
        nodesCreated: totalNodesCreated,
        edgesCreated: totalEdgesCreated
      };
    } catch (error) {
      console.error('Error running pipeline:', error);
      throw error;
    }
  }
  
  /**
   * Process a single message directly
   */
  async processMessage(message: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    userId: string;
  }): Promise<{
    nodes: Partial<BubbleNode>[];
    edges: Partial<Edge>[];
  }> {
    // Find a chat source in registered sources
    const chatSource = this.sources.find(source => source.sourceType === 'cogito_chat');
    
    if (!chatSource) {
      throw new Error('Chat source not registered');
    }
    
    // Cast to expected type with addRawMessage
    const typedChatSource = chatSource as any;
    if (typeof typedChatSource.addRawMessage !== 'function') {
      throw new Error('Chat source does not implement addRawMessage method');
    }
    
    // Add the message to the chat source
    typedChatSource.addRawMessage(message);
    
    // Track nodes and edges created
    const createdNodes: Partial<BubbleNode>[] = [];
    const createdEdges: Partial<Edge>[] = [];
    
    // Process the message
    for await (const entityData of chatSource.getEntities()) {
      let currentNodes: Partial<BubbleNode>[] = [entityData];
      let currentEdges: Partial<Edge>[] = [];
      
      // Apply transformers
      for (const transformer of this.transformers) {
        const result = await transformer.transform(currentNodes);
        currentNodes = result.nodes;
        if (result.edges) {
          currentEdges = [...currentEdges, ...result.edges];
        }
      }
      
      // Process each node
      for (const nodeData of currentNodes) {
        if (!nodeData.content) continue;
        
        // Generate embedding if not present
        if (!nodeData.embedding_vector && this.embeddingModel) {
          try {
            nodeData.embedding_vector = await this.embeddingModel.generateEmbedding(nodeData.content);
            
            // Calculate 3D position from embedding
            if (this.embeddingModel.embedding3DPosition) {
              nodeData.position = this.embeddingModel.embedding3DPosition(nodeData.embedding_vector);
            }
          } catch (error) {
            console.error('Error generating embedding:', error);
          }
        }
        
        // Create the node in the graph
        try {
          await createNode(nodeData);
          createdNodes.push(nodeData);
        } catch (error) {
          console.error(`Error creating node:`, error);
        }
      }
      
      // Process edges
      for (const edgeData of currentEdges) {
        try {
          await createEdge(edgeData);
          createdEdges.push(edgeData);
        } catch (error) {
          console.error(`Error creating edge:`, error);
        }
      }
    }
    
    return {
      nodes: createdNodes,
      edges: createdEdges
    };
  }
}