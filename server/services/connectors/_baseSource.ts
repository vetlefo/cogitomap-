import { BubbleNode } from '../../../client/src/types';

/**
 * Defines authentication types for data sources
 */
export enum AuthType {
  NONE = "none",
  API_KEY = "api_key",
  OAUTH2 = "oauth2",
  BASIC = "basic",
  BEARER = "bearer",
  CUSTOM = "custom"
}

/**
 * Defines a configuration field for a source
 */
export interface SourceConfigField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'password';
  required: boolean;
  description?: string;
  default?: any;
  options?: Array<{ value: string, label: string }>;  // For select/multiselect types
  placeholder?: string;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    customValidator?: (value: any) => { isValid: boolean, message?: string };
  };
}

/**
 * Base interface for all data sources
 * 
 * This defines the contract that all source implementations must follow.
 * Sources are responsible for retrieving or generating data from external systems
 * or internal processes and converting them into BubbleNode entities.
 */
export interface BaseSource {
  /**
   * Unique identifier for this source type
   */
  readonly sourceId: string;
  
  /**
   * Human-readable name of the source
   */
  readonly sourceName: string;
  
  /**
   * Source type identifier (e.g., "cogito_chat", "notion", "web_search")
   */
  readonly sourceType: string;
  
  /**
   * Authentication type required by this source
   */
  readonly authType: AuthType;
  
  /**
   * Configuration fields for this source
   */
  readonly configFields?: SourceConfigField[];

  /**
   * Initialize the source with dynamic configuration
   * 
   * @param config Configuration parameters
   * @param credentials Authentication credentials if needed
   */
  initialize(config: Record<string, any>, credentials?: Record<string, any>): Promise<void>;

  /**
   * Fetches or generates entities from the source
   * 
   * @returns An async generator of BubbleNode partial objects
   */
  getEntities(): AsyncGenerator<Partial<BubbleNode>>;

  /**
   * Validates configuration and credentials
   * 
   * @param config Configuration parameters to validate
   * @param credentials Authentication credentials to validate
   * @returns Object indicating validation success and optional message
   */
  validateConfig?(config: Record<string, any>, credentials?: Record<string, any>): 
    Promise<{isValid: boolean, message?: string}>;
    
  /**
   * Optional method to check if the source is connected and accessible
   * 
   * @returns Object indicating connection status and optional message
   */
  checkConnection?(): Promise<{isConnected: boolean, message?: string}>;
}