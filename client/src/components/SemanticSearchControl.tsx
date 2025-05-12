/**
 * Component to display and manage semantic search functionality
 */
import React, { useState } from 'react';
import SemanticSearchTester from './SemanticSearchTester';
import { Search } from 'lucide-react';

interface SemanticSearchControlProps {
  className?: string;
}

export default function SemanticSearchControl({ className = '' }: SemanticSearchControlProps) {
  const [showTester, setShowTester] = useState(false);

  const toggleTester = () => {
    setShowTester(!showTester);
  };

  return (
    <div className={`semantic-search-control ${className}`}>
      <button 
        className="search-control-button"
        onClick={toggleTester}
        title="Semantic Search Tools"
      >
        <span className="search-icon"><Search size={16} /></span>
        <span>Semantic Search</span>
      </button>
      
      {showTester && (
        <SemanticSearchTester onClose={() => setShowTester(false)} />
      )}
    </div>
  );
}