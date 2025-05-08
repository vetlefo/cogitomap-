// Enhanced node types for richer visualization
export type NodeType = 'user_message' | 'ai_message' | 'topic' | 'entity' | 'summary' | 'question';

// Enhanced relationship types for connections
export type RelationshipType = 'response_to' | 'mentions' | 'elaborates' | 'supports' | 'contradicts' | 'summarizes' | 'raises_question';

// Node in the knowledge graph visualization
export interface BubbleNode {
  id: string;
  content: string; // Message text, topic name, entity name, etc.
  type: NodeType; // Type of node
  position: {
    x: number;
    y: number;
    z: number;
  };
  importance: number; // 0-1 scale, affects size
  keywords?: string[]; // Key topics (mainly for message nodes)
  // Additional fields from structured output
  sentiment?: 'positive' | 'negative' | 'neutral';
  metadata?: Record<string, any>; // For extra info like entity type (PERSON, ORG)
}

// Connection between nodes
export interface Edge {
  id: string;
  source: string; // Source node ID
  target: string; // Target node ID
  strength: number; // 0-1 scale, affects visual weight
  relationship?: RelationshipType; // Type of relationship between nodes
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
export interface StructuredLLMOutput {
  main_response: string;
  identified_topics?: string[];
  key_entities?: { entity: string; type: string }[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  suggested_followups?: string[];
  internal_links?: { 
    source_node_id: string; 
    target_node_id: string; 
    relationship: string 
  }[];
  summary?: string;
}

// Interface for the expected parsed backend response
export type BackendResponseData = {
  message: StructuredLLMOutput | Message; // Could be structured or fallback
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  }; // Optional usage stats
}
