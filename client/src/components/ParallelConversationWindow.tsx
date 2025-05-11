import React, { useState, useEffect, useRef } from 'react';
import { sendMessage as sendLLMMessage, useLLM } from '../lib/stores/useOpenAI';
import ApiKeyModal from './ApiKeyModal';
import ModelSelector from './ModelSelector';
import { analyzeMessage } from '../lib/ContextAnalyzer';
import { BubbleNode, Message, StructuredLLMOutput, Edge } from '../types';
import { useVisualization } from '../lib/stores/useVisualization';

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
    
    // If there are already initial messages, don't automatically generate
    if (initialMessages.length > 0) {
      console.log("Initial messages exist, not auto-generating second opinion");
      return;
    }
    
    // Get the selected nodes from the state
    const selectedNodes = windowNodes.filter(node => node.selected);
    
    if (selectedNodes.length === 0) {
      console.log("No selected nodes to process for second opinion");
      // No nodes selected, generate a generic prompt
      const systemMessage: Message = {
        role: 'system',
        content: 'You are a Second Opinion assistant providing alternative perspectives. Answer the following request with insights that may differ from standard views.'
      };
      
      setMessages([systemMessage]);
    } else {
      console.log(`Processing ${selectedNodes.length} selected nodes for second opinion`);
      
      // Extract content from all selected nodes
      const selectedContent = selectedNodes
        .map(node => `[${node.type}]: ${node.content}`)
        .join('\n\n');
      
      // Create a prompt based on the selected content
      const prompt = `
        Based on the following context, provide a second opinion or alternative perspective.
        Consider different interpretations, missing aspects, or potential counterarguments.
        
        ${selectedContent}
      `;
      
      // Create a system message and user message
      const systemMessage: Message = {
        role: 'system',
        content: 'You are a Second Opinion assistant providing alternative perspectives. Your goal is to explore different angles, challenge assumptions, or highlight overlooked aspects. Be thorough yet respectful in your analysis.'
      };
      
      const userMessage: Message = {
        role: 'user',
        content: prompt
      };
      
      // Set the messages
      setMessages([systemMessage, userMessage]);
      
      // Auto-trigger a response
      await sendMessage(prompt);
    }
  };
  
  // FIXED: Use the updated signature for addEdge
  const sendMessage = async (content: string = inputValue) => {
    if (!content.trim()) return;
    
    // Create a new user message
    const userMessage: Message = {
      role: 'user',
      content: content.trim()
    };
    
    // Update messages with the new user message
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    
    // Process the user message to create nodes and connections
    const userNodeId = `user-${windowId}-${Date.now()}`;
    
    // Analyze the user message to create graph nodes and edges
    const userAnalysis = analyzeMessage(
      userMessage,
      null, // No structured data for user messages
      null, // No previous message to link to initially
      windowNodes // Pass all existing nodes for context
    );
    
    // Add all nodes from the user analysis
    userAnalysis.newNodes.forEach(node => {
      addNode(node);
    });
    
    // Add all edges from the analysis
    userAnalysis.newEdges.forEach(edge => {
      addEdge(edge.source, edge.target, "message", 0.5);
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
        addEdge(edge.source, edge.target, "message", 0.5);
      });
      
      // Always add a direct connection between the latest user message and the first assistant node
      if (assistantAnalysis.newNodes.length > 0) {
        const assistantMainNode = assistantAnalysis.newNodes[0];
        
        addEdge(
          userNodeId,
          assistantMainNode.id,
          "response_to",
          0.8 // Strong connection for direct conversation flow
        );
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
        addEdge(edge.source, edge.target, "message", 0.5);
      });
      
      // Always add a direct connection between the latest user message and the first assistant node
      if (assistantAnalysis.newNodes.length > 0) {
        const assistantMainNode = assistantAnalysis.newNodes[0];
        
        addEdge(
          userNodeId,
          assistantMainNode.id,
          "response_to",
          0.8 // Strong connection for direct conversation flow
        );
      }
    }
    
    // Update messages with the assistant's response
    setMessages([...updatedMessages, assistantMessage]);
    
    // Clear the input
    setInputValue('');
  };
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };
  
  // Handle input keydown (for Enter key)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  // Handle drag start
  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartWindowPos.current = windowPosition;
  };
  
  // Auto-process content when mounted
  useEffect(() => {
    processSecondOpinionContent();
  }, []);
  
  // ---------- Render ----------
  // Calculate faded class based on isNew
  const windowClass = `parallel-window ${isNew ? 'parallel-window-new' : ''}`;
  
  return (
    <div 
      className={windowClass}
      style={{
        left: `${windowPosition.x}px`,
        top: `${windowPosition.y}px`,
        width: `${windowSize.width}px`,
        height: `${windowSize.height}px`
      }}
    >
      <div 
        className="parallel-window-header" 
        onMouseDown={handleDragStart}
      >
        <div className="parallel-window-title">
          OPENAI SECOND OPINION
        </div>
        <div className="parallel-window-controls">
          <button 
            className="close-button"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>
      
      <div className="parallel-window-model-selector">
        <div className="provider-badge">
          OPENAI
        </div>
        <ModelSelector />
      </div>
      
      <div className="parallel-window-content">
        <div className="message-list">
          {messages.map((message, index) => (
            message.role !== 'system' && (
              <div 
                key={index} 
                className={`message ${message.role}`}
              >
                {message.content}
              </div>
            )
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <div className="parallel-window-input">
        <input 
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          disabled={isLoading || needsApiKey}
        />
        <button 
          onClick={() => sendMessage()}
          disabled={!inputValue.trim() || isLoading || needsApiKey}
        >
          Send
        </button>
      </div>
      
      {needsApiKey && (
        <div className="api-key-prompt">
          <button onClick={() => setIsApiKeyModalOpen(true)}>
            Set API Key
          </button>
        </div>
      )}
      
      {isApiKeyModalOpen && (
        <ApiKeyModal
          isOpen={isApiKeyModalOpen}
          onClose={() => setIsApiKeyModalOpen(false)}
        />
      )}
    </div>
  );
}