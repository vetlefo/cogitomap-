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