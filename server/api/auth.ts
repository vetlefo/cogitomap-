import { Request, Response } from 'express';
import { getUserInfo } from '@replit/repl-auth';
import { log } from '../vite';

/**
 * Get current user information
 */
export async function getCurrentUserHandler(req: Request, res: Response) {
  try {
    const userInfo = getUserInfo(req);
    
    if (!userInfo) {
      return res.status(200).json({ authenticated: false });
    }
    
    return res.status(200).json({
      authenticated: true,
      user: userInfo
    });
  } catch (error) {
    log(`Error in getCurrentUserHandler: ${error}`, 'auth');
    return res.status(500).json({ 
      authenticated: false,
      error: 'Failed to get user information' 
    });
  }
}

/**
 * Check if user is authenticated
 */
export async function checkAuthHandler(req: Request, res: Response) {
  try {
    // First try to get user from Replit Auth
    const userInfo = getUserInfo(req);
    
    // Check for simulated dev auth mode
    const devMode = req.query.devMode === 'true' || req.headers['x-dev-auth'] === 'true';
    
    if (devMode) {
      // For development: Return a mock user for easier testing
      return res.status(200).json({
        authenticated: true,
        user: {
          id: 'dev-user-123',
          name: 'Development User',
          profileImage: 'https://avatars.githubusercontent.com/u/983194',
          roles: ['user'],
          devMode: true
        },
        devMode: true
      });
    }
    
    return res.status(200).json({ 
      authenticated: !!userInfo,
      user: userInfo || null
    });
  } catch (error) {
    log(`Error in checkAuthHandler: ${error}`, 'auth');
    return res.status(500).json({ 
      authenticated: false,
      error: 'Failed to verify authentication' 
    });
  }
}

/**
 * For development purposes, simply set a mock user without redirect
 */
export function loginHandler(req: Request, res: Response) {
  // For development: Instead of redirecting to Replit auth, return a success
  // and we'll handle it on the client side with simulated authentication
  res.json({
    success: true,
    message: 'Development auth mode enabled',
    mockUser: {
      id: 'dev-user-123',
      name: 'Development User',
      profileImage: 'https://avatars.githubusercontent.com/u/983194',
      roles: ['user']
    }
  });
}

/**
 * Handle logout by clearing cookies and redirecting
 */
export function logoutHandler(req: Request, res: Response) {
  // In Replit Auth, we can't directly log out the user server-side
  // Instead, redirect to home page and let client handle the state
  res.redirect('/');
}