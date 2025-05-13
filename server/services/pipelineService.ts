/**
 * Pipeline Service
 * 
 * This service orchestrates the flow of data through the system, connecting:
 * 1. Sources (chat, file, notion, etc.) that provide raw data
 * 2. Transformers that process and extract meaning from the data
 * 3. The embedding model that creates vector representations
 * 4. The graph database for storing nodes and relationships
 */

import { BaseSource } from './connectors/_baseSource';
import { BaseTransformer } from './transformers/_baseTransformer';
import { BaseEmbeddingModel } from './embedding_models/_baseEmbeddingModel';
import { createNode, createEdge } from '../db/graphService';
import { BubbleNode, Edge } from '../../client/src/types';
import { log } from '../vite';
import { v4 as uuidv4 } from 'uuid';

export class PipelineService {
  private sources: BaseSource[] = [];
  private transformers: BaseTransformer[] = [];
  private embeddingModel: BaseEmbeddingModel | null = null;
  private initialized: boolean = false;
  
  /**
   * Register a data source with the pipeline
   */
  registerSource(source: BaseSource): void {
    this.sources.push(source);
    log(`Registered source: ${source.sourceName} (${source.sourceId})`, 'pipeline-service');
  }
  
  /**
   * Register a transformer with the pipeline
   */
  registerTransformer(transformer: BaseTransformer): void {
    this.transformers.push(transformer);
    log(`Registered transformer: ${transformer.transformerName} (${transformer.transformerId})`, 'pipeline-service');
  }
  
  /**
   * Set the embedding model for the pipeline
   */
  setEmbeddingModel(model: BaseEmbeddingModel): void {
    this.embeddingModel = model;
    log(`Set embedding model: ${model.modelName} (${model.modelId})`, 'pipeline-service');
  }
  
  /**
   * Process a single message through the pipeline
   * This simplified approach directly handles a message without needing data sources
   */
  async processMessage(message: {
    id?: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    userId: string;
    timestamp?: string;
  }): Promise<{
    nodes: Partial<BubbleNode>[];
    edges: Partial<Edge>[];
  }> {
    const nodes: Partial<BubbleNode>[] = [];
    const edges: Partial<Edge>[] = [];
    
    try {
      // Generate unique ID if not provided
      const messageId = message.id || `${message.role}_message-${Date.now().toString(36)}-${uuidv4().substring(0, 8)}`;
      
      // Create the message node
      const type = `${message.role}_message`;
      const timestamp = message.timestamp || new Date().toISOString();
      
      // Generate embedding for the message content
      let embedding = null;
      let position = null;
      
      if (this.embeddingModel && this.embeddingModel.isAvailable) {
        try {
          embedding = await this.embeddingModel.generateEmbedding(message.content);
          
          if (typeof this.embeddingModel.embedding3DPosition === 'function') {
            position = this.embeddingModel.embedding3DPosition(embedding);
          } else {
            // Default positioning algorithm if the model doesn't provide one
            position = this.defaultPositioning(embedding);
          }
        } catch (embeddingError) {
          log(`Error generating embedding: ${embeddingError}`, 'pipeline-error');
          // Generate random position as fallback
          position = {
            x: (Math.random() * 20) - 10,
            y: (Math.random() * 20) - 10,
            z: (Math.random() * 20) - 10
          };
        }
      } else {
        log(`No embedding model available, using random positioning`, 'pipeline-warning');
        position = {
          x: (Math.random() * 20) - 10,
          y: (Math.random() * 20) - 10,
          z: (Math.random() * 20) - 10
        };
      }
      
      // Create the message node
      const messageNode: Partial<BubbleNode> = {
        id: messageId,
        type,
        content: message.content,
        position,
        embedding_vector: embedding,
        importance: message.role === 'system' ? 0.9 : 0.7,
        timestamp,
        metadata: {
          userId: message.userId,
          role: message.role
        }
      };
      
      nodes.push(messageNode);
      
      // Create the actual node in the database
      try {
        // Convert to full BubbleNode for database
        const fullNode: BubbleNode = {
          ...messageNode as any,
          // Add required fields with defaults if missing
          id: messageNode.id as string,
          type: messageNode.type as string,
          content: messageNode.content as string,
          position: messageNode.position as { x: number, y: number, z: number },
          importance: messageNode.importance as number
        };
        
        await createNode(fullNode);
        log(`Created message node in database: ${messageId}`, 'pipeline-service');
      } catch (nodeError) {
        log(`Error creating message node in database: ${nodeError}`, 'pipeline-error');
        // Continue with the pipeline even if database storage fails
      }
      
      // Run the message through all transformers
      for (const transformer of this.transformers) {
        try {
          log(`Running transformer ${transformer.transformerName} on message`, 'pipeline-service');
          const transformResult = await transformer.transform({
            node: messageNode as BubbleNode,
            content: message.content,
            type: message.role
          });
          
          // Add results to our collections
          if (transformResult.nodes && transformResult.nodes.length > 0) {
            log(`Transformer ${transformer.transformerName} created ${transformResult.nodes.length} nodes`, 'pipeline-service');
            
            // Store each node from the transformer
            for (const node of transformResult.nodes) {
              nodes.push(node);
              
              try {
                // Convert to full BubbleNode for database
                const fullNode: BubbleNode = {
                  ...node as any,
                  // Add required fields with defaults if missing
                  id: node.id as string,
                  type: node.type as string,
                  content: node.content as string,
                  position: node.position as { x: number, y: number, z: number },
                  importance: node.importance || 0.5
                };
                
                await createNode(fullNode);
                log(`Created derived node in database: ${node.id}`, 'pipeline-service');
              } catch (nodeError) {
                log(`Error creating derived node in database: ${nodeError}`, 'pipeline-error');
                // Continue with the pipeline even if database storage fails
              }
              
              // Create an edge from the message to this derived node
              const edge: Partial<Edge> = {
                id: `${messageId}-to-${node.id}`,
                source: messageId,
                target: node.id as string,
                relationship: 'contains',
                strength: 0.8,
                metadata: {
                  creator: transformer.transformerId,
                  timestamp: new Date().toISOString()
                }
              };
              
              edges.push(edge);
              
              try {
                await createEdge(
                  messageId,
                  node.id as string,
                  'contains',
                  { strength: 0.8, creator: transformer.transformerId }
                );
                log(`Created edge in database: ${edge.id}`, 'pipeline-service');
              } catch (edgeError) {
                log(`Error creating edge in database: ${edgeError}`, 'pipeline-error');
                // Continue with the pipeline even if database storage fails
              }
            }
          }
          
          // Add relationships from the transformer
          if (transformResult.edges && transformResult.edges.length > 0) {
            log(`Transformer ${transformer.transformerName} created ${transformResult.edges.length} edges`, 'pipeline-service');
            
            for (const edge of transformResult.edges) {
              edges.push(edge);
              
              try {
                const sourceId = edge.source as string;
                const targetId = edge.target as string;
                const relationship = edge.relationship as string;
                const metadata = edge.metadata || { strength: edge.strength || 0.5 };
                
                await createEdge(sourceId, targetId, relationship, metadata);
                log(`Created edge in database: ${edge.id || `${sourceId}-${relationship}-${targetId}`}`, 'pipeline-service');
              } catch (edgeError) {
                log(`Error creating edge in database: ${edgeError}`, 'pipeline-error');
                // Continue with the pipeline even if database storage fails
              }
            }
          }
        } catch (transformerError) {
          log(`Error in transformer ${transformer.transformerName}: ${transformerError}`, 'pipeline-error');
          // Continue with the next transformer
        }
      }
      
      return { nodes, edges };
    } catch (error) {
      log(`Error in pipeline process: ${error}`, 'pipeline-error');
      return { nodes, edges };
    }
  }
  
  /**
   * Run the full pipeline on all data sources
   */
  async runPipeline(): Promise<{
    nodesCreated: number;
    edgesCreated: number;
  }> {
    let nodesCreated = 0;
    let edgesCreated = 0;
    
    try {
      // Check if we have any sources
      if (this.sources.length === 0) {
        log('No data sources registered with the pipeline', 'pipeline-warning');
        return { nodesCreated: 0, edgesCreated: 0 };
      }
      
      // Process each source
      for (const source of this.sources) {
        log(`Processing source: ${source.sourceName}`, 'pipeline-service');
        
        try {
          // Get entities from this source
          for await (const entity of source.getEntities()) {
            try {
              log(`Processing entity from source ${source.sourceId}`, 'pipeline-service');
              
              // Store the entity as a node
              if (entity.id && entity.type && entity.content) {
                // Add position if not provided
                if (!entity.position && entity.embedding_vector && this.embeddingModel) {
                  if (typeof this.embeddingModel.embedding3DPosition === 'function') {
                    entity.position = this.embeddingModel.embedding3DPosition(entity.embedding_vector);
                  } else {
                    entity.position = this.defaultPositioning(entity.embedding_vector);
                  }
                } else if (!entity.position) {
                  entity.position = {
                    x: (Math.random() * 20) - 10,
                    y: (Math.random() * 20) - 10,
                    z: (Math.random() * 20) - 10
                  };
                }
                
                // Create node in graph database
                try {
                  // Convert to full BubbleNode for database
                  const fullNode: BubbleNode = {
                    ...entity as any,
                    // Add required fields with defaults if missing
                    id: entity.id as string,
                    type: entity.type as string,
                    content: entity.content as string,
                    position: entity.position as { x: number, y: number, z: number },
                    importance: entity.importance || 0.5
                  };
                  
                  await createNode(fullNode);
                  log(`Created entity node in database: ${entity.id}`, 'pipeline-service');
                  nodesCreated++;
                } catch (nodeError) {
                  log(`Error creating entity node in database: ${nodeError}`, 'pipeline-error');
                  // Continue with the pipeline even if database storage fails
                }
                
                // Run the entity through transformers
                for (const transformer of this.transformers) {
                  try {
                    log(`Running transformer ${transformer.transformerName} on entity ${entity.id}`, 'pipeline-service');
                    
                    const transformResult = await transformer.transform({
                      node: entity as BubbleNode,
                      content: entity.content,
                      type: entity.type
                    });
                    
                    // Process and store nodes from the transformer
                    if (transformResult.nodes && transformResult.nodes.length > 0) {
                      for (const node of transformResult.nodes) {
                        try {
                          // Convert to full BubbleNode for database
                          const fullNode: BubbleNode = {
                            ...node as any,
                            // Add required fields with defaults if missing
                            id: node.id as string,
                            type: node.type as string,
                            content: node.content as string,
                            position: node.position as { x: number, y: number, z: number },
                            importance: node.importance || 0.5
                          };
                          
                          await createNode(fullNode);
                          log(`Created derived node in database: ${node.id}`, 'pipeline-service');
                          nodesCreated++;
                        } catch (nodeError) {
                          log(`Error creating derived node in database: ${nodeError}`, 'pipeline-error');
                          // Continue with the pipeline even if database storage fails
                        }
                        
                        // Create edge from entity to this node
                        try {
                          await createEdge(
                            entity.id as string,
                            node.id as string,
                            'contains',
                            { strength: 0.8, creator: transformer.transformerId }
                          );
                          log(`Created edge in database: ${entity.id}-contains-${node.id}`, 'pipeline-service');
                          edgesCreated++;
                        } catch (edgeError) {
                          log(`Error creating edge in database: ${edgeError}`, 'pipeline-error');
                          // Continue with the pipeline even if database storage fails
                        }
                      }
                    }
                    
                    // Process and store edges from the transformer
                    if (transformResult.edges && transformResult.edges.length > 0) {
                      for (const edge of transformResult.edges) {
                        try {
                          const sourceId = edge.source as string;
                          const targetId = edge.target as string;
                          const relationship = edge.relationship as string;
                          const metadata = edge.metadata || { strength: edge.strength || 0.5 };
                          
                          await createEdge(sourceId, targetId, relationship, metadata);
                          log(`Created edge in database: ${edge.id || `${sourceId}-${relationship}-${targetId}`}`, 'pipeline-service');
                          edgesCreated++;
                        } catch (edgeError) {
                          log(`Error creating edge in database: ${edgeError}`, 'pipeline-error');
                          // Continue with the pipeline even if database storage fails
                        }
                      }
                    }
                  } catch (transformerError) {
                    log(`Error in transformer ${transformer.transformerName}: ${transformerError}`, 'pipeline-error');
                    // Continue with the next transformer
                  }
                }
              } else {
                log(`Incomplete entity from source ${source.sourceId}, skipping: ${JSON.stringify(entity)}`, 'pipeline-warning');
              }
            } catch (entityError) {
              log(`Error processing entity from source ${source.sourceId}: ${entityError}`, 'pipeline-error');
              // Continue with the next entity
            }
          }
        } catch (sourceError) {
          log(`Error processing source ${source.sourceId}: ${sourceError}`, 'pipeline-error');
          // Continue with the next source
        }
      }
      
      return { nodesCreated, edgesCreated };
    } catch (error) {
      log(`Error running pipeline: ${error}`, 'pipeline-error');
      return { nodesCreated, edgesCreated };
    }
  }
  
  /**
   * Default positioning algorithm when embedding model doesn't provide one
   */
  private defaultPositioning(embedding: number[]): { x: number, y: number, z: number } {
    // PCA-like dimensionality reduction
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
}