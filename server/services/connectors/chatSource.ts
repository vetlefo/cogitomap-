/**
 * Chat Source
 * 
 * A source that processes chat messages and produces nodes for the conversation.
 */

import { v4 as uuidv4 } from 'uuid';
import { AuthType, BaseSource, SourceConfigField } from './_baseSource';
import { BubbleNode } from '../../../client/src/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  userId: string;
  timestamp: string;
}

export class ChatSource implements BaseSource {
  readonly sourceId: string = 'cogito-chat';
  readonly sourceName: string = 'Chat Messages';
  readonly sourceType: string = 'chat';
  readonly authType: AuthType = AuthType.NONE;
  
  private messages: ChatMessage[] = [];
  private processedMessages: Set<string> = new Set();
  private includeSystemMessages: boolean = false;
  private maxHistoryMessages: number = 100;
  private processMessagesBatch: boolean = false;
  
  readonly configFields: SourceConfigField[] = [
    {
      name: 'includeSystemMessages',
      label: 'Include System Messages',
      type: 'boolean',
      required: false,
      description: 'Whether to include system messages as nodes',
      default: false
    },
    {
      name: 'maxHistoryMessages',
      label: 'Max History Messages',
      type: 'number',
      required: false,
      description: 'Maximum number of messages to keep in history',
      default: 100
    },
    {
      name: 'processMessagesBatch',
      label: 'Process Messages in Batch',
      type: 'boolean',
      required: false,
      description: 'Process all messages at once instead of one by one',
      default: false
    }
  ];
  
  async initialize(config: Record<string, any>): Promise<void> {
    // Set configuration
    this.includeSystemMessages = config.includeSystemMessages ?? this.includeSystemMessages;
    this.maxHistoryMessages = config.maxHistoryMessages ?? this.maxHistoryMessages;
    this.processMessagesBatch = config.processMessagesBatch ?? this.processMessagesBatch;
    
    // Clear existing messages
    this.messages = [];
    this.processedMessages = new Set();
  }
  
  /**
   * Add a message to the source
   */
  addRawMessage(message: { 
    id?: string;
    role: 'user' | 'assistant' | 'system'; 
    content: string; 
    userId: string;
    timestamp?: string;
  }): void {
    // Skip empty messages
    if (!message.content || message.content.trim() === '') {
      return;
    }
    
    // Skip system messages if not including them
    if (message.role === 'system' && !this.includeSystemMessages) {
      return;
    }
    
    const chatMessage: ChatMessage = {
      id: message.id || `${message.role}_message-${Date.now().toString(36)}-${uuidv4().substring(0, 8)}`,
      role: message.role,
      content: message.content,
      userId: message.userId,
      timestamp: message.timestamp || new Date().toISOString()
    };
    
    // Add to messages
    this.messages.push(chatMessage);
    
    // Limit history size
    if (this.messages.length > this.maxHistoryMessages) {
      this.messages = this.messages.slice(-this.maxHistoryMessages);
    }
  }
  
  /**
   * Get message nodes from the source
   */
  async *getEntities(): AsyncGenerator<Partial<BubbleNode>> {
    // If processing in batch, yield all unprocessed messages at once
    if (this.processMessagesBatch) {
      for (const message of this.messages) {
        // Skip already processed messages
        if (this.processedMessages.has(message.id)) {
          continue;
        }
        
        // Mark as processed
        this.processedMessages.add(message.id);
        
        // Skip system messages if not including them
        if (message.role === 'system' && !this.includeSystemMessages) {
          continue;
        }
        
        // Create a node for the message
        const node: Partial<BubbleNode> = {
          id: message.id,
          type: `${message.role}_message`,
          content: message.content,
          // Position is added by the pipeline
          // embedding_vector is added by the pipeline
          importance: message.role === 'system' ? 0.9 : 0.75,
          timestamp: message.timestamp,
          metadata: {
            userId: message.userId,
            role: message.role
          }
        };
        
        yield node;
      }
    } else {
      // Process messages one at a time
      // Find the first unprocessed message
      const unprocessed = this.messages.find(msg => !this.processedMessages.has(msg.id));
      
      if (unprocessed) {
        // Mark as processed
        this.processedMessages.add(unprocessed.id);
        
        // Create a node for the message
        const node: Partial<BubbleNode> = {
          id: unprocessed.id,
          type: `${unprocessed.role}_message`,
          content: unprocessed.content,
          // Position is added by the pipeline
          // embedding_vector is added by the pipeline
          importance: unprocessed.role === 'system' ? 0.9 : 0.75,
          timestamp: unprocessed.timestamp,
          metadata: {
            userId: unprocessed.userId,
            role: unprocessed.role
          }
        };
        
        yield node;
      }
    }
  }
  
  /**
   * Check connection (always connected for chat source)
   */
  async checkConnection(): Promise<{isConnected: boolean, message?: string}> {
    return { isConnected: true };
  }
}