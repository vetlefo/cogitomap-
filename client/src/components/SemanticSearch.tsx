import React, { useState } from 'react';
import type { BubbleNode } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Card, CardContent } from './ui/card';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { SearchIcon, SettingsIcon } from 'lucide-react';

interface SemanticSearchProps {
  onSelectResult?: (node: BubbleNode) => void;
}

const SemanticSearch: React.FC<SemanticSearchProps> = ({ onSelectResult }) => {
  // Search parameters
  const [query, setQuery] = useState<string>('');
  const [minSimilarity, setMinSimilarity] = useState<number>(0.65);
  const [maxResults, setMaxResults] = useState<number>(10);
  const [includeRelated, setIncludeRelated] = useState<boolean>(true);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [vectorSearch, setVectorSearch] = useState<boolean>(true);
  const [textSearch, setTextSearch] = useState<boolean>(true);
  
  // Results state
  const [results, setResults] = useState<BubbleNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Handle search
  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/semantic/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          minSimilarity,
          limit: maxResults,
          includeRelated,
          maxHops: includeRelated ? 2 : 0,
          vectorSearch,
          textSearch
        })
      });
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle selecting a search result
  const handleSelectResult = (node: BubbleNode) => {
    if (onSelectResult) {
      onSelectResult(node);
    }
  };
  
  return (
    <div className="semantic-search-container">
      <div className="search-form space-y-4">
        <div className="flex space-x-2">
          <Input
            placeholder="Search knowledge graph..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-grow"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button 
            onClick={handleSearch} 
            disabled={isLoading || !query.trim()}
            className="whitespace-nowrap"
          >
            {isLoading ? 'Searching...' : <><SearchIcon className="h-4 w-4 mr-1" /> Search</>}
          </Button>
        </div>
        
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs flex items-center"
          >
            <SettingsIcon className="h-3 w-3 mr-1" />
            {showAdvanced ? 'Hide Options' : 'Show Options'}
          </Button>
          
          <div className="flex space-x-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="vector-search"
                checked={vectorSearch}
                onCheckedChange={setVectorSearch}
              />
              <Label htmlFor="vector-search" className="text-xs">Vector</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="text-search"
                checked={textSearch}
                onCheckedChange={setTextSearch}
              />
              <Label htmlFor="text-search" className="text-xs">Text</Label>
            </div>
          </div>
        </div>
        
        {showAdvanced && (
          <div className="advanced-options space-y-3 border rounded-md p-3 bg-gray-50 dark:bg-gray-900">
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label htmlFor="similarity-slider" className="text-xs">
                  Minimum Similarity: {minSimilarity.toFixed(2)}
                </Label>
              </div>
              <Slider
                id="similarity-slider"
                min={0.1}
                max={0.9}
                step={0.05}
                value={[minSimilarity]}
                onValueChange={(value) => setMinSimilarity(value[0])}
              />
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label htmlFor="results-slider" className="text-xs">
                  Max Results: {maxResults}
                </Label>
              </div>
              <Slider
                id="results-slider"
                min={1}
                max={50}
                step={1}
                value={[maxResults]}
                onValueChange={(value) => setMaxResults(value[0])}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="include-related"
                checked={includeRelated}
                onCheckedChange={setIncludeRelated}
              />
              <Label htmlFor="include-related" className="text-xs">Include Related Nodes</Label>
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <div className="mt-4 p-2 bg-red-100 border border-red-300 rounded text-red-900 text-sm">
          {error}
        </div>
      )}
      
      <div className="results-container mt-4 space-y-2 max-h-[60vh] overflow-y-auto">
        {results.length === 0 && !isLoading && query && (
          <div className="text-center py-8 text-gray-500">
            No results found. Try a different search query or adjust your search parameters.
          </div>
        )}
        
        {results.map(node => (
          <Card 
            key={node.id} 
            className="result-item cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
            onClick={() => handleSelectResult(node)}
          >
            <CardContent className="p-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Badge variant={node.isDirectMatch ? "default" : "outline"}>
                      {node.type}
                    </Badge>
                    {node.similarity !== undefined && (
                      <span className="text-xs text-gray-500">
                        {Math.round(node.similarity * 100)}% match
                      </span>
                    )}
                    {!node.isDirectMatch && (
                      <Badge variant="outline" className="bg-cyan-50 text-cyan-800 border-cyan-200">
                        related
                      </Badge>
                    )}
                  </div>
                  <h4 className="text-sm font-medium line-clamp-1">{node.title || node.content}</h4>
                </div>
              </div>
              <Separator className="my-2" />
              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                {node.content}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SemanticSearch;