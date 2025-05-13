import React, { useState } from 'react';
import { useVisualization } from '../lib/stores/useVisualization';
import { Eye, EyeOff, X } from 'lucide-react';

interface NodePanelToggleProps {
  initialState?: boolean;
}

/**
 * A persistent toggle button for the node selection panel
 */
export default function NodePanelToggle({ initialState = false }: NodePanelToggleProps) {
  const [isPanelVisible, setIsPanelVisible] = useState(initialState);
  const { selectedNodes, clearSelectedNodes } = useVisualization();
  
  const hasSelectedNodes = selectedNodes.length > 0;
  
  const togglePanel = () => {
    setIsPanelVisible(!isPanelVisible);
    
    // If panel is being hidden and there are selected nodes, offer to clear them
    if (isPanelVisible && hasSelectedNodes) {
      const shouldClear = window.confirm("Would you like to clear your selected nodes as well?");
      if (shouldClear) {
        clearSelectedNodes();
      }
    }
  };
  
  return (
    <div className="fixed top-4 right-4 z-[50]">
      <button 
        onClick={togglePanel}
        className={`flex items-center justify-center rounded-full w-8 h-8 bg-background/30 backdrop-blur border shadow-neon transition-all hover:bg-background/50 
          ${isPanelVisible ? 'border-cyan-400/70 shadow-cyan-400/20' : 'border-gray-500/30 shadow-none'} 
          ${hasSelectedNodes ? 'ring-1 ring-cyan-400/50' : ''}`}
        title={isPanelVisible ? 'Hide Node Panel' : 'Show Node Panel'}
      >
        {isPanelVisible ? 
          <X className="w-4 h-4 text-cyan-400" /> : 
          <Eye className="w-4 h-4 text-gray-300" />
        }
      </button>
      
      {/* Badge for selected node count */}
      {hasSelectedNodes && (
        <div className="absolute -top-2 -right-2 bg-cyan-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
          {selectedNodes.length}
        </div>
      )}
      
      {/* Expose the current visibility state via data attribute for other components */}
      <div data-panel-visible={isPanelVisible} style={{ display: 'none' }} />
    </div>
  );
}