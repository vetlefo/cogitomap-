import React, { useState } from 'react';
import { Message } from '../types';
import { useVisualization } from '../lib/stores/useVisualization';

interface SemanticAnalysisButtonProps {
  messages: Message[];
  className?: string;
}

export default function SemanticAnalysisButton({ messages, className = '' }: SemanticAnalysisButtonProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Get visualization store methods
  const { addNode, addEdge } = useVisualization();

  /**
   * Trigger semantic analysis API call
   */
  const findSemanticRelationships = async () => {
    // Only process if we have enough messages
    if (messages.length < 2) {
      setError('Need at least 2 messages for semantic analysis');
      return;
    }
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const response = await fetch('/api/semantic/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageHistory: messages,
          analysisMode: 'full',
          analysisOptions: {
            includeMessageContext: true
          }
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run semantic analysis');
      }
      
      const data = await response.json();
      setResults(data);
      
      // Add nodes and edges to visualization if available
      if (data.success && data.nodesAdded > 0) {
        // Refresh nodes and edges from the database
        // (The actual nodes are already added on the server)
        // In a production app, we might return and add them directly here
        
        // Show success message with stats
        console.log(`Semantic analysis complete: ${data.nodesAdded} nodes, ${data.edgesAdded} edges`);
      }
    } catch (err) {
      console.error('Error during semantic analysis:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  return (
    <div className={`semantic-analysis-container ${className}`}>
      <button
        className={`semantic-analysis-button ${isAnalyzing ? 'analyzing' : ''}`}
        onClick={findSemanticRelationships}
        disabled={isAnalyzing || messages.length < 2}
      >
        {isAnalyzing ? (
          <>
            <span className="analyzing-spinner"></span>
            Finding Semantic Relationships...
          </>
        ) : (
          <>Find Semantic Relationships</>
        )}
      </button>
      
      {error && (
        <div className="semantic-analysis-error">
          {error}
        </div>
      )}
      
      {results && results.success && (
        <div className="semantic-analysis-results">
          <div className="semantic-analysis-summary">
            {results.summary}
          </div>
          <div className="semantic-analysis-stats">
            Added {results.nodesAdded} nodes and {results.edgesAdded} edges
          </div>
        </div>
      )}
    </div>
  );
}