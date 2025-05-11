import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
// import { storage } from "./storage"; // Not used for graph operations directly for now
import { handleLLMRequest } from "./api/llm_router";
import { getCurrentUserHandler, checkAuthHandler, loginHandler, logoutHandler } from "./api/auth";
import { requireAuth } from "./middleware/auth";
import { runMemgraphQuery } from "./db/memgraphClient";
import { log } from "./vite";
import { z } from "zod";

// ---- Define Zod Schemas for Node/Edge Payloads ----
const ALLOWED_NODE_TYPES = [
  "user_message",
  "ai_message",
  "topic",
  "entity",
  "summary",
  "question",
] as const;
const NodeTypeEnum = z.enum(ALLOWED_NODE_TYPES);

const NodeInputSchema = z.object({
  id: z.string().min(1),
  type: NodeTypeEnum,
  content: z.string().min(1),
  timestamp: z.number().optional(),
  sentiment: z.enum(["positive", "negative", "neutral"]).optional(),
  keywords: z.array(z.string()).optional(),
  importance: z.number().min(0).max(1).optional(),
  metadata: z.record(z.any()).optional(),
  embedding_vector: z.array(z.number()).optional(),
});
type NodeInput = z.infer<typeof NodeInputSchema>;

const ALLOWED_RELATIONSHIP_TYPES = [
  "response_to",
  "mentions",
  "elaborates",
  "supports",
  "contradicts",
  "summarizes",
  "raises_question",
  "related_to" // Added for semantic linking
] as const;
const RelationshipTypeEnum = z.enum(ALLOWED_RELATIONSHIP_TYPES);

const EdgeInputSchema = z.object({
  // id: z.string().min(1).optional(), // Client might generate an edge ID, or we let DB handle it. For now, optional.
                                    // Memgraph edges don't typically have user-defined IDs like nodes unless modeled differently.
  source: z.string().min(1),         // ID of the source node
  target: z.string().min(1),         // ID of the target node
  relationship: RelationshipTypeEnum, // Type of the relationship
  strength: z.number().min(0).max(1).optional(), // Optional strength
  // Add any other edge properties if needed
});
type EdgeInput = z.infer<typeof EdgeInputSchema>;


// ---- Route Handlers ----

async function createNodeHandler(req: Request, res: Response) {
  try {
    log(`Received POST /api/graph/node with body: ${JSON.stringify(req.body)}`, 'api-graph-debug');
    const validationResult = NodeInputSchema.safeParse(req.body);
    if (!validationResult.success) {
      log(`Create node validation error: ${JSON.stringify(validationResult.error.format())}`, 'api-graph');
      return res.status(400).json({ message: "Invalid node data", errors: validationResult.error.format() });
    }

    const nodeData: NodeInput = validationResult.data;
    const nodeLabel = nodeData.type;
    const propertiesToSave: Record<string, any> = { ...nodeData };

    if (propertiesToSave.metadata && typeof propertiesToSave.metadata !== 'object') {
        try {
            propertiesToSave.metadata = JSON.parse(propertiesToSave.metadata);
        } catch (e) {
            log(`Metadata for node ${nodeData.id} is not a parsable JSON string nor an object. Storing as is.`, 'api-graph');
        }
    }

    const query = `CREATE (n:${nodeLabel} $props) RETURN n`;
    const params = { props: propertiesToSave };

    log(`Executing Cypher: ${query} with params: ${JSON.stringify(params)}`, 'api-graph-debug');
    const result = await runMemgraphQuery(query, params);

    if (result.records.length > 0 && result.records[0].get('n')) {
      const createdNodeProperties = result.records[0].get('n').properties;
      log(`Node created successfully: ${createdNodeProperties.id} of type ${nodeLabel}`, 'api-graph');
      res.status(201).json(createdNodeProperties);
    } else {
      log(`Node creation in Memgraph failed, no record returned for type ${nodeLabel} with id ${nodeData.id}. Query: ${query}, Params: ${JSON.stringify(params)}`, 'api-graph-error');
      res.status(500).json({ message: "Node creation failed in database, no record returned" });
    }
  } catch (error) {
    log(`Error in createNodeHandler: ${error instanceof Error ? error.message : String(error)}`, 'api-graph-error');
    if (error instanceof Error && error.stack) {
        log(error.stack, 'api-graph-error-stack');
    }
    res.status(500).json({ message: "Error creating node", error: error instanceof Error ? error.message : "Unknown server error" });
  }
}

async function createEdgeHandler(req: Request, res: Response) {
  try {
    log(`Received POST /api/graph/edge with body: ${JSON.stringify(req.body)}`, 'api-graph-debug');
    const validationResult = EdgeInputSchema.safeParse(req.body);
    if (!validationResult.success) {
      log(`Create edge validation error: ${JSON.stringify(validationResult.error.format())}`, 'api-graph');
      return res.status(400).json({ message: "Invalid edge data", errors: validationResult.error.format() });
    }

    const edgeData: EdgeInput = validationResult.data;
    const { source: sourceId, target: targetId, relationship: relationshipType, ...edgeProps } = edgeData;

    const query = `
      MATCH (sourceNode {id: $sourceId}), (targetNode {id: $targetId})
      CREATE (sourceNode)-[r:${relationshipType} $props]->(targetNode)
      RETURN type(r) AS relationshipType, r.strength AS strength, startNode(r).id AS source, endNode(r).id AS target
    `;
    const params = {
      sourceId,
      targetId,
      props: Object.keys(edgeProps).length > 0 ? edgeProps : {},
    };

    log(`Executing Cypher: ${query.replace(/\s+/g, ' ').trim()} with params: ${JSON.stringify(params)}`, 'api-graph-debug');
    const result = await runMemgraphQuery(query, params);

    if (result.records.length > 0) {
      const createdRel = result.records[0];
      const responseData = {
        relationshipType: createdRel.get('relationshipType'),
        strength: createdRel.get('strength'),
        source: createdRel.get('source'),
        target: createdRel.get('target'),
      };
      log(`Edge created: ${JSON.stringify(responseData)}`, 'api-graph');
      res.status(201).json(responseData);
    } else {
      log(`Edge creation failed: Source or Target node not found, or relationship not created. sourceId: ${sourceId}, targetId: ${targetId}, type: ${relationshipType}`, 'api-graph-error');
      res.status(404).json({ message: "Edge creation failed: Source or Target node not found, or relationship couldn't be established." });
    }
  } catch (error) {
    log(`Error in createEdgeHandler: ${error instanceof Error ? error.message : String(error)}`, 'api-graph-error');
     if (error instanceof Error && error.stack) {
        log(error.stack, 'api-graph-error-stack');
    }
    res.status(500).json({ message: "Error creating edge", error: error instanceof Error ? error.message : "Unknown server error" });
  }
}


export async function registerRoutes(app: Express): Promise<Server> {
  app.post('/api/chat', handleLLMRequest);

  app.post('/api/validate-key', async (req, res) => {
    const { apiKey, provider = 'openai' } = req.body;
    if (!apiKey) return res.status(400).json({ valid: false, message: 'API key is required' });
    try {
      let url = '';
      let fetchOptions: RequestInit = { headers: {} };
      switch (provider.toLowerCase()) {
        case 'openai': case 'o':
          url = 'https://api.openai.com/v1/models';
          (fetchOptions.headers as Record<string, string>)['Authorization'] = `Bearer ${apiKey}`;
          break;
        case 'anthropic': case 'a':
          url = 'https://api.anthropic.com/v1/messages';
          fetchOptions.method = 'POST';
          (fetchOptions.headers as Record<string, string>)['x-api-key'] = apiKey;
          (fetchOptions.headers as Record<string, string>)['anthropic-version'] = '2023-06-01';
          (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
          fetchOptions.body = JSON.stringify({ model: "claude-3-haiku-20240307", max_tokens: 1, messages: [{role: "user", content: "Test"}] });
          break;
        case 'gemini': case 'g':
          url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
          (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
          break;
        default:
          log(`Unsupported provider for validation: ${provider}`, 'api-validate-key');
          return res.status(400).json({ valid: false, message: `Unsupported provider for validation: ${provider}` });
      }
      log(`Validating ${provider} key by calling ${url}`, 'api-validate-key');
      const response = await fetch(url, fetchOptions);
      const responseText = await response.text();
      if (response.ok) {
        log(`${provider} API key appears valid. Status: ${response.status}`, 'api-validate-key');
        res.json({ valid: true, message: `${provider} API key appears valid` });
      } else {
        log(`Invalid ${provider} API key or API error. Status: ${response.status}, Response: ${responseText.substring(0, 200)}...`, 'api-validate-key-error');
        try {
            res.status(response.status).json({ valid: false, message: `Invalid ${provider} API key or API error`, error: JSON.parse(responseText) });
        } catch (e) {
            res.status(response.status).json({ valid: false, message: `Invalid ${provider} API key or API error. Response not JSON: ${responseText.substring(0,100)}...` });
        }
      }
    } catch (error) {
      log(`Error validating ${provider} API key: ${error instanceof Error ? error.message : String(error)}`, 'api-validate-key-error');
      res.status(500).json({ valid: false, message: `Error validating ${provider} API key`, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

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
    }; // Ensure models object is properly defined or imported if it's large
    res.json(models);
  });

  app.get('/api/keys/check', (req, res) => {
    const envKeys = {
      openai: !!process.env.OPENAI_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY
    }; // Ensure envKeys object is properly defined
    res.json(envKeys);
  });

  app.get('/api/auth/user', getCurrentUserHandler);
  app.get('/api/auth/check', checkAuthHandler);
  app.get('/api/auth/login', loginHandler);
  app.get('/api/auth/logout', logoutHandler);
  app.get('/api/protected', requireAuth, (req, res) => res.json({ message: 'This is a protected route', user: req.user }));

  // ---- New Graph API Endpoints ----
  app.post('/api/graph/node', createNodeHandler);
  app.post('/api/graph/edge', createEdgeHandler);
  // app.get('/api/graph/node/:id', getNodeHandler);
  // app.get('/api/graph/neighbors/:id', getNeighborsHandler);
  // app.post('/api/graph/search', searchGraphHandler);

  const httpServer = createServer(app);
  return httpServer;
}