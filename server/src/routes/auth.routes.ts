import { Router, Request, Response } from 'express';
import * as userService from '../services/user.service';
import { requireAuth } from '../middleware/auth';
import { requirePlanFeatures } from '../middleware/subscription';
import { registerSchema, loginSchema, googleAuthSchema } from './validation';
import { hasErrorMessage, getErrorMessage } from '../utils/errors';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const parse = registerSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        message: 'invalid payload',
        error: parse.error.flatten(),
      });
    }

    const user = await userService.registerUser(parse.data);

    // Store userId in session
    req.session.userId = user.id;

    return res.json({
      success: true,
      message: 'user created',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error: unknown) {
    if (hasErrorMessage(error, 'Username or email already exists')) {
      return res
        .status(409)
        .json({ success: false, message: getErrorMessage(error) });
    }
    logger.error('Registration error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'internal server error' });
  }
});

/**
 * POST /api/v1/auth/login
 * Login a user
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        message: 'invalid payload',
        error: parse.error.flatten(),
      });
    }

    const user = await userService.verifyUser(parse.data);

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: 'invalid credentials' });
    }

    // Store userId in session
    req.session.userId = user.id;

    return res.json({
      success: true,
      message: 'login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error: unknown) {
    logger.error('Login error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'internal server error' });
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout current user
 */
router.post('/logout', requireAuth, (req: Request, res: Response) => {
  try {
    req.session?.destroy((err) => {
      if (err) {
        logger.error('Logout error:', err);
        return res
          .status(500)
          .json({ success: false, message: 'internal server error' });
      }
      res.json({ success: true, message: 'logout successful' });
    });
  } catch (error: unknown) {
    logger.error('Logout error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'internal server error' });
  }
});

/**
 * POST /api/v1/auth/google
 * Login or register with Google OAuth
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const parse = googleAuthSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        message: 'invalid payload',
        error: parse.error.flatten(),
      });
    }

    const user = await userService.loginOrRegisterWithGoogle(
      parse.data.token,
      parse.data.timezone
    );

    // Store userId in session
    req.session.userId = user.id;

    // Explicitly save the session
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err)
          reject(err instanceof Error ? err : new Error(getErrorMessage(err)));
        else resolve();
      });
    });

    return res.json({
      success: true,
      message: 'login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error: unknown) {
    logger.error('Google auth error:', error);
    const errorMessage = getErrorMessage(error);

    // Handle specific error cases
    if (errorMessage.includes('GOOGLE_CLIENT_ID is not configured')) {
      return res.status(500).json({
        success: false,
        message:
          'Google OAuth not configured. Please set GOOGLE_CLIENT_ID in environment variables.',
      });
    }

    if (
      errorMessage.includes('Failed to verify Google token') ||
      errorMessage.includes('invalid google token') ||
      errorMessage.includes('Failed to fetch user info from Google')
    ) {
      return res.status(401).json({
        success: false,
        message: 'invalid google token',
        error: errorMessage,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'internal server error',
      error: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

/**
 * GET /api/v1/auth/me
 * Get current user info
 */
router.get(
  '/me',
  requireAuth,
  requirePlanFeatures,
  async (req: Request, res: Response) => {
    try {
      const user = await userService.getUserById(req.userId!);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: 'user not found' });
      }
      return res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          timezone: user.timezone,
        },
        features: req.planFeatures,
      });
    } catch (error: unknown) {
      logger.error('Get user error:', error);
      return res
        .status(500)
        .json({ success: false, message: 'internal server error' });
    }
  }
);

/**
 * TODO: We need to add this as optional in the frontend.
 * PUT /api/v1/auth/timezone
 * Update user timezone
 */
router.put('/timezone', requireAuth, async (req: Request, res: Response) => {
  try {
    const { timezone } = req.body as { timezone?: string };
    if (!timezone || typeof timezone !== 'string') {
      return res
        .status(400)
        .json({ success: false, message: 'timezone is required' });
    }

    const updated = await userService.updateUserTimezone(req.userId!, timezone);
    return res.json({
      success: true,
      message: 'timezone updated',
      user: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        timezone: updated.timezone,
      },
    });
  } catch (error: unknown) {
    logger.error('Update timezone error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'internal server error' });
  }
});

export default router;
