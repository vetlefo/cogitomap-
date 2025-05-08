import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { handleLLMRequest } from "./api/llm_router";
import { getCurrentUserHandler, checkAuthHandler, loginHandler, logoutHandler } from "./api/auth";
import { requireAuth } from "./middleware/auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Multi-provider LLM Chat Completions API endpoint
  app.post('/api/chat', handleLLMRequest);
  
  // API key validation endpoint - now with support for multiple providers
  app.post('/api/validate-key', async (req, res) => {
    const { apiKey, provider = 'openai' } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ valid: false, message: 'API key is required' });
    }
    
    try {
      let response;
      let url = '';
      let headers = {};
      
      // Validate based on provider
      switch (provider.toLowerCase()) {
        case 'openai':
        case 'o':
          url = 'https://api.openai.com/v1/models';
          headers = { 'Authorization': `Bearer ${apiKey}` };
          break;
        case 'anthropic':
        case 'a':
          url = 'https://api.anthropic.com/v1/messages';
          headers = { 
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          };
          break;
        case 'gemini':
        case 'g':
          // For Gemini, we'll make a minimal request to the models endpoint
          url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
          headers = { 'Content-Type': 'application/json' };
          break;
        default:
          return res.status(400).json({ 
            valid: false, 
            message: `Unsupported provider: ${provider}`
          });
      }
      
      // Make validation request
      response = await fetch(url, { headers });
      
      if (response.ok) {
        res.json({ 
          valid: true, 
          message: `${provider} API key is valid` 
        });
      } else {
        const errorData = await response.json();
        res.status(400).json({ 
          valid: false, 
          message: `Invalid ${provider} API key`,
          error: errorData
        });
      }
    } catch (error) {
      console.error(`Error validating ${provider} API key:`, error);
      res.status(500).json({ 
        valid: false, 
        message: `Error validating ${provider} API key`, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Add endpoint for available models by provider
  app.get('/api/models', (req, res) => {
    const models = {
      openai: [
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
        { id: 'gpt-4', name: 'GPT-4' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
        { id: 'gpt-4o', name: 'GPT-4o' }
      ],
      anthropic: [
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
        { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
      ],
      gemini: [
        { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
      ]
    };
    
    res.json(models);
  });
  
  // Authentication routes
  app.get('/api/auth/user', getCurrentUserHandler);
  app.get('/api/auth/check', checkAuthHandler);
  app.get('/api/auth/login', loginHandler);
  app.get('/api/auth/logout', logoutHandler);
  
  // Protected route example
  app.get('/api/protected', requireAuth, (req, res) => {
    res.json({ message: 'This is a protected route', user: req.user });
  });

  const httpServer = createServer(app);

  return httpServer;
}
