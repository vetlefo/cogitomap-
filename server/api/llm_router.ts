import { Request, Response } from 'express';
import { callOpenAI } from './providers/openai_provider';
import { callAnthropic } from './providers/anthropic_provider';
import { callGemini } from './providers/gemini_provider';
import { Message } from '../../client/src/types';

// Define the structured output interface
interface StructuredLLMOutput {
  main_response: string;
  identified_topics?: string[];
  key_entities?: { entity: string; type: string }[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  suggested_followups?: string[];
  internal_links?: { source_node_id: string; target_node_id: string; relationship: string }[];
  summary?: string;
}

// System prompt for structured output
const STRUCTURED_SYSTEM_PROMPT = `
Your task is to respond to the user's query based on the provided conversation history.
You MUST structure your entire response as a single JSON object conforming to the following TypeScript interface:

interface StructuredLLMOutput {
  main_response: string; // The primary natural language answer to the user's last message
  identified_topics?: string[]; // List of key topics discussed in the main_response (3-5 topics)
  key_entities?: { entity: string; type: string }[]; // List of named entities (PERSON, ORG, LOC, etc.) mentioned
  sentiment?: 'positive' | 'negative' | 'neutral'; // Overall sentiment of the main_response
  suggested_followups?: string[]; // 1-3 relevant follow-up questions the user might ask
  internal_links?: { source_node_id: string; target_node_id: string; relationship: string }[]; // Leave empty for now
  summary?: string; // A very brief (1-2 sentence) summary of the main_response content
}

Ensure your output is ONLY the valid JSON object, starting with { and ending with }.
Do not include any text before or after the JSON object.
`;

/**
 * Handles requests to any LLM provider
 */
export async function handleLLMRequest(req: Request, res: Response) {
  try {
    // Extract request data - model can now be in format "provider:model_name"
    const { messages: originalMessages, apiKey, model } = req.body;
    
    if (!apiKey && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
      return res.status(400).json({ message: 'API key is required' });
    }
    
    if (!originalMessages || !Array.isArray(originalMessages)) {
      return res.status(400).json({ message: 'Valid messages array is required' });
    }

    // Default to OpenAI's gpt-3.5-turbo if no model specified
    const modelString = model || 'openai:gpt-3.5-turbo';
    
    // Parse provider and model name
    const [provider, modelName] = modelString.includes(':') 
      ? modelString.split(':', 2) 
      : ['openai', modelString];
    
    // Determine which API key to use (prefer provided key, fall back to env var)
    let selectedApiKey = apiKey;
    if (!selectedApiKey) {
      switch (provider.toLowerCase()) {
        case 'openai':
        case 'o':
          selectedApiKey = process.env.OPENAI_API_KEY;
          if (!selectedApiKey) {
            return res.status(400).json({ message: 'OpenAI API key is required' });
          }
          break;
        case 'anthropic':
        case 'a':
          selectedApiKey = process.env.ANTHROPIC_API_KEY;
          if (!selectedApiKey) {
            return res.status(400).json({ message: 'Anthropic API key is required' });
          }
          break;
        case 'gemini':
        case 'g':
          selectedApiKey = process.env.GEMINI_API_KEY;
          if (!selectedApiKey) {
            return res.status(400).json({ message: 'Google Gemini API key is required' });
          }
          break;
        default:
          return res.status(400).json({ message: `Unsupported provider: ${provider}` });
      }
    }
    
    // Check if we should request structured output
    const structured = req.query.structured === 'true' || req.body.structured === true;
    
    // Prepare messages with system prompt for structured output if requested
    const messages = structured 
      ? [{ role: 'system', content: STRUCTURED_SYSTEM_PROMPT }, ...originalMessages]
      : originalMessages;
    
    // Route request to the appropriate provider
    let responseData;
    switch (provider.toLowerCase()) {
      case 'openai':
      case 'o':
        responseData = await callOpenAI(
          messages, 
          selectedApiKey, 
          modelName,
          { responseFormat: structured ? 'json_object' : undefined }
        );
        break;
      case 'anthropic':
      case 'a':
        responseData = await callAnthropic(messages, selectedApiKey, modelName);
        break;
      case 'gemini':
      case 'g':
        responseData = await callGemini(messages, selectedApiKey, modelName);
        break;
      default:
        return res.status(400).json({ message: `Unsupported provider: ${provider}` });
    }
    
    // Extract the message from the provider's response format
    const responseMessage: Message = responseData.choices[0].message;
    
    // Attempt to parse structured output if requested
    if (structured && responseMessage.content) {
      try {
        // Extract the JSON object if it's embedded in text
        const jsonMatch = responseMessage.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const structuredContent = JSON.parse(jsonMatch[0]) as StructuredLLMOutput;
          
          // Validate that it has the required main_response field
          if (structuredContent.main_response) {
            return res.json({
              message: structuredContent,
              usage: responseData.usage
            });
          }
        }
        // If we couldn't extract valid JSON, continue with regular response
        console.warn('Failed to parse structured output, returning raw response');
      } catch (error) {
        console.warn('Error parsing structured output:', error);
        // Continue with regular response
      }
    }
    
    // Return the standard response format
    res.json({
      message: responseMessage,
      usage: responseData.usage
    });
  } catch (error) {
    console.error('Error in LLM router:', error);
    res.status(500).json({
      message: 'Internal server error processing LLM request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}