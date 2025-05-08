import { Suspense, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import ContextVisualizer from "./components/ContextVisualizer";
import ChatInterface from "./components/ChatInterface";
import ApiKeyModal from "./components/ApiKeyModal";
import { getLocalStorage, setLocalStorage } from "./lib/utils";
import "../src/styles/cyberpunk.css";

function App() {
  const [showChat, setShowChat] = useState(true);
  const [showDrones, setShowDrones] = useState(true);
  const [apiKey, setApiKey] = useState<string | null>(getLocalStorage("openai-api-key"));
  const [showApiKeyModal, setShowApiKeyModal] = useState(!apiKey);
  const [selectedModel, setSelectedModel] = useState<string>("gpt-3.5-turbo");

  const toggleUI = () => setShowChat(!showChat);
  const toggleDrones = () => setShowDrones(!showDrones);
  
  const resetView = () => {
    // Reset camera position is handled by the OrbitControls reset method
    const controls = document.querySelector('.orbit-controls') as any;
    if (controls) {
      controls.reset();
    }
  };

  const handleApiKeySubmit = (key: string) => {
    setApiKey(key);
    setLocalStorage("openai-api-key", key);
    setShowApiKeyModal(false);
  };

  const handleOpenApiKeyModal = () => {
    setShowApiKeyModal(true);
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(e.target.value);
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
            className="orbit-controls"
            enableZoom={true}
            enablePan={true}
            enableRotate={true}
            minDistance={5}
            maxDistance={50}
          />
        </Canvas>
      </div>

      {/* Model Selector */}
      <div className="model-selector">
        <label htmlFor="model-select">Model:</label>
        <select id="model-select" value={selectedModel} onChange={handleModelChange}>
          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          <option value="gpt-4">GPT-4</option>
          <option value="gpt-4-turbo">GPT-4 Turbo</option>
        </select>
      </div>

      {/* Chat Interface */}
      <ChatInterface 
        visible={showChat} 
        apiKey={apiKey}
        selectedModel={selectedModel}
      />

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
        onSubmit={handleApiKeySubmit} 
        onCancel={() => {
          if (apiKey) {
            setShowApiKeyModal(false);
          }
        }}
        initialValue={apiKey || ""}
      />
    </div>
  );
}

export default App;
