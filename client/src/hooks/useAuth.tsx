import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Types for user info from Replit Auth
export interface AuthUser {
  id?: string;
  name?: string;
  bio?: string;
  url?: string;
  profileImage?: string;
  roles?: string[];
  teams?: string[];
  [key: string]: unknown;
}

// Auth context type
interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  checkAuth: () => Promise<void>;
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  isAuthenticated: false,
  checkAuth: async () => {}
});

// Provider component that wraps the app
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAuth = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/auth/check');
      const data = await response.json();
      
      if (data.authenticated && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setError('Failed to verify authentication status');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Check auth status on initial load
  useEffect(() => {
    checkAuth();
  }, []);

  // Derive authentication state from user object
  const isAuthenticated = !!user;

  // Provide the auth context to children
  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      error, 
      isAuthenticated,
      checkAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook for easy access to auth context
export function useAuth() {
  return useContext(AuthContext);
}