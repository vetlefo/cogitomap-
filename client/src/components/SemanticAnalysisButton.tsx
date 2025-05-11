import { useState } from 'react';
import { runSemanticAnalysis } from '../lib/services/SemanticService';
import { useVisualization } from '../lib/stores/useVisualization';

interface SemanticAnalysisButtonProps {
  className?: string;
}

export default function SemanticAnalysisButton({ className = '' }: SemanticAnalysisButtonProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [parameters, setParameters] = useState({
    minSimilarity: 0.6,
    maxRelationsPerNode: 3,
    nodeTypes: ['topic', 'entity', 'summary'],
    persistToDatabase: false
  });
  const syncWithDatabase = useVisualization(state => state.syncWithDatabase);

  const startAnalysis = () => {
    setShowConfirmDialog(true);
  };

  const cancelAnalysis = () => {
    setShowConfirmDialog(false);
  };

  const handleAnalysis = async () => {
    try {
      setIsAnalyzing(true);
      setShowConfirmDialog(false);
      setResult(null);
      
      const response = await runSemanticAnalysis({
        minSimilarity: parameters.minSimilarity,
        maxRelationsPerNode: parameters.maxRelationsPerNode,
        nodeTypes: parameters.nodeTypes,
        persistToDatabase: parameters.persistToDatabase
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

  const handlePersistChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParameters({
      ...parameters,
      persistToDatabase: e.target.checked
    });
  };

  return (
    <div className={`semantic-analysis-button ${className}`}>
      <button 
        onClick={startAnalysis}
        disabled={isAnalyzing}
        className="py-1 px-3 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white text-sm rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[200px]"
      >
        {isAnalyzing ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Analyzing...
          </span>
        ) : 'Find Semantic Relationships'}
      </button>
      
      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-navy-900 border border-blue-500 text-white p-6 rounded-lg w-96 shadow-lg">
            <h3 className="text-xl font-semibold mb-4 text-blue-300">Confirm Semantic Analysis</h3>
            <p className="mb-4">This will analyze the nodes to find semantic relationships between topics, entities, and summaries.</p>
            
            <div className="mb-4">
              <label className="flex items-center space-x-2 text-blue-200">
                <input 
                  type="checkbox" 
                  checked={parameters.persistToDatabase} 
                  onChange={handlePersistChange}
                  className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span>Persist to database (not just in-memory)</span>
              </label>
            </div>
            
            <div className="flex justify-between space-x-2">
              <button 
                onClick={cancelAnalysis}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleAnalysis}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Run Analysis
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Results Panel */}
      {result && (
        <div className="mt-2 text-sm bg-navy-800 text-blue-200 p-3 rounded-md border border-blue-500 shadow-md">
          {result}
        </div>
      )}
    </div>
  );
}