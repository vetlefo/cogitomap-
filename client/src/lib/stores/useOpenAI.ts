import { create } from 'zustand';

interface OpenAIState {
  apiKey: string | null;
  selectedModel: string;
  isLoading: boolean;
  error: string | null;
  
  setApiKey: (key: string | null) => void;
  setModel: (model: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useOpenAI = create<OpenAIState>((set) => ({
  apiKey: null,
  selectedModel: 'gpt-3.5-turbo',
  isLoading: false,
  error: null,
  
  setApiKey: (key) => set({ apiKey: key }),
  setModel: (model) => set({ selectedModel: model }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));

/**
 * Sends a message to the OpenAI API
 */
export async function sendMessage(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  model: string = 'gpt-3.5-turbo'
) {
  const { setLoading, setError } = useOpenAI.getState();
  
  setLoading(true);
  setError(null);
  
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        apiKey,
        model,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
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
