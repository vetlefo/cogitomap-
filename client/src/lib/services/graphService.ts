import { BubbleNode, Edge } from '../../types';
import { apiRequest } from '../queryClient';

// Interface for paginated graph data responses
interface PaginatedNodesResponse {
  nodes: BubbleNode[];
  total: number;
  page: number;
  pageSize: number;
}

interface PaginatedEdgesResponse {
  edges: Edge[];
  total: number;
  page: number;
  pageSize: number;
}

interface SubgraphResponse {
  nodes: BubbleNode[];
  edges: Edge[];
}

interface GraphStatus {
  connected: boolean;
  nodeCount: number;
  edgeCount: number;
  storageMode: string;
  timestamp: string;
}

interface NodeNeighborsResponse {
  nodeId: string;
  neighbors: { node: BubbleNode, relationship: string }[];
}

/**
 * Service class for interacting with the graph API
 */
export class GraphService {
  /**
   * Get the current status of the graph database
   */
  static async getStatus(): Promise<GraphStatus> {
    const response = await apiRequest('GET', '/api/graph/status');
    return await response.json();
  }

  /**
   * Get all nodes with optional pagination and type filtering
   */
  static async getNodes(page: number = 0, pageSize: number = 50, nodeType?: string): Promise<PaginatedNodesResponse> {
    let url = `/api/graph/nodes?page=${page}&pageSize=${pageSize}`;
    if (nodeType) {
      url += `&type=${nodeType}`;
    }
    const response = await apiRequest('GET', url);
    return await response.json();
  }

  /**
   * Get all edges with optional pagination and relationship type filtering
   */
  static async getEdges(page: number = 0, pageSize: number = 50, relationshipType?: string): Promise<PaginatedEdgesResponse> {
    let url = `/api/graph/edges?page=${page}&pageSize=${pageSize}`;
    if (relationshipType) {
      url += `&relationship=${relationshipType}`;
    }
    const response = await apiRequest('GET', url);
    return await response.json();
  }

  /**
   * Get a specific node by ID
   */
  static async getNode(id: string): Promise<BubbleNode> {
    const response = await apiRequest('GET', `/api/graph/node/${id}`);
    return await response.json();
  }

  /**
   * Get a node's neighbors
   */
  static async getNodeNeighbors(id: string): Promise<NodeNeighborsResponse> {
    const response = await apiRequest('GET', `/api/graph/node/${id}/neighbors`);
    return await response.json();
  }

  /**
   * Get a subgraph centered around a node
   * API endpoint is GET /api/graph/subgraph/:nodeId?depth=:depth
   */
  static async getSubgraph(nodeId: string, depth: number = 1): Promise<SubgraphResponse> {
    // Ensure the URL matches the server route: path param for ID, query param for depth.
    const response = await apiRequest('GET', `/api/graph/subgraph/${nodeId}?depth=${depth}`);
    return await response.json();
  }

  /**
   * Create a new node
   */
  static async createNode(node: Omit<BubbleNode, 'id'>): Promise<BubbleNode> {
    const response = await apiRequest('POST', '/api/graph/node', node);
    return await response.json();
  }

  /**
   * Create a new edge
   */
  static async createEdge(source: string | { id: string }, target: string | { id: string }, relationship: string, strength: number = 0.5): Promise<Edge> {
    // Ensure source and target are strings, not objects
    const sourceId = typeof source === 'object' && source !== null ? source.id : source;
    const targetId = typeof target === 'object' && target !== null ? target.id : target;
    
    // Make sure all required fields are strings and correctly formatted
    const edge = {
      source: sourceId,
      target: targetId,
      relationship,
      strength
    };
    
    console.log('Creating edge with data:', edge);
    const response = await apiRequest('POST', '/api/graph/edge', edge);
    return await response.json();
  }
}