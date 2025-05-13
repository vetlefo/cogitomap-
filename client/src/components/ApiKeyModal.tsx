import { useState, useEffect } from 'react';
import { LLMProvider } from '../lib/stores/useOpenAI';
import { Key } from 'lucide-react';

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
    <div className="modal fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm perspective-dramatic">
      <div className="modal-content rounded-xl overflow-hidden bg-background/90 backdrop-blur-lg border border-accent/30 shadow-2xl transform-gpu translate-z-6 transition-transform hover:translate-z-8 max-w-md w-full mx-4 p-6" style={{ borderColor: info.color }}>
        <h2 className="modal-title text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: info.color }}>
          <Key size={18} />
          {initialValue === 'env-variable' ? `${info.name} API Key (Environment)` : `Enter ${info.name} API Key`}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {initialValue === 'env-variable' ? (
            <div className="rounded-lg bg-accent/10 p-3 border border-accent/20">
              <p className="text-sm flex items-start gap-2">
                <Key size={14} className="mt-0.5 shrink-0" />
                <span>
                  <strong className="block text-accent mb-1">Environment Variable Detected</strong>
                  Your {info.name} API key is currently set via an environment variable. You don't need to enter it manually.
                </span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your API key is stored locally in your browser and is only sent directly to {info.name}.
            </p>
          )}
          
          {initialValue !== 'env-variable' && (
            <div className="rounded-lg bg-accent/5 p-3 border border-accent/10 text-sm">
              <p className="text-xs text-muted-foreground mb-1">
                Don't have a key? Get one from:
              </p>
              <a 
                href={info.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-accent font-medium hover:underline"
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
