import React, { useState } from 'react';
import SemanticSearchBar from './SemanticSearchBar';
import { toast } from 'sonner';

/**
 * Special component to test semantic search functionality
 * with predefined examples that demonstrate vector similarity and text search
 */
interface SemanticSearchTesterProps {
  onClose: () => void;
}

export default function SemanticSearchTester({ onClose }: SemanticSearchTesterProps) {
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [testName, setTestName] = useState<string | null>(null);
  const [isUpdatingEmbeddings, setIsUpdatingEmbeddings] = useState(false);
  const [embeddingUpdateStats, setEmbeddingUpdateStats] = useState<{updated: number, total: number} | null>(null);
  
  // Sample test queries that demonstrate different aspects of semantic search
  const testQueries = [
    { 
      name: "Country Search", 
      query: "countries with large geographical distances", 
      options: { useEmbedding: true, includeRelated: true } 
    },
    { 
      name: "Topic Analysis", 
      query: "What are topics of interest", 
      options: { useEmbedding: true, includeRelated: true } 
    },
    { 
      name: "Concept Relationships", 
      query: "how are topics connected", 
      options: { useEmbedding: true, includeRelated: true } 
    }
  ];
  
  const handleRunTest = async (test: typeof testQueries[0]) => {
    setIsLoading(true);
    setTestName(test.name);
    setResults([]);
    
    try {
      // Make semantic search API request
      const response = await fetch('/api/semantic/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: test.query,
          useEmbedding: test.options.useEmbedding,
          includeRelated: test.options.includeRelated,
          maxResults: 10,
          minSimilarity: 0.5
        })
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      setResults(data.results || []);
      
      if (data.results && data.results.length > 0) {
        toast.success(`Found ${data.results.length} results for "${test.query}"`);
      } else {
        toast.info(`No results found for "${test.query}". Try adding more content to the graph.`);
      }
    } catch (error) {
      console.error("Error running semantic search test:", error);
      toast.error("Error running semantic search test");
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Update embeddings for existing nodes in the database
   * This is useful for fixing nodes that were created without embeddings
   */
  const updateEmbeddings = async () => {
    setIsUpdatingEmbeddings(true);
    setEmbeddingUpdateStats(null);
    
    try {
      const response = await fetch('/api/semantic/update-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setEmbeddingUpdateStats({
          updated: data.updated,
          total: data.total
        });
        
        toast.success(`Updated embeddings for ${data.updated} out of ${data.total} nodes`);
      } else {
        toast.error(`Failed to update embeddings: ${data.message}`);
      }
    } catch (error) {
      console.error("Error updating embeddings:", error);
      toast.error("Error updating embeddings");
    } finally {
      setIsUpdatingEmbeddings(false);
    }
  };
  
  return (
    <div className="semantic-search-panel test-panel">
      <div className="panel-header">
        <h3>Semantic Search Test Scenarios</h3>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="panel-content">
        <div className="description">
          <p>
            These test scenarios demonstrate how semantic search can find related content 
            even when exact keywords don't match. Choose a test to run:
          </p>
        </div>
        
        <div className="test-buttons">
          {testQueries.map(test => (
            <button
              key={test.name}
              className={`test-button ${testName === test.name ? 'active' : ''}`}
              onClick={() => handleRunTest(test)}
              disabled={isLoading}
            >
              {test.name}
            </button>
          ))}
        </div>
        
        <div className="separator"></div>
        
        <div className="admin-actions">
          <button
            className={`update-embeddings-button ${isUpdatingEmbeddings ? 'updating' : ''}`}
            onClick={updateEmbeddings}
            disabled={isUpdatingEmbeddings}
          >
            {isUpdatingEmbeddings ? (
              <>
                <span className="updating-spinner"></span>
                Updating Embeddings...
              </>
            ) : (
              <>Update Node Embeddings</>
            )}
          </button>
          
          {embeddingUpdateStats && (
            <div className="update-stats">
              Updated {embeddingUpdateStats.updated} out of {embeddingUpdateStats.total} nodes with embeddings
            </div>
          )}
        </div>
        
        <div className="separator"></div>
        
        <div className="search-container">
          <SemanticSearchBar 
            className="test-search-bar"
            onSearchResults={setResults}
            placeholder="Or try your own search query..."
          />
        </div>
        
        <div className="separator"></div>
        
        <div className="results-container">
          <h4>
            {isLoading ? 'Searching...' : 
             results.length > 0 ? `Found ${results.length} results:` : 'No results found'}
          </h4>
          
          {results.length > 0 ? (
            <div className="results-list">
              {results.map((result, index) => (
                <div key={index} className="result-item">
                  <div className="result-header">
                    <span className="result-type">{result.type}</span>
                    <span className="result-score">Similarity: {(result.similarity * 100).toFixed(1)}%</span>
                  </div>
                  <div className="result-content">{result.content}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-results">
              {isLoading ? (
                <div className="loading-indicator">Searching database...</div>
              ) : (
                <div className="help-text">
                  {testName ? `No results found for the "${testName}" test.` : "Select a test scenario or try a search query."}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}