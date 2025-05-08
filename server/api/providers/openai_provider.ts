import { Message, OpenAIResponse } from '../../../client/src/types';

/**
 * Makes a request to the OpenAI API
 */
export async function callOpenAI(
  messages: Message[], 
  apiKey: string, 
  modelName: string = 'gpt-3.5-turbo',
  options: { 
    temperature?: number;
    maxTokens?: number;
    responseFormat?: 'json_object' | 'text';
  } = {}
): Promise<any> {
  // Default options
  const { 
    temperature = 0.7, 
    maxTokens = 1000,
    responseFormat
  } = options;
  
  // Build request body
  const requestBody: any = {
    model: modelName,
    messages,
    temperature,
    max_tokens: maxTokens
  };
  
  // Add JSON response format if requested
  if (responseFormat === 'json_object') {
    requestBody.response_format = { type: 'json_object' };
  }

  // Make API request
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });
  
  // Handle API errors
  if (!response.ok) {
    const errorData = await response.json();
    console.error('OpenAI API error:', errorData);
    
    throw new Error(
      `OpenAI API error (${response.status}): ${
        errorData.error?.message || JSON.stringify(errorData)
      }`
    );
  }
  
  // Parse and return response
  const data: OpenAIResponse = await response.json();
  return data;
}