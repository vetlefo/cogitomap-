import { Message } from '../../../client/src/types';

// Response interface for Google Gemini API
interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
      role: string;
    };
    finishReason: string;
    index: number;
    safetyRatings: any[];
  }>;
  promptFeedback: {
    safetyRatings: any[];
  };
  usage: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

/**
 * Converts standard messages to Gemini-compatible format
 * Note: Gemini has different handling for system messages
 */
function convertMessagesToGeminiFormat(messages: Message[]): any[] {
  const geminiMessages = [];
  let systemMessage = '';
  
  // Extract system message
  for (const message of messages) {
    if (message.role === 'system') {
      systemMessage = message.content;
      continue;
    }
    
    geminiMessages.push({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }]
    });
  }
  
  // If we have a system message, prepend it to the first user message
  // or create a new user message if there isn't one
  if (systemMessage && geminiMessages.length > 0) {
    const firstUserMessageIndex = geminiMessages.findIndex(m => m.role === 'user');
    if (firstUserMessageIndex !== -1) {
      geminiMessages[firstUserMessageIndex].parts[0].text = 
        `System Instructions: ${systemMessage}\n\nUser Message: ${geminiMessages[firstUserMessageIndex].parts[0].text}`;
    } else {
      geminiMessages.unshift({
        role: 'user',
        parts: [{ text: `System Instructions: ${systemMessage}` }]
      });
    }
  }
  
  return geminiMessages;
}

/**
 * Makes a request to the Google Gemini API
 */
export async function callGemini(
  messages: Message[], 
  apiKey: string, 
  modelName: string = 'gemini-1.5-pro',
  options: { 
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<any> {
  // Default options
  const { 
    temperature = 0.7, 
    maxTokens = 1024
  } = options;
  
  // Convert messages to Gemini format
  const geminiMessages = convertMessagesToGeminiFormat(messages);
  
  // Build request body
  const requestBody = {
    contents: geminiMessages,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      topP: 0.95,
      topK: 40
    }
  };

  // Define an allow-list of valid model names
  const allowedModels = ['gemini-1.5-pro', 'gemini-2.0', 'gemini-lite'];

  // Clean up model name (remove potential 'gemini:' prefix)
  const cleanModelName = modelName.replace('gemini:', '');

  // Validate the cleaned model name against the allow-list
  if (!allowedModels.includes(cleanModelName)) {
    throw new Error(`Invalid model name: ${cleanModelName}`);
  }

  // Make API request
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelName}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }
  );
  
  // Handle API errors
  if (!response.ok) {
    let errorMessage = `Gemini API error (${response.status})`;
    try {
      const errorData = await response.json();
      console.error('Gemini API error:', errorData);
      errorMessage += `: ${errorData.error?.message || JSON.stringify(errorData)}`;
    } catch (e) {
      errorMessage += `: ${await response.text() || 'Unknown error'}`;
    }
    throw new Error(errorMessage);
  }
  
  // Parse and return response
  const data: GeminiResponse = await response.json();
  
  // Convert Gemini response to a standardized format
  return {
    id: Math.random().toString(36).substring(2, 15),
    object: 'chat.completion',
    created: Date.now(),
    model: cleanModelName,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: data.candidates[0]?.content?.parts[0]?.text || ''
      },
      finish_reason: data.candidates[0]?.finishReason || 'unknown'
    }],
    usage: {
      prompt_tokens: data.usage?.promptTokenCount || 0,
      completion_tokens: data.usage?.candidatesTokenCount || 0,
      total_tokens: data.usage?.totalTokenCount || 0
    }
  };
}