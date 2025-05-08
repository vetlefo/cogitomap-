import { Request, Response } from 'express';
import { OpenAIResponse, Message } from '../../client/src/types';

/**
 * Handles requests to the OpenAI API
 */
export async function handleOpenAIRequest(req: Request, res: Response) {
  try {
    const { messages, apiKey, model = 'gpt-3.5-turbo' } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ message: 'API key is required' });
    }
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ message: 'Valid messages array is required' });
    }
    
    // Create the request to OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });
    
    // Handle API errors
    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      console.error('OpenAI API error:', errorData);
      
      return res.status(openaiResponse.status).json({
        message: 'Error from OpenAI API',
        error: errorData
      });
    }
    
    // Parse and send the response
    const data: OpenAIResponse = await openaiResponse.json();
    const responseMessage: Message = data.choices[0].message;
    
    res.json({
      message: responseMessage,
      usage: data.usage
    });
  } catch (error) {
    console.error('Error in OpenAI handler:', error);
    res.status(500).json({
      message: 'Internal server error processing OpenAI request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
