import { useState, useEffect } from 'react';

interface KeyboardState {
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

/**
 * Hook to track global keyboard state
 * Useful for multi-select operations and other keyboard shortcuts
 */
export function useKeyboardState(): KeyboardState {
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKeyboardState({
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeyboardState({
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return keyboardState;
}