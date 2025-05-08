// Node in the knowledge graph visualization
export interface BubbleNode {
  id: string;
  content: string; // The message text
  type: 'user' | 'assistant'; // Who sent the message
  position: {
    x: number;
    y: number;
    z: number;
  };
  importance: number; // 0-1 scale, affects size
  keywords: string[]; // Key topics in the message
}

// Connection between nodes
export interface Edge {
  id: string;
  source: string; // Source node ID
  target: string; // Target node ID
  strength: number; // 0-1 scale, affects visual weight
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
