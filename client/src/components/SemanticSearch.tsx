import React, { useState } from 'react';
import SemanticSearchBar from './SemanticSearchBar';
import SemanticSearchResults from './SemanticSearchResults';
import SemanticSearchTester from './SemanticSearchTester';

interface SemanticSearchProps {
  onSelectResult?: (result: any) => void;
  className?: string;
  onClose?: () => void;
}

/**
 * Combined component that provides a semantic search interface
 * with search bar and results display
 */
const SemanticSearch: React.FC<SemanticSearchProps> = ({
  onSelectResult,
  className = "",
  onClose
}) => {
  const [searchResults, setSearchResults] = useState<any>(null);
  const [showTester, setShowTester] = useState<boolean>(false);

  const handleSearchResults = (results: any) => {
    setSearchResults(results);
  };

  const handleSelectResult = (result: any) => {
    if (onSelectResult) {
      onSelectResult(result);
    }
  };

  const toggleTester = () => {
    setShowTester(!showTester);
  };

  // Show the tester instead of regular search when enabled
  if (showTester) {
    return <SemanticSearchTester onClose={() => setShowTester(false)} />;
  }

  return (
    <div className={`semantic-search-panel ${className}`}>
      <div className="panel-header">
        <h3>Semantic Knowledge Search</h3>
        {onClose && (
          <button className="close-button" onClick={onClose}>×</button>
        )}
      </div>
      
      <div className="panel-content">
        <p className="mb-4 text-sm text-cyan-300">
          Search your conversation history using natural language and vector similarity.
        </p>
        
        <SemanticSearchBar 
          onSearchResults={handleSearchResults}
          placeholder="Search by meaning, topic, or context..."
        />
        
        <div className="test-button-container" style={{ textAlign: 'right', margin: '10px 0' }}>
          <button 
            onClick={toggleTester}
            className="px-2 py-1 text-xs bg-cyan-900/50 text-cyan-300 rounded border border-cyan-500/30 hover:bg-cyan-800/60"
          >
            Run Test Scenarios
          </button>
        </div>
        
        <SemanticSearchResults 
          data={searchResults}
          onSelectResult={handleSelectResult}
        />
      </div>
    </div>
  );
};

export default SemanticSearch;