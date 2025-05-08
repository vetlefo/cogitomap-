import { useState, useEffect } from 'react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onSubmit: (apiKey: string) => void;
  onCancel: () => void;
  initialValue: string;
}

export default function ApiKeyModal({ 
  isOpen, 
  onSubmit, 
  onCancel, 
  initialValue 
}: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState(initialValue);
  
  // Update apiKey if initialValue changes
  useEffect(() => {
    setApiKey(initialValue);
  }, [initialValue]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      onSubmit(apiKey.trim());
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="modal" style={{ display: 'flex' }}>
      <div className="modal-content">
        <h2 className="modal-title">Enter OpenAI API Key</h2>
        <form onSubmit={handleSubmit}>
          <p style={{ color: '#0ff', marginBottom: '15px', fontSize: '14px' }}>
            Your API key is stored locally in your browser and is only sent directly to OpenAI.
          </p>
          <input
            type="password"
            className="modal-input"
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoFocus
          />
          <div className="modal-buttons">
            <button 
              type="submit" 
              className="modal-button modal-button-primary"
              disabled={!apiKey.trim()}
            >
              Save Key
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
