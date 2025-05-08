import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { handleOpenAIRequest } from "./api/openai";

export async function registerRoutes(app: Express): Promise<Server> {
  // OpenAI Chat Completions API endpoint
  app.post('/api/chat', handleOpenAIRequest);
  
  // Add API key validation endpoint
  app.post('/api/validate-key', async (req, res) => {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ valid: false, message: 'API key is required' });
    }
    
    try {
      // Make a simple request to list models to validate the API key
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (response.ok) {
        res.json({ valid: true, message: 'API key is valid' });
      } else {
        const errorData = await response.json();
        res.status(400).json({ 
          valid: false, 
          message: 'Invalid API key',
          error: errorData
        });
      }
    } catch (error) {
      console.error('Error validating API key:', error);
      res.status(500).json({ 
        valid: false, 
        message: 'Error validating API key', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
