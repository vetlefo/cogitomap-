/**
 * Enhanced LLM Router with Pipeline Integration
 * 
 * This version of the LLM router integrates with the pipeline architecture
 * to process messages and create graph nodes as part of the LLM request flow.
 */

import { Request, Response } from 'express';
import { callOpenAI } from './providers/openai_provider';
import { callAnthropic } from './providers/anthropic_provider';
import { callGemini } from './providers/gemini_provider';
import { Message as ClientMessage } from '../../client/src/types';
import { 
  StructuredLLMOutputSchema, 
  SimplifiedLLMOutputSchema,
  StructuredLLMOutput,
  getStructuredOutputExample
} from '../../shared/schemas/llmOutput';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { processMessage, Message } from '../services/pipelineController';
import { log } from '../vite';
import { v4 as uuidv4 } from 'uuid';

// Enhanced system prompt for structured output with example
const STRUCTURED_SYSTEM_PROMPT = `
You are an insightful AI assistant with special capabilities to visualize conversations in a 3D knowledge graph. As you answer questions naturally, your responses will automatically be transformed into an immersive spatial experience.

Respond to the user's query based on the provided conversation history. Your message will be converted to a single JSON object with fields that enhance the visual representation.

## CORE MESSAGE:
- main_response: Provide your thoughtful, natural answer to the user here. This is what the user will read.

## ENHANCING THE VISUALIZATION:
To create a rich knowledge graph from your answer, include these optional elements:

- identified_topics: 3-5 key topics from your response that should appear as nodes
- summary: A concise 1-2 sentence summary that captures your main points
- sentiment: The overall tone ('positive', 'negative', or 'neutral')
- suggested_followups: 1-3 natural follow-up questions to continue exploration

## ENHANCING ENTITY REPRESENTATION:
When your response mentions specific entities (people, organizations, concepts):
- Add them to 'key_entities' with:
  * entity: Full name
  * type: Category (PERSON, ORG, LOCATION, CONCEPT, etc.)
  * description: Brief context about this entity
  * importance: How central it is to your answer (1-10)

## SEMANTIC RELATIONSHIPS:
To show how concepts connect in the visualization:
- Add meaningful connections to 'relationships':
  * source: Starting entity or concept
  * target: Connected entity or concept
  * relationship_type: How they relate (e.g., "influences", "contains", "contradicts")
  * strength: Connection importance (1-10)
  * description: Brief explanation of this relationship

## HANDLING LARGE SETS:
When discussing many related items (like companies, countries, or historical events):
- Group them meaningfully in 'entity_categories':
  * category_name: Clear group name (e.g., "Renewable Energy Companies") 
  * description: What defines this category
  * importance: Relevance to the current topic (1-10)
  * entities: 2-4 representative examples from this category, with descriptions

## TECHNICAL REQUIREMENTS:
1. Structure your entire response as a valid JSON object
2. No text, backticks, or markdown outside the JSON
3. Ensure entity names are consistent when referenced in relationships
4. Always use entity_categories for large sets of similar items (10+)

EXAMPLES OF EXPECTED FORMAT:
${getStructuredOutputExample()}
`;

/**
 * Handle LLM requests and process messages through the pipeline
 */
export async function handlePipelineLLMRequest(req: Request, res: Response) {
  try {
    // Extract request data - model can now be in format "provider:model_name"
    const { messages: originalMessages, apiKey, model, userId = 'default-user' } = req.body;
    
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
          log(`Using OpenAI API key from environment variables`, 'llm-router');
          break;
        case 'anthropic':
        case 'a':
          selectedApiKey = process.env.ANTHROPIC_API_KEY;
          if (!selectedApiKey) {
            return res.status(400).json({ message: 'Anthropic API key is required' });
          }
          log(`Using Anthropic API key from environment variables`, 'llm-router');
          break;
        case 'gemini':
        case 'g':
          selectedApiKey = process.env.GEMINI_API_KEY;
          if (!selectedApiKey) {
            return res.status(400).json({ message: 'Google Gemini API key is required' });
          }
          log(`Using Gemini API key from environment variables`, 'llm-router');
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
    const responseMessage: ClientMessage = responseData.choices[0].message;
    
    // Process the message using the pipeline architecture
    const userQuery = originalMessages[originalMessages.length - 1];
    const assistantResponse = responseMessage;
    
    // Create unique IDs for these messages
    const userMessageId = `user_message-${Date.now().toString(36)}-${uuidv4().substring(0, 8)}`;
    const aiMessageId = `ai_message-${Date.now().toString(36)}-${uuidv4().substring(0, 8)}`;

    // Process the user message through the pipeline
    const userPipelineResult = await processMessage({
      id: userMessageId,
      role: 'user',
      content: userQuery.content,
      userId: userId,
      timestamp: new Date().toISOString(),
    });
    
    log(`Processed user message through pipeline: ${userPipelineResult.nodes.length} nodes, ${userPipelineResult.edges.length} edges created`, 'llm-router-pipeline');
    
    // Parse the JSON from the response content
    let contentToProcess = '';
    let jsonContent: any = null;
    
    try {
      // Parse the JSON content
      jsonContent = JSON.parse(assistantResponse.content as string);
      
      // Extract the main_response
      if (jsonContent && typeof jsonContent === 'object' && jsonContent.main_response) {
        log('Found JSON with main_response field', 'llm-router-pipeline');
        contentToProcess = jsonContent.main_response;
      } else {
        log('Missing main_response in JSON content', 'llm-router-pipeline-error');
        contentToProcess = assistantResponse.content as string;
      }
    } catch (e) {
      log('Error parsing JSON content: ' + e, 'llm-router-pipeline-error');
      contentToProcess = assistantResponse.content as string;
    }
    
    // Process the AI response through the pipeline
    const aiPipelineResult = await processMessage({
      id: aiMessageId,
      role: 'assistant',
      content: contentToProcess,
      userId: userId,
      timestamp: new Date().toISOString(),
    });
    
    log(`Processed AI response through pipeline: ${aiPipelineResult.nodes.length} nodes, ${aiPipelineResult.edges.length} edges created`, 'llm-router-pipeline');
    
    // Create a connection between user message and AI response
    // This would be handled by transformers in a full implementation
    
    // Use the already parsed JSON content directly
    if (jsonContent && jsonContent.main_response) {
      log('Using parsed JSON with main_response for response format', 'llm-router-pipeline');
      
      // Create a proper message format with the main_response as content
      const formattedMessage = {
        role: 'assistant',
        content: jsonContent.main_response,
        // Add any additional fields as annotations
        refusal: null,
        annotations: []
      };
      
      // Return the formatted response
      return res.json({
        message: formattedMessage,
        usage: responseData.usage,
        pipeline: {
          userMessage: {
            id: userMessageId,
            nodesCreated: userPipelineResult.nodes.length,
            edgesCreated: userPipelineResult.edges.length,
          },
          aiMessage: {
            id: aiMessageId,
            nodesCreated: aiPipelineResult.nodes.length,
            edgesCreated: aiPipelineResult.edges.length,
          },
        },
      });
    }
    
    // Return the standard response format
    res.json({
      message: responseMessage,
      usage: responseData.usage,
      pipeline: {
        userMessage: {
          id: userMessageId,
          nodesCreated: userPipelineResult.nodes.length,
          edgesCreated: userPipelineResult.edges.length,
        },
        aiMessage: {
          id: aiMessageId,
          nodesCreated: aiPipelineResult.nodes.length,
          edgesCreated: aiPipelineResult.edges.length,
        },
      },
    });
  } catch (error) {
    log('Error in Pipeline LLM router: ' + error, 'llm-router-pipeline-error');
    res.status(500).json({
      message: 'Internal server error processing LLM request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}