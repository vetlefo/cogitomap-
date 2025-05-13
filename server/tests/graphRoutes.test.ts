import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../routes';

let app: express.Express;
let server: any;

beforeAll(async () => {
  app = express();
  app.use(express.json());
  server = await registerRoutes(app);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('Graph API Integration', () => {
  let createdNodeId: string;
  it('should report graph status', async () => {
    const res = await request(app).get('/api/graph/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('connected');
    expect(typeof res.body.nodeCount).toBe('number');
  });

  it('should create and retrieve a node', async () => {
    const nodePayload = {
      id: 'test-node-1',
      type: 'topic',
      content: 'Test Node Content'
    };
    const postRes = await request(app)
      .post('/api/graph/node')
      .send(nodePayload);
    expect(postRes.status).toBe(201);
    expect(postRes.body.id).toBe(nodePayload.id);
    createdNodeId = postRes.body.id;

    const getRes = await request(app).get(`/api/graph/node/${createdNodeId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.content).toBe(nodePayload.content);
  });

  it('should create and retrieve an edge', async () => {
    const edgePayload = {
      source: createdNodeId,
      target: createdNodeId,
      relationship: 'related_to',
      strength: 0.5
    };
    const edgeRes = await request(app)
      .post('/api/graph/edge')
      .send(edgePayload);
    expect(edgeRes.status).toBe(201);
    expect(edgeRes.body.relationship).toBe('related_to');
  });

  it('should fetch subgraph for existing node', async () => {
    const res = await request(app)
      .get(`/api/graph/subgraph/${createdNodeId}?depth=1`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.nodes)).toBe(true);
    expect(Array.isArray(res.body.edges)).toBe(true);
  });
});