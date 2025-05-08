import React, { useState, useCallback, forwardRef, useImperativeHandle, ForwardRefRenderFunction } from 'react';
import ParallelConversationWindow from './ParallelConversationWindow';
import { useAudio } from '../lib/stores/useAudio';
import { useVisualization } from '../lib/stores/useVisualization';
import { Message, BubbleNode } from '../types';

// Define the ref type for external access
export interface ParallelWindowsManagerRef {
  createSecondOpinionWindow: (selectedNodeIds: string[]) => string | null;
}

interface ParallelWindow {
  id: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  initialMessages?: Message[];
}

interface ParallelWindowManagerProps {
  onWindowCreate?: (windowId: string) => void;
}

const ParallelWindowsManagerComponent: ForwardRefRenderFunction<
  ParallelWindowsManagerRef, 
  ParallelWindowManagerProps
> = ({ onWindowCreate }, ref) => {
  const [windows, setWindows] = useState<ParallelWindow[]>([]);
  const { playHit } = useAudio();
  const { nodes } = useVisualization();
  
  // Function to create a new parallel window
  const spawnWindow = (
    initialMessages: Message[] = [],
    position?: { x: number; y: number }
  ) => {
    // Play sound effect
    playHit();
    
    // Calculate default position if not provided
    const defaultPosition = position || {
      x: 100 + (windows.length * 50),
      y: 100 + (windows.length * 30)
    };
    
    // Create a new window config
    const newWindow: ParallelWindow = {
      id: `win-${Date.now()}`,
      position: defaultPosition,
      size: { width: 400, height: 500 },
      initialMessages
    };
    
    // Add to windows list
    setWindows([...windows, newWindow]);
    
    return newWindow.id;
  };
  
  // Function to close a window
  const closeWindow = (id: string) => {
    setWindows(windows.filter(window => window.id !== id));
  };
  
  // Function to duplicate a conversation in a new window
  const duplicateConversation = (
    sourceId: string, 
    messages: Message[]
  ) => {
    // Find source window to position the new one nearby
    const sourceWindow = windows.find(w => w.id === sourceId);
    
    if (sourceWindow) {
      return spawnWindow(
        messages,
        { 
          x: sourceWindow.position.x + 60, 
          y: sourceWindow.position.y + 60 
        }
      );
    }
    
    return spawnWindow(messages);
  };
  
  // Memoize the spawnWindow function to use in the dependency array
  const memoizedSpawnWindow = useCallback((
    initialMessages: Message[] = [],
    position?: { x: number; y: number }
  ) => {
    return spawnWindow(initialMessages, position);
  }, [spawnWindow]);
  
  // Function to create a second opinion window based on selected nodes and their context
  const createSecondOpinionWindow = useCallback((selectedNodeIds: string[]) => {
    // Get node objects for the selected IDs
    const selectedNodes = selectedNodeIds
      .map(id => nodes.find(node => node.id === id))
      .filter(Boolean) as BubbleNode[];
    
    if (selectedNodes.length === 0) return null;
    
    // Collect the conversation nodes (user/ai messages) that are related to the selected nodes
    // First identify all message nodes
    const messageNodes = nodes.filter(node => 
      node.type === 'user_message' || node.type === 'ai_message'
    );
    
    // Group selected nodes by type for better organization
    const topics = selectedNodes.filter(node => node.type === 'topic');
    const entities = selectedNodes.filter(node => node.type === 'entity');
    const questions = selectedNodes.filter(node => node.type === 'question');
    const summaries = selectedNodes.filter(node => node.type === 'summary');
    
    // Format each section
    let promptContent = '';
    
    // Add topics section if we have topics
    if (topics.length > 0) {
      promptContent += '## Topics of Interest\n';
      promptContent += topics.map(node => `- ${node.content}`).join('\n');
      promptContent += '\n\n';
    }
    
    // Add entities section if we have entities
    if (entities.length > 0) {
      promptContent += '## Key Entities\n';
      promptContent += entities.map(node => {
        const entityType = node.metadata?.type ? ` (${node.metadata.type})` : '';
        return `- ${node.content}${entityType}`;
      }).join('\n');
      promptContent += '\n\n';
    }
    
    // Add questions if we have them
    if (questions.length > 0) {
      promptContent += '## Questions to Explore\n';
      promptContent += questions.map(node => `- ${node.content}`).join('\n');
      promptContent += '\n\n';
    }
    
    // Add summaries if we have them
    if (summaries.length > 0) {
      promptContent += '## Related Summaries\n';
      promptContent += summaries.map(node => `- ${node.content}`).join('\n');
      promptContent += '\n\n';
    }
    
    // Add selected message nodes for context
    // Find user and AI message nodes that are most relevant to the selected nodes
    // Use 3-4 message pairs to provide adequate context
    const messageNodesOfInterest = messageNodes
      .filter(messageNode => {
        // Check if this message is related to any selected node
        // For simplicity, we'll just take the most recent messages
        return true;
      })
      .slice(-6); // Get the last 6 messages (3 exchanges)
    
    if (messageNodesOfInterest.length > 0) {
      promptContent += '## Relevant Conversation Context\n';
      messageNodesOfInterest.forEach(messageNode => {
        const prefix = messageNode.type === 'user_message' ? 'User: ' : 'Assistant: ';
        promptContent += `${prefix}${messageNode.content}\n\n`;
      });
    }
    
    // Create a prompt for the second opinion
    const secondOpinionPrompt: Message = {
      role: 'user',
      content: `I'd like your perspective on the following points extracted from our conversation. Please analyze these concepts and their relationships, and provide your insights. Feel free to make connections between them or highlight patterns I might have missed.\n\n${promptContent}\nPlease provide a thoughtful, well-structured analysis.`
    };
    
    // Create a new window with this initial prompt
    const windowId = memoizedSpawnWindow(
      [secondOpinionPrompt],
      {
        x: window.innerWidth - 520,
        y: 80
      }
    );
    
    // Notify parent component about window creation
    if (onWindowCreate) {
      onWindowCreate(windowId);
    }
    
    return windowId;
  }, [nodes, memoizedSpawnWindow, onWindowCreate]);
  
  // Expose the createSecondOpinionWindow function for external components
  React.useImperativeHandle(
    ref,
    () => ({
      createSecondOpinionWindow
    }),
    [createSecondOpinionWindow]
  );
  
  return (
    <>
      {/* Spawn Button */}
      <button
        className="spawn-window-button"
        onClick={() => spawnWindow()}
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          zIndex: 3,
          backgroundColor: 'rgba(0, 40, 80, 0.8)',
          border: '1px solid #0ff',
          color: '#0ff',
          borderRadius: '4px',
          padding: '8px 15px',
          fontFamily: 'VT323, monospace',
          fontSize: '16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 0 15px rgba(0, 255, 255, 0.2)',
          backdropFilter: 'blur(3px)'
        }}
      >
        <span>+</span>
        New Conversation
      </button>
      
      {/* Render Windows */}
      {windows.map(window => (
        <ParallelConversationWindow
          key={window.id}
          windowId={window.id}
          position={window.position}
          size={window.size}
          initialMessages={window.initialMessages || []}
          onClose={() => closeWindow(window.id)}
        />
      ))}
    </>
  );
};

// Create the forwarded ref component
const ParallelWindowsManager = forwardRef(ParallelWindowsManagerComponent);

export default ParallelWindowsManager;