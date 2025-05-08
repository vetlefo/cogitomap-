import { Suspense, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import ContextVisualizer from "./components/ContextVisualizer";
import ChatInterface from "./components/ChatInterface";
import ApiKeyModal from "./components/ApiKeyModal";
import ParallelWindowsManager from "./components/ParallelWindowsManager";
import ModelSelector from "./components/ModelSelector";
import { getLocalStorage, setLocalStorage } from "./lib/utils";
import { useLLM, LLMProvider, fetchAvailableModels } from "./lib/stores/useOpenAI";
import { useAudio } from "./lib/stores/useAudio";
import "../src/styles/cyberpunk.css";

function App() {
  const [showChat, setShowChat] = useState(true);
  const [showDrones, setShowDrones] = useState(true);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  
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
    
    // If no API key is set for the selected provider, show the modal
    if (!apiKeys[selectedProvider]) {
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
      <ParallelWindowsManager />

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
        <button id="api-key-button" title="Set API Key" onClick={handleOpenApiKeyModal}>
          Set API Key
        </button>
      </div>

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

export default App;
