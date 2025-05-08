import { useState, useEffect } from 'react';
import { LLMProvider } from '../lib/stores/useOpenAI';

interface ApiKeyModalProps {
  isOpen: boolean;
  provider: LLMProvider;
  onSubmit: (apiKey: string, provider: LLMProvider) => void;
  onCancel: () => void;
  initialValue: string;
}

// Provider information for UI
const providerInfo = {
  openai: {
    name: 'OpenAI',
    website: 'https://platform.openai.com/',
    placeholder: 'sk-...',
    keyPrefix: 'sk-',
    color: '#0ff',
    bgColor: 'rgba(0, 150, 180, 0.2)'
  },
  anthropic: {
    name: 'Anthropic',
    website: 'https://console.anthropic.com/',
    placeholder: 'sk-ant-...',
    keyPrefix: 'sk-ant-',
    color: '#f0f',
    bgColor: 'rgba(150, 0, 180, 0.2)'
  },
  gemini: {
    name: 'Google Gemini',
    website: 'https://makersuite.google.com/',
    placeholder: 'AIza...',
    keyPrefix: 'AIza',
    color: '#0f0',
    bgColor: 'rgba(0, 150, 0, 0.2)'
  }
};

export default function ApiKeyModal({ 
  isOpen, 
  provider, 
  onSubmit, 
  onCancel, 
  initialValue 
}: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState(initialValue);
  const [isValid, setIsValid] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  
  // Update apiKey if initialValue changes
  useEffect(() => {
    setApiKey(initialValue);
  }, [initialValue]);
  
  // Basic validation based on provider-specific prefixes
  useEffect(() => {
    const key = apiKey.trim();
    const info = providerInfo[provider];
    
    if (!key) {
      setIsValid(false);
      setValidationMessage('');
      return;
    }
    
    if (info.keyPrefix && !key.startsWith(info.keyPrefix)) {
      setIsValid(false);
      setValidationMessage(`${info.name} API keys typically start with "${info.keyPrefix}"`);
      return;
    }
    
    setIsValid(true);
    setValidationMessage('');
  }, [apiKey, provider]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = apiKey.trim();
    
    if (!key || !isValid) return;
    
    setIsValidating(true);
    setValidationMessage('Validating key...');
    
    try {
      // Validation happens on submit now
      // The actual API call is handled in the ChatInterface component
      onSubmit(key, provider);
    } finally {
      setIsValidating(false);
    }
  };
  
  if (!isOpen) return null;
  
  const info = providerInfo[provider];
  
  return (
    <div className="modal" style={{ display: 'flex' }}>
      <div className="modal-content" style={{ borderColor: info.color }}>
        <h2 className="modal-title" style={{ color: info.color }}>
          {initialValue === 'env-variable' ? `${info.name} API Key (Environment)` : `Enter ${info.name} API Key`}
        </h2>
        
        <form onSubmit={handleSubmit}>
          {initialValue === 'env-variable' ? (
            <p style={{ color: info.color, marginBottom: '15px', fontSize: '14px', backgroundColor: 'rgba(0, 40, 80, 0.4)', padding: '10px', borderRadius: '4px' }}>
              <strong>🔑 Environment Variable Detected</strong><br/>
              Your {info.name} API key is currently set via an environment variable. You don't need to enter it manually.
            </p>
          ) : (
            <p style={{ color: info.color, marginBottom: '15px', fontSize: '14px' }}>
              Your API key is stored locally in your browser and is only sent directly to {info.name}.
            </p>
          )}
          
          {initialValue !== 'env-variable' && (
            <div style={{ 
              background: info.bgColor, 
              padding: '10px', 
              borderRadius: '4px', 
              marginBottom: '15px'
            }}>
              <p style={{ fontSize: '12px', margin: '0 0 8px 0' }}>
                Don't have a key? Get one from:
              </p>
              <a 
                href={info.website} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ 
                  color: info.color, 
                  textDecoration: 'none', 
                  fontWeight: 'bold',
                  fontSize: '13px'
                }}
              >
                {info.website}
              </a>
            </div>
          )}
          
          {initialValue !== 'env-variable' && (
            <input
              type="password"
              className="modal-input"
              placeholder={info.placeholder}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoFocus
              style={{ 
                borderColor: isValid ? info.color : 'rgba(255, 80, 80, 0.6)',
                boxShadow: isValid 
                  ? `0 0 10px rgba(0, 255, 255, 0.3)` 
                  : validationMessage 
                    ? '0 0 10px rgba(255, 80, 80, 0.3)'
                    : 'none'
              }}
            />
          )}
          
          {validationMessage && (
            <p style={{ 
              color: isValidating ? info.color : 'rgba(255, 80, 80, 0.9)', 
              fontSize: '12px',
              margin: '8px 0'
            }}>
              {validationMessage}
            </p>
          )}
          
          <div className="modal-buttons">
            <button 
              type="submit" 
              className="modal-button modal-button-primary"
              disabled={initialValue === 'env-variable' || !isValid || isValidating}
              style={{ 
                background: isValid 
                  ? `linear-gradient(to bottom, ${info.color}, ${info.bgColor})` 
                  : undefined,
                opacity: isValid && !isValidating ? 1 : 0.6
              }}
            >
              {initialValue === 'env-variable' ? 'Using Environment Variable' : (isValidating ? 'Validating...' : 'Save Key')}
            </button>
            <button 
              type="button" 
              className="modal-button modal-button-secondary"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
