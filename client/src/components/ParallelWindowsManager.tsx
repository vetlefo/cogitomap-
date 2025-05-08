import React, { useState } from 'react';
import ParallelConversationWindow from './ParallelConversationWindow';
import { useAudio } from '../lib/stores/useAudio';
import { Message } from '../types';

interface ParallelWindow {
  id: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  initialMessages?: Message[];
}

export default function ParallelWindowsManager() {
  const [windows, setWindows] = useState<ParallelWindow[]>([]);
  const { playHit } = useAudio();
  
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
}