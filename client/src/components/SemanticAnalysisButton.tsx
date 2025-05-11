import { useState } from 'react';
import { runSemanticAnalysis } from '../lib/services/SemanticService';
import { useVisualization } from '../lib/stores/useVisualization';

interface SemanticAnalysisButtonProps {
  className?: string;
}

export default function SemanticAnalysisButton({ className = '' }: SemanticAnalysisButtonProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const syncWithDatabase = useVisualization(state => state.syncWithDatabase);

  const handleAnalysis = async () => {
    try {
      setIsAnalyzing(true);
      setResult(null);
      
      const response = await runSemanticAnalysis({
        minSimilarity: 0.6,
        maxRelationsPerNode: 3,
        nodeTypes: ['topic', 'entity', 'summary']
      });
      
      setResult(`Found ${response.relationshipsFound} semantic relationships, created ${response.edgesCreated} edges.`);
      
      // Sync with database to get the new edges
      await syncWithDatabase();
    } catch (error) {
      console.error('Error running semantic analysis:', error);
      setResult('Error running semantic analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className={`semantic-analysis-button ${className}`}>
      <button 
        onClick={handleAnalysis}
        disabled={isAnalyzing}
        className="py-1 px-3 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isAnalyzing ? 'Analyzing...' : 'Find Semantic Relationships'}
      </button>
      
      {result && (
        <div className="mt-2 text-xs bg-gray-100 p-2 rounded-md">
          {result}
        </div>
      )}
    </div>
  );
}