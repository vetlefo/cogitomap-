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
    const userInfo = getUserInfo(req);
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
 * Redirect to Replit login page
 */
export function loginHandler(req: Request, res: Response) {
  // Get the current URL to use as return URL after login
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const returnUrl = `${protocol}://${host}`;
  
  // Redirect to Replit login with return URL
  const loginUrl = `https://replit.com/auth_with_repl_site?domain=${encodeURIComponent(returnUrl)}`;
  res.redirect(loginUrl);
}

/**
 * Handle logout by clearing cookies and redirecting
 */
export function logoutHandler(req: Request, res: Response) {
  // In Replit Auth, we can't directly log out the user server-side
  // Instead, redirect to home page and let client handle the state
  res.redirect('/');
}