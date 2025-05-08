import { useState, useEffect, useRef } from 'react';
import { useVisualization } from '../lib/stores/useVisualization';
import { analyzeMessage } from '../lib/ContextAnalyzer';

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
  const [messages, setMessages] = useState<{role: string; content: string}[]>([
    { role: 'assistant', content: 'Welcome! I\'ll help you visualize our conversation as a 3D knowledge graph.' }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { addNode, addEdge, clearAll } = useVisualization();
  
  // Auto-scroll chat to bottom when new messages come in
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Send message to API and process response
  const sendMessage = async () => {
    if (!input.trim() || !apiKey) return;
    
    // Don't allow sending while processing
    if (isProcessing) return;
    
    // Add user message to chat
    const userMessage = { role: 'user', content: input };
    setMessages([...messages, userMessage]);
    
    // Clear input and set processing state
    setInput('');
    setIsProcessing(true);
    
    try {
      // Create user node for visualization
      const userNode = analyzeMessage(userMessage, messages);
      addNode({
        id: `user-${Date.now()}`,
        content: userMessage.content,
        type: 'user',
        position: userNode.position,
        importance: userNode.importance,
        keywords: userNode.keywords
      });

      // Send to API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          apiKey,
          model: selectedModel
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from API');
      }

      const data = await response.json();
      const assistantMessage = data.message;
      
      // Update messages with assistant response
      setMessages(prev => [...prev, assistantMessage]);
      
      // Create assistant node and edge for visualization
      const assistantNode = analyzeMessage(assistantMessage, [...messages, userMessage]);
      const aiNodeId = `ai-${Date.now()}`;
      
      addNode({
        id: aiNodeId,
        content: assistantMessage.content,
        type: 'assistant',
        position: assistantNode.position,
        importance: assistantNode.importance, 
        keywords: assistantNode.keywords
      });
      
      // Add edge connecting user message to AI response
      addEdge({
        id: `edge-${Date.now()}`,
        source: `user-${Date.now() - 100}`, // Approximate ID of the last user node
        target: aiNodeId,
        strength: 0.8
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
      sendMessage();
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
          placeholder={apiKey ? "Ask something..." : "Enter your API key first"}
          disabled={!apiKey || isProcessing}
        />
        <button 
          id="send-button" 
          onClick={sendMessage}
          disabled={!apiKey || isProcessing}
        >
          Send
        </button>
      </div>
    </div>
  );
}
