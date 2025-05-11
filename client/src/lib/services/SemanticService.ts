/**
 * Client-side service for semantic analysis operations
 */
import { apiRequest } from '../queryClient';
import { Edge } from '../../types';

interface SemanticAnalysisOptions {
  minSimilarity?: number;
  maxRelationsPerNode?: number;
  nodeTypes?: string[];
  persistToDatabase?: boolean;
}

interface SemanticAnalysisResponse {
  message: string;
  relationshipsFound: number;
  edgesCreated: number;
  edges: Edge[];
  persistedToDatabase?: boolean;
}

/**
 * Run semantic analysis to find relationships between nodes
 */
export async function runSemanticAnalysis(options: SemanticAnalysisOptions = {}): Promise<SemanticAnalysisResponse> {
  try {
    // Build query params
    const params = new URLSearchParams();
    
    if (options.minSimilarity !== undefined) {
      params.append('minSimilarity', options.minSimilarity.toString());
    }
    
    if (options.maxRelationsPerNode !== undefined) {
      params.append('maxRelationsPerNode', options.maxRelationsPerNode.toString());
    }
    
    if (options.nodeTypes && options.nodeTypes.length > 0) {
      params.append('nodeTypes', options.nodeTypes.join(','));
    }
    
    if (options.persistToDatabase !== undefined) {
      params.append('persistToDatabase', options.persistToDatabase.toString());
    }
    
    const url = `/api/graph/semantic-analysis?${params.toString()}`;
    const response = await apiRequest('POST', url);
    return await response.json();
  } catch (error) {
    console.error('Error running semantic analysis:', error);
    throw error;
  }
}