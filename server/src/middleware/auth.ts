import { Request, Response, NextFunction } from 'express';

// Extend Express Request to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      sessionId?: string;
    }
  }
}

/**
 * Middleware to require user authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ success: false, message: 'unauthorized' });
  }

  req.userId = req.session.userId;
  if (req.sessionID) {
    req.sessionId = req.sessionID;
  }
  next();
}

/**
 * Middleware for device authentication using bearer token
 */
export async function requireDeviceAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';

  if (!token) {
    return res.status(401).json({ success: false, message: 'unauthorized - no token provided' });
  }

  // Attach token to request for use in route handlers
  (req as any).deviceToken = token;
  next();
}

