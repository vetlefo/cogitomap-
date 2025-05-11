import { useState, useEffect, useRef, useCallback } from 'react';
import { useVisualization } from '../lib/stores/useVisualization';
import { useLLM, sendMessage as sendLLMMessage } from '../lib/stores/useOpenAI';
import { analyzeMessage } from '../lib/ContextAnalyzer';
import { useAuth } from '../hooks/useAuth';
import { BubbleNode, Message, Edge, StructuredLLMOutput, NodeType } from '../types';

interface ChatInterfaceProps {
  visible: boolean;
  apiKey: string | null;
  selectedModel: string;
}

export default function ChatInterface({ 
  visible, 
  apiKey,
  selectedModel 
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Welcome! I\'ll help you visualize our conversation as a 3D knowledge graph.' }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Track message to node mappings
  const [messageNodeMap, setMessageNodeMap] = useState<Record<number, string[]>>({});
  
  // Global stores
  const { 
    addNode,
    addEdge, 
    nodes, 
    clearAll,
    selectNode,
    toggleNodeSelection,
    clearSelectedNodes
  } = useVisualization();
  
  const { 
    isLoading, 
    error, 
    selectedProvider, 
    structured,
    apiKeys,
    selectedModel: storeSelectedModel
  } = useLLM();
  const { isAuthenticated, user } = useAuth();
  
  // Auto-scroll chat to bottom when new messages come in
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Initialize the graph with the welcome message
  useEffect(() => {
    if (nodes.length === 0 && messages.length > 0) {
      const welcomeAnalysis = analyzeMessage(messages[0], null, null, []);
      // Add all new nodes from the analysis
      welcomeAnalysis.newNodes.forEach(node => addNode(node));
      // Add all new edges from the analysis
      welcomeAnalysis.newEdges.forEach(edge => 
        addEdge(edge.source, edge.target, edge.relationship || 'mentions', edge.strength)
      );
      
      // Save mapping of message index to node IDs
      const nodeIds = welcomeAnalysis.newNodes.map(node => node.id);
      setMessageNodeMap({ 0: nodeIds });
    }
  }, []);
  
  // Function to handle message click - selects related nodes in visualization
  const handleMessageClick = useCallback((messageIndex: number) => {
    console.log(`Message clicked: ${messageIndex}`);
    
    // Get the nodes associated with this message
    const nodeIds = messageNodeMap[messageIndex];
    
    if (!nodeIds || nodeIds.length === 0) {
      console.log(`No nodes found for message ${messageIndex}`);
      return;
    }
    
    // First clear any existing selection
    clearSelectedNodes();
    
    // Select the primary node (first one)
    if (nodeIds.length > 0) {
      selectNode(nodeIds[0]);
      console.log(`Selected primary node: ${nodeIds[0]}`);
    }
    
    // Add all other nodes to multi-selection
    if (nodeIds.length > 1) {
      // Skip the first node as it's already the primary selection
      for (let i = 1; i < nodeIds.length; i++) {
        toggleNodeSelection(nodeIds[i]);
        console.log(`Added to selection: ${nodeIds[i]}`);
      }
    }
  }, [messageNodeMap, selectNode, toggleNodeSelection, clearSelectedNodes]);

  // Send message to API and process response
  const handleSendMessage = async () => {
    // Use store-provided API key if not passed in props
    const effectiveApiKey = apiKey !== null ? apiKey : apiKeys[selectedProvider];
    
    if (!input.trim() || effectiveApiKey === null) return;
    
    // Don't allow sending while processing
    if (isProcessing) return;
    
    // Add user message to chat
    const userMessage: Message = { role: 'user', content: input };
    setMessages([...messages, userMessage]);
    
    // Clear input and set processing state
    setInput('');
    setIsProcessing(true);
    
    try {
      // Create user node for visualization with improved semantic analysis
      const prevMessageId = nodes.length > 0 ? nodes[nodes.length - 1].id : null;
      const userAnalysis = analyzeMessage(userMessage, null, prevMessageId, nodes);
      
      // Generate a unique ID for the main user node (should be the first one)
      const userNodeId = userAnalysis.newNodes.length > 0 ? userAnalysis.newNodes[0].id : `user-${Date.now()}`;
      
      // Add all nodes from the analysis
      userAnalysis.newNodes.forEach(node => {
        addNode(node);
      });
      
      // Add all edges from the analysis
      userAnalysis.newEdges.forEach(edge => {
        // Pass individual properties instead of the whole edge object
        addEdge(edge.source, edge.target, edge.relationship || 'mentions', edge.strength);
      });
      
      // Store mapping of message index to node IDs for bi-directional selection
      const userMessageIndex = messages.length;
      const userNodeIds = userAnalysis.newNodes.map(node => node.id);
      setMessageNodeMap(prev => ({
        ...prev,
        [userMessageIndex]: userNodeIds
      }));

      // Use the proper model from store or props
      const effectiveModel = selectedModel || storeSelectedModel;
      
      // Send to API using the central LLM store function
      const response = await sendLLMMessage(
        [...messages, userMessage],
        {
          apiKey: effectiveApiKey === null ? undefined : effectiveApiKey,
          model: effectiveModel,
          provider: selectedProvider,
          structured
        }
      );
      
      // Handle different response formats (structured vs. standard)
      let assistantMessage: Message;
      if (response.main_response) {
        // This is a structured response
        assistantMessage = {
          role: 'assistant',
          content: response.main_response
        };
        console.log('Received structured response:', response);
      } else {
        // This is a standard message object
        assistantMessage = response;
      }
      
      // Update messages with assistant response
      setMessages(prev => [...prev, assistantMessage]);
      
      // Create assistant node and semantic connections for visualization
      // Use structured data if available
      const structuredData = 'main_response' in response ? response as StructuredLLMOutput : null;
      
      // Get the updated nodes list including user nodes that were just added
      const updatedNodes = [...nodes];
      
      // Process the assistant message along with its structured data
      const assistantAnalysis = analyzeMessage(
        assistantMessage, 
        structuredData,
        userNodeId, // Connect to the user message that triggered it
        updatedNodes // Pass all existing nodes for context
      );
      
      // Add all nodes from the assistant analysis
      assistantAnalysis.newNodes.forEach(node => {
        addNode(node);
      });
      
      // Add all edges from the assistant analysis  
      assistantAnalysis.newEdges.forEach(edge => {
        // Pass individual properties instead of the whole edge object
        addEdge(edge.source, edge.target, edge.relationship || 'mentions', edge.strength);
      });
      
      // Store mapping of assistant message index to node IDs
      const assistantMessageIndex = messages.length + 1; // +1 because we added the user message
      const assistantNodeIds = assistantAnalysis.newNodes.map(node => node.id);
      setMessageNodeMap(prev => ({
        ...prev,
        [assistantMessageIndex]: assistantNodeIds
      }));
      
      // Log the nodes and edges added for debugging
      console.log('Added assistant nodes:', assistantAnalysis.newNodes);
      console.log('Added assistant edges:', assistantAnalysis.newEdges);
      console.log('Updated message-node mapping:', {
        ...messageNodeMap,
        [assistantMessageIndex]: assistantNodeIds
      });
      
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: 'Sorry, there was an error processing your request. Please check your API key and try again.'
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Enter key press in textarea
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Reset conversation function
  const handleNewConversation = () => {
    // Confirm with user before clearing
    if (messages.length > 1 && window.confirm('Start a new conversation? This will clear the current chat.')) {
      setMessages([{ 
        role: 'assistant', 
        content: 'Welcome! I\'ll help you visualize our conversation as a 3D knowledge graph.' 
      }]);
      // Optional: Clear the graph visualization too
      clearAll();
    } else if (messages.length <= 1) {
      // If conversation is already empty-ish, no need to confirm
      setMessages([{ 
        role: 'assistant', 
        content: 'Welcome! I\'ll help you visualize our conversation as a 3D knowledge graph.' 
      }]);
      clearAll();
    }
  };

  return (
    <div id="chat-interface" className={visible ? '' : 'hidden'}>
      <button 
        className="new-conversation-btn"
        onClick={handleNewConversation}
        title="Start a new conversation"
      >
        <span className="new-conversation-icon">+</span>
        <span>New Chat</span>
      </button>

      <div id="chat-messages">
        {!isAuthenticated && (
          <a 
            href="/?devMode=true" 
            className="auth-hint-banner"
            onClick={(e) => {
              e.preventDefault();
              localStorage.setItem('devAuth', 'true');
              window.location.href = '/?devMode=true';
            }}
          >
            <div className="auth-hint-content">
              <span className="auth-hint-icon">🔐</span>
              <span className="auth-hint-text">
                <strong>Login with Replit</strong> to save conversations and access more features
              </span>
            </div>
          </a>
        )}
        {messages.map((message, index) => (
          <div 
            key={index} 
            className={`message ${message.role === 'user' ? 'user-message' : 'ai-message'} ${messageNodeMap[index] ? 'has-nodes' : ''}`}
            onClick={() => handleMessageClick(index)}
            title={messageNodeMap[index] ? "Click to select related nodes" : ""}
          >
            <div className="message-header">
              <span className="message-role">{message.role === 'user' ? 'You' : 'AI'}</span>
              {messageNodeMap[index] && (
                <span className="node-indicator">{messageNodeMap[index].length} node{messageNodeMap[index].length > 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="message-content">{message.content}</div>
          </div>
        ))}
        {isProcessing && (
          <div className="message ai-message">
            AI: <span className="loading"></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div id="input-area">
        <textarea 
          id="user-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={apiKeys[selectedProvider] 
            ? `Ask ${selectedProvider.toUpperCase()} something...` 
            : `Set your ${selectedProvider.toUpperCase()} API key first`}
          disabled={!apiKeys[selectedProvider] || isProcessing}
        />
        <button 
          id="send-button" 
          onClick={handleSendMessage}
          disabled={!apiKeys[selectedProvider] || isProcessing}
        >
          {isProcessing ? 
            <span className="loading"></span> : 
            'Send'
          }
        </button>
      </div>
    </div>
  );
}
