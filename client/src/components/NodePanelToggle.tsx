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
    <div className="node-panel-toggle">
      <button 
        onClick={togglePanel}
        className={`node-panel-button ${isPanelVisible ? 'active' : ''} ${hasSelectedNodes ? 'has-nodes' : ''}`}
      >
        {isPanelVisible ? 'Hide Node Panel' : 'Show Node Panel'}
        {hasSelectedNodes && (
          <span className="node-count">{selectedNodes.length}</span>
        )}
      </button>
      
      {/* Expose the current visibility state via data attribute for other components */}
      <div data-panel-visible={isPanelVisible} style={{ display: 'none' }} />
    </div>
  );
}