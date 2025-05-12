import React, { useState } from 'react';
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
        <input
          className="flex-grow px-3 py-2 rounded bg-black/50 text-cyan-300 border border-cyan-500/30 focus:border-cyan-400 focus:outline-none"
          placeholder={placeholder}
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSearch()}
        />
        <button
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
          className="w-24 px-3 py-2 bg-cyan-900/70 text-cyan-300 rounded border border-cyan-500/50 hover:bg-cyan-800/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSearching ? "Searching..." : "Search"}
        </button>
      </div>
      
      <div className="flex flex-wrap gap-2 text-sm text-cyan-300">
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={searchOptions.useEmbedding}
            onChange={() => handleToggleOption('useEmbedding')}
            className="accent-cyan-500"
          />
          <span>Vector Search</span>
        </label>
        
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={searchOptions.includeRelated}
            onChange={() => handleToggleOption('includeRelated')}
            className="accent-cyan-500"
          />
          <span>Include Related</span>
        </label>
      </div>
    </div>
  );
};

export default SemanticSearchBar;