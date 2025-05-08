import { create } from 'zustand';

// Provider-specific types
export type LLMProvider = 'openai' | 'anthropic' | 'gemini';

// Model information interface
export interface ModelInfo {
  id: string;
  name: string;
  provider: LLMProvider;
}

interface LLMState {
  // API Keys
  apiKeys: Record<LLMProvider, string | null>;
  
  // Selected model and provider
  selectedProvider: LLMProvider;
  selectedModel: string;
  
  // Model lists by provider
  availableModels: Record<LLMProvider, ModelInfo[]>;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Request options
  structured: boolean;
  
  // Actions
  setApiKey: (provider: LLMProvider, key: string | null) => void;
  setProvider: (provider: LLMProvider) => void;
  setModel: (model: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setStructured: (structured: boolean) => void;
  
  // Model management
  updateAvailableModels: (models: Record<LLMProvider, ModelInfo[]>) => void;
}

export const useLLM = create<LLMState>((set) => ({
  // API Keys - null means not set
  apiKeys: {
    openai: null,
    anthropic: null,
    gemini: null
  },
  
  // Default to OpenAI's gpt-3.5-turbo
  selectedProvider: 'openai',
  selectedModel: 'gpt-3.5-turbo',
  
  // Initial model lists - will be populated from API
  availableModels: {
    openai: [
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' },
      { id: 'gpt-4', name: 'GPT-4', provider: 'openai' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' }
    ],
    anthropic: [
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic' },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'anthropic' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic' }
    ],
    gemini: [
      { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro', provider: 'gemini' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini' }
    ]
  },
  
  // UI state
  isLoading: false,
  error: null,
  
  // Request options
  structured: true, // Default to structured output
  
  // Actions
  setApiKey: (provider, key) => set(state => ({
    apiKeys: { ...state.apiKeys, [provider]: key }
  })),
  
  setProvider: (provider) => set({ selectedProvider: provider }),
  
  setModel: (model) => set({ selectedModel: model }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setError: (error) => set({ error }),
  
  setStructured: (structured) => set({ structured }),
  
  updateAvailableModels: (models) => set({ availableModels: models })
}));

// For backward compatibility
export const useOpenAI = {
  getState: () => {
    const state = useLLM.getState();
    return {
      apiKey: state.apiKeys.openai,
      selectedModel: state.selectedModel,
      isLoading: state.isLoading,
      error: state.error,
      setApiKey: (key: string | null) => state.setApiKey('openai', key),
      setModel: state.setModel,
      setLoading: state.setLoading,
      setError: state.setError
    };
  }
};

/**
 * Fetches available models from the server
 */
export async function fetchAvailableModels() {
  const { updateAvailableModels, setError } = useLLM.getState();
  
  try {
    const response = await fetch('/api/models');
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Convert to ModelInfo objects with provider information
    const formattedModels: Record<LLMProvider, ModelInfo[]> = {
      openai: [],
      anthropic: [],
      gemini: []
    };
    
    for (const [provider, models] of Object.entries(data)) {
      formattedModels[provider as LLMProvider] = (models as any[]).map(model => ({
        ...model,
        provider: provider as LLMProvider
      }));
    }
    
    updateAvailableModels(formattedModels);
  } catch (error) {
    console.error('Error fetching models:', error);
    setError(error instanceof Error ? error.message : 'Failed to fetch models');
  }
}

/**
 * Validates an API key with the specified provider
 */
export async function validateApiKey(
  apiKey: string,
  provider: LLMProvider = 'openai'
): Promise<{ valid: boolean; message: string }> {
  try {
    const response = await fetch('/api/validate-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey,
        provider,
      }),
    });
    
    return await response.json();
  } catch (error) {
    return {
      valid: false,
      message: error instanceof Error ? error.message : 'Unknown error validating API key'
    };
  }
}

/**
 * Sends a message to the selected LLM provider
 */
export async function sendMessage(
  messages: Array<{ role: string; content: string }>,
  options: {
    apiKey?: string;
    model?: string;
    provider?: LLMProvider;
    structured?: boolean;
  } = {}
) {
  const state = useLLM.getState();
  const { setLoading, setError } = state;
  
  // Set defaults from state if not provided
  const provider = options.provider || state.selectedProvider;
  const model = options.model || state.selectedModel;
  const structured = options.structured !== undefined ? options.structured : state.structured;
  
  // Use provided API key or fall back to stored key
  let apiKey = options.apiKey || state.apiKeys[provider];
  
  // For environment variable keys, set to null to trigger server-side env lookup
  if (apiKey === 'env-variable') {
    console.log(`Using environment variable for ${provider} API key`);
    apiKey = null; // Server will use environment variable instead
  }
  
  // If still no API key, try to use environment variable (will be checked server-side)
  if (!apiKey) {
    console.log(`No API key provided for ${provider}, falling back to server environment variables`);
  }
  
  setLoading(true);
  setError(null);
  
  try {
    // Format model string for server: "provider:model"
    const fullModelId = `${provider}:${model}`;
    
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        apiKey,
        model: fullModelId,
        structured
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return data.message;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    setError(errorMessage);
    throw error;
  } finally {
    setLoading(false);
  }
}
