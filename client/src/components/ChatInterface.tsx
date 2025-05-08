import { useState, useEffect, useRef } from 'react';
import { useVisualization } from '../lib/stores/useVisualization';
import { useLLM, sendMessage as sendLLMMessage } from '../lib/stores/useOpenAI';
import { analyzeMessage } from '../lib/ContextAnalyzer';
import { useAudio } from '../lib/stores/useAudio';
import { BubbleNode, Message, Edge } from '../types';

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
  
  // Global stores
  const { addNode, addEdge, nodes, clearAll } = useVisualization();
  const { 
    isLoading, 
    error, 
    selectedProvider, 
    structured,
    apiKeys,
    selectedModel: storeSelectedModel
  } = useLLM();
  const { playHit, playSuccess } = useAudio();
  
  // Auto-scroll chat to bottom when new messages come in
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Initialize the graph with the welcome message
  useEffect(() => {
    if (nodes.length === 0 && messages.length > 0) {
      const welcomeAnalysis = analyzeMessage(messages[0], [], []);
      addNode(welcomeAnalysis.node);
    }
  }, []);

  // Send message to API and process response
  const handleSendMessage = async () => {
    // Use store-provided API key if not passed in props
    const effectiveApiKey = apiKey || apiKeys[selectedProvider];
    
    if (!input.trim() || !effectiveApiKey) return;
    
    // Don't allow sending while processing
    if (isProcessing) return;
    
    // Play sound effect
    playHit();
    
    // Add user message to chat
    const userMessage: Message = { role: 'user', content: input };
    setMessages([...messages, userMessage]);
    
    // Clear input and set processing state
    setInput('');
    setIsProcessing(true);
    
    try {
      // Create user node for visualization with improved semantic analysis
      const userAnalysis = analyzeMessage(userMessage, messages, nodes);
      const userNodeId = `user-${Date.now()}`;
      
      // Add the user node with its proper ID
      const userNode: BubbleNode = {
        ...userAnalysis.node,
        id: userNodeId
      };
      
      addNode(userNode);
      
      // Add all the semantic connections this node creates
      userAnalysis.connections.forEach(edge => {
        // Update the target to use our actual node ID
        const updatedEdge = {
          ...edge,
          target: userNodeId
        };
        addEdge(updatedEdge);
      });

      // Use the proper model from store or props
      const effectiveModel = selectedModel || storeSelectedModel;
      
      // Send to API using the central LLM store function
      const assistantMessage = await sendLLMMessage(
        [...messages, userMessage],
        {
          apiKey: effectiveApiKey,
          model: effectiveModel,
          provider: selectedProvider,
          structured
        }
      );
      
      // Play success sound
      playSuccess();
      
      // Update messages with assistant response
      setMessages(prev => [...prev, assistantMessage]);
      
      // Create assistant node and semantic connections for visualization
      // We include the user message we just added in the messages for context
      const updatedNodes = [...nodes, userNode];
      const assistantAnalysis = analyzeMessage(
        assistantMessage, 
        [...messages, userMessage],
        updatedNodes
      );
      
      const aiNodeId = `ai-${Date.now()}`;
      
      // Add the assistant node with its proper ID
      const assistantNode: BubbleNode = {
        ...assistantAnalysis.node,
        id: aiNodeId
      };
      
      addNode(assistantNode);
      
      // Add semantic connections for the assistant node
      assistantAnalysis.connections.forEach(edge => {
        // Update the target to use our actual node ID
        const updatedEdge = {
          ...edge,
          target: aiNodeId
        };
        addEdge(updatedEdge);
      });
      
      // Always add a direct connection between the latest user message and this response
      // This ensures the conversation flow is visually clear
      addEdge({
        id: `edge-convo-${Date.now()}`,
        source: userNodeId,
        target: aiNodeId,
        strength: 0.9 // Strong connection for direct conversation flow
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

  return (
    <div id="chat-interface" className={visible ? '' : 'hidden'}>
      <div id="chat-messages">
        {messages.map((message, index) => (
          <div 
            key={index} 
            className={`message ${message.role === 'user' ? 'user-message' : 'ai-message'}`}
          >
            {message.role === 'user' ? 'You: ' : 'AI: '}{message.content}
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
