import React, { useState } from 'react';
import SemanticSearchBar from './SemanticSearchBar';
import SemanticSearchResults from './SemanticSearchResults';

interface SemanticSearchProps {
  onSelectResult?: (result: any) => void;
  className?: string;
}

/**
 * Combined component that provides a semantic search interface
 * with search bar and results display
 */
const SemanticSearch: React.FC<SemanticSearchProps> = ({
  onSelectResult,
  className = ""
}) => {
  const [searchResults, setSearchResults] = useState<any>(null);

  const handleSearchResults = (results: any) => {
    setSearchResults(results);
  };

  const handleSelectResult = (result: any) => {
    if (onSelectResult) {
      onSelectResult(result);
    }
  };

  return (
    <div className={`semantic-search-container ${className}`}>
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Semantic Knowledge Search</h2>
        <p className="text-sm text-gray-500">
          Search your conversation history using natural language and vector similarity.
        </p>
      </div>
      
      <SemanticSearchBar 
        onSearchResults={handleSearchResults}
        placeholder="Search by meaning, topic, or context..."
      />
      
      <SemanticSearchResults 
        data={searchResults}
        onSelectResult={handleSelectResult}
      />
    </div>
  );
};

export default SemanticSearch;