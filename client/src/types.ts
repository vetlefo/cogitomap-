// Enhanced node types for richer visualization
export type NodeType = 'user_message' | 'ai_message' | 'topic' | 'entity' | 'summary' | 'question';

// Enhanced relationship types for connections
export type RelationshipType = 'response_to' | 'mentions' | 'elaborates' | 'supports' | 'contradicts' | 'summarizes' | 'raises_question';

// Node in the knowledge graph visualization
export interface BubbleNode {
  // Core identity fields
  id: string;
  content: string; // Message text, topic name, entity name, etc.
  type: NodeType; // Type of node
  
  // Spatial positioning
  position: {
    x: number;
    y: number;
    z: number;
  };
  
  // Semantic properties
  importance: number; // 0-1 scale, affects size
  keywords?: string[]; // Key topics (mainly for message nodes)
  sentiment?: 'positive' | 'negative' | 'neutral';
  
  // Metadata and classification
  metadata?: Record<string, any>; // For extra info like entity type (PERSON, ORG)
  title?: string; // Optional title for display (separate from full content)
  description?: string; // Short description
  
  // Data lineage and provenance - new fields inspired by AirWeave
  entityDefinitionId?: string; // FK to a new EntityDefinition model
  sourceSystem?: string; // e.g., "chat", "notion_import", "airweave_connector_X"
  sourceSystemId?: string; // ID of the entity in the original source system
  parentEntityId?: string; // If this node is a "chunk" of a larger entity
  source_id?: string; // The ID of the source node (e.g., the message ID for a derived topic)
  versionHash?: string; // For data versioning, inspired by AirWeave's hashing
  createdAt?: string; // ISO 8601 timestamp
  updatedAt?: string; // ISO 8601 timestamp
  
  // Semantic embedding and vector data
  embedding_vector?: number[]; // Embedding vector for semantic similarity and positioning
  
  // Search and UI state fields
  similarity?: number; // Similarity score from vector search
  isDirectMatch?: boolean; // Whether this is a direct vector match vs a graph-expanded result
  selected?: boolean; // UI state for node selection
}

// Connection between nodes
export interface Edge {
  id: string;
  source: string; // Source node ID
  target: string; // Target node ID
  strength: number; // 0-1 scale, affects visual weight
  relationship?: RelationshipType; // Type of relationship between nodes
  
  // New fields for better relationship typing
  relationshipDefinitionId?: string; // FK to RelationshipDefinition
  properties?: Record<string, any>; // For additional edge metadata
  createdAt?: string; // ISO 8601 timestamp
  updatedAt?: string; // ISO 8601 timestamp
  sourceSystem?: string; // Origin system that created this edge
  versionHash?: string; // For data versioning
  directed?: boolean; // Whether relationship is directed (default: true)
}

// Message in the chat
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// API response from OpenAI
export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: Message;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Structured output from LLM for enhanced visualization
// We're importing the type from the shared schema to maintain consistency
import { StructuredLLMOutput as SharedStructuredLLMOutput } from '../../shared/schemas/llmOutput';

// Re-export the shared type for use in client components
export type StructuredLLMOutput = SharedStructuredLLMOutput;

// Interface for the expected parsed backend response
export type BackendResponseData = {
  message: StructuredLLMOutput | Message; // Could be structured or fallback
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  }; // Optional usage stats
}
