import { Request, Response, NextFunction } from 'express';
import { getUserInfo } from '@replit/repl-auth';

/**
 * Middleware to check if a user is authenticated
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const user = getUserInfo(req);
  
  if (!user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  // Add the user to the request object for later use
  req.user = user;
  next();
};

/**
 * Get the current authenticated user
 */
export const getCurrentUser = (req: Request) => {
  return getUserInfo(req);
};

/**
 * Get detailed information about the current user
 */
export const getUserDetails = (req: Request) => {
  try {
    const userInfo = getUserInfo(req);
    return userInfo;
  } catch (error) {
    console.error('Error getting user details:', error);
    return null;
  }
};

// Define UserInfo type from repl-auth
interface UserInfo {
  id?: string;
  name?: string;
  bio?: string;
  url?: string;
  profileImage?: string;
  roles?: string[];
  teams?: string[];
  [key: string]: unknown;
}

// User type that can be assigned to request.user
type RequestUser = {
  [key: string]: unknown;
} & {
  id?: string;
  name?: string;
  roles?: string[];
}

// Augment express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: UserInfo;
    }
  }
}