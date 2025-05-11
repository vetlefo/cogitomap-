import { Suspense, useState, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import ContextVisualizer from "./components/ContextVisualizer";
import ChatInterface from "./components/ChatInterface";
import ApiKeyModal from "./components/ApiKeyModal";
import ParallelWindowsManager, { ParallelWindowsManagerRef } from "./components/ParallelWindowsManager";
import SelectedNodesPanel from "./components/SelectedNodesPanel";
import NodePanelToggle from "./components/NodePanelToggle";
import ModelSelector from "./components/ModelSelector";
import AuthButton from "./components/AuthButton";
import SemanticAnalysisButton from "./components/SemanticAnalysisButton";
import { getLocalStorage, setLocalStorage } from "./lib/utils";
import { useLLM, LLMProvider, fetchAvailableModels } from "./lib/stores/useOpenAI";
import { useKeyboardState } from "./hooks/useKeyboardState";
import { AuthProvider } from "./hooks/useAuth";
import { Message } from "./types";
import "../src/styles/cyberpunk.css";

function App() {
  const [showChat, setShowChat] = useState(true);
  const [showDrones, setShowDrones] = useState(true);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const windowsManagerRef = useRef<ParallelWindowsManagerRef>(null);
  
  // Store conversation messages at the App level to share with semantic analysis
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Welcome! I\'ll help you visualize our conversation as a 3D knowledge graph.' }
  ]);
  
  // Use the keyboard state to detect shift key for multi-select mode
  const keyboardState = useKeyboardState();
  
  // Get state from the LLM store
  const { 
    apiKeys, 
    selectedProvider,
    selectedModel,
    setApiKey,
    setProvider,
    setModel
  } = useLLM();
  
  // Check if we need to show the API key modal
  useEffect(() => {
    // Load OpenAI API key from localStorage for backward compatibility
    const savedOpenAIKey = getLocalStorage("openai-api-key");
    if (savedOpenAIKey && !apiKeys.openai) {
      setApiKey('openai', savedOpenAIKey);
    }
    
    // Mark OpenAI API key as available since it's now set as an environment variable
    // The client will recognize 'env-variable' and send null to the server
    if (!apiKeys.openai) {
      setApiKey('openai', 'env-variable');
    }
    
    // If no API key is set for the selected provider that isn't OpenAI, show the modal
    if (!apiKeys[selectedProvider] && selectedProvider !== 'openai') {
      setShowApiKeyModal(true);
    }
    
    // Fetch available models
    fetchAvailableModels();
  }, []);
  
  const toggleUI = () => setShowChat(!showChat);
  const toggleDrones = () => setShowDrones(!showDrones);
  
  const resetView = () => {
    // Reset camera position is handled by the OrbitControls reset method
    const controls = document.querySelector('.orbit-controls') as any;
    if (controls) {
      controls.reset();
    }
  };

  const handleApiKeySubmit = (key: string, provider: LLMProvider) => {
    setApiKey(provider, key);
    
    // Also save to localStorage for backward compatibility if it's OpenAI
    if (provider === 'openai') {
      setLocalStorage("openai-api-key", key);
    }
    
    setShowApiKeyModal(false);
  };

  const handleOpenApiKeyModal = () => {
    setShowApiKeyModal(true);
  };

  // Handle request for second opinion on selected nodes
  const handleRequestSecondOpinion = (selectedNodeIds: string[]) => {
    console.log(`App received request for second opinion on ${selectedNodeIds.length} nodes: [${selectedNodeIds.join(', ')}]`);
    
    if (windowsManagerRef.current) {
      // Try the request and handle errors
      try {
        const windowId = windowsManagerRef.current.createSecondOpinionWindow(selectedNodeIds);
        console.log(`Created second opinion window: ${windowId || 'NULL'}`);
        
        if (!windowId) {
          console.error('Failed to create second opinion window - null ID returned');
        }
      } catch (error) {
        console.error('Error creating second opinion window:', error);
      }
    } else {
      console.error('windowsManagerRef is not initialized - cannot create second opinion window');
    }
  };
  
  // Track window creation
  const handleWindowCreate = (windowId: string) => {
    console.log(`New window created: ${windowId}`);
  };

  return (
    <div className="app-container">
      <div id="visualization-container">
        <Canvas
          camera={{ position: [0, 0, 50], fov: 60 }}
          gl={{ antialias: true }}
        >
          <color attach="background" args={["#000"]} />
          <ambientLight intensity={0.3} />
          <pointLight position={[10, 10, 10]} intensity={0.7} />
          <Suspense fallback={null}>
            <ContextVisualizer showDrones={showDrones} />
          </Suspense>
          <OrbitControls 
            minDistance={10}
            maxDistance={150}
            enableDamping={true}
            dampingFactor={0.1}
          />
        </Canvas>
      </div>

      {/* Top Info Panel - minimized version of the model selector & auth */}
      <div className="top-cockpit-panel">
        <div className="cockpit-auth-container">
          <AuthButton />
        </div>
        <div className="cockpit-model-selector">
          <ModelSelector 
            onProviderChange={(provider) => {
              // Check if we need to show the API key modal for this provider
              if (!apiKeys[provider]) {
                setProvider(provider);
                setShowApiKeyModal(true);
              }
            }}
          />
        </div>
      </div>

      {/* Chat Interface */}
      <ChatInterface 
        visible={showChat} 
        apiKey={apiKeys[selectedProvider]}
        selectedModel={selectedModel}
      />
      
      {/* Parallel Windows Manager */}
      <ParallelWindowsManager 
        ref={windowsManagerRef}
        onWindowCreate={handleWindowCreate}
      />
      
      {/* Selected Nodes Panel for Second Opinion feature */}
      <SelectedNodesPanel onRequestSecondOpinion={handleRequestSecondOpinion} />
      
      {/* Node Panel Toggle Button */}
      <NodePanelToggle initialState={true} />

      {/* Controls */}
      <div id="controls">
        <div className="panel-header">NAVIGATION</div>
        <button id="toggle-ui" title="Show/Hide Chat UI" onClick={toggleUI}>
          <span className="control-icon">⊙</span> Toggle Interface
        </button>
        <button id="reset-view" title="Reset Camera View" onClick={resetView}>
          <span className="control-icon">↻</span> Reset View
        </button>
        <button id="toggle-drones" title="Show/Hide AI Drones" onClick={toggleDrones}>
          <span className="control-icon">⚑</span> Toggle Drones
        </button>
        <button 
          id="api-key-button" 
          title={apiKeys.openai === 'env-variable' ? "API key set via environment variable" : "Set API Key"} 
          onClick={handleOpenApiKeyModal}
        >
          <span className="control-icon">🔑</span> {apiKeys.openai === 'env-variable' ? 'API Key (Env)' : 'Set API Key'}
        </button>
        <SemanticAnalysisButton messages={messages} />
      </div>
      
      {/* Multi-select mode indicator */}
      {keyboardState.shiftKey && (
        <div className="mode-indicator">
          <div className="mode-indicator-pulse"></div>
          <div className="mode-indicator-content">
            <span className="mode-icon">⊕</span>
            <span className="mode-label">MULTI-SELECT MODE</span>
            <span className="mode-hint">Click nodes to add to selection</span>
          </div>
        </div>
      )}

      {/* API Key Modal */}
      <ApiKeyModal 
        isOpen={showApiKeyModal} 
        provider={selectedProvider}
        onSubmit={handleApiKeySubmit} 
        onCancel={() => {
          if (apiKeys[selectedProvider]) {
            setShowApiKeyModal(false);
          }
        }}
        initialValue={apiKeys[selectedProvider] || ""}
      />
    </div>
  );
}

// Wrap the App component with AuthProvider to provide auth context
function AppWithAuth() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

export default AppWithAuth;
