import React, { useState } from 'react';
import { useVisualization } from '../lib/stores/useVisualization';

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
    <div className="fixed bottom-4 right-4 z-[100]">
      <button 
        onClick={togglePanel}
        className={`flex items-center gap-2 rounded-lg bg-background/70 backdrop-blur border border-accent/30 shadow-sm px-3 py-1.5 text-xs transition-all hover:bg-background/90 ${isPanelVisible ? 'active bg-accent/10' : ''} ${hasSelectedNodes ? 'border-accent/60' : ''}`}
      >
        <span className="text-accent">{isPanelVisible ? '✕' : '◎'}</span>
        <span>{isPanelVisible ? 'Hide Panel' : 'Show Panel'}</span>
        {hasSelectedNodes && (
          <span className="bg-accent/20 text-accent rounded-full w-5 h-5 flex items-center justify-center text-xs ml-1">{selectedNodes.length}</span>
        )}
      </button>
      
      {/* Expose the current visibility state via data attribute for other components */}
      <div data-panel-visible={isPanelVisible} style={{ display: 'none' }} />
    </div>
  );
}