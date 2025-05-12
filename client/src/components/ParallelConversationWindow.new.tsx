import React, { useState, useEffect, useRef } from 'react';
import { sendMessage as sendLLMMessage, useLLM } from '../lib/stores/useOpenAI';
import ApiKeyModal from './ApiKeyModal';
import ModelSelector from './ModelSelector';
import { analyzeMessage } from '../lib/ContextAnalyzer';
import { BubbleNode, Message, StructuredLLMOutput } from '../types';
import { useVisualization } from '../lib/stores/useVisualization';
import { Key } from 'lucide-react';

interface ParallelConversationWindowProps {
  windowId: string;
  onClose: () => void;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  initialMessages?: Message[];
}

export default function ParallelConversationWindow({
  windowId,
  onClose,
  position = { x: 100, y: 100 },
  size = { width: 400, height: 400 },
  initialMessages = []
}: ParallelConversationWindowProps) {
  // ---------- State Management ----------
  // Messages and input
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Window positioning and dragging
  const [isDragging, setIsDragging] = useState(false);
  const [windowPosition, setWindowPosition] = useState(position);
  const [windowSize, setWindowSize] = useState(size);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragStartWindowPos = useRef({ x: 0, y: 0 });
  
  // Animation
  const [isNew, setIsNew] = useState(true);
  
  // ---------- Hooks ----------
  // LLM integration
  const {
    selectedProvider,
    selectedModel,
    apiKeys,
    isLoading,
    error
  } = useLLM();
  
  // Visualization integration
  const { addNode, addEdge, nodes: windowNodes } = useVisualization();
  
  // Audio functionality removed
  
  // Check if an API key is needed
  const needsApiKey = !apiKeys[selectedProvider];
  
  // ---------- Effects ----------
  // Fade in animation
  useEffect(() => {
    console.log(`ParallelConversationWindow ${windowId} mounted`);
    const timer = setTimeout(() => setIsNew(false), 500);
    return () => clearTimeout(timer);
  }, [windowId]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Window dragging effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStartPos.current.x;
        const deltaY = e.clientY - dragStartPos.current.y;
        
        setWindowPosition({
          x: dragStartWindowPos.current.x + deltaX,
          y: dragStartWindowPos.current.y + deltaY
        });
      }
    };
    
    const handleMouseUp = () => setIsDragging(false);
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);
  
  // Process second opinion content automatically
  const processSecondOpinionContent = async () => {
    console.log("Processing second opinion content");
    
    if (initialMessages.length === 0 || !initialMessages[0].content.includes("I've selected specific elements")) {
      console.log("Not a second opinion window");
      return;
    }
    
    try {
      // Create node for visualization based on this existing message
      const userAnalysis = analyzeMessage(
        initialMessages[0],
        null, // No structured data for user message
        null, // No previous message ID
        windowNodes
      );
      
      const userNodeId = userAnalysis.newNodes.length > 0 
        ? userAnalysis.newNodes[0].id 
        : `second-opinion-${windowId}-${Date.now()}`;
      
      // Add all nodes from the analysis 
      userAnalysis.newNodes.forEach(node => {
        addNode(node);
      });
      
      // Create a synthetic "response" since we're not actually calling the API
      const syntheticResponse: Message = {
        role: 'assistant',
        content: 'Analyzing the selected elements from your conversation...'
      };
      
      // Update the UI immediately with this placeholder
      setMessages([initialMessages[0], syntheticResponse]);
      
      // Now make the actual API call
      console.log("Making API call for second opinion window...");
      const response = await sendLLMMessage(
        [initialMessages[0]], // Just use the initial structured message
        {
          apiKey: apiKeys[selectedProvider] === null ? undefined : apiKeys[selectedProvider],
          model: selectedModel,
          provider: selectedProvider,
          structured: true
        }
      );
      
      // Audio functionality removed
      
      // Once we have the response, update the message
      setMessages([initialMessages[0], {
        role: 'assistant',
        content: response.main_response || 
                (typeof response === 'object' && 'content' in response ? response.content : String(response))
      }]);
    } catch (error) {
      console.error("Error processing second opinion window:", error);
      setMessages([
        initialMessages[0],
        { 
          role: 'assistant', 
          content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`
        }
      ]);
    }
  };
  
  // Automatically process second opinion windows
  useEffect(() => {
    // Check if this is a second opinion window with initial content that needs processing
    const isSecondOpinionWindow = initialMessages.length > 0 && 
      initialMessages[0].content.includes("I've selected specific elements") &&
      messages.length === 1; // Only the initial message is present
      
    if (isSecondOpinionWindow) {
      console.log("Auto-processing second opinion window content");
      // Use setTimeout to ensure the window is visible before processing
      const processingTimer = setTimeout(() => {
        processSecondOpinionContent();
      }, 800); // Wait for window animation to complete
      
      return () => clearTimeout(processingTimer);
    }
  }, [initialMessages, messages.length]);
  
  // Handle sending a message
  const handleSendMessage = async () => {
    console.log(`Attempting to send message in window ${windowId}`);
    if (!inputValue.trim() || isLoading) {
      console.log("Message empty or already loading, not sending");
      return;
    }
    
    // Audio functionality removed
    
    // Add user message
    const userMessage: Message = { role: 'user', content: inputValue };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue('');
    
    // If this is a second opinion window and we already have an initial message
    // that looks like our structured second opinion query, don't actually send this message
    // (this fixes the issue with second opinion windows not showing content)
    const isSecondOpinionInitialMessage = initialMessages.length > 0 && 
      initialMessages[0].content.includes("I've selected specific elements");
    
    if (isSecondOpinionInitialMessage && messages.length === 1) {
      // We're in a second opinion window with the initial prompt
      console.log("This appears to be a second opinion window with initial message, processing...");
      
      // Rather than sending a new API call, parse the content that was already passed to this window
      try {
        // Create node for visualization based on this existing message
        const userAnalysis = analyzeMessage(
          initialMessages[0],
          null, // No structured data for user message
          null, // No previous message ID
          windowNodes
        );
        
        const userNodeId = userAnalysis.newNodes.length > 0 
          ? userAnalysis.newNodes[0].id 
          : `second-opinion-${windowId}-${Date.now()}`;
        
        // Add all nodes from the analysis 
        userAnalysis.newNodes.forEach(node => {
          addNode(node);
        });
        
        // Create a synthetic "response" since we're not actually calling the API
        const syntheticResponse: Message = {
          role: 'assistant',
          content: 'Analyzing the selected elements from your conversation...'
        };
        
        // Update the UI immediately with this placeholder
        setMessages([...updatedMessages, syntheticResponse]);
        
        // Now make the actual API call
        console.log("Making API call for second opinion window...");
        const response = await sendLLMMessage(
          [initialMessages[0]], // Just use the initial structured message
          {
            apiKey: apiKeys[selectedProvider] === null ? undefined : apiKeys[selectedProvider],
            model: selectedModel,
            provider: selectedProvider,
            structured: true
          }
        );
        
        // Once we have the response, update the message
        setMessages([initialMessages[0], {
          role: 'assistant',
          content: response.main_response || 
                  (typeof response === 'object' && 'content' in response ? response.content : String(response))
        }]);
        
        return; // Exit early since we've handled this special case
      } catch (error) {
        console.error("Error processing second opinion window:", error);
        // Continue with normal flow to show error message
      }
    }
    
    // Standard message flow
    try {
      console.log("Processing standard message flow");
      // Create node for visualization
      const userAnalysis = analyzeMessage(
        userMessage,
        null, // No structured data for user message
        null, // No previous message ID
        windowNodes
      );
      
      const userNodeId = userAnalysis.newNodes.length > 0 ? userAnalysis.newNodes[0].id : `user-${windowId}-${Date.now()}`;
      
      // Add all nodes from the analysis
      userAnalysis.newNodes.forEach(node => {
        addNode(node);
      });
      
      // Add all edges from the analysis
      userAnalysis.newEdges.forEach(edge => {
        addEdge(edge);
      });
      
      console.log(`Sending message to API from window ${windowId}`);
      // Send to API using the LLM store
      const response = await sendLLMMessage(
        updatedMessages,
        {
          apiKey: apiKeys[selectedProvider] === null ? undefined : apiKeys[selectedProvider],
          model: selectedModel,
          provider: selectedProvider,
          structured: true
        }
      );
      
      // Audio functionality removed
      
      // Handle different response formats (structured vs. standard)
      let assistantMessage: Message;
      const aiNodeId = `assistant-${windowId}-${Date.now()}`;
      
      if (response.main_response) {
        // This is a structured response
        assistantMessage = {
          role: 'assistant',
          content: response.main_response
        };
        console.log('Received structured response in parallel window:', response);
      } else {
        // This is a standard message object
        assistantMessage = response;
      }
      
      if (assistantMessage && typeof assistantMessage === 'object' && assistantMessage.content) {
        // Create node with enhanced information from structured output
        const structuredData = 'main_response' in response ? response as StructuredLLMOutput : null;
        
        // Process the assistant message along with its structured data
        const assistantAnalysis = analyzeMessage(
          assistantMessage,
          structuredData,
          userNodeId, // Connect to the user message that triggered it
          windowNodes // Pass all existing nodes for context
        );
        
        // Add all nodes from the assistant analysis
        assistantAnalysis.newNodes.forEach(node => {
          addNode(node);
        });
        
        // Add all edges from the assistant analysis
        assistantAnalysis.newEdges.forEach(edge => {
          addEdge(edge);
        });
        
        // Always add a direct connection between the latest user message and the first assistant node
        if (assistantAnalysis.newNodes.length > 0) {
          const assistantMainNode = assistantAnalysis.newNodes[0];
          
          addEdge({
            id: `edge-convo-${windowId}-${Date.now()}`,
            source: userNodeId,
            target: assistantMainNode.id,
            strength: 0.8 // Strong connection for direct conversation flow
          });
        }
      } else {
        // Regular response
        assistantMessage = {
          role: 'assistant',
          content: typeof response === 'object' && 'content' in response 
            ? response.content 
            : String(response)
        };
        
        // Create node with enhanced information
        const assistantAnalysis = analyzeMessage(
          assistantMessage,
          null, // No structured data
          userNodeId, // Connect to the user message
          windowNodes // Existing nodes
        );
        
        // Add all nodes from the assistant analysis
        assistantAnalysis.newNodes.forEach(node => {
          addNode(node);
        });
        
        // Add all edges from the assistant analysis
        assistantAnalysis.newEdges.forEach(edge => {
          addEdge(edge);
        });
        
        // Always add a direct connection between the latest user message and the first assistant node
        if (assistantAnalysis.newNodes.length > 0) {
          const assistantMainNode = assistantAnalysis.newNodes[0];
          
          addEdge({
            id: `edge-convo-${windowId}-${Date.now()}`,
            source: userNodeId,
            target: assistantMainNode.id,
            strength: 0.8 // Strong connection for direct conversation flow
          });
        }
      }
      
      // Add assistant message to the chat
      setMessages([...updatedMessages, assistantMessage]);
      
    } catch (error) {
      console.error('Error sending message:', error);
      // Add error message
      setMessages([
        ...updatedMessages,
        { 
          role: 'assistant', 
          content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`
        }
      ]);
    }
  };
  
  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // Handle window dragging
  const handleWindowMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('window-header')) {
      setIsDragging(true);
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      dragStartWindowPos.current = { x: windowPosition.x, y: windowPosition.y };
      e.preventDefault();
    }
  };
  
  // Provider color based on selected provider
  const providerColors = {
    openai: { bg: 'rgba(0, 150, 180, 0.3)', border: '#0cf' },
    anthropic: { bg: 'rgba(150, 0, 180, 0.3)', border: '#f0f' },
    gemini: { bg: 'rgba(0, 150, 0, 0.3)', border: '#0f0' }
  };
  
  const currentProviderColor = providerColors[selectedProvider];
  
  return (
    <div 
      className="parallel-window"
      style={{
        position: 'fixed',
        top: `${windowPosition.y}px`,
        left: `${windowPosition.x}px`,
        width: `${windowSize.width}px`,
        height: `${windowSize.height}px`,
        backgroundColor: 'rgba(0, 15, 30, 0.85)',
        border: `1px solid ${currentProviderColor.border}`,
        borderRadius: '6px',
        zIndex: 4,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: isNew 
          ? `0 0 40px ${currentProviderColor.border}88` 
          : `0 0 20px ${currentProviderColor.border}33`,
        backdropFilter: 'blur(3px)',
        overflow: 'hidden',
        cursor: isDragging ? 'grabbing' : 'default',
        opacity: isNew ? 0.5 : 1,
        transform: isNew ? 'scale(0.95)' : 'scale(1)',
        transition: 'opacity 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease'
      }}
      onMouseDown={handleWindowMouseDown}
    >
      {/* Window Header */}
      <div 
        className="window-header"
        style={{
          background: `linear-gradient(90deg, ${currentProviderColor.bg}, rgba(0, 30, 60, 0.9))`,
          borderBottom: `1px solid ${currentProviderColor.border}`,
          padding: '8px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: currentProviderColor.border,
          cursor: 'grab',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', fontWeight: 'bold' }}>
          {initialMessages.length > 0 && initialMessages[0].content.includes('I\'ve selected specific elements') 
            ? `${selectedProvider.toUpperCase()} SECOND OPINION`
            : `${selectedProvider.toUpperCase()} DIALOG`}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            style={{
              background: 'none',
              border: 'none',
              color: currentProviderColor.border,
              cursor: 'pointer',
              fontSize: '16px'
            }}
            onClick={() => setIsApiKeyModalOpen(true)}
            title="Set API Key"
          >
            <Key size={16} style={{ color: '#0ff' }} />
          </button>
          <button 
            style={{
              background: 'none',
              border: 'none',
              color: currentProviderColor.border,
              cursor: 'pointer',
              fontSize: '16px'
            }}
            onClick={onClose}
            title="Close Window"
          >
            ×
          </button>
        </div>
      </div>
      
      {/* Model Selector */}
      <div style={{ padding: '8px 10px', borderBottom: `1px solid ${currentProviderColor.border}30` }}>
        <ModelSelector />
      </div>
      
      {/* Messages Display */}
      <div 
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          scrollbarWidth: 'thin',
          scrollbarColor: `${currentProviderColor.border} #012`
        }}
      >
        {messages.map((message, index) => (
          <div 
            key={index}
            className={message.role === 'user' ? 'user-message' : 'ai-message'}
            style={message.role === 'user' ? {
              alignSelf: 'flex-end',
              maxWidth: '80%',
              padding: '8px 12px',
              backgroundColor: 'rgba(0, 100, 200, 0.3)',
              borderRadius: '12px 12px 0 12px',
              borderLeft: `3px solid ${currentProviderColor.border}`,
            } : {
              alignSelf: 'flex-start',
              maxWidth: '80%',
              padding: '8px 12px',
              backgroundColor: 'rgba(0, 130, 100, 0.3)',
              borderRadius: '12px 12px 12px 0',
              borderLeft: `3px solid ${currentProviderColor.border}`
            }}
          >
            {message.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Area */}
      <div 
        style={{
          padding: '10px',
          borderTop: `1px solid ${currentProviderColor.border}50`,
          backgroundColor: 'rgba(0, 10, 25, 0.8)',
          display: 'flex',
          gap: '8px'
        }}
      >
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={needsApiKey ? `Please set your ${selectedProvider} API key` : "Type your message..."}
          disabled={needsApiKey || isLoading}
          style={{
            flex: 1,
            resize: 'none',
            height: '60px',
            padding: '8px 12px',
            backgroundColor: 'rgba(0, 15, 30, 0.9)',
            border: `1px solid ${needsApiKey ? 'rgba(255, 60, 60, 0.5)' : currentProviderColor.border}`,
            borderRadius: '4px',
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: '14px',
            outline: 'none'
          }}
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || needsApiKey || isLoading}
          style={{
            padding: '0 15px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: !inputValue.trim() || needsApiKey || isLoading 
              ? 'rgba(100, 100, 100, 0.3)' 
              : currentProviderColor.bg,
            color: !inputValue.trim() || needsApiKey || isLoading ? '#777' : '#fff',
            cursor: !inputValue.trim() || needsApiKey || isLoading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {isLoading ? (
            <div className="loading" style={{ width: '18px', height: '18px' }} />
          ) : (
            'Send'
          )}
        </button>
      </div>
      
      {/* Error message display */}
      {error && (
        <div 
          style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(200, 0, 0, 0.2)',
            borderTop: '1px solid rgba(255, 0, 0, 0.3)',
            color: '#f77',
            fontSize: '13px'
          }}
        >
          Error: {error}
        </div>
      )}
      
      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        provider={selectedProvider}
        onSubmit={(key, provider) => {
          useLLM.getState().setApiKey(provider, key);
          setIsApiKeyModalOpen(false);
        }}
        onCancel={() => setIsApiKeyModalOpen(false)}
        initialValue={apiKeys[selectedProvider] || ''}
      />
    </div>
  );
}