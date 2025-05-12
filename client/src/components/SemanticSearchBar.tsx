import React, { useState } from 'react';
import { Button, Input } from './ui/common';
import { toast } from 'sonner';

interface SemanticSearchBarProps {
  onSearchResults?: (results: any) => void;
  placeholder?: string;
  className?: string;
}

/**
 * SemanticSearchBar component provides a search interface for semantic vector search
 * It communicates with the server's semantic search endpoint
 */
const SemanticSearchBar: React.FC<SemanticSearchBarProps> = ({
  onSearchResults,
  placeholder = "Search knowledge graph by meaning...",
  className = ""
}) => {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchOptions, setSearchOptions] = useState({
    useEmbedding: true,
    includeRelated: true,
    nodeTypes: [] // empty means all types
  });

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    
    try {
      const response = await fetch('/api/semantic/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          nodeTypes: searchOptions.nodeTypes.length > 0 ? searchOptions.nodeTypes : undefined,
          useEmbedding: searchOptions.useEmbedding,
          includeRelated: searchOptions.includeRelated
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (onSearchResults) {
        onSearchResults(data);
      }
      
      toast.success(`Found ${data.results.length} matching items`);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleToggleOption = (option: keyof typeof searchOptions) => {
    if (typeof searchOptions[option] === 'boolean') {
      setSearchOptions(prev => ({
        ...prev,
        [option]: !prev[option]
      }));
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex gap-2">
        <Input
          className="flex-grow"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
          className="w-24"
        >
          {isSearching ? "Searching..." : "Search"}
        </Button>
      </div>
      
      <div className="flex flex-wrap gap-2 text-sm">
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={searchOptions.useEmbedding}
            onChange={() => handleToggleOption('useEmbedding')}
          />
          <span>Vector Search</span>
        </label>
        
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={searchOptions.includeRelated}
            onChange={() => handleToggleOption('includeRelated')}
          />
          <span>Include Related</span>
        </label>
      </div>
    </div>
  );
};

export default SemanticSearchBar;