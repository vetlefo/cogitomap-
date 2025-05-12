/**
 * Special component to test semantic search functionality
 * with predefined examples that demonstrate vector similarity and text search
 */
import { useState } from 'react';
import { BubbleNode } from '../types';
import '../styles/cyberpunk.css';

interface SemanticSearchTesterProps {
  onClose: () => void;
}

interface TestScenario {
  name: string;
  description: string;
  query: string;
  queryType: 'text' | 'vector';
  options?: {
    minSimilarity?: number;
    limit?: number;
    includeRelated?: boolean;
    maxHops?: number;
    nodeTypes?: string[];
  };
}

export default function SemanticSearchTester({ onClose }: SemanticSearchTesterProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<BubbleNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<TestScenario | null>(null);
  const [updatingEmbeddings, setUpdatingEmbeddings] = useState<boolean>(false);
  const [updateStats, setUpdateStats] = useState<{
    total: number;
    updated: number;
    skipped: number;
    failed?: number;
  } | null>(null);

  // Predefined test scenarios
  const testScenarios: TestScenario[] = [
    {
      name: 'Topic Analysis',
      description: 'Find nodes related to data analysis and processing concepts',
      query: 'data analysis processing algorithms',
      queryType: 'vector',
      options: {
        minSimilarity: 0.6,
        includeRelated: true,
        maxHops: 2
      }
    },
    {
      name: 'Country Search',
      description: 'Find knowledge about countries and geographic locations',
      query: 'countries geographic locations capitals',
      queryType: 'vector',
      options: {
        minSimilarity: 0.65,
        nodeTypes: ['topic', 'entity'],
        includeRelated: true
      }
    },
    {
      name: 'Concept Relationships',
      description: 'Explore relationships between AI concepts',
      query: 'artificial intelligence machine learning neural networks',
      queryType: 'vector',
      options: {
        minSimilarity: 0.7,
        limit: 15,
        includeRelated: true,
        maxHops: 3
      }
    }
  ];

  const runSearch = async (scenario: TestScenario) => {
    setSelectedScenario(scenario);
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const endpoint = scenario.queryType === 'text' 
        ? '/api/search/text' 
        : '/api/search/semantic';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: scenario.query,
          ...scenario.options
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Search failed: ${errorText}`);
      }

      const data = await response.json();
      
      if (data.results && Array.isArray(data.results)) {
        setResults(data.results);
      } else {
        setResults([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update embeddings for existing nodes in the database
   * This is useful for fixing nodes that were created without embeddings
   */
  const updateEmbeddings = async () => {
    setUpdatingEmbeddings(true);
    setUpdateStats(null);
    setError(null);

    try {
      const response = await fetch('/api/semantic/update-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Embedding update failed: ${errorText}`);
      }

      const data = await response.json();
      console.log('Embedding update result:', data);
      
      if (data.stats) {
        setUpdateStats(data.stats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Embedding update error:', err);
    } finally {
      setUpdatingEmbeddings(false);
    }
  };

  return (
    <div className="semantic-search-tester">
      <div className="tester-header">
        <h2>Semantic Search Testing</h2>
        <button className="close-button" onClick={onClose}>×</button>
      </div>

      <div className="admin-actions">
        <button 
          className={`update-embeddings-button ${updatingEmbeddings ? 'updating' : ''}`}
          onClick={updateEmbeddings}
          disabled={updatingEmbeddings}
        >
          {updatingEmbeddings && <span className="updating-spinner"></span>}
          {updatingEmbeddings ? 'Updating Embeddings...' : 'Update Node Embeddings'}
        </button>
        
        {updateStats && (
          <div className="update-stats">
            Updated {updateStats.updated} nodes 
            (Skipped: {updateStats.skipped}, 
            Failed: {updateStats.failed || 0}, 
            Total: {updateStats.total})
          </div>
        )}
      </div>

      <div className="scenarios-container">
        <h3>Test Scenarios</h3>
        <div className="scenario-list">
          {testScenarios.map((scenario) => (
            <div 
              key={scenario.name}
              className={`scenario-card ${selectedScenario?.name === scenario.name ? 'selected' : ''}`}
              onClick={() => runSearch(scenario)}
            >
              <div className="scenario-title">{scenario.name}</div>
              <div className="scenario-description">{scenario.description}</div>
              <div className="scenario-details">
                <span className="scenario-query">"{scenario.query}"</span>
                <span className={`scenario-type ${scenario.queryType}`}>
                  {scenario.queryType === 'vector' ? 'Vector Search' : 'Text Search'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="results-container">
        <h3>
          Search Results 
          {selectedScenario && <span> for "{selectedScenario.name}"</span>}
          {loading && <span className="loading-indicator"> (Loading...)</span>}
        </h3>
        
        {error && (
          <div className="error-message">
            Error: {error}
          </div>
        )}
        
        {results.length === 0 && !loading && !error ? (
          <div className="no-results">
            <p>No results found. This could be because:</p>
            <ul>
              <li>There are no nodes in the database that match the query</li>
              <li>The similarity threshold is too high</li>
              <li>Nodes don't have proper embedding vectors</li>
            </ul>
            <p>Try using the "Update Node Embeddings" button above to fix nodes missing embeddings.</p>
          </div>
        ) : (
          <div className="result-list">
            {results.map((result) => (
              <div key={result.id} className="result-card">
                <div className="result-type">{result.type}</div>
                <div className="result-content">{result.content}</div>
                {result.similarity !== undefined && (
                  <div className="result-similarity">
                    Similarity: {(result.similarity * 100).toFixed(1)}%
                  </div>
                )}
                {result.isDirectMatch !== undefined && (
                  <div className={`result-match ${result.isDirectMatch ? 'direct' : 'related'}`}>
                    {result.isDirectMatch ? 'Direct Match' : 'Related Node'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}