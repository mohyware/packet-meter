import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /health
 * Server health check
 */
router.get('/', (_req: Request, res: Response) => {
    res.json({ ok: true });
});

export default router;

