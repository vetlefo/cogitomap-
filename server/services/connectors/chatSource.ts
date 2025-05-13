import { BaseSource, AuthType, SourceConfigField } from './_baseSource';
import { BubbleNode } from '../../../client/src/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * ChatSource implementation
 * 
 * This source handles live conversation data from the chat interface,
 * processing messages and converting them into appropriate BubbleNode objects.
 */
export class ChatSource implements BaseSource {
  readonly sourceId: string = 'chat-source';
  readonly sourceName: string = 'Live Conversation';
  readonly sourceType: string = 'cogito_chat';
  readonly authType: AuthType = AuthType.NONE; // No special auth for the built-in chat

  // Raw messages queue to be processed
  private messages: Array<{ 
    id: string;
    role: 'user' | 'assistant' | 'system'; 
    content: string; 
    userId: string;
    timestamp: string;
  }> = [];

  // Flag to track if the source has been initialized
  private initialized: boolean = false;

  // Configuration properties
  private config: {
    includeSystemMessages: boolean;
    maxHistoryMessages: number;
    processMessagesBatch: boolean;
  } = {
    includeSystemMessages: false,
    maxHistoryMessages: 100,
    processMessagesBatch: false,
  };

  /**
   * Configuration fields for the chat source
   */
  readonly configFields: SourceConfigField[] = [
    {
      name: 'includeSystemMessages',
      label: 'Include System Messages',
      type: 'boolean',
      required: false,
      description: 'Whether to include system messages in the graph',
      default: false,
    },
    {
      name: 'maxHistoryMessages',
      label: 'Maximum History Messages',
      type: 'number',
      required: false,
      description: 'Maximum number of historical messages to include',
      default: 100,
      validation: {
        min: 1,
        max: 1000,
      },
    },
    {
      name: 'processMessagesBatch',
      label: 'Process Messages in Batch',
      type: 'boolean',
      required: false,
      description: 'Process all messages at once instead of one by one',
      default: false,
    },
  ];

  /**
   * Initialize the chat source with configuration
   */
  async initialize(config: Record<string, any>): Promise<void> {
    if (config) {
      this.config = {
        ...this.config,
        ...config,
      };
    }
    this.initialized = true;
  }

  /**
   * Add a new raw message to be processed
   */
  public addRawMessage(message: { 
    id?: string;
    role: 'user' | 'assistant' | 'system'; 
    content: string; 
    userId: string;
    timestamp?: string;
  }): void {
    const formattedMessage = {
      id: message.id || uuidv4(),
      role: message.role,
      content: message.content,
      userId: message.userId,
      timestamp: message.timestamp || new Date().toISOString(),
    };
    
    this.messages.push(formattedMessage);
    
    // Keep messages under the maximum limit
    if (this.messages.length > this.config.maxHistoryMessages) {
      this.messages = this.messages.slice(-this.config.maxHistoryMessages);
    }
  }

  /**
   * Process and yield entities from the messages queue
   */
  async *getEntities(): AsyncGenerator<Partial<BubbleNode>> {
    if (!this.initialized) {
      throw new Error('ChatSource must be initialized before use');
    }
    
    // Create a copy of messages to process
    const messagesToProcess = [...this.messages];
    
    // Clear the message queue after we've made a copy
    this.messages = [];
    
    // Filter out system messages if configured to do so
    const filteredMessages = this.config.includeSystemMessages 
      ? messagesToProcess 
      : messagesToProcess.filter(msg => msg.role !== 'system');
      
    // Process messages in the way configured
    if (this.config.processMessagesBatch) {
      // Process all at once
      for (const message of filteredMessages) {
        yield this.convertMessageToNode(message);
      }
    } else {
      // Process only the latest message
      if (filteredMessages.length > 0) {
        const latestMessage = filteredMessages[filteredMessages.length - 1];
        yield this.convertMessageToNode(latestMessage);
      }
    }
  }

  /**
   * Convert a raw message to a BubbleNode object
   */
  private convertMessageToNode(message: { 
    id: string;
    role: 'user' | 'assistant' | 'system'; 
    content: string; 
    userId: string;
    timestamp: string;
  }): Partial<BubbleNode> {
    // Determine node type based on message role
    const type = message.role === 'user' 
      ? 'user_message' 
      : message.role === 'assistant' 
        ? 'ai_message' 
        : 'system_message';
        
    // Simple keyword extraction as a placeholder
    // In a real implementation, this would be done by a transformer
    const keywords = message.content
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 5);
      
    // Create the node with basic properties
    const node: Partial<BubbleNode> = {
      id: message.id,
      content: message.content,
      type: type as any, // Cast to NodeType
      // Position would be set by a positioner transformer
      importance: 0.7, // Default importance
      keywords: keywords,
      // Additional fields from our enhanced model
      sourceSystem: this.sourceType,
      sourceSystemId: message.id,
      createdAt: message.timestamp,
      updatedAt: message.timestamp,
      metadata: { 
        userId: message.userId, 
        timestamp: message.timestamp,
        role: message.role,
      },
    };
    
    return node;
  }
  
  /**
   * Validate configuration
   */
  async validateConfig(config: Record<string, any>): Promise<{ isValid: boolean, message?: string }> {
    // Check that maxHistoryMessages is a positive number
    if (config.maxHistoryMessages !== undefined && 
        (typeof config.maxHistoryMessages !== 'number' || 
         config.maxHistoryMessages < 1 || 
         config.maxHistoryMessages > 1000)) {
      return {
        isValid: false,
        message: 'maxHistoryMessages must be a number between 1 and 1000',
      };
    }
    
    return { isValid: true };
  }
  
  /**
   * Check connection status
   */
  async checkConnection(): Promise<{ isConnected: boolean, message?: string }> {
    // For the chat source, always connected if initialized
    return { 
      isConnected: this.initialized,
      message: this.initialized ? 'Chat source is ready' : 'Chat source not initialized',
    };
  }
}