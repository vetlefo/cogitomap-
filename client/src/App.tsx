import { Suspense, useState, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import ContextVisualizer from "./components/ContextVisualizer";
import ChatInterface from "./components/ChatInterface";
import ApiKeyModal from "./components/ApiKeyModal";
import ParallelWindowsManager, { ParallelWindowsManagerRef } from "./components/ParallelWindowsManager";
import SelectedNodesPanel from "./components/SelectedNodesPanel";
import ModelSelector from "./components/ModelSelector";
import AuthButton from "./components/AuthButton";
import { getLocalStorage, setLocalStorage } from "./lib/utils";
import { useLLM, LLMProvider, fetchAvailableModels } from "./lib/stores/useOpenAI";
import { useAudio } from "./lib/stores/useAudio";
import { useKeyboardState } from "./hooks/useKeyboardState";
import { AuthProvider } from "./hooks/useAuth";
import "../src/styles/cyberpunk.css";

function App() {
  const [showChat, setShowChat] = useState(true);
  const [showDrones, setShowDrones] = useState(true);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const windowsManagerRef = useRef<ParallelWindowsManagerRef>(null);
  
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
  
  // Get audio state and controls
  const { 
    isMuted, 
    toggleMute,
    setHitSound,
    setSuccessSound
  } = useAudio();
  
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
  
  // Initialize audio
  useEffect(() => {
    // Load sound effects
    const hitSound = new Audio('/sounds/hit.mp3');
    const successSound = new Audio('/sounds/success.mp3');
    
    // Set the sounds in the store
    setHitSound(hitSound);
    setSuccessSound(successSound);
    
    // Load mute state from localStorage
    const savedMuteState = getLocalStorage("audio-muted");
    if (savedMuteState !== null && savedMuteState !== isMuted) {
      toggleMute();
    }
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
  
  const handleToggleSound = () => {
    toggleMute();
    // Save mute state to localStorage
    setLocalStorage("audio-muted", !isMuted);
  };

  // Handle request for second opinion on selected nodes
  const handleRequestSecondOpinion = (selectedNodeIds: string[]) => {
    if (windowsManagerRef.current) {
      const windowId = windowsManagerRef.current.createSecondOpinionWindow(selectedNodeIds);
      console.log(`Created second opinion window: ${windowId}`);
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
          camera={{ position: [0, 0, 15], fov: 60 }}
          gl={{ antialias: true }}
        >
          <color attach="background" args={["#000"]} />
          <ambientLight intensity={0.3} />
          <pointLight position={[10, 10, 10]} intensity={0.7} />
          <Suspense fallback={null}>
            <ContextVisualizer showDrones={showDrones} />
          </Suspense>
          <OrbitControls 
            minDistance={5}
            maxDistance={50}
          />
        </Canvas>
      </div>

      {/* Model Selector - visible in the top-right corner */}
      <div style={{ position: 'fixed', top: '20px', right: '20px', width: '250px', zIndex: 3 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <AuthButton />
        </div>
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

      {/* Controls */}
      <div id="controls">
        <button id="toggle-ui" title="Show/Hide Chat UI" onClick={toggleUI}>
          Toggle UI
        </button>
        <button id="reset-view" title="Reset Camera View" onClick={resetView}>
          Reset View
        </button>
        <button id="toggle-drones" title="Show/Hide AI Drones" onClick={toggleDrones}>
          Toggle Drones
        </button>
        <button 
          id="api-key-button" 
          title={apiKeys.openai === 'env-variable' ? "API key set via environment variable" : "Set API Key"} 
          onClick={handleOpenApiKeyModal}
        >
          {apiKeys.openai === 'env-variable' ? '🔑 API Key (Env)' : 'Set API Key'}
        </button>
        <button 
          id="toggle-sound" 
          title={isMuted ? "Enable Sound" : "Disable Sound"} 
          onClick={handleToggleSound}
          className={isMuted ? "muted" : ""}
        >
          {isMuted ? "🔇 Sound Off" : "🔊 Sound On"}
        </button>
      </div>
      
      {/* Multi-select mode indicator */}
      {keyboardState.shiftKey && (
        <div 
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(100, 0, 150, 0.8)',
            color: 'white',
            padding: '8px 15px',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 'bold',
            boxShadow: '0 0 15px rgba(100, 0, 150, 0.5)',
            zIndex: 1000,
            animation: 'pulse 1.5s infinite',
            border: '1px solid rgba(200, 100, 255, 0.6)'
          }}
        >
          🔍 Multi-Select Mode (Shift) - Click nodes to select multiple
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
