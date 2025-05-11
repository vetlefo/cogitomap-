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
      
      // Create a more detailed result message
      let resultMessage = `Found ${response.relationshipsFound} semantic relationships`;
      
      if (response.persistedToDatabase) {
        resultMessage += `, created ${response.edgesCreated} edges in the database.`;
      } else {
        resultMessage += ` (in-memory only, not persisted to database).`;
      }
      
      setResult(resultMessage);
      
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
        className="cognitive-scan-btn"
      >
        {isAnalyzing ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-blue-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="scan-text">Analyzing Neural Patterns</span>
          </span>
        ) : (
          <>
            <span className="scan-icon">⊗</span>
            <span className="scan-text">Analyze Cognitive Networks</span>
          </>
        )}
      </button>
      
      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-purple-500 text-white p-6 rounded-lg w-96 shadow-xl">
            <h3 className="text-xl font-semibold mb-4 text-purple-300">Confirm Semantic Analysis</h3>
            <p className="mb-4 text-gray-200">This will analyze the nodes to find semantic relationships between topics, entities, and summaries.</p>
            
            <div className="mb-6 mt-4 bg-gray-800 p-3 rounded border border-gray-700">
              <label className="flex items-center space-x-2 text-gray-200">
                <input 
                  type="checkbox" 
                  checked={parameters.persistToDatabase} 
                  onChange={handlePersistChange}
                  className="form-checkbox h-5 w-5 text-purple-600 rounded focus:ring-purple-500"
                />
                <span>Persist to database (not just in-memory)</span>
              </label>
            </div>
            
            <div className="flex justify-between space-x-4">
              <button 
                onClick={cancelAnalysis}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors shadow-md"
              >
                Cancel
              </button>
              <button 
                onClick={handleAnalysis}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded transition-colors shadow-md"
              >
                Run Analysis
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* HUD-style Analysis Results Panel */}
      {result && (
        <div className="hud-panel">
          <div className="hud-content">
            <div className="hud-header">
              <span className="hud-status-indicator"></span>
              <span className="hud-title">SEMANTIC ANALYSIS</span>
              <span className="hud-timestamp">{new Date().toLocaleTimeString()}</span>
            </div>
            <div className="hud-body">
              {result}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}