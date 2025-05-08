import { useState, useEffect } from 'react';
import { useLLM, LLMProvider, ModelInfo, fetchAvailableModels } from '../lib/stores/useOpenAI';

interface ModelSelectorProps {
  onProviderChange?: (provider: LLMProvider) => void;
  onModelChange?: (model: string) => void;
}

export default function ModelSelector({ 
  onProviderChange, 
  onModelChange 
}: ModelSelectorProps) {
  const { 
    selectedProvider, 
    selectedModel, 
    availableModels,
    setProvider,
    setModel,
    apiKeys
  } = useLLM();
  
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Fetch available models on initial mount
  useEffect(() => {
    fetchAvailableModels();
  }, []);
  
  // When provider changes, select the first model in that provider
  useEffect(() => {
    const providerModels = availableModels[selectedProvider];
    if (providerModels && providerModels.length > 0) {
      // Only auto-select if current model doesn't belong to this provider
      if (!providerModels.some(m => m.id === selectedModel)) {
        handleModelSelect(providerModels[0].id);
      }
    }
  }, [selectedProvider, availableModels]);
  
  const handleProviderSelect = (provider: LLMProvider) => {
    setProvider(provider);
    if (onProviderChange) onProviderChange(provider);
    setShowDropdown(false);
  };
  
  const handleModelSelect = (model: string) => {
    setModel(model);
    if (onModelChange) onModelChange(model);
    setShowDropdown(false);
  };
  
  // Find current model info
  const currentModel = availableModels[selectedProvider]?.find(m => m.id === selectedModel) 
    || availableModels[selectedProvider]?.[0];
  
  // Get provider status (has API key)
  const providerHasKey = (provider: LLMProvider) => apiKeys[provider] !== null;
  const isEnvironmentKey = (provider: LLMProvider) => apiKeys[provider] === 'env-variable';
  
  const providerColors = {
    openai: { bg: 'rgba(0, 150, 180, 0.3)', border: '#0cf' },
    anthropic: { bg: 'rgba(150, 0, 180, 0.3)', border: '#f0f' },
    gemini: { bg: 'rgba(0, 150, 0, 0.3)', border: '#0f0' }
  };
  
  return (
    <div className="model-selector-container">
      <div 
        className="model-selector" 
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          background: providerColors[selectedProvider].bg,
          borderColor: providerColors[selectedProvider].border
        }}
      >
        <div className="current-model">
          <div className="provider-label">
            {selectedProvider.toUpperCase()}
            <span className={`key-status ${providerHasKey(selectedProvider) ? 'has-key' : 'no-key'}`}>
              {providerHasKey(selectedProvider) ? '✓' : '✗'}
            </span>
          </div>
          <div className="model-name">
            {currentModel?.name || selectedModel}
          </div>
        </div>
        <div className="dropdown-arrow">▼</div>
      </div>
      
      {showDropdown && (
        <div className="model-dropdown">
          {/* Provider Tabs */}
          <div className="provider-tabs">
            {Object.entries(availableModels).map(([provider, models]) => (
              <div 
                key={provider}
                className={`provider-tab ${provider === selectedProvider ? 'active' : ''}`}
                onClick={() => handleProviderSelect(provider as LLMProvider)}
                style={{
                  borderColor: provider === selectedProvider 
                    ? providerColors[provider as LLMProvider].border 
                    : 'transparent',
                  color: provider === selectedProvider 
                    ? providerColors[provider as LLMProvider].border 
                    : '#999'
                }}
              >
                {provider.toUpperCase()}
                <span className={`key-status ${providerHasKey(provider as LLMProvider) ? 'has-key' : 'no-key'}`}>
                  {providerHasKey(provider as LLMProvider) ? '✓' : '✗'}
                </span>
              </div>
            ))}
          </div>
          
          {/* Model List */}
          <div className="model-list">
            {availableModels[selectedProvider]?.map((model) => (
              <div 
                key={model.id}
                className={`model-option ${model.id === selectedModel ? 'selected' : ''}`}
                onClick={() => handleModelSelect(model.id)}
                style={{
                  borderColor: model.id === selectedModel 
                    ? providerColors[selectedProvider].border 
                    : 'transparent',
                  background: model.id === selectedModel 
                    ? providerColors[selectedProvider].bg 
                    : 'transparent',
                }}
              >
                {model.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}