import React from 'react';
import { motion } from 'framer-motion';
import { User, Bot, Pin, BarChart2, FileText, HelpCircle, Search } from 'lucide-react';

interface SearchResult {
  id: string;
  type: string;
  content: string;
  similarity: number;
  isDirectMatch?: boolean;
}

interface SearchResultsData {
  query: string;
  results: SearchResult[];
  searchType: 'vector' | 'keyword';
  timestamp: string;
}

interface SemanticSearchResultsProps {
  data: SearchResultsData | null;
  onSelectResult?: (result: SearchResult) => void;
  className?: string;
}

/**
 * SemanticSearchResults component displays search results in a formatted list
 * with highlighting and animation
 */
const SemanticSearchResults: React.FC<SemanticSearchResultsProps> = ({
  data,
  onSelectResult,
  className = ""
}) => {
  if (!data || !data.results || data.results.length === 0) {
    return (
      <div className={`mt-4 text-center text-gray-500 ${className}`}>
        {data ? 'No results found.' : 'Search for something to see results.'}
      </div>
    );
  }

  // Get result type emoji
  const getTypeEmoji = (type: string): string => {
    switch (type) {
      case 'user_message': return '👤';
      case 'ai_message': return '🤖';
      case 'topic': return '📌';
      case 'entity': return '📊';
      case 'summary': return '📝';
      case 'question': return '❓';
      default: return '🔍';
    }
  };

  // Format similarity percentage
  const formatSimilarity = (similarity: number): string => {
    return (similarity * 100).toFixed(1) + '%';
  };

  return (
    <div className={`mt-4 ${className}`}>
      <div className="mb-2 text-sm">
        <span className="font-medium">"{data.query}"</span> -
        <span className="text-gray-500 ml-1">
          {data.results.length} results via {data.searchType} search
        </span>
      </div>

      <div className="space-y-2">
        {data.results.map((result, index) => (
          <motion.div
            key={result.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className={`p-3 rounded-lg cursor-pointer transition-colors
              ${result.isDirectMatch 
                ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30' 
                : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800/70'}`}
            onClick={() => onSelectResult && onSelectResult(result)}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <span className="text-xl" role="img" aria-label={result.type}>
                  {getTypeEmoji(result.type)}
                </span>
                <span className="font-medium text-sm capitalize">
                  {result.type.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
                  {formatSimilarity(result.similarity)}
                </span>
                {result.isDirectMatch && (
                  <span className="text-xs bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full">
                    Direct Match
                  </span>
                )}
              </div>
            </div>
            
            <div className="mt-2 text-sm line-clamp-3">
              {result.content}
            </div>
            
            <div className="mt-1 text-xs text-gray-500">
              ID: {result.id}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default SemanticSearchResults;