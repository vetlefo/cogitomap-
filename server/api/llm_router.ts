import { Request, Response } from 'express';
import { callOpenAI } from './providers/openai_provider';
import { callAnthropic } from './providers/anthropic_provider';
import { callGemini } from './providers/gemini_provider';
import { Message } from '../../client/src/types';
import { 
  StructuredLLMOutputSchema, 
  SimplifiedLLMOutputSchema,
  StructuredLLMOutput,
  getStructuredOutputExample
} from '../../shared/schemas/llmOutput';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';

// Enhanced system prompt for structured output with example
const STRUCTURED_SYSTEM_PROMPT = `
Your task is to respond to the user's query based on the provided conversation history.
You MUST structure your entire response as a single JSON object with the following fields:

- main_response (required): The primary natural language answer to the user's last message
- identified_topics (optional): List of 3-5 key topics discussed in your response
- key_entities (optional): List of named entities (PERSON, ORG, LOC, etc.) mentioned in your response
- sentiment (optional): Overall sentiment of your response ('positive', 'negative', or 'neutral')
- suggested_followups (optional): 1-3 relevant follow-up questions the user might ask
- summary (optional): A very brief (1-2 sentence) summary of your response content

IMPORTANT:
1. Your output MUST be a valid JSON object
2. Ensure your output ONLY contains the JSON object, with no text before or after
3. Do not include backticks, markdown formatting, or any non-JSON content

Here's an example of the expected format:
${getStructuredOutputExample()}
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
          console.log(`Using OpenAI API key from environment variables`);
          break;
        case 'anthropic':
        case 'a':
          selectedApiKey = process.env.ANTHROPIC_API_KEY;
          if (!selectedApiKey) {
            return res.status(400).json({ message: 'Anthropic API key is required' });
          }
          console.log(`Using Anthropic API key from environment variables`);
          break;
        case 'gemini':
        case 'g':
          selectedApiKey = process.env.GEMINI_API_KEY;
          if (!selectedApiKey) {
            return res.status(400).json({ message: 'Google Gemini API key is required' });
          }
          console.log(`Using Gemini API key from environment variables`);
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
          const parsedJson = JSON.parse(jsonMatch[0]);
          
          // First try the strict schema validation
          try {
            const validationResult = StructuredLLMOutputSchema.safeParse(parsedJson);
            
            if (validationResult.success) {
              console.log('Structured output validated successfully with strict schema');
              return res.json({
                message: validationResult.data,
                usage: responseData.usage
              });
            } else {
              // Log validation errors
              const validationError = fromZodError(validationResult.error);
              console.warn('Strict schema validation failed:', validationError.message);
              
              // Try the simplified schema as a fallback
              const simplifiedResult = SimplifiedLLMOutputSchema.safeParse(parsedJson);
              
              if (simplifiedResult.success) {
                console.log('Structured output validated with simplified schema');
                return res.json({
                  message: simplifiedResult.data,
                  usage: responseData.usage
                });
              } else {
                // Both schemas failed, log error details for debugging
                console.warn('Both schema validations failed. Errors:', 
                  fromZodError(simplifiedResult.error).message);
                  
                // Check if at least we have main_response (absolute minimum requirement)
                if (parsedJson.main_response && typeof parsedJson.main_response === 'string') {
                  console.warn('Falling back to basic main_response validation');
                  return res.json({
                    message: { 
                      main_response: parsedJson.main_response,
                      // Include any other fields that might be usable
                      ...Object.fromEntries(
                        Object.entries(parsedJson)
                          .filter(([key, value]) => 
                            key !== 'main_response' && 
                            value !== null && 
                            value !== undefined
                          )
                      )
                    },
                    usage: responseData.usage
                  });
                }
              }
            }
          } catch (zodError) {
            console.error('Error during Zod validation:', zodError);
          }
        }
        // If we couldn't extract valid JSON or validation failed completely
        console.warn('Failed to parse or validate structured output, returning raw response');
      } catch (parseError) {
        console.warn('Error parsing JSON from LLM response:', parseError);
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