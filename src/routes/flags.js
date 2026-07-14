import express from 'express';
import protect from '../middleware/auth.js';
import { getFeatureFlags, getPublicFeatureFlags, updateFeatureFlag } from '../services/featureFlagService.js';

const router = express.Router();

router.get('/public', async (_req, res) => {
    try {
        const flags = await getPublicFeatureFlags();

        res.json({
            status: 'success',
            data: flags,
        });
    } catch (error) {
        console.error('Public flags error:', error);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

router.get('/', protect, async (_req, res) => {
    try {
        const flags = await getFeatureFlags();

        res.json({
            status: 'success',
            data: flags,
        });
    } catch (error) {
        console.error('Flags fetch error:', error);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

router.patch('/:key', protect, async (req, res) => {
    try {
        const { key } = req.params;
        const { enabled, label, description, category, route, target } = req.body;

        const updated = await updateFeatureFlag(key, {
            ...(typeof enabled === 'boolean' ? { enabled } : {}),
            ...(typeof label === 'string' ? { label } : {}),
            ...(typeof description === 'string' ? { description } : {}),
            ...(typeof category === 'string' ? { category } : {}),
            ...(typeof route === 'string' ? { route } : {}),
            ...(typeof target === 'string' ? { target } : {}),
        });

        if (!updated) {
            return res.status(404).json({ status: 'error', message: 'Feature flag not found' });
        }

        res.json({
            status: 'success',
            data: updated,
        });
    } catch (error) {
        console.error('Flag update error:', error);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

export default router;