import { Router, Request, Response } from 'express';
import * as userService from '../services/user.service';
import { requireAuth } from '../middleware/auth';
import { registerSchema, loginSchema, googleAuthSchema } from './validation';

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
                error: parse.error.flatten()
            });
        }

        const user = await userService.registerUser(parse.data);

        // Store userId in session
        req.session!.userId = user.id;

        return res.json({
            success: true,
            message: 'user created',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
            },
        });
    } catch (error: any) {
        if (error.message === 'Username or email already exists') {
            return res.status(409).json({ success: false, message: error.message });
        }
        console.error('Registration error:', error);
        return res.status(500).json({ success: false, message: 'internal server error' });
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
                error: parse.error.flatten()
            });
        }

        const user = await userService.verifyUser(parse.data);

        if (!user) {
            return res.status(401).json({ success: false, message: 'invalid credentials' });
        }

        // Store userId in session
        req.session!.userId = user.id;

        return res.json({
            success: true,
            message: 'login successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
            },
        });
    } catch (error: any) {
        console.error('Login error:', error);
        return res.status(500).json({ success: false, message: 'internal server error' });
    }
});

/**
 * POST /api/v1/auth/logout
 * Logout current user
 */
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
    try {
        req.session?.destroy((err) => {
            if (err) {
                console.error('Logout error:', err);
                return res.status(500).json({ success: false, message: 'internal server error' });
            }
            res.json({ success: true, message: 'logout successful' });
        });
    } catch (error: any) {
        console.error('Logout error:', error);
        return res.status(500).json({ success: false, message: 'internal server error' });
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
                error: parse.error.flatten()
            });
        }

        const user = await userService.loginOrRegisterWithGoogle(parse.data.token);

        // Store userId in session
        req.session!.userId = user.id;

        // Explicitly save the session
        await new Promise<void>((resolve, reject) => {
            req.session!.save((err) => {
                if (err) reject(err);
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
    } catch (error: any) {
        console.error('Google auth error:', error);
        console.error('Error stack:', error.stack);

        // Handle specific error cases
        if (error.message?.includes('GOOGLE_CLIENT_ID is not configured')) {
            return res.status(500).json({
                success: false,
                message: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID in environment variables.'
            });
        }

        if (error.message?.includes('Failed to verify Google token') ||
            error.message?.includes('invalid google token') ||
            error.message?.includes('Failed to fetch user info from Google')) {
            return res.status(401).json({
                success: false,
                message: 'invalid google token',
                error: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: 'internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/v1/auth/me
 * Get current user info
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
    try {
        // User info is available from session
        return res.json({
            success: true,
            userId: req.userId,
        });
    } catch (error: any) {
        console.error('Get user error:', error);
        return res.status(500).json({ success: false, message: 'internal server error' });
    }
});

export default router;

