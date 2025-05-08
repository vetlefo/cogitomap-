import React, { useState } from 'react';
import { useVisualization } from '../lib/stores/useVisualization';
import { BubbleNode } from '../types';

interface SelectedNodesPanelProps {
  onRequestSecondOpinion: (selectedNodeIds: string[]) => void;
}

export default function SelectedNodesPanel({ onRequestSecondOpinion }: SelectedNodesPanelProps) {
  const { selectedNodes, nodes, clearSelectedNodes } = useVisualization();
  const [showPanel, setShowPanel] = useState(false);
  
  // Get the actual node objects for the selected node IDs
  const selectedNodeObjects = selectedNodes
    .map(id => nodes.find(node => node.id === id))
    .filter(node => node !== undefined) as BubbleNode[];
  
  // Only show panel when nodes are selected
  const hasSelectedNodes = selectedNodeObjects.length > 0;
  
  const handleRequestSecondOpinion = () => {
    if (selectedNodeObjects.length > 0) {
      onRequestSecondOpinion(selectedNodes);
      clearSelectedNodes();
    }
  };
  
  // If no nodes are selected, don't render the panel
  if (!hasSelectedNodes) {
    return null;
  }
  
  return (
    <div 
      className="selected-nodes-panel"
      style={{
        position: 'fixed',
        bottom: showPanel ? '20px' : '-250px',
        left: '20px',
        width: '300px', 
        backgroundColor: 'rgba(0, 15, 30, 0.85)',
        backdropFilter: 'blur(5px)',
        borderRadius: '8px',
        boxShadow: '0 0 20px rgba(0, 100, 255, 0.3)',
        border: '1px solid rgba(0, 100, 255, 0.5)',
        padding: '12px',
        transition: 'bottom 0.3s ease-in-out',
        zIndex: 10,
        color: '#fff',
        maxHeight: '300px',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Panel Header with toggle */}
      <div 
        className="panel-header"
        onClick={() => setShowPanel(!showPanel)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
          cursor: 'pointer',
          position: showPanel ? 'relative' : 'absolute',
          width: showPanel ? '100%' : '300px',
          top: showPanel ? 'auto' : '-50px',
          left: showPanel ? 'auto' : '0',
          backgroundColor: showPanel ? 'transparent' : 'rgba(0, 15, 30, 0.85)',
          padding: showPanel ? '0' : '10px',
          borderRadius: showPanel ? '0' : '8px 8px 0 0',
          pointerEvents: 'all'
        }}
      >
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>
          Selected Nodes ({selectedNodeObjects.length})
        </h3>
        <span style={{ fontSize: '18px' }}>
          {showPanel ? '▼' : '▲'}
        </span>
      </div>
      
      {/* Selected nodes list */}
      {showPanel && (
        <>
          <div 
            className="nodes-list"
            style={{
              overflowY: 'auto',
              maxHeight: '200px',
              marginBottom: '10px',
              padding: '5px',
              borderRadius: '4px',
              backgroundColor: 'rgba(0, 30, 60, 0.5)',
            }}
          >
            {selectedNodeObjects.map(node => (
              <div 
                key={node.id}
                className="selected-node-item"
                style={{
                  padding: '6px 8px',
                  borderRadius: '4px',
                  marginBottom: '4px',
                  backgroundColor: 'rgba(0, 50, 100, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px'
                }}
              >
                {/* Color dot for node type */}
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: getNodeColor(node.type),
                    flexShrink: 0
                  }}
                />
                
                {/* Node type label */}
                <span style={{ 
                  fontWeight: 'bold',
                  color: 'rgba(200, 220, 255, 0.8)',
                  flexShrink: 0
                }}>
                  {getNodeTypeLabel(node.type)}:
                </span>
                
                {/* Truncated content */}
                <span style={{ 
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {node.content.length > 30 
                    ? `${node.content.substring(0, 30)}...` 
                    : node.content}
                </span>
              </div>
            ))}
          </div>
          
          {/* Action buttons */}
          <div 
            className="panel-actions"
            style={{
              display: 'flex',
              gap: '8px'
            }}
          >
            <button
              onClick={clearSelectedNodes}
              style={{
                flex: 1,
                padding: '6px 10px',
                backgroundColor: 'rgba(100, 100, 100, 0.3)',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Clear Selection
            </button>
            
            <button
              onClick={handleRequestSecondOpinion}
              style={{
                flex: 2,
                padding: '6px 10px',
                backgroundColor: 'rgba(100, 0, 150, 0.6)',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              Get Second Opinion
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Helper function to get a color for node type
function getNodeColor(type: string): string {
  switch (type) {
    case 'user_message': return '#0088ff'; // Blue
    case 'ai_message': return '#00ff99'; // Green
    case 'topic': return '#aa44cc'; // Purple
    case 'entity': return '#ff8800'; // Orange
    case 'summary': return '#ffcc00'; // Yellow
    case 'question': return '#ff4444'; // Red
    default: return '#aaaaaa'; // Gray
  }
}

// Helper function to get a label for node type
function getNodeTypeLabel(type: string): string {
  switch (type) {
    case 'user_message': return 'User';
    case 'ai_message': return 'AI';
    case 'topic': return 'Topic';
    case 'entity': return 'Entity';
    case 'summary': return 'Summary';
    case 'question': return 'Question';
    default: return type;
  }
}