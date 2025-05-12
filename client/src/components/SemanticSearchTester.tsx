import React, { useState, useEffect } from 'react';
import type { BubbleNode } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { CheckIcon, SearchIcon, SettingsIcon, RefreshCwIcon } from 'lucide-react';

// Define test search scenarios
interface SearchScenario {
  name: string;
  query: string;
  nodeTypes?: string[];
  minSimilarity?: number;
  includeRelated?: boolean;
  maxHops?: number;
  maxResults?: number;
}

interface SemanticSearchTesterProps {
  onClose?: () => void;
}

// Pre-defined test scenarios
const TEST_SCENARIOS: SearchScenario[] = [
  {
    name: 'Topic Analysis',
    query: 'What are the main topics discussed in this conversation?',
    nodeTypes: ['topic'],
    minSimilarity: 0.6,
    includeRelated: true,
    maxHops: 2,
    maxResults: 15
  },
  {
    name: 'Country Search',
    query: 'Find information about countries mentioned',
    nodeTypes: ['entity'],
    minSimilarity: 0.7,
    includeRelated: true,
    maxHops: 1,
    maxResults: 10
  },
  {
    name: 'Concept Relationships',
    query: 'How are different concepts connected in this discussion?',
    nodeTypes: ['topic', 'entity'],
    minSimilarity: 0.65,
    includeRelated: true, 
    maxHops: 2,
    maxResults: 20
  }
];

const SemanticSearchTester: React.FC<SemanticSearchTesterProps> = ({ onClose }) => {
  // Search parameters
  const [query, setQuery] = useState<string>('');
  const [minSimilarity, setMinSimilarity] = useState<number>(0.65);
  const [maxResults, setMaxResults] = useState<number>(10);
  const [includeRelated, setIncludeRelated] = useState<boolean>(true);
  const [maxHops, setMaxHops] = useState<number>(2);
  const [nodeTypes, setNodeTypes] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>('custom');
  const [activeScenario, setActiveScenario] = useState<SearchScenario | null>(null);
  
  // Results state
  const [results, setResults] = useState<BubbleNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSearchTime, setLastSearchTime] = useState<number | null>(null);
  
  // Update embeddings state
  const [isUpdatingEmbeddings, setIsUpdatingEmbeddings] = useState<boolean>(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  
  // Apply a test scenario
  const applyScenario = (scenario: SearchScenario) => {
    setQuery(scenario.query);
    setNodeTypes(scenario.nodeTypes || []);
    setMinSimilarity(scenario.minSimilarity || 0.65);
    setIncludeRelated(scenario.includeRelated !== undefined ? scenario.includeRelated : true);
    setMaxHops(scenario.maxHops || 2);
    setMaxResults(scenario.maxResults || 10);
    setActiveScenario(scenario);
  };
  
  // Effect to handle scenario selection
  useEffect(() => {
    if (selectedTab !== 'custom' && TEST_SCENARIOS.length > 0) {
      const scenarioIndex = parseInt(selectedTab.replace('scenario-', ''), 10);
      if (!isNaN(scenarioIndex) && scenarioIndex >= 0 && scenarioIndex < TEST_SCENARIOS.length) {
        applyScenario(TEST_SCENARIOS[scenarioIndex]);
      }
    } else {
      setActiveScenario(null);
    }
  }, [selectedTab]);
  
  // Perform the actual search
  const performSearch = async () => {
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResults([]);
    
    const startTime = performance.now();
    
    try {
      const response = await fetch('/api/semantic/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          nodeTypes: nodeTypes.length > 0 ? nodeTypes : undefined,
          limit: maxResults,
          minSimilarity,
          expandGraphSearch: includeRelated,
          maxHops,
          vectorSearch: true,
          textSearch: true, // Enable text search as fallback
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to perform search');
      }
      
      const data = await response.json();
      setResults(data.results || []);
      setLastSearchTime(performance.now() - startTime);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update embeddings for existing nodes
  const updateEmbeddings = async () => {
    if (isUpdatingEmbeddings) return;
    
    setIsUpdatingEmbeddings(true);
    setUpdateStatus('Starting update...');
    
    try {
      const response = await fetch('/api/semantic/update-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeTypes: [], // Empty array means update all node types
          force: true, // Force update even for nodes that already have embeddings
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update embeddings');
      }
      
      const data = await response.json();
      setUpdateStatus(`Updated ${data.updatedCount} nodes successfully`);
      
      // Automatically refresh search after update
      if (query.trim()) {
        await performSearch();
      }
    } catch (err) {
      setUpdateStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('Update embeddings error:', err);
    } finally {
      setIsUpdatingEmbeddings(false);
    }
  };
  
  // Node type options for the select component
  const nodeTypeOptions = [
    { value: 'user_message', label: 'User Messages' },
    { value: 'ai_message', label: 'AI Messages' },
    { value: 'topic', label: 'Topics' },
    { value: 'entity', label: 'Entities' },
    { value: 'concept', label: 'Concepts' },
  ];
  
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SearchIcon className="h-5 w-5" />
            <span>Semantic Search Tester</span>
          </CardTitle>
          <CardDescription>
            Test and debug semantic search functionality with predefined scenarios or custom queries
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs 
            value={selectedTab} 
            onValueChange={setSelectedTab}
            className="mb-4"
          >
            <TabsList className="mb-2">
              <TabsTrigger value="custom">Custom Search</TabsTrigger>
              {TEST_SCENARIOS.map((scenario, index) => (
                <TabsTrigger key={index} value={`scenario-${index}`}>
                  {scenario.name}
                </TabsTrigger>
              ))}
            </TabsList>
            
            <TabsContent value="custom">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Configure a custom search query with your own parameters
                </p>
              </div>
            </TabsContent>
            
            {TEST_SCENARIOS.map((scenario, index) => (
              <TabsContent key={index} value={`scenario-${index}`}>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {scenario.query}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {scenario.nodeTypes?.map(type => (
                      <Badge key={type} variant="outline">{type}</Badge>
                    ))}
                    <Badge variant="outline">similarity: {scenario.minSimilarity}</Badge>
                    <Badge variant="outline">
                      {scenario.includeRelated ? 'includes related' : 'direct matches only'}
                    </Badge>
                    {scenario.includeRelated && (
                      <Badge variant="outline">hops: {scenario.maxHops}</Badge>
                    )}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="query">Search Query</Label>
              <div className="flex space-x-2">
                <Input
                  id="query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter your search query..."
                  className="flex-1"
                />
                <Button 
                  onClick={performSearch}
                  disabled={isLoading || !query.trim()}
                >
                  {isLoading ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Node Types</Label>
                <Select
                  value="multiple"
                  onValueChange={(value) => {
                    if (value !== 'multiple') {
                      setNodeTypes([value]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      nodeTypes.length === 0 
                        ? 'All node types' 
                        : `${nodeTypes.length} types selected`
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {nodeTypeOptions.map(option => (
                      <SelectItem 
                        key={option.value} 
                        value={option.value}
                        onClick={() => {
                          if (nodeTypes.includes(option.value)) {
                            setNodeTypes(nodeTypes.filter(t => t !== option.value));
                          } else {
                            setNodeTypes([...nodeTypes, option.value]);
                          }
                        }}
                      >
                        <div className="flex items-center">
                          {nodeTypes.includes(option.value) && (
                            <CheckIcon className="h-4 w-4 mr-2" />
                          )}
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                    <Separator className="my-1" />
                    <SelectItem 
                      value="clear"
                      onClick={() => setNodeTypes([])}
                    >
                      Clear selection (all types)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Minimum Similarity ({(minSimilarity * 100).toFixed(0)}%)</Label>
                <Slider
                  min={0}
                  max={1}
                  step={0.05}
                  value={[minSimilarity]}
                  onValueChange={(values) => setMinSimilarity(values[0])}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Max Results</Label>
                <Slider
                  min={5}
                  max={50}
                  step={5}
                  value={[maxResults]}
                  onValueChange={(values) => setMaxResults(values[0])}
                />
                <span className="text-xs text-muted-foreground">{maxResults} results</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="includeRelated">Include Related Nodes</Label>
                  <Switch
                    id="includeRelated"
                    checked={includeRelated}
                    onCheckedChange={setIncludeRelated}
                  />
                </div>
                {includeRelated && (
                  <div className="pt-2">
                    <Label>Max Hops: {maxHops}</Label>
                    <Slider
                      min={1}
                      max={3}
                      step={1}
                      value={[maxHops]}
                      onValueChange={(values) => setMaxHops(values[0])}
                      disabled={!includeRelated}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between border-t p-4">
          <div className="flex-1">
            {error && (
              <p className="text-red-500 text-sm mb-2">{error}</p>
            )}
            {lastSearchTime !== null && !error && (
              <p className="text-sm text-muted-foreground">
                Search completed in {(lastSearchTime / 1000).toFixed(2)}s with {results.length} results
              </p>
            )}
          </div>
          <Button
            variant="outline"
            onClick={updateEmbeddings}
            disabled={isUpdatingEmbeddings}
            className="flex items-center gap-2"
          >
            <RefreshCwIcon className="h-4 w-4" />
            {isUpdatingEmbeddings ? 'Updating...' : 'Update Embeddings'}
          </Button>
        </CardFooter>
      </Card>
      
      {/* Results display */}
      {results.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Search Results ({results.length})</CardTitle>
            <CardDescription>
              Displaying semantic search results sorted by relevance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((node, index) => (
                <Card key={node.id} className={`overflow-hidden ${
                  // Highlight direct matches (nodes with high similarity)
                  (node.similarity && node.similarity > 0.8) 
                    ? 'border-green-500 bg-green-50 dark:bg-green-950/20' 
                    : ''
                }`}>
                  <CardHeader className="py-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {node.type === 'topic' && '📌 '}
                          {node.type === 'entity' && '🔷 '}
                          {node.type === 'user_message' && '👤 '}
                          {node.type === 'ai_message' && '🤖 '}
                          <span>
                            {node.title || node.content?.substring(0, 50) || 'Untitled'} 
                            {(node.title || node.content?.length > 50) && '...'}
                          </span>
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {node.type}
                          </Badge>
                          {node.isDirectMatch && (
                            <Badge variant="default" className="bg-green-600 text-xs">
                              Direct Match
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {node.similarity ? `${(node.similarity * 100).toFixed(1)}% match` : 'No score'}
                          </Badge>
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="ml-2">
                        #{index + 1}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="py-2">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {node.content || node.description || 'No content available'}
                    </p>
                    {node.keywords && node.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {node.keywords.map((keyword: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        !isLoading && query && !error && (
          <Card className="bg-muted">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <SearchIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-center text-muted-foreground">
                No search results found. Try adjusting your search parameters or updating the embeddings.
              </p>
            </CardContent>
          </Card>
        )
      )}
      
      {/* Update Embeddings Status */}
      {updateStatus && (
        <div className={`mt-4 p-3 rounded-md text-sm ${
          updateStatus.startsWith('Error') 
            ? 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400' 
            : 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400'
        }`}>
          {updateStatus}
        </div>
      )}
    </div>
  );
};

export default SemanticSearchTester;