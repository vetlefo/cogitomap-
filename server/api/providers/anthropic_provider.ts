import { Message } from '../../../client/src/types';

// Response interface for Anthropic API
interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Converts standard messages to Anthropic-compatible format
 * Note: Anthropic has different handling for system messages
 */
function convertMessagesToAnthropicFormat(messages: Message[]): any[] {
  const result = [];
  let systemMessage = '';
  
  // Extract system message if present
  for (const message of messages) {
    if (message.role === 'system') {
      systemMessage = message.content;
    } else {
      result.push({
        role: message.role,
        content: message.content
      });
    }
  }
  
  return {
    messages: result,
    system: systemMessage || undefined
  };
}

/**
 * Makes a request to the Anthropic API
 */
export async function callAnthropic(
  messages: Message[], 
  apiKey: string, 
  modelName: string = 'claude-3-opus-20240229',
  options: { 
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<any> {
  // Default options
  const { 
    temperature = 0.7, 
    maxTokens = 1000
  } = options;
  
  // Convert messages to Anthropic format
  const { messages: anthropicMessages, system } = convertMessagesToAnthropicFormat(messages);
  
  // Build request body
  const requestBody: any = {
    model: modelName,
    messages: anthropicMessages,
    max_tokens: maxTokens,
    temperature
  };
  
  // Add system message if present
  if (system) {
    requestBody.system = system;
  }

  // Make API request
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(requestBody)
  });
  
  // Handle API errors
  if (!response.ok) {
    let errorMessage = `Anthropic API error (${response.status})`;
    try {
      const errorData = await response.json();
      console.error('Anthropic API error:', errorData);
      errorMessage += `: ${errorData.error?.message || JSON.stringify(errorData)}`;
    } catch (e) {
      errorMessage += `: ${await response.text() || 'Unknown error'}`;
    }
    throw new Error(errorMessage);
  }
  
  // Parse and return response
  const data: AnthropicResponse = await response.json();
  
  // Convert Anthropic response to a standardized format
  return {
    id: data.id,
    object: data.type,
    created: Date.now(),
    model: data.model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: data.content[0]?.text || ''
      },
      finish_reason: data.stop_reason
    }],
    usage: {
      prompt_tokens: data.usage.input_tokens,
      completion_tokens: data.usage.output_tokens,
      total_tokens: data.usage.input_tokens + data.usage.output_tokens
    }
  };
}