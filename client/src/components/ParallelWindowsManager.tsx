import React, { useState, useCallback, forwardRef, useImperativeHandle, ForwardRefRenderFunction } from 'react';
import ParallelConversationWindow from './ParallelConversationWindow';
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
  const { nodes } = useVisualization();
  
  // Function to create a new parallel window
  const spawnWindow = (
    initialMessages: Message[] = [],
    position?: { x: number; y: number }
  ) => {
    console.log(`spawnWindow called with ${initialMessages.length} messages`);
    
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
    
    console.log(`Created new window with ID: ${newWindow.id}`);
    
    // Add to windows list using functional update to avoid stale state issues
    setWindows(prevWindows => {
      const updatedWindows = [...prevWindows, newWindow];
      console.log(`Windows count: ${updatedWindows.length}`);
      return updatedWindows;
    });
    
    return newWindow.id;
  };
  
  // Function to close a window
  const closeWindow = (id: string) => {
    console.log(`Closing window: ${id}`);
    // Use functional update pattern to avoid stale state issues
    setWindows(prevWindows => {
      const updatedWindows = prevWindows.filter(window => window.id !== id);
      console.log(`Windows remaining after close: ${updatedWindows.length}`);
      return updatedWindows;
    });
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
    console.log(`memoizedSpawnWindow called with ${initialMessages.length} messages`);
    return spawnWindow(initialMessages, position);
  }, [windows]); // Include windows state as dependency
  
  // Function to create a second opinion window based on selected nodes and their context
  const createSecondOpinionWindow = useCallback((selectedNodeIds: string[]) => {
    console.log(`Creating second opinion window with selected nodes: [${selectedNodeIds.join(', ')}]`);
    
    // Get node objects for the selected IDs
    const selectedNodes = selectedNodeIds
      .map(id => nodes.find(node => node.id === id))
      .filter(Boolean) as BubbleNode[];
    
    if (selectedNodes.length === 0) {
      console.log('No valid nodes found for the selected IDs');
      return null;
    }
    
    console.log(`Found ${selectedNodes.length} nodes for analysis`);
    
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
    const userMessages = selectedNodes.filter(node => node.type === 'user_message');
    const aiMessages = selectedNodes.filter(node => node.type === 'ai_message');
    
    console.log(`Node breakdown:
      - Topics: ${topics.length}
      - Entities: ${entities.length}
      - Questions: ${questions.length}
      - Summaries: ${summaries.length}
      - User Messages: ${userMessages.length}
      - AI Messages: ${aiMessages.length}`
    );
    
    // Format each section
    let promptContent = '';
    
    // Add selected messages section if we have them (highest priority)
    if (userMessages.length > 0 || aiMessages.length > 0) {
      promptContent += '## Selected Messages\n\n';
      
      // Sort all selected messages by their position.y to maintain conversation flow
      const allSelectedMessages = [...userMessages, ...aiMessages]
        .sort((a, b) => a.position.y - b.position.y);
      
      allSelectedMessages.forEach(node => {
        const prefix = node.type === 'user_message' ? 'User: ' : 'Assistant: ';
        promptContent += `${prefix}${node.content}\n\n`;
      });
    }
    
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
    
    // Add relevant conversation context only if we don't have selected messages
    if (userMessages.length === 0 && aiMessages.length === 0) {
      // Find user and AI message nodes that are most relevant to the selected nodes
      const messageNodesOfInterest = messageNodes
        .filter(messageNode => {
          // Look for messages that have connections to the selected topics/entities
          const messageKeywords = messageNode.keywords || [];
          
          // Check if this message's keywords overlap with any selected node's content
          const hasRelatedKeywords = selectedNodes.some(selectedNode => {
            // For topic nodes, look for direct matches
            if (selectedNode.type === 'topic') {
              return messageKeywords.includes(selectedNode.content.toLowerCase());
            }
            
            // For entity nodes, look for content matches
            if (selectedNode.type === 'entity') {
              return messageNode.content.toLowerCase().includes(selectedNode.content.toLowerCase());
            }
            
            return false;
          });
          
          return hasRelatedKeywords;
        });
        
      // If we don't find any related messages, fall back to the most recent ones
      const finalMessageNodes = messageNodesOfInterest.length > 0 
        ? messageNodesOfInterest 
        : messageNodes.slice(-6); // Get the last 6 messages (3 exchanges)
      
      if (finalMessageNodes.length > 0) {
        promptContent += '## Relevant Conversation Context\n';
        // Sort messages by Y position to maintain conversation flow
        finalMessageNodes
          .sort((a, b) => a.position.y - b.position.y)
          .forEach(messageNode => {
            const prefix = messageNode.type === 'user_message' ? 'User: ' : 'Assistant: ';
            promptContent += `${prefix}${messageNode.content}\n\n`;
          });
      }
    }
    
    // Create a prompt for the second opinion
    const secondOpinionPrompt: Message = {
      role: 'user',
      content: `I've selected specific elements from our conversation and would like your perspective on them. Please analyze these concepts and their relationships, focusing especially on the selected topics, entities, and messages below.

${promptContent}

Consider the connections between these elements and provide a thoughtful, well-structured analysis. Feel free to highlight patterns or insights that might not be immediately obvious. I'm looking for a different perspective on these specific points.

Please try to address any questions I've selected, and connect your answer to the topics and entities mentioned.`
    };
    
    console.log('Second opinion prompt created:', secondOpinionPrompt.content.substring(0, 100) + '...');
    
    // Create a new window with this initial prompt
    const windowId = memoizedSpawnWindow(
      [secondOpinionPrompt],
      {
        x: window.innerWidth - 520,
        y: 80
      }
    );
    
    console.log(`New second opinion window created with ID: ${windowId}`);
    
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