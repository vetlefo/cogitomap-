import { useAuth } from '../hooks/useAuth';
import { useState } from 'react';
import { Button } from './ui/button';

export default function AuthButton() {
  const { user, isAuthenticated, loading } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  if (loading) {
    return (
      <div className="auth-button">
        <Button variant="outline" size="sm" disabled>
          <span className="loading-spinner"></span>
        </Button>
      </div>
    );
  }

  const handleLogin = async () => {
    try {
      // For development mode, fetch directly without redirect
      const response = await fetch('/api/auth/login');
      const data = await response.json();
      
      if (data.success) {
        // Set dev mode header for future requests
        localStorage.setItem('devAuth', 'true');
        // Force refresh auth state
        window.location.href = '/?devMode=true';
      } else {
        // Fallback to normal auth flow
        window.location.href = `/api/auth/login`;
      }
    } catch (e) {
      console.error('Auth error:', e);
      // Fallback to normal auth flow
      window.location.href = `/api/auth/login`;
    }
  };
  
  const handleLogout = () => {
    // For development mode, clear local storage
    if (user?.devMode) {
      localStorage.removeItem('devAuth');
      window.location.href = '/';
      return;
    }
    
    // Normal Replit Auth logout
    window.location.href = `/api/auth/logout`;
  };
  
  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <div className="auth-button relative">
      {isAuthenticated ? (
        <>
          <Button 
            variant="ghost" 
            onClick={toggleDropdown}
            className="flex items-center gap-2 text-cyan-300 hover:text-cyan-100 hover:bg-cyan-900/30 transition-colors"
          >
            {user?.profileImage ? (
              <img 
                src={user.profileImage} 
                alt={user.name || 'User'} 
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-cyan-800 flex items-center justify-center">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <span className="max-w-[100px] truncate">
              {user?.name || 'User'}
            </span>
          </Button>
          
          {isDropdownOpen && (
            <div 
              className="absolute right-0 top-full mt-2 w-48 bg-gray-900 border border-cyan-900 rounded-md shadow-lg z-10 p-2"
              onMouseLeave={() => setIsDropdownOpen(false)}
            >
              <div className="p-2 border-b border-cyan-900/50 mb-2">
                <p className="text-cyan-300 font-medium">{user?.name}</p>
                {user?.bio && <p className="text-xs text-gray-400 mt-1">{user.bio}</p>}
              </div>
              <Button 
                variant="destructive" 
                onClick={handleLogout}
                className="w-full justify-start text-red-400 hover:text-red-300 bg-transparent hover:bg-red-900/30"
              >
                Logout
              </Button>
            </div>
          )}
        </>
      ) : (
        <Button 
          onClick={handleLogin}
          variant="outline" 
          size="sm"
          className="bg-cyan-900/20 text-cyan-300 border-cyan-700 hover:bg-cyan-800/30"
        >
          Login with Replit
        </Button>
      )}
    </div>
  );
}