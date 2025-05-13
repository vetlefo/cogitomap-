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

describe('Semantic Search API Integration', () => {
  it('should return semantic search results', async () => {
    const res = await request(app)
      .post('/api/semantic/search')
      .send({
        query: 'example test',
        minSimilarity: 0.1,
        limit: 3,
        vectorSearch: false,
        textSearch: true
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('results');
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  it('should return SSR semantic results', async () => {
    const res = await request(app)
      .get('/api/graph/semantic-ssr')
      .query({ query: 'example ssr', limit: 2, minSimilarity: 0.0 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach((item: any) => {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('similarity');
    });
  });
});